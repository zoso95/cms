import { supabase } from '../db';

export interface RegisterWorkflowParams {
  workflowId: string;
  workflowName: string;
  patientCaseId: number;
  parentWorkflowId?: string;
  entityType?: string;
  entityId?: string;
  parameters?: Record<string, any>;
}

/**
 * Registers a workflow execution in the database
 *
 * This should be called BEFORE starting a child workflow to ensure
 * it's tracked in the database from the moment it begins.
 *
 * @param params - Workflow registration parameters
 * @returns The created workflow execution record
 */
export async function registerWorkflow(params: RegisterWorkflowParams) {
  const {
    workflowId,
    workflowName,
    patientCaseId,
    parentWorkflowId,
    entityType,
    entityId,
    parameters,
  } = params;

  console.log(`[Registry] Registering workflow: ${workflowName} (${workflowId})`);
  if (parentWorkflowId) {
    console.log(`[Registry]   Parent: ${parentWorkflowId}`);
  }
  if (entityType && entityId) {
    console.log(`[Registry]   Entity: ${entityType}#${entityId}`);
  }

  const { data, error } = await supabase
    .from('workflow_executions')
    .insert({
      workflow_id: workflowId,
      workflow_name: workflowName,
      patient_case_id: patientCaseId,
      parent_workflow_id: parentWorkflowId,
      entity_type: entityType,
      entity_id: entityId,
      status: 'running',
      parameters: parameters || {},
      started_at: new Date().toISOString(),
      run_id: null, // Will be updated by Temporal monitor when available
    })
    .select()
    .single();

  if (error) {
    console.error(`[Registry] Failed to register workflow: ${error.message}`);
    throw error;
  }

  console.log(`[Registry] ✅ Registered workflow ${workflowId}`);
  return data;
}

/**
 * Updates a workflow execution status
 *
 * @param workflowId - The workflow ID to update
 * @param status - New status
 * @param result - Optional result data
 * @param error - Optional error message
 */
export async function updateWorkflowStatus(
  workflowId: string,
  status: 'completed' | 'failed' | 'cancelled' | 'running',
  result?: any,
  error?: string
) {
  console.log(`[Registry] Updating workflow ${workflowId} status: ${status}`);

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    updateData.completed_at = new Date().toISOString();
  }

  if (result) {
    updateData.result = result;
  }

  if (error) {
    updateData.error = error;
  }

  const { error: updateError } = await supabase
    .from('workflow_executions')
    .update(updateData)
    .eq('workflow_id', workflowId);

  if (updateError) {
    console.error(`[Registry] Failed to update workflow status: ${updateError.message}`);
    throw updateError;
  }

  console.log(`[Registry] ✅ Updated workflow ${workflowId}`);
}
