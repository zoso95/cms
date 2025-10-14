import { supabase } from '../db';

/**
 * Build dynamic variables for ElevenLabs call
 *
 * ElevenLabs expects a flat map of simple values (strings, numbers, booleans)
 * Complex objects will cause the API to fail.
 *
 * We provide:
 * 1. Top-level simple fields for easy access in prompts
 * 2. A "context" field with stringified JSON containing all complex data
 */
export async function buildDynamicVariables(
  patientCaseId: number,
  workflowId: string
): Promise<Record<string, string | number | boolean>> {
  console.log(`[DynamicVariables] Building for patient case ${patientCaseId}`);

  // Fetch patient case
  const { data: patientCase, error: caseError } = await supabase
    .from('patient_cases')
    .select('*')
    .eq('id', patientCaseId)
    .single();

  if (caseError || !patientCase) {
    throw new Error(`Failed to fetch patient case: ${caseError?.message}`);
  }

  // Fetch communication logs
  const { data: communications, error: commsError } = await supabase
    .from('communication_logs')
    .select('*')
    .eq('patient_case_id', patientCaseId)
    .order('created_at', { ascending: false });

  if (commsError) {
    console.warn(`[DynamicVariables] Failed to fetch communications: ${commsError.message}`);
  }

  // Fetch providers
  const { data: providers, error: providersError } = await supabase
    .from('providers')
    .select('*')
    .eq('patient_case_id', patientCaseId)
    .order('created_at', { ascending: false });

  if (providersError) {
    console.warn(`[DynamicVariables] Failed to fetch providers: ${providersError.message}`);
  }

  // Fetch workflow execution
  const { data: workflowExecution, error: workflowError } = await supabase
    .from('workflow_executions')
    .select('*')
    .eq('workflow_id', workflowId)
    .single();

  if (workflowError) {
    console.warn(`[DynamicVariables] Failed to fetch workflow: ${workflowError.message}`);
  }

  // Fetch call transcripts (if any)
  const { data: transcripts, error: transcriptsError } = await supabase
    .from('call_transcripts')
    .select('*')
    .eq('patient_case_id', patientCaseId)
    .order('created_at', { ascending: false });

  if (transcriptsError) {
    console.warn(`[DynamicVariables] Failed to fetch transcripts: ${transcriptsError.message}`);
  }

  // Build flat variables for easy access
  const variables: Record<string, string | number | boolean> = {
    // Patient info
    patient_case_id: patientCaseId.toString(),
    patient_first_name: patientCase.first_name || '',
    patient_last_name: patientCase.last_name || '',
    patient_email: patientCase.email || '',
    patient_phone: patientCase.phone || '',
    patient_status: patientCase.status || '',

    // Workflow info
    workflow_id: workflowId,
    workflow_name: workflowExecution?.workflow_name || '',

    // Counts for quick reference
    total_communications: communications?.length || 0,
    total_providers: providers?.length || 0,
    total_transcripts: transcripts?.length || 0,

    // Previous outreach attempts
    sms_count: communications?.filter(c => c.type === 'sms').length || 0,
    call_count: communications?.filter(c => c.type === 'call').length || 0,
    email_count: communications?.filter(c => c.type === 'email').length || 0,
  };

  // Add provider info if available (first provider only for simplicity)
  if (providers && providers.length > 0) {
    const firstProvider = providers[0];
    variables.provider_name = firstProvider.name || '';
    variables.provider_method = firstProvider.method || '';
    variables.provider_contact = firstProvider.contact || '';
    variables.has_providers = true;
  } else {
    variables.has_providers = false;
  }

  // Build comprehensive context object
  const context = {
    patient_case: patientCase,
    communications: communications || [],
    providers: providers || [],
    transcripts: transcripts || [],
    workflow_execution: workflowExecution || null,
    metadata: {
      generated_at: new Date().toISOString(),
      workflow_id: workflowId,
      patient_case_id: patientCaseId,
    },
  };

  // Add stringified context
  variables.context = JSON.stringify(context);

  // Validate that all variables are primitive types (ElevenLabs requirement)
  for (const [key, value] of Object.entries(variables)) {
    const type = typeof value;
    if (type !== 'string' && type !== 'number' && type !== 'boolean') {
      throw new Error(
        `Invalid dynamic variable type: ${key} is ${type}, but ElevenLabs only accepts string, number, or boolean`
      );
    }
  }

  console.log(`[DynamicVariables] Built ${Object.keys(variables).length} variables (including context)`);
  console.log(`[DynamicVariables] Context size: ${variables.context.length} characters`);
  console.log(`[DynamicVariables] ✅ All variables are primitive types (safe for ElevenLabs)`);

  return variables;
}
