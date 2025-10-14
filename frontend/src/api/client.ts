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
  getPatientCases: () => apiRequest<any[]>('/patient-cases'),
  getPatientCasesWithWorkflows: () => apiRequest<any[]>('/patient-cases-with-workflows'),
  getPatientCase: (id: string) => apiRequest<any>(`/patient-cases/${id}`),

  // Workflows
  getWorkflowCatalog: () => apiRequest<any[]>('/workflows/catalog'),
  getWorkflowSource: (workflowName: string) => apiRequest<{ workflowName: string; source: string }>(`/workflows/${workflowName}/source`),
  startWorkflow: (patientCaseId: number, workflowName?: string, parameters?: any) =>
    apiRequest<{ workflowId: string; runId: string; executionId: string }>('/workflows/start', {
      method: 'POST',
      body: JSON.stringify({ patientCaseId, workflowName, parameters }),
    }),
  stopWorkflow: (workflowId: string) =>
    apiRequest<{ success: boolean }>(`/workflows/${workflowId}/stop`, {
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
};
