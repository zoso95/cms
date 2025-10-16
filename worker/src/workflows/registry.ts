import { z } from 'zod';

// Parameter schemas for different workflows
export const PatientOutreachParamsSchema = z.object({
  maxAttempts: z.number().min(1).max(10).default(7),
  waitBetweenAttempts: z.string().default('1 day'), // Temporal duration string
  smsTemplate: z.string().default('Please call us back to discuss your medical records.'),
});

export const RecordsRetrievalParamsSchema = z.object({
  providerId: z.string().uuid().optional(), // Provider UUID from database
  providerName: z.string().optional(), // Fallback if providerId not available (for legacy workflows)
  followUpEnabled: z.boolean().default(false),
  followUpInterval: z.string().default('3 days'),
  maxFollowUps: z.number().min(0).max(5).default(2),
});

export const CallParamsSchema = z.object({
  agentId: z.string().optional(),
  maxDuration: z.number().default(300), // seconds
});

export const EndToEndWorkflowParamsSchema = z.object({
  patientOutreach: PatientOutreachParamsSchema,
  recordsRetrieval: RecordsRetrievalParamsSchema,
  call: CallParamsSchema,
});

// Export types
export type PatientOutreachParams = z.infer<typeof PatientOutreachParamsSchema>;
export type RecordsRetrievalParams = z.infer<typeof RecordsRetrievalParamsSchema>;
export type CallParams = z.infer<typeof CallParamsSchema>;
export type EndToEndWorkflowParams = z.infer<typeof EndToEndWorkflowParamsSchema>;

// Workflow metadata
export interface WorkflowMetadata {
  name: string;
  displayName: string;
  description: string;
  category: 'production' | 'test';
  parameters: z.ZodSchema;
  defaultParams: any;
}

// Workflow registry
export const WORKFLOW_REGISTRY: Record<string, WorkflowMetadata> = {
  endToEndWorkflow: {
    name: 'endToEndWorkflow',
    displayName: 'End-to-End Medical Records',
    description: 'Complete workflow: patient outreach, transcript collection, provider records retrieval, and downstream analysis',
    category: 'test',
    parameters: EndToEndWorkflowParamsSchema,
    defaultParams: {
      patientOutreach: {
        maxAttempts: 7,
        waitBetweenAttempts: '1 day',
        smsTemplate: 'Please call us back to discuss your medical records.',
      },
      recordsRetrieval: {
        followUpEnabled: false,
        followUpInterval: '3 days',
        maxFollowUps: 2,
      },
      call: {
        maxDuration: 300,
      },
    },
  },
  patientOutreachWorkflow: {
    name: 'patientOutreachWorkflow',
    displayName: 'Patient Outreach',
    description: 'Contact patient via SMS and calls until they respond or max attempts reached',
    category: 'test',
    parameters: PatientOutreachParamsSchema,
    defaultParams: {
      maxAttempts: 7,
      waitBetweenAttempts: '1 day',
      smsTemplate: 'Please call us back to discuss your medical records.',
    },
  },
  recordsRetrievalWorkflow: {
    name: 'recordsRetrievalWorkflow',
    displayName: 'Records Retrieval',
    description: 'Request and retrieve medical records from a healthcare provider',
    category: 'test',
    parameters: RecordsRetrievalParamsSchema,
    defaultParams: {
      followUpEnabled: false,
      followUpInterval: '3 days',
      maxFollowUps: 2,
    },
  },
  testSMSWorkflow: {
    name: 'testSMSWorkflow',
    displayName: 'Test SMS',
    description: 'Send a test SMS to a patient',
    category: 'test',
    parameters: z.object({
      message: z.string().default('Test message from Afterimage'),
    }),
    defaultParams: { message: 'Test message from Afterimage' },
  },
  testCallWorkflow: {
    name: 'testCallWorkflow',
    displayName: 'Test Call',
    description: 'Place a test call to a patient',
    category: 'test',
    parameters: CallParamsSchema,
    defaultParams: {
      maxDuration: 300,
    },
  },
  testFaxWorkflow: {
    name: 'testFaxWorkflow',
    displayName: 'Test Fax',
    description: 'Send a test fax to a number',
    category: 'test',
    parameters: z.object({
      faxNumber: z.string(),
      message: z.string().default('Test fax'),
    }),
    defaultParams: { faxNumber: '', message: 'Test fax' },
  },
  testEmailWorkflow: {
    name: 'testEmailWorkflow',
    displayName: 'Test Email',
    description: 'Send a test email',
    category: 'test',
    parameters: z.object({
      to: z.string().email(),
      subject: z.string().default('Test email'),
      body: z.string().default('This is a test email'),
    }),
    defaultParams: { to: '', subject: 'Test email', body: 'This is a test email' },
  },
  initializeTasksWorkflow: {
    name: 'initializeTasksWorkflow',
    displayName: 'Initialize Tasks',
    description: 'Create default tasks for a patient case',
    category: 'test',
    parameters: z.object({}),
    defaultParams: {},
  },
  intakeCallWorkflow: {
    name: 'intakeCallWorkflow',
    displayName: 'Intake Call (Production)',
    description: 'Hardcoded 1-week patient outreach workflow. Handles intake call, case evaluation with Claude AI, provider extraction, and triggers provider verification. Updates Tasks 1, 2, 3, and 5.',
    category: 'production',
    parameters: z.object({}),
    defaultParams: {},
  },
  recordsCoordinatorWorkflow: {
    name: 'recordsCoordinatorWorkflow',
    displayName: 'Records Coordinator (Production)',
    description: 'Coordinates records retrieval for all verified providers. Launches child workflows per provider, manages e-signature collection, and sends requests to providers. Updates Tasks 6, 7, and 8.',
    category: 'production',
    parameters: z.object({}),
    defaultParams: {},
  },
  providerRecordsWorkflow: {
    name: 'providerRecordsWorkflow',
    displayName: 'Provider Records (Child)',
    description: 'Child workflow for retrieving records from a single provider. Creates release authorization, waits for signature, and sends to provider.',
    category: 'test',
    parameters: z.object({
      providerId: z.string().uuid(),
      providerName: z.string(),
    }),
    defaultParams: { providerId: '', providerName: '' },
  },
  productionEndToEndWorkflow: {
    name: 'productionEndToEndWorkflow',
    displayName: 'Production End-to-End (Complete)',
    description: 'Complete production workflow with full task tracking. Includes: intake call (7-day outreach), case evaluation, provider extraction, manual verification with signals, signature collection, and records requests. Updates all 8 tasks throughout the process.',
    category: 'production',
    parameters: z.object({}),
    defaultParams: {},
  },
};

// Helper to get workflow metadata
export function getWorkflowMetadata(workflowName: string): WorkflowMetadata | undefined {
  return WORKFLOW_REGISTRY[workflowName];
}

// Helper to list all workflows
export function listWorkflows(): WorkflowMetadata[] {
  return Object.values(WORKFLOW_REGISTRY);
}

// Helper to validate workflow parameters
export function validateWorkflowParams(workflowName: string, params: any): any {
  const metadata = getWorkflowMetadata(workflowName);
  if (!metadata) {
    throw new Error(`Unknown workflow: ${workflowName}`);
  }
  return metadata.parameters.parse(params);
}
