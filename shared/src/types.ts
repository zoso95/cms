import { z } from 'zod';

// ============================================
// Patient Case Schema (existing table)
// ============================================
export const PatientCaseSchema = z.object({
  id: z.number(),
  created_at: z.string().datetime(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  birthday: z.string().nullable(),
  state: z.string().nullable(),
  condition: z.string().nullable(),
  incident_date: z.string().nullable(),
  impact: z.string().nullable(),
  details: z.string().nullable(),
  status: z.string().nullable(),
  is_public_submission: z.boolean().nullable(),
  ip: z.string().nullable(),
  ref: z.record(z.any()).nullable(),
  calls: z.record(z.any()).nullable(),
  tasks: z.array(z.any()).nullable(),
  priority: z.number().nullable(),
  providers: z.record(z.any()).nullable(),
  call_notes: z.record(z.any()).nullable(),
  case_id: z.number().nullable(),
  chat: z.string().nullable(),
  preexisting_conditions: z.string().nullable(),
  case_type: z.string().nullable(),
  financial_damages: z.string().nullable(),
  standard_of_care_issues: z.string().nullable(),
  pain_and_suffering_damages: z.string().nullable(),
});

export type PatientCase = z.infer<typeof PatientCaseSchema>;

// ============================================
// Workflow Execution Schema
// ============================================
export const WorkflowExecutionSchema = z.object({
  id: z.string().uuid(),
  patient_case_id: z.number(),
  workflow_id: z.string(),
  run_id: z.string(),
  status: z.enum(['running', 'completed', 'failed', 'terminated']),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  error: z.string().optional(),
});

export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>;

// ============================================
// Communication Log Schema
// ============================================
export const CommunicationTypeSchema = z.enum(['sms', 'call', 'email', 'fax']);

export const CommunicationLogSchema = z.object({
  id: z.string().uuid(),
  patient_case_id: z.number(),
  workflow_execution_id: z.string().uuid(),
  type: CommunicationTypeSchema,
  direction: z.enum(['inbound', 'outbound']),
  status: z.enum(['pending', 'sent', 'delivered', 'failed', 'received']),
  content: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.string().datetime(),
});

export type CommunicationType = z.infer<typeof CommunicationTypeSchema>;
export type CommunicationLog = z.infer<typeof CommunicationLogSchema>;

// ============================================
// Call Transcript Schema
// ============================================
export const CallTranscriptSchema = z.object({
  id: z.string().uuid(),
  patient_case_id: z.number(),
  workflow_execution_id: z.string().uuid(),
  communication_log_id: z.string().uuid(),
  transcript: z.string(),
  analysis: z.record(z.any()).optional(),
  created_at: z.string().datetime(),
});

export type CallTranscript = z.infer<typeof CallTranscriptSchema>;

// ============================================
// Provider Schema
// ============================================
export const ProviderSchema = z.object({
  id: z.string().uuid(),
  patient_case_id: z.number(),
  workflow_execution_id: z.string().uuid(),
  name: z.string(),
  specialty: z.string().optional(),
  contact_method: z.enum(['email', 'fax']).optional(),
  contact_info: z.string().optional(),
  verified: z.boolean().default(false),
  records_received: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Provider = z.infer<typeof ProviderSchema>;

// ============================================
// Records Request Schema
// ============================================
export const RecordsRequestSchema = z.object({
  id: z.string().uuid(),
  provider_id: z.string().uuid(),
  workflow_execution_id: z.string().uuid(),
  status: z.enum(['created', 'awaiting_signature', 'sent', 'received', 'failed']),
  signature_url: z.string().optional(),
  signed_at: z.string().datetime().optional(),
  sent_at: z.string().datetime().optional(),
  received_at: z.string().datetime().optional(),
  created_at: z.string().datetime(),
});

export type RecordsRequest = z.infer<typeof RecordsRequestSchema>;

// ============================================
// Webhook Event Schema
// ============================================
export const WebhookEventSchema = z.object({
  id: z.string().uuid(),
  patient_case_id: z.number().optional(),
  workflow_execution_id: z.string().uuid().optional(),
  event_type: z.string(),
  payload: z.record(z.any()),
  processed: z.boolean().default(false),
  created_at: z.string().datetime(),
});

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

// ============================================
// Workflow Signals
// ============================================
export interface UserResponse {
  message: string;
  timestamp: string;
}

export interface WorkflowState {
  patientCaseId: number;
  currentStep: string;
  attemptCount: number;
  pickedUp: boolean;
  userResponded: boolean;
  providers: string[];
  communications: string[];
}
