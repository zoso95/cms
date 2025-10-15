import { Context, ApplicationFailure } from '@temporalio/activity';
import { supabase } from './db';
import { v4 as uuidv4 } from 'uuid';
import twilio from 'twilio';
import nodemailer from 'nodemailer';
import { openphone } from './services/openphone';
import { elevenlabs } from './services/elevenlabs';
import { normalizePhoneNumber } from './utils/phone';
import { buildDynamicVariables } from './utils/dynamicVariables';
import { registerWorkflow, type RegisterWorkflowParams } from './utils/workflowRegistry';
import { claude } from './services/claude';
import { openSignService } from './services/opensign';
import { mailgunService } from './services/mailgun';
import { npiService } from './services/npi';
import { humbleFaxService } from './services/humblefax';

// Lazy-initialize Twilio client
let twilioClient: ReturnType<typeof twilio> | null = null;
function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID || 'mock',
      process.env.TWILIO_AUTH_TOKEN || 'mock'
    );
  }
  return twilioClient;
}

// Lazy-initialize email transporter
let emailTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function getEmailTransporter() {
  if (!emailTransporter) {
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || 'mock@example.com',
        pass: process.env.SMTP_PASS || 'mock',
      },
    });
  }
  return emailTransporter;
}

// Helper to get workflow execution ID from context
function getWorkflowExecutionId(): string {
  const info = Context.current().info;
  return `${info.workflowExecution.workflowId}`;
}

// Helper to log communication
async function logCommunication(
  patientCaseId: number,
  type: 'sms' | 'call' | 'email' | 'fax',
  direction: 'inbound' | 'outbound',
  status: string,
  content?: string,
  metadata?: Record<string, any>
) {
  const workflowExecutionId = await getWorkflowExecutionIdFromDb(patientCaseId);

  const { data, error } = await supabase
    .from('communication_logs')
    .insert({
      id: uuidv4(),
      patient_case_id: patientCaseId,
      workflow_execution_id: workflowExecutionId,
      type,
      direction,
      status,
      content,
      metadata,
    })
    .select()
    .single();

  if (error) throw error;
  return data.id;
}

async function getWorkflowExecutionIdFromDb(patientCaseId: number): Promise<string> {
  // Get the current workflow ID from the activity context
  const info = Context.current().info;
  const currentWorkflowId = info.workflowExecution.workflowId;

  // Look up the workflow execution by the current workflow ID
  const { data, error } = await supabase
    .from('workflow_executions')
    .select('id')
    .eq('workflow_id', currentWorkflowId)
    .single();

  if (error || !data) {
    console.error(`[Activity] Failed to find workflow execution for workflow_id: ${currentWorkflowId}`, error);
    throw new Error(`No workflow execution found for workflow ${currentWorkflowId}`);
  }

  return data.id;
}

// ============================================
// Workflow Registry Activities
// ============================================

/**
 * Register a child workflow in the database
 *
 * This should be called BEFORE starting a child workflow to ensure
 * it's tracked from the moment it begins.
 */
export async function registerChildWorkflow(params: RegisterWorkflowParams): Promise<void> {
  const info = Context.current().info;
  const parentWorkflowId = info.workflowExecution.workflowId;

  console.log(`[Activity] Registering child workflow: ${params.workflowName}`);
  console.log(`[Activity]   Parent workflow: ${parentWorkflowId}`);
  console.log(`[Activity]   Child workflow ID: ${params.workflowId}`);

  await registerWorkflow({
    ...params,
    parentWorkflowId,
  });
}

// ============================================
// SMS Activities
// ============================================

/**
 * Send SMS to patient
 * @returns OpenPhone message ID
 * @throws Error if SMS fails to send
 */
export async function sendSMS(patientCaseId: number, message: string): Promise<string> {
  console.log(`[Activity] Sending SMS to patient case ${patientCaseId}: ${message}`);

  // Get patient phone from database
  const { data: patientCase, error: caseError } = await supabase
    .from('patient_cases')
    .select('phone')
    .eq('id', patientCaseId)
    .single();

  if (caseError) throw caseError;
  if (!patientCase.phone) throw new Error('No phone number for patient case');

  // Normalize phone number to E.164 format for OpenPhone
  const normalizedPhone = normalizePhoneNumber(patientCase.phone);
  console.log(`[Activity] Normalized phone: ${patientCase.phone} → ${normalizedPhone}`);

  // Send via OpenPhone
  const messageId = await openphone.sendSMSToNumber(normalizedPhone, message);

  // Log to database
  await logCommunication(
    patientCaseId,
    'sms',
    'outbound',
    'sent',
    message,
    { openphone_message_id: messageId, phone: normalizedPhone, original_phone: patientCase.phone }
  );

  return messageId;
}

// ============================================
// Call Activities
// ============================================
export async function placeCall(patientCaseId: number): Promise<string> {
  console.log(`[Activity] Placing call to patient case ${patientCaseId}`);

  const { data: patientCase, error: caseError } = await supabase
    .from('patient_cases')
    .select('phone')
    .eq('id', patientCaseId)
    .single();

  if (caseError) throw caseError;
  if (!patientCase.phone) throw new Error('No phone number for patient case');

  // Get workflow execution context
  const info = Context.current().info;
  const workflowId = info.workflowExecution.workflowId;

  // Normalize phone number
  const normalizedPhone = normalizePhoneNumber(patientCase.phone);
  console.log(`[Activity] Normalized phone: ${patientCase.phone} → ${normalizedPhone}`);

  // Get agent ID from environment (you can make this configurable later)
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!agentId) {
    throw new Error('ELEVENLABS_AGENT_ID not configured');
  }

  // Build dynamic variables with patient context
  console.log(`[Activity] Building dynamic variables for patient case ${patientCaseId}...`);
  const dynamicVariables = await buildDynamicVariables(patientCaseId, workflowId);
  console.log(`[Activity] Built ${Object.keys(dynamicVariables).length} dynamic variables`);

  // Initiate call via ElevenLabs
  console.log(`[Activity] Initiating ElevenLabs call to ${normalizedPhone}...`);
  const callResult = await elevenlabs.makeCall({
    toNumber: normalizedPhone,
    agentId,
    dynamicVariables,
  });

  if (!callResult.success) {
    // Immediate failure (e.g., HTTP 400 - invalid number, account restrictions, etc.)
    // This means no conversation was created, so no webhook will arrive
    console.error(`[Activity] Call initiation failed immediately: ${callResult.error}`);

    // Store failed call record in database
    const callId = uuidv4();
    await supabase
      .from('elevenlabs_calls')
      .insert({
        id: callId,
        patient_case_id: patientCaseId,
        workflow_id: workflowId,
        conversation_id: null,
        call_sid: null,
        to_number: normalizedPhone,
        agent_id: agentId,
        status: 'failed',
        failure_reason: callResult.error,
        completed_at: new Date().toISOString(),
        talked_to_human: false,
      });

    // Log failed communication
    await logCommunication(
      patientCaseId,
      'call',
      'outbound',
      'failed',
      undefined,
      {
        phone: normalizedPhone,
        error: callResult.error,
        failure_type: 'immediate_api_failure',
      }
    );

    // Throw non-retryable error so Temporal doesn't retry this activity
    // (retrying would make additional call attempts!)
    throw ApplicationFailure.nonRetryable(
      `Call initiation failed: ${callResult.error}`,
      'CallInitiationError'
    );
  }

  console.log(`[Activity] Call initiated! conversation_id: ${callResult.conversationId}`);

  // Store call record in database
  const { error: insertError } = await supabase
    .from('elevenlabs_calls')
    .insert({
      id: uuidv4(),
      patient_case_id: patientCaseId,
      workflow_id: workflowId,
      conversation_id: callResult.conversationId,
      call_sid: callResult.callSid,
      to_number: normalizedPhone,
      agent_id: agentId,
      status: 'pending',
    });

  if (insertError) throw insertError;

  // Log communication
  await logCommunication(
    patientCaseId,
    'call',
    'outbound',
    'pending',  // Use 'pending' instead of 'initiated' to match DB constraint
    undefined,
    {
      conversation_id: callResult.conversationId,
      call_sid: callResult.callSid,
      phone: normalizedPhone,
    }
  );

  // Return conversation ID so workflow can wait for signal
  return callResult.conversationId!;
}

export async function checkCallStatus(conversationId: string): Promise<{
  completed: boolean;
  talkedToHuman?: boolean;
  failed?: boolean;
  failureReason?: string;
}> {
  console.log(`[Activity] Checking call status for conversation ${conversationId}`);

  // First check database (webhook may have already updated it)
  const { data: callRecord } = await supabase
    .from('elevenlabs_calls')
    .select('*')
    .eq('conversation_id', conversationId)
    .single();

  if (!callRecord) {
    throw new Error(`Call record not found for conversation ${conversationId}`);
  }

  if (callRecord.status === 'completed') {
    console.log(`[Activity] Call completed (from database)`, { conversationId, talkedToHuman: callRecord.talked_to_human });
    return {
      completed: true,
      talkedToHuman: callRecord.talked_to_human ?? false,
    };
  }

  if (callRecord.status === 'failed') {
    console.log(`[Activity] Call failed (from database)`, { conversationId, failureReason: callRecord.failure_reason });
    return {
      completed: true,
      failed: true,
      failureReason: callRecord.failure_reason || 'Unknown error',
    };
  }

  // Still pending in database - query ElevenLabs API directly (fallback)
  console.log(`[Activity] Call still pending in database, querying ElevenLabs API`, { conversationId });

  const apiStatus = await elevenlabs.getConversationStatus(conversationId);

  if (apiStatus.status === 'completed') {
    console.log(`[Activity] Call completed (from API)`, { conversationId, talkedToHuman: apiStatus.talkedToHuman });

    // Update database with API result
    await supabase
      .from('elevenlabs_calls')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        talked_to_human: apiStatus.talkedToHuman ?? false,
        transcript: apiStatus.transcript,
        analysis: apiStatus.analysis,
      })
      .eq('conversation_id', conversationId);

    return {
      completed: true,
      talkedToHuman: apiStatus.talkedToHuman ?? false,
    };
  }

  if (apiStatus.status === 'failed') {
    console.log(`[Activity] Call failed (from API)`, { conversationId, failureReason: apiStatus.failureReason });

    // Update database with API result
    await supabase
      .from('elevenlabs_calls')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        failure_reason: apiStatus.failureReason,
        talked_to_human: false,
      })
      .eq('conversation_id', conversationId);

    return {
      completed: true,
      failed: true,
      failureReason: apiStatus.failureReason || 'Unknown error',
    };
  }

  // Still pending even in API
  console.log(`[Activity] Call still pending`, { conversationId });
  return {
    completed: false,
  };
}

export async function scheduleCall(patientCaseId: number, message: string): Promise<void> {
  console.log(`[Activity] Scheduling callback for patient case ${patientCaseId}: ${message}`);

  // Update patient case status
  await supabase
    .from('patient_cases')
    .update({ status: 'contacted' })
    .eq('id', patientCaseId);

  // Log the scheduling
  await logCommunication(
    patientCaseId,
    'call',
    'inbound',
    'received',
    `Patient requested callback: ${message}`
  );
}

export async function collectTranscript(patientCaseId: number): Promise<string> {
  console.log(`[Activity] Collecting transcript for patient case ${patientCaseId}`);

  const workflowExecutionId = await getWorkflowExecutionIdFromDb(patientCaseId);

  // Get the most recent completed call from ElevenLabs
  const { data: call, error: callError } = await supabase
    .from('elevenlabs_calls')
    .select('*')
    .eq('patient_case_id', patientCaseId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (callError) {
    console.error(`[Activity] Error fetching call: ${callError.message}`);
    throw callError;
  }

  if (!call) {
    console.error(`[Activity] No completed call found for patient case ${patientCaseId}`);
    throw new Error(`No completed call found for patient case ${patientCaseId}`);
  }

  if (!call.transcript_text) {
    console.error(`[Activity] Call ${call.id} has no transcript text`);
    throw new Error(`Call ${call.id} has no transcript text`);
  }

  console.log(`[Activity] Found transcript for call ${call.id}, length: ${call.transcript_text.length} chars`);

  // Get the most recent call communication log
  const { data: callLog } = await supabase
    .from('communication_logs')
    .select('id')
    .eq('patient_case_id', patientCaseId)
    .eq('type', 'call')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Store transcript in call_transcripts table
  await supabase
    .from('call_transcripts')
    .insert({
      id: uuidv4(),
      patient_case_id: patientCaseId,
      workflow_execution_id: workflowExecutionId,
      communication_log_id: callLog?.id,
      transcript: call.transcript_text,
      analysis: call.analysis || {},
    });

  console.log(`[Activity] Stored transcript in call_transcripts table`);

  return call.transcript_text;
}

// ============================================
// Analysis Activities
// ============================================
export async function analyzeTranscript(
  patientCaseId: number,
  transcript: string
): Promise<Record<string, any>> {
  console.log(`[Activity] Analyzing transcript with Claude AI for patient case ${patientCaseId}`);

  // Get existing variables from ElevenLabs call if available
  const { data: call } = await supabase
    .from('elevenlabs_calls')
    .select('variables_collected')
    .eq('patient_case_id', patientCaseId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingVariables = call?.variables_collected || {};
  console.log(`[Activity] Found ${Object.keys(existingVariables).length} existing variables from call`);

  // Analyze case merits with Claude
  const analysis = await claude.analyzeCaseMerits(transcript, existingVariables);
  console.log(`[Activity] Case analysis complete - Quality score: ${analysis.qualityScore}`);

  // Store analysis in case_analysis table
  const workflowExecutionId = await getWorkflowExecutionIdFromDb(patientCaseId);

  // Get the call transcript ID we just created
  const { data: callTranscript } = await supabase
    .from('call_transcripts')
    .select('id')
    .eq('patient_case_id', patientCaseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase
    .from('claude_case_analysis')
    .upsert({
      patient_case_id: patientCaseId,
      workflow_execution_id: workflowExecutionId,
      call_transcript_id: callTranscript?.id,
      quality_score: analysis.qualityScore,
      summary: analysis.summary,
      medical_subject: analysis.medicalSubject,
      patient_info: analysis.patientInfo,
      doctor_info_quality: analysis.doctorInfoQuality,
      core_scales: analysis.coreScales,
      case_factors: analysis.caseFactors,
      legal_practical_factors: analysis.legalPracticalFactors,
      call_quality_assessment: analysis.callQualityAssessment,
      next_actions: analysis.nextActions,
      compliance_notes: analysis.complianceNotes,
      overall_case_assessment: analysis.overallCaseAssessment,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'patient_case_id',
    });

  console.log(`[Activity] Case analysis stored in database`);

  return analysis;
}

export async function extractProviders(
  patientCaseId: number,
  transcript: string
): Promise<Array<{ id: string; fullName: string }>> {
  console.log(`[Activity] Extracting providers from transcript with Claude AI`);

  const providers = await claude.extractProviders(transcript);
  console.log(`[Activity] Extracted ${providers.length} providers`);

  // Get workflow execution ID for database records
  const workflowExecutionId = await getWorkflowExecutionIdFromDb(patientCaseId);

  // Save providers to database with all extracted fields and return IDs
  const savedProviders: Array<{ id: string; fullName: string }> = [];

  if (providers.length > 0) {
    const providerRecords = providers.map((provider) => {
      const id = uuidv4();
      const fullName = provider.fullName || `${provider.firstName || ''} ${provider.lastName || ''}`.trim();

      savedProviders.push({ id, fullName });

      return {
        id,
        patient_case_id: patientCaseId,
        workflow_execution_id: workflowExecutionId,
        // Legacy fields
        name: fullName,
        specialty: provider.specialty,
        contact_method: provider.faxNumber ? 'fax' : provider.phoneNumber ? 'phone' : null,
        contact_info: provider.faxNumber || provider.phoneNumber || null,
        verified: false,
        records_received: false,
        // New comprehensive fields from Claude
        first_name: provider.firstName,
        last_name: provider.lastName,
        full_name: fullName,
        provider_type: provider.providerType,
        organization: provider.organization,
        city: provider.city,
        state: provider.state,
        address: provider.address,
        phone_number: provider.phoneNumber,
        fax_number: provider.faxNumber,
        npi: provider.npi,
        role: provider.role,
        context_in_case: provider.contextInCase,
      };
    });

    const { error: insertError } = await supabase
      .from('providers')
      .insert(providerRecords);

    if (insertError) {
      console.error(`[Activity] Error inserting providers:`, insertError);
      throw insertError;
    }

    console.log(`[Activity] Saved ${providers.length} providers to database with full details`);
  }

  // Return provider IDs and names for the workflow to use
  return savedProviders;
}

/**
 * Get all verified providers for a patient case
 * @param patientCaseId - Patient case ID
 * @returns Array of verified providers
 */
export async function getVerifiedProviders(patientCaseId: number): Promise<any[]> {
  console.log(`[Activity] Getting verified providers for patient case ${patientCaseId}`);

  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('patient_case_id', patientCaseId)
    .eq('verified', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(`[Activity] Error fetching verified providers:`, error);
    throw error;
  }

  console.log(`[Activity] Found ${data?.length || 0} verified providers`);
  return data || [];
}

/**
 * Get a single provider by ID
 * @param providerId - Provider ID
 * @returns Provider object or null if not found
 */
export async function getVerifiedProvider(providerId: string): Promise<any | null> {
  console.log(`[Activity] Getting provider ${providerId}`);

  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('id', providerId)
    .maybeSingle();

  if (error) {
    console.error(`[Activity] Error fetching provider:`, error);
    throw error;
  }

  return data;
}

// ============================================
// E-Signature Activities (OpenSign)
// ============================================

/**
 * Create a signature request via OpenSign
 * @param patientCaseId - Patient case ID
 * @param signerEmail - Email of the person who needs to sign
 * @param signerName - Name of the person who needs to sign
 * @param documentTitle - Title/description of the document
 * @param templateId - Optional OpenSign template ID (uses first available if not specified)
 * @returns Document ID for tracking
 */
export async function createSignatureRequest(
  patientCaseId: number,
  signerEmail: string,
  signerName: string,
  documentTitle: string,
  templateId?: string
): Promise<string> {
  console.log(`[Activity] Creating signature request for ${signerName} (${signerEmail})`);
  console.log(`[Activity]   Document: ${documentTitle}`);

  const result = await openSignService.createSignatureRequest({
    signerEmail,
    signerName,
    documentTitle,
    templateId,
    metadata: {
      patientCaseId,
      createdBy: 'workflow'
    }
  });

  if (!result.success) {
    throw new Error(`Failed to create signature request: ${result.error}`);
  }

  console.log(`[Activity] Signature request created! Document ID: ${result.requestId}`);
  console.log(`[Activity]   Signing URL: ${result.signingUrl}`);

  // Log to communication logs
  await logCommunication(
    patientCaseId,
    'email',
    'outbound',
    'sent',
    `Signature request sent: ${documentTitle}`,
    {
      document_id: result.requestId,
      signing_url: result.signingUrl,
      signer_email: signerEmail,
      signer_name: signerName
    }
  );

  return result.requestId!;
}

/**
 * Check signature status (single poll)
 * @param documentId - OpenSign document ID
 * @returns Status information
 */
export async function checkSignatureStatus(documentId: string): Promise<{
  status: 'pending' | 'signed' | 'declined' | 'expired';
  signedAt?: string;
  signedDocumentUrl?: string;
}> {
  console.log(`[Activity] Checking signature status for document ${documentId}`);

  const status = await openSignService.getSignatureStatus(documentId);

  if (!status) {
    throw new Error(`Failed to get signature status for document ${documentId}`);
  }

  console.log(`[Activity] Document ${documentId} status: ${status.status}`);

  return {
    status: status.status,
    signedAt: status.signedAt,
    signedDocumentUrl: status.signedDocumentUrl
  };
}

/**
 * Check signature status and log completion/failure
 * This is meant to be called in a polling loop from the workflow
 * @param documentId - OpenSign document ID
 * @param patientCaseId - Patient case ID for logging
 * @returns Object with done flag and signed flag
 */
export async function waitForSignature(
  documentId: string,
  patientCaseId: number
): Promise<{ done: boolean; signed: boolean }> {
  console.log(`[Activity] Checking signature status for document ${documentId}`);

  const status = await openSignService.getSignatureStatus(documentId);

  if (!status) {
    throw new Error(`Failed to get signature status for document ${documentId}`);
  }

  if (status.status === 'signed') {
    console.log(`[Activity] ✅ Document ${documentId} has been signed!`);

    // Log completion
    await logCommunication(
      patientCaseId,
      'email',
      'inbound',
      'received',
      `Document signed`,
      {
        document_id: documentId,
        signed_at: status.signedAt,
        signed_document_url: status.signedDocumentUrl
      }
    );

    return { done: true, signed: true };
  }

  if (status.status === 'declined') {
    console.log(`[Activity] ❌ Document ${documentId} was declined`);

    // Log decline
    await logCommunication(
      patientCaseId,
      'email',
      'inbound',
      'failed',
      `Document declined`,
      {
        document_id: documentId
      }
    );

    return { done: true, signed: false };
  }

  if (status.status === 'expired') {
    console.log(`[Activity] ⏱️ Document ${documentId} has expired`);

    // Log expiration
    await logCommunication(
      patientCaseId,
      'email',
      'outbound',
      'failed',
      `Document expired`,
      {
        document_id: documentId
      }
    );

    return { done: true, signed: false };
  }

  // Still pending - workflow will continue polling
  console.log(`[Activity] ⏳ Document ${documentId} is still pending`);
  return { done: false, signed: false };
}

/**
 * Download signed document PDF
 * @param documentId - OpenSign document ID
 * @returns PDF buffer
 */
export async function downloadSignedDocument(documentId: string): Promise<Buffer> {
  console.log(`[Activity] Downloading signed document ${documentId}`);

  const pdfBuffer = await openSignService.downloadSignedDocument(documentId);

  if (!pdfBuffer) {
    throw new Error(`Failed to download signed document ${documentId}`);
  }

  console.log(`[Activity] Downloaded signed document ${documentId}, size: ${pdfBuffer.length} bytes`);

  return pdfBuffer;
}

// ============================================
// Records Request Activities
// ============================================

/**
 * Create a medical records release authorization request
 * This creates a signature request for the patient to sign their medical records release form
 * @param patientCaseId - Patient case ID
 * @param providerName - Name of the provider whose records are being requested
 * @returns Document ID for tracking
 */
export async function createRecordsRequest(
  patientCaseId: number,
  providerName: string
): Promise<string> {
  console.log(`[Activity] Creating records request for ${providerName}`);

  // Get patient information from database
  const { data: patientCase, error: caseError } = await supabase
    .from('patient_cases')
    .select('email, first_name, last_name')
    .eq('id', patientCaseId)
    .single();

  if (caseError) throw caseError;
  if (!patientCase.email) throw new Error('No email address for patient case');

  const patientName = `${patientCase.first_name || ''} ${patientCase.last_name || ''}`.trim() || 'Patient';
  const signerEmail = patientCase.email;

  // Try to get provider details from database (organization, full name, etc.)
  let providerOrganization: string | undefined;
  const { data: provider } = await supabase
    .from('providers')
    .select('organization, full_name, first_name, last_name')
    .eq('patient_case_id', patientCaseId)
    .or(`name.eq.${providerName},full_name.eq.${providerName}`)
    .maybeSingle();

  if (provider) {
    providerOrganization = provider.organization || undefined;
    // Use full_name if available, otherwise use what was passed
    const fullProviderName = provider.full_name ||
                             `${provider.first_name || ''} ${provider.last_name || ''}`.trim();
    if (fullProviderName) {
      providerName = fullProviderName;
    }
    console.log(`[Activity] Found provider details: ${providerName}${providerOrganization ? ` at ${providerOrganization}` : ''}`);
  }

  // Create signature request via OpenSign
  const documentTitle = `Medical Records Release Authorization - ${providerName}`;

  const result = await openSignService.createSignatureRequest({
    signerEmail,
    signerName: patientName,
    documentTitle,
    providerName,
    providerOrganization,
    metadata: {
      patientCaseId,
      providerName,
      providerOrganization,
      createdBy: 'records-retrieval-workflow'
    }
  });

  if (!result.success) {
    throw new Error(`Failed to create records request: ${result.error}`);
  }

  console.log(`[Activity] Records request created! Document ID: ${result.requestId}`);
  console.log(`[Activity]   Provider: ${providerName}`);
  console.log(`[Activity]   Patient: ${patientName} (${signerEmail})`);

  // Log to communication logs
  await logCommunication(
    patientCaseId,
    'email',
    'outbound',
    'sent',
    `Records release authorization sent for ${providerName}`,
    {
      document_id: result.requestId,
      signing_url: result.signingUrl,
      provider_name: providerName,
      signer_email: signerEmail,
      signer_name: patientName
    }
  );

  return result.requestId!;
}

export async function findDoctorOffice(
  patientCaseId: number,
  providerName: string
): Promise<{
  name: string;
  method: 'email' | 'fax';
  contact: string;
  verificationRequired?: boolean;
  verificationId?: string;
}> {
  console.log(`[Activity] Finding contact info for provider: ${providerName}`);

  // Get provider details from database
  const { data: provider } = await supabase
    .from('providers')
    .select('*')
    .eq('patient_case_id', patientCaseId)
    .or(`name.eq.${providerName},full_name.eq.${providerName}`)
    .maybeSingle();

  if (!provider) {
    console.log(`[Activity] Provider ${providerName} not found in database`);
    throw new Error(`Provider ${providerName} not found`);
  }

  // Check if we already have verified contact info
  if (provider.verified && (provider.fax_number || provider.contact_info)) {
    console.log(`[Activity] Using verified contact info for ${providerName}`);
    return {
      name: provider.full_name || provider.name,
      method: provider.fax_number ? 'fax' : 'email',
      contact: provider.fax_number || provider.contact_info || 'records@example.com'
    };
  }

  // Perform NPI lookup
  console.log(`[Activity] Performing NPI lookup for ${providerName}`);
  const npiResult = await npiService.searchProvider({
    firstName: provider.first_name,
    lastName: provider.last_name,
    organization: provider.organization,
    city: provider.city,
    state: provider.state
  });

  // Create verification request
  const verificationId = uuidv4();
  const workflowExecutionId = await getWorkflowExecutionIdFromDb(patientCaseId);

  // Get call transcript ID if available
  const { data: callTranscript } = await supabase
    .from('call_transcripts')
    .select('id')
    .eq('patient_case_id', patientCaseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  await supabase.from('provider_verifications').insert({
    id: verificationId,
    patient_case_id: patientCaseId,
    provider_id: provider.id,
    workflow_execution_id: workflowExecutionId,
    call_transcript_id: callTranscript?.id,
    extracted_provider_info: {
      first_name: provider.first_name,
      last_name: provider.last_name,
      full_name: provider.full_name || provider.name,
      organization: provider.organization,
      city: provider.city,
      state: provider.state,
      specialty: provider.specialty,
      context_in_case: provider.context_in_case
    },
    npi_lookup_results: npiResult.success ? {
      provider: npiResult.provider,
      candidates: npiResult.candidates
    } : null,
    status: 'pending'
  });

  console.log(`[Activity] Created verification request ${verificationId}`);

  // If NPI found a result with fax, use it (but still require verification)
  if (npiResult.success && npiResult.provider?.faxNumber) {
    console.log(`[Activity] NPI found fax number: ${npiResult.provider.faxNumber}`);
    return {
      name: providerName,
      method: 'fax',
      contact: npiResult.provider.faxNumber,
      verificationRequired: true,
      verificationId
    };
  }

  // No fax found - need manual verification
  console.log(`[Activity] No fax number found - manual verification required`);
  return {
    name: providerName,
    method: 'fax', // Default to fax, will be updated after verification
    contact: '', // Will be filled in after verification
    verificationRequired: true,
    verificationId
  };
}

export async function sendFax(
  patientCaseId: number,
  contact: { name: string; contact: string },
  requestId: string
): Promise<string> {
  console.log(`[Activity] Sending fax to ${contact.name} at ${contact.contact}`);

  // Get patient case information to construct reply-to email
  const { data: patientCase, error: caseError } = await supabase
    .from('patient_cases')
    .select('first_name, last_name, email')
    .eq('id', patientCaseId)
    .single();

  if (caseError) throw caseError;

  // Construct reply-to email: records+{firstname}.{lastname}@havencresthealth.com
  const firstName = (patientCase.first_name || '').toLowerCase().replace(/\s+/g, '');
  const lastName = (patientCase.last_name || '').toLowerCase().replace(/\s+/g, '');
  const replyToEmail = `records+${firstName}.${lastName}@havencresthealth.com`;

  console.log(`[Activity] Reply-to email: ${replyToEmail}`);

  // Download signed authorization document
  console.log(`[Activity] Downloading signed authorization document ${requestId}`);
  const pdfBuffer = await openSignService.downloadSignedDocument(requestId);

  if (!pdfBuffer) {
    throw new Error(`Failed to download signed document ${requestId}`);
  }

  console.log(`[Activity] Downloaded authorization document, size: ${pdfBuffer.length} bytes`);

  // Construct coversheet message with reply instructions
  const coversheetMessage = `
Medical Records Request

Patient: ${patientCase.first_name} ${patientCase.last_name}

Please send the requested medical records to:
${replyToEmail}

Or reply via fax to the number shown on this coversheet.

Attached is the signed patient authorization form.

Thank you,
Havencrest Health
  `.trim();

  // Send fax via HumbleFax
  const result = await humbleFaxService.sendFax({
    recipients: [contact.contact],
    files: [{
      filename: `authorization-${requestId}.pdf`,
      data: pdfBuffer
    }],
    includeCoversheet: true,
    subject: `Medical Records Request - ${patientCase.first_name} ${patientCase.last_name}`,
    message: coversheetMessage
  });

  if (!result.success) {
    throw new Error(`Failed to send fax: ${result.error}`);
  }

  console.log(`[Activity] Fax sent successfully! Fax ID: ${result.faxId}`);

  // Log to communication logs
  await logCommunication(
    patientCaseId,
    'fax',
    'outbound',
    'sent',
    `Fax sent to ${contact.name} with medical records authorization`,
    {
      fax_id: result.faxId,
      fax_number: contact.contact,
      provider_name: contact.name,
      authorization_document_id: requestId,
      reply_to_email: replyToEmail
    }
  );

  return result.faxId!;
}

export async function sendRecordsEmail(
  patientCaseId: number,
  contact: { name: string; contact: string },
  requestId: string
): Promise<string> {
  console.log(`[Activity] Sending records request email to ${contact.name} at ${contact.contact}`);

  // Get patient case information to construct reply-to email
  const { data: patientCase, error: caseError } = await supabase
    .from('patient_cases')
    .select('first_name, last_name, email')
    .eq('id', patientCaseId)
    .single();

  if (caseError) throw caseError;

  // Construct reply-to email: records+{firstname}.{lastname}@havencresthealth.com
  const firstName = (patientCase.first_name || '').toLowerCase().replace(/\s+/g, '');
  const lastName = (patientCase.last_name || '').toLowerCase().replace(/\s+/g, '');
  const replyToEmail = `records+${firstName}.${lastName}@havencresthealth.com`;

  console.log(`[Activity] Reply-to email: ${replyToEmail}`);

  // Download signed authorization document
  console.log(`[Activity] Downloading signed authorization document ${requestId}`);
  const pdfBuffer = await openSignService.downloadSignedDocument(requestId);

  if (!pdfBuffer) {
    throw new Error(`Failed to download signed document ${requestId}`);
  }

  console.log(`[Activity] Downloaded authorization document, size: ${pdfBuffer.length} bytes`);

  // Construct email body
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">Medical Records Request</h2>

      <p>Dear ${contact.name},</p>

      <p>We are writing on behalf of our client, <strong>${patientCase.first_name} ${patientCase.last_name}</strong>, to request a copy of their medical records.</p>

      <p>Attached to this email is a signed patient authorization form permitting the release of these records.</p>

      <h3 style="color: #333; margin-top: 20px;">How to Send Records:</h3>
      <p>Please send the medical records to: <strong>${replyToEmail}</strong></p>

      <p>Alternatively, you can reply directly to this email with the records attached.</p>

      <p>If you have any questions or need additional information, please don't hesitate to contact us by replying to this email.</p>

      <p>Thank you for your assistance.</p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

      <p style="color: #666; font-size: 12px;">
        Sincerely,<br>
        Havencrest Health<br>
        <a href="mailto:${replyToEmail}">${replyToEmail}</a>
      </p>
    </div>
  `;

  const textBody = `
Medical Records Request

Dear ${contact.name},

We are writing on behalf of our client, ${patientCase.first_name} ${patientCase.last_name}, to request a copy of their medical records.

Attached to this email is a signed patient authorization form permitting the release of these records.

HOW TO SEND RECORDS:
Please send the medical records to: ${replyToEmail}

Alternatively, you can reply directly to this email with the records attached.

If you have any questions or need additional information, please don't hesitate to contact us.

Thank you for your assistance.

Sincerely,
Havencrest Health
${replyToEmail}
  `.trim();

  // Send email via Mailgun
  const result = await mailgunService.sendEmail({
    to: contact.contact,
    subject: `Medical Records Request - ${patientCase.first_name} ${patientCase.last_name}`,
    html: htmlBody,
    text: textBody,
    replyTo: replyToEmail,
    tags: ['medical-records', 'records-request'],
    metadata: {
      patientCaseId,
      requestId,
      providerName: contact.name,
      replyToEmail
    },
    attachments: [{
      filename: `authorization-${patientCase.first_name}-${patientCase.last_name}.pdf`,
      data: pdfBuffer,
      contentType: 'application/pdf'
    }]
  });

  if (!result.success) {
    throw new Error(`Failed to send email: ${result.error}`);
  }

  console.log(`[Activity] Email sent successfully! Message ID: ${result.messageId}`);

  // Log to communication logs
  await logCommunication(
    patientCaseId,
    'email',
    'outbound',
    'sent',
    `Email sent to ${contact.name} with medical records authorization`,
    {
      message_id: result.messageId,
      email_address: contact.contact,
      provider_name: contact.name,
      authorization_document_id: requestId,
      reply_to_email: replyToEmail
    }
  );

  return result.messageId!;
}

export async function waitForRecords(providerName: string): Promise<void> {
  console.log(`[Activity] Waiting for records from ${providerName}`);

  // This would be triggered by a webhook or polling in production
  await new Promise(resolve => setTimeout(resolve, 100));
}

export async function ingestRecords(providerName: string): Promise<void> {
  console.log(`[Activity] Ingesting records from ${providerName}`);

  // In a real implementation, process and store the records
  await new Promise(resolve => setTimeout(resolve, 100));
}

export async function downstreamAnalysis(patientCaseId: number): Promise<void> {
  console.log(`[Activity] Running downstream analysis for patient case ${patientCaseId}`);

  /*
  // Update patient case status to completed
  await supabase
    .from('patient_cases')
    .update({ status: 'completed' })
    .eq('id', patientCaseId);
  */

  // In a real implementation, trigger downstream workflows
  await new Promise(resolve => setTimeout(resolve, 100));
}

export async function logFailure(patientCaseId: number, reason: string): Promise<void> {
  console.log(`[Activity] Logging failure for patient case ${patientCaseId}: ${reason}`);

  /*
  await supabase
    .from('patient_cases')
    .update({ status: 'failed' })
    .eq('id', patientCaseId);
  */

  const workflowExecutionId = await getWorkflowExecutionIdFromDb(patientCaseId);

  await supabase
    .from('workflow_executions')
    .update({
      status: 'failed',
      error: reason,
      completed_at: new Date().toISOString()
    })
    .eq('id', workflowExecutionId);
}

// ============================================
// Task Management Activities
// ============================================

/**
 * Initialize default tasks for a patient case
 * Creates 7 default tasks if they don't already exist
 */
export async function initializeDefaultTasks(patientCaseId: number): Promise<string[]> {
  console.log(`[Activity] Initializing default tasks for patient case ${patientCaseId}`);

  const defaultTasks = [
    { task_name: 'Intake Call', assigned_to: 'AI', sort_order: 1 },
    { task_name: 'Case Evaluation', assigned_to: 'AI', sort_order: 2 },
    { task_name: 'Extract Providers', assigned_to: 'AI', sort_order: 3 },
    { task_name: 'Follow up call (pitch advocacy)', assigned_to: 'Ben', sort_order: 4 },
    { task_name: 'Verify Providers', assigned_to: 'Ben', sort_order: 5 },
    { task_name: 'Gather Releases', assigned_to: 'AI', sort_order: 6 },
    { task_name: 'Send Out Records Requests', assigned_to: 'AI', sort_order: 7 },
    { task_name: 'Follow up on Records Requests', assigned_to: 'Ben', sort_order: 7 },
  ];

  const taskIds: string[] = [];

  for (const task of defaultTasks) {
    const taskId = uuidv4();
    taskIds.push(taskId);

    // Use upsert to avoid duplicates
    const { error } = await supabase
      .from('case_tasks')
      .upsert({
        id: taskId,
        patient_case_id: patientCaseId,
        task_name: task.task_name,
        assigned_to: task.assigned_to,
        status: 'not_started',
        sort_order: task.sort_order,
      }, {
        onConflict: 'patient_case_id,task_name',
        ignoreDuplicates: true,
      });

    if (error) {
      console.error(`[Activity] Error creating task "${task.task_name}":`, error);
    }
  }

  console.log(`[Activity] Initialized ${defaultTasks.length} default tasks`);
  return taskIds;
}

/**
 * Update task status for a patient case
 * @param patientCaseId - Patient case ID
 * @param taskName - Name of the task to update
 * @param status - New status
 * @param notes - Optional notes to add
 */
export async function updateTaskStatus(
  patientCaseId: number,
  taskName: string,
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'failed',
  notes?: string
): Promise<void> {
  console.log(`[Activity] Updating task "${taskName}" to "${status}" for patient case ${patientCaseId}`);

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (notes !== undefined) {
    updateData.notes = notes;
  }

  const { error } = await supabase
    .from('case_tasks')
    .update(updateData)
    .eq('patient_case_id', patientCaseId)
    .eq('task_name', taskName);

  if (error) {
    console.error(`[Activity] Error updating task "${taskName}":`, error);
    throw error;
  }

  console.log(`[Activity] Task "${taskName}" updated successfully`);
}

/**
 * Get task by name for a patient case
 * @param patientCaseId - Patient case ID
 * @param taskName - Name of the task to retrieve
 * @returns Task object or null if not found
 */
export async function getTaskByName(
  patientCaseId: number,
  taskName: string
): Promise<{
  id: string;
  status: string;
  notes: string | null;
  assigned_to: string;
} | null> {
  console.log(`[Activity] Getting task "${taskName}" for patient case ${patientCaseId}`);

  const { data, error } = await supabase
    .from('case_tasks')
    .select('id, status, notes, assigned_to')
    .eq('patient_case_id', patientCaseId)
    .eq('task_name', taskName)
    .maybeSingle();

  if (error) {
    console.error(`[Activity] Error fetching task "${taskName}":`, error);
    throw error;
  }

  return data;
}

// ============================================
// Status Update Activities
// ============================================

/**
 * Mark workflow as running (used when scheduled workflows begin execution)
 */
export async function markWorkflowAsRunning(): Promise<void> {
  const info = Context.current().info;
  const workflowId = info.workflowExecution.workflowId;

  console.log(`[Activity] Marking workflow as running: ${workflowId}`);

  // Update status to running if it was scheduled
  await supabase
    .from('workflow_executions')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .eq('workflow_id', workflowId)
    .eq('status', 'scheduled');
}

export async function updateWorkflowStatus(statusMessage: string): Promise<void> {
  const info = Context.current().info;
  const workflowId = info.workflowExecution.workflowId;

  console.log(`[Activity] Updating workflow status: ${workflowId} -> ${statusMessage}`);

  await supabase
    .from('workflow_executions')
    .update({
      status_message: statusMessage,
    })
    .eq('workflow_id', workflowId);
}
