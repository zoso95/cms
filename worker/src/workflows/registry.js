"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORKFLOW_REGISTRY = exports.RecordsWorkflowParamsSchema = exports.CallParamsSchema = exports.RecordsRetrievalParamsSchema = exports.PatientOutreachParamsSchema = void 0;
exports.getWorkflowMetadata = getWorkflowMetadata;
exports.listWorkflows = listWorkflows;
exports.validateWorkflowParams = validateWorkflowParams;
const zod_1 = require("zod");
// Parameter schemas for different workflows
exports.PatientOutreachParamsSchema = zod_1.z.object({
    maxAttempts: zod_1.z.number().min(1).max(10).default(7),
    waitBetweenAttempts: zod_1.z.string().default('1 day'), // Temporal duration string
    smsTemplate: zod_1.z.string().default('Please call us back to discuss your medical records.'),
});
exports.RecordsRetrievalParamsSchema = zod_1.z.object({
    followUpEnabled: zod_1.z.boolean().default(false),
    followUpInterval: zod_1.z.string().default('3 days'),
    maxFollowUps: zod_1.z.number().min(0).max(5).default(2),
});
exports.CallParamsSchema = zod_1.z.object({
    agentId: zod_1.z.string().optional(),
    maxDuration: zod_1.z.number().default(300), // seconds
});
exports.RecordsWorkflowParamsSchema = zod_1.z.object({
    patientOutreach: exports.PatientOutreachParamsSchema,
    recordsRetrieval: exports.RecordsRetrievalParamsSchema,
    call: exports.CallParamsSchema,
});
// Workflow registry
exports.WORKFLOW_REGISTRY = {
    recordsWorkflow: {
        name: 'recordsWorkflow',
        displayName: 'Medical Records Retrieval',
        description: 'Full workflow for contacting patients, collecting transcripts, and requesting medical records from providers',
        category: 'production',
        parameters: exports.RecordsWorkflowParamsSchema,
        defaultParams: exports.RecordsWorkflowParamsSchema.parse({}),
    },
    patientOutreachWorkflow: {
        name: 'patientOutreachWorkflow',
        displayName: 'Patient Outreach',
        description: 'Contact patient via SMS and calls until they respond or max attempts reached',
        category: 'production',
        parameters: exports.PatientOutreachParamsSchema,
        defaultParams: exports.PatientOutreachParamsSchema.parse({}),
    },
    recordsRetrievalWorkflow: {
        name: 'recordsRetrievalWorkflow',
        displayName: 'Records Retrieval',
        description: 'Request and retrieve medical records from a healthcare provider',
        category: 'production',
        parameters: exports.RecordsRetrievalParamsSchema,
        defaultParams: exports.RecordsRetrievalParamsSchema.parse({}),
    },
    testSMSWorkflow: {
        name: 'testSMSWorkflow',
        displayName: 'Test SMS',
        description: 'Send a test SMS to a patient',
        category: 'test',
        parameters: zod_1.z.object({
            message: zod_1.z.string().default('Test message from Afterimage'),
        }),
        defaultParams: { message: 'Test message from Afterimage' },
    },
    testCallWorkflow: {
        name: 'testCallWorkflow',
        displayName: 'Test Call',
        description: 'Place a test call to a patient',
        category: 'test',
        parameters: exports.CallParamsSchema,
        defaultParams: exports.CallParamsSchema.parse({}),
    },
    testFaxWorkflow: {
        name: 'testFaxWorkflow',
        displayName: 'Test Fax',
        description: 'Send a test fax to a number',
        category: 'test',
        parameters: zod_1.z.object({
            faxNumber: zod_1.z.string(),
            message: zod_1.z.string().default('Test fax'),
        }),
        defaultParams: { faxNumber: '', message: 'Test fax' },
    },
    testEmailWorkflow: {
        name: 'testEmailWorkflow',
        displayName: 'Test Email',
        description: 'Send a test email',
        category: 'test',
        parameters: zod_1.z.object({
            to: zod_1.z.string().email(),
            subject: zod_1.z.string().default('Test email'),
            body: zod_1.z.string().default('This is a test email'),
        }),
        defaultParams: { to: '', subject: 'Test email', body: 'This is a test email' },
    },
};
// Helper to get workflow metadata
function getWorkflowMetadata(workflowName) {
    return exports.WORKFLOW_REGISTRY[workflowName];
}
// Helper to list all workflows
function listWorkflows() {
    return Object.values(exports.WORKFLOW_REGISTRY);
}
// Helper to validate workflow parameters
function validateWorkflowParams(workflowName, params) {
    const metadata = getWorkflowMetadata(workflowName);
    if (!metadata) {
        throw new Error(`Unknown workflow: ${workflowName}`);
    }
    return metadata.parameters.parse(params);
}
//# sourceMappingURL=registry.js.map