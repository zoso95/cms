const API_BASE_URL = '/api';

export async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
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
  getPatientCases: (page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    const query = params.toString();
    return apiRequest<{ data: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/patient-cases${query ? '?' + query : ''}`);
  },
  getPatientCasesWithWorkflows: () => apiRequest<any[]>('/patient-cases-with-workflows'),
  getPatientCase: (id: string) => apiRequest<any>(`/patient-cases/${id}`),
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
};
