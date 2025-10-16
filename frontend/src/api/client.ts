import { supabase } from '../lib/supabase';

const API_BASE_URL = '/api';

export async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // Get current session token
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  // Add auth token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include', // Include cookies for session-based auth (Temporal UI)
    headers,
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'An error occurred');
  }

  return response.json();
}

export const api = {
  // Patient cases
  getPatientCases: (page?: number, limit?: number, search?: string) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (search) params.append('search', search);
    const query = params.toString();
    return apiRequest<{ data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/patient-cases${query ? '?' + query : ''}`);
  },
  getPatientCasesWithWorkflows: () => apiRequest<any[]>('/patient-cases-with-workflows'),
  getPatientCase: (id: string) => apiRequest<any>(`/patient-cases/${id}`),
  createPatientCase: (patientData: {
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    birthday?: string;
    state?: string;
    condition?: string;
    incident_date?: string;
    impact?: string;
    details?: string;
    status?: string;
    priority?: number;
    case_type?: string;
    preexisting_conditions?: string;
    financial_damages?: string;
    standard_of_care_issues?: string;
    pain_and_suffering_damages?: string;
  }) =>
    apiRequest<any>('/patient-cases', {
      method: 'POST',
      body: JSON.stringify(patientData),
    }),
  updatePatientDetails: (id: string, details: string) =>
    apiRequest<any>(`/patient-cases/${id}/details`, {
      method: 'PATCH',
      body: JSON.stringify({ details }),
    }),

  // Workflows
  getWorkflowCatalog: () => apiRequest<any[]>('/workflows/catalog'),
  getWorkflowSource: (workflowName: string) => apiRequest<{ workflowName: string; source: string }>(`/workflows/${workflowName}/source`),
  startWorkflow: (patientCaseId: number, workflowName?: string, parameters?: any, scheduledAt?: string) =>
    apiRequest<{ workflowId: string; runId?: string; executionId: string; scheduledAt?: string; status?: string }>('/workflows/start', {
      method: 'POST',
      body: JSON.stringify({ patientCaseId, workflowName, parameters, scheduledAt }),
    }),
  stopWorkflow: (workflowId: string) =>
    apiRequest<{ success: boolean }>(`/workflows/${workflowId}/stop`, {
      method: 'POST',
    }),
  pauseWorkflow: (workflowId: string) =>
    apiRequest<{ success: boolean; childrenPaused: number }>(`/workflows/${workflowId}/pause`, {
      method: 'POST',
    }),
  resumeWorkflow: (workflowId: string) =>
    apiRequest<{ success: boolean; childrenResumed: number }>(`/workflows/${workflowId}/resume`, {
      method: 'POST',
    }),
  deleteWorkflow: (executionId: string) =>
    apiRequest<{ success: boolean }>(`/workflows/${executionId}`, {
      method: 'DELETE',
    }),
  getWorkflow: (workflowId: string) => apiRequest<any>(`/workflows/${workflowId}`),
  getPatientCaseWorkflows: (id: string) => apiRequest<any[]>(`/patient-cases/${id}/workflows`),
  getChildWorkflows: (workflowId: string) => apiRequest<any[]>(`/workflows/${workflowId}/children`),
  sendSignal: (workflowId: string, signalName: string, signalArgs: any[]) =>
    apiRequest<{ success: boolean }>(`/workflows/${workflowId}/signal`, {
      method: 'POST',
      body: JSON.stringify({ signalName, signalArgs }),
    }),

  // Communications
  getPatientCaseCommunications: (id: string) => apiRequest<any[]>(`/patient-cases/${id}/communications`),

  // Providers
  getPatientCaseProviders: (id: string) => apiRequest<any[]>(`/patient-cases/${id}/providers`),

  // Transcripts
  getPatientCaseTranscripts: (id: string) => apiRequest<any[]>(`/patient-cases/${id}/transcripts`),

  // Claude Analysis
  getPatientCaseAnalysis: (id: string) => apiRequest<any>(`/patient-cases/${id}/analysis`),

  // Verifications
  getPatientCaseVerifications: (id: string) => apiRequest<any[]>(`/patient-cases/${id}/verifications`),
  approveVerification: (verificationId: string, contactInfo: any) =>
    apiRequest<{ success: boolean }>(`/verifications/${verificationId}/approve`, {
      method: 'POST',
      body: JSON.stringify(contactInfo),
    }),
  rejectVerification: (verificationId: string, reason: string) =>
    apiRequest<{ success: boolean }>(`/verifications/${verificationId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Tasks
  getPatientCaseTasks: (id: string) => apiRequest<any[]>(`/patient-cases/${id}/tasks`),
  initializePatientTasks: (id: string) =>
    apiRequest<{ success: boolean; tasks: any[] }>(`/patient-cases/${id}/tasks/initialize`, {
      method: 'POST',
    }),
  updateTaskStatus: (taskId: string, status: string, assigned_to?: string) =>
    apiRequest<any>(`/patient-cases/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, assigned_to }),
    }),
};
