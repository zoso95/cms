import { Context, ApplicationFailure } from '@temporalio/activity';
import { supabase } from './db';
import { v4 as uuidv4 } from 'uuid';
import twilio from 'twilio';
import nodemailer from 'nodemailer';
import { openphone } from './services/openphone';
import { elevenlabs } from './services/elevenlabs';
import { normalizePhoneNumber } from './utils/phone';
import { buildDynamicVariables } from './utils/dynamicVariables';

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
  const { data, error } = await supabase
    .from('workflow_executions')
    .select('id')
    .eq('patient_case_id', patientCaseId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) throw new Error('No running workflow found for patient case');
  return data.id;
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

  // In a real implementation, this would fetch from Twilio or a recording service
  // For now, we'll simulate it
  const mockTranscript = `Patient discussed their medical records request. They mentioned seeing Dr. Smith at Memorial Hospital and Dr. Johnson at City Clinic for their recent treatments.`;

  const workflowExecutionId = await getWorkflowExecutionIdFromDb(patientCaseId);

  // Get the most recent call communication log
  const { data: callLog } = await supabase
    .from('communication_logs')
    .select('id')
    .eq('patient_case_id', patientCaseId)
    .eq('type', 'call')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Store transcript
  await supabase
    .from('call_transcripts')
    .insert({
      id: uuidv4(),
      patient_case_id: patientCaseId,
      workflow_execution_id: workflowExecutionId,
      communication_log_id: callLog?.id || uuidv4(),
      transcript: mockTranscript,
    });

  return mockTranscript;
}

// ============================================
// Analysis Activities
// ============================================
export async function analyzeTranscript(transcript: string): Promise<Record<string, any>> {
  console.log(`[Activity] Analyzing transcript`);

  // In a real implementation, this would use AI/NLP
  // For now, we'll return mock analysis
  const analysis = {
    intent: 'medical_records_request',
    providers_mentioned: ['Dr. Smith at Memorial Hospital', 'Dr. Johnson at City Clinic'],
    urgency: 'medium',
    sentiment: 'positive',
  };

  return analysis;
}

export async function extractProviders(analysis: Record<string, any>): Promise<string[]> {
  console.log(`[Activity] Extracting providers from analysis`);

  return analysis.providers_mentioned || [];
}

// ============================================
// Records Request Activities
// ============================================
export async function createRecordsRequest(providerName: string): Promise<string> {
  console.log(`[Activity] Creating records request for provider: ${providerName}`);

  // This would typically get leadId from context, for now we'll need to pass it
  // In a real implementation, we'd store the leadId in the activity context
  const requestId = uuidv4();

  // For now, return the request ID
  // In a real implementation, this would create a signature request via DocuSign/HelloSign
  return requestId;
}

export async function waitForSignature(requestId: string): Promise<void> {
  console.log(`[Activity] Waiting for signature on request ${requestId}`);

  // This would be triggered by a webhook in production
  // For now, we'll simulate a delay
  await new Promise(resolve => setTimeout(resolve, 100));
}

export async function findDoctorOffice(providerName: string): Promise<{
  name: string;
  method: 'email' | 'fax';
  contact: string;
}> {
  console.log(`[Activity] Finding contact info for provider: ${providerName}`);

  // In a real implementation, this would search a database or use an API
  // For now, return mock data
  return {
    name: providerName,
    method: 'email',
    contact: 'records@example.com',
  };
}

export async function manualVerify(contact: {
  name: string;
  method: 'email' | 'fax';
  contact: string;
}): Promise<boolean> {
  console.log(`[Activity] Manually verifying contact: ${contact.name}`);

  // In a real implementation, this would wait for human verification
  // For now, auto-approve
  return true;
}

export async function sendFax(
  contact: { name: string; contact: string },
  requestId: string
): Promise<void> {
  console.log(`[Activity] Sending fax to ${contact.name} at ${contact.contact}`);

  // In a real implementation, use a fax API
  await new Promise(resolve => setTimeout(resolve, 100));
}

export async function sendEmail(
  contact: { name: string; contact: string },
  requestId: string
): Promise<void> {
  console.log(`[Activity] Sending email to ${contact.name} at ${contact.contact}`);

  // MOCKED: Skip actual email for now
  console.log(`[MOCK] Would email ${contact.contact} with request ID: ${requestId}`);
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
