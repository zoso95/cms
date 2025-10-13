import { Context } from '@temporalio/activity';
import { supabase } from './db';
import { v4 as uuidv4 } from 'uuid';
import twilio from 'twilio';
import nodemailer from 'nodemailer';
import { openphone } from './services/openphone';
import { normalizePhoneNumber } from './utils/phone';

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
export async function placeCall(patientCaseId: number): Promise<boolean> {
  console.log(`[Activity] Placing call to patient case ${patientCaseId}`);

  const { data: patientCase, error: caseError } = await supabase
    .from('patient_cases')
    .select('phone')
    .eq('id', patientCaseId)
    .single();

  if (caseError) throw caseError;
  if (!patientCase.phone) throw new Error('No phone number for patient case');

  // MOCKED: Simulate call - randomly pick up or not
  const pickedUp = Math.random() > 0.8; // 20% chance they pick up
  console.log(`[MOCK] Would call ${patientCase.phone}: ${pickedUp ? 'PICKED UP' : 'NO ANSWER'}`);

  await logCommunication(
    patientCaseId,
    'call',
    'outbound',
    pickedUp ? 'received' : 'failed',
    undefined,
    { mocked: true, phone: patientCase.phone, pickedUp }
  );

  return pickedUp;
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
