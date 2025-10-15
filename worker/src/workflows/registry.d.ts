import { z } from 'zod';
export declare const PatientOutreachParamsSchema: z.ZodObject<{
    maxAttempts: z.ZodDefault<z.ZodNumber>;
    waitBetweenAttempts: z.ZodDefault<z.ZodString>;
    smsTemplate: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    maxAttempts: number;
    waitBetweenAttempts: string;
    smsTemplate: string;
}, {
    maxAttempts?: number | undefined;
    waitBetweenAttempts?: string | undefined;
    smsTemplate?: string | undefined;
}>;
export declare const RecordsRetrievalParamsSchema: z.ZodObject<{
    providerId: z.ZodOptional<z.ZodString>;
    providerName: z.ZodOptional<z.ZodString>;
    followUpEnabled: z.ZodDefault<z.ZodBoolean>;
    followUpInterval: z.ZodDefault<z.ZodString>;
    maxFollowUps: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    followUpEnabled: boolean;
    followUpInterval: string;
    maxFollowUps: number;
    providerId?: string | undefined;
    providerName?: string | undefined;
}, {
    providerId?: string | undefined;
    providerName?: string | undefined;
    followUpEnabled?: boolean | undefined;
    followUpInterval?: string | undefined;
    maxFollowUps?: number | undefined;
}>;
export declare const CallParamsSchema: z.ZodObject<{
    agentId: z.ZodOptional<z.ZodString>;
    maxDuration: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxDuration: number;
    agentId?: string | undefined;
}, {
    agentId?: string | undefined;
    maxDuration?: number | undefined;
}>;
export declare const EndToEndWorkflowParamsSchema: z.ZodObject<{
    patientOutreach: z.ZodObject<{
        maxAttempts: z.ZodDefault<z.ZodNumber>;
        waitBetweenAttempts: z.ZodDefault<z.ZodString>;
        smsTemplate: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        maxAttempts: number;
        waitBetweenAttempts: string;
        smsTemplate: string;
    }, {
        maxAttempts?: number | undefined;
        waitBetweenAttempts?: string | undefined;
        smsTemplate?: string | undefined;
    }>;
    recordsRetrieval: z.ZodObject<{
        providerId: z.ZodOptional<z.ZodString>;
        providerName: z.ZodOptional<z.ZodString>;
        followUpEnabled: z.ZodDefault<z.ZodBoolean>;
        followUpInterval: z.ZodDefault<z.ZodString>;
        maxFollowUps: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        followUpEnabled: boolean;
        followUpInterval: string;
        maxFollowUps: number;
        providerId?: string | undefined;
        providerName?: string | undefined;
    }, {
        providerId?: string | undefined;
        providerName?: string | undefined;
        followUpEnabled?: boolean | undefined;
        followUpInterval?: string | undefined;
        maxFollowUps?: number | undefined;
    }>;
    call: z.ZodObject<{
        agentId: z.ZodOptional<z.ZodString>;
        maxDuration: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        maxDuration: number;
        agentId?: string | undefined;
    }, {
        agentId?: string | undefined;
        maxDuration?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    patientOutreach: {
        maxAttempts: number;
        waitBetweenAttempts: string;
        smsTemplate: string;
    };
    recordsRetrieval: {
        followUpEnabled: boolean;
        followUpInterval: string;
        maxFollowUps: number;
        providerId?: string | undefined;
        providerName?: string | undefined;
    };
    call: {
        maxDuration: number;
        agentId?: string | undefined;
    };
}, {
    patientOutreach: {
        maxAttempts?: number | undefined;
        waitBetweenAttempts?: string | undefined;
        smsTemplate?: string | undefined;
    };
    recordsRetrieval: {
        providerId?: string | undefined;
        providerName?: string | undefined;
        followUpEnabled?: boolean | undefined;
        followUpInterval?: string | undefined;
        maxFollowUps?: number | undefined;
    };
    call: {
        agentId?: string | undefined;
        maxDuration?: number | undefined;
    };
}>;
export type PatientOutreachParams = z.infer<typeof PatientOutreachParamsSchema>;
export type RecordsRetrievalParams = z.infer<typeof RecordsRetrievalParamsSchema>;
export type CallParams = z.infer<typeof CallParamsSchema>;
export type EndToEndWorkflowParams = z.infer<typeof EndToEndWorkflowParamsSchema>;
export interface WorkflowMetadata {
    name: string;
    displayName: string;
    description: string;
    category: 'production' | 'test';
    parameters: z.ZodSchema;
    defaultParams: any;
}
export declare const WORKFLOW_REGISTRY: Record<string, WorkflowMetadata>;
export declare function getWorkflowMetadata(workflowName: string): WorkflowMetadata | undefined;
export declare function listWorkflows(): WorkflowMetadata[];
export declare function validateWorkflowParams(workflowName: string, params: any): any;
//# sourceMappingURL=registry.d.ts.map