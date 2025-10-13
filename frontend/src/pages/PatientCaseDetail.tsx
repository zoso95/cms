import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

export default function PatientCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'workflows' | 'communications' | 'providers' | 'transcripts'>('workflows');

  const { data: patientCase, isLoading: caseLoading } = useQuery({
    queryKey: ['patient-case', id],
    queryFn: () => api.getPatientCase(id!),
    enabled: !!id,
  });

  const { data: workflows, isLoading: workflowsLoading } = useQuery({
    queryKey: ['patient-case-workflows', id],
    queryFn: () => api.getPatientCaseWorkflows(id!),
    enabled: !!id,
  });

  const { data: communications } = useQuery({
    queryKey: ['patient-case-communications', id],
    queryFn: () => api.getPatientCaseCommunications(id!),
    enabled: !!id && activeTab === 'communications',
  });

  const { data: providers } = useQuery({
    queryKey: ['patient-case-providers', id],
    queryFn: () => api.getPatientCaseProviders(id!),
    enabled: !!id && activeTab === 'providers',
  });

  const { data: transcripts } = useQuery({
    queryKey: ['patient-case-transcripts', id],
    queryFn: () => api.getPatientCaseTranscripts(id!),
    enabled: !!id && activeTab === 'transcripts',
  });

  const startWorkflowMutation = useMutation({
    mutationFn: () => api.startWorkflow(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-workflows', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case', id] });
    },
  });

  const stopWorkflowMutation = useMutation({
    mutationFn: (workflowId: string) => api.stopWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-workflows', id] });
    },
  });

  const deleteWorkflowMutation = useMutation({
    mutationFn: (executionId: string) => api.deleteWorkflow(executionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-workflows', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-cases-with-workflows'] });
    },
  });

  if (caseLoading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>;
  }

  if (!patientCase) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Patient case not found</div>;
  }

  return (
    <div>
      <Link to="/" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1rem', display: 'inline-block' }}>
        ← Back to Dashboard
      </Link>

      {/* Patient Info Card */}
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #e5e5e5',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              {patientCase.first_name} {patientCase.last_name}
            </h1>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Phone</p>
                <p style={{ fontWeight: '500' }}>{patientCase.phone || 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Email</p>
                <p style={{ fontWeight: '500' }}>{patientCase.email || 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Condition</p>
                <p style={{ fontWeight: '500' }}>{patientCase.condition || 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.25rem' }}>Status</p>
                <p style={{ fontWeight: '500', textTransform: 'capitalize' }}>{patientCase.status || 'pending'}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => startWorkflowMutation.mutate()}
            disabled={startWorkflowMutation.isPending}
            style={{
              backgroundColor: '#2563eb',
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              fontWeight: '500',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            {startWorkflowMutation.isPending ? 'Starting...' : 'Start Workflow'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        borderBottom: '1px solid #e5e5e5',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '2rem'
      }}>
        {(['workflows', 'communications', 'providers', 'transcripts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 0',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: activeTab === tab ? '#2563eb' : '#666',
              borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'workflows' && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          border: '1px solid #e5e5e5',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Workflows</h2>
          {workflowsLoading ? (
            <p>Loading workflows...</p>
          ) : workflows && workflows.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {workflows.map((workflow: any) => (
                <div key={workflow.id} style={{
                  padding: '1rem',
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: '500', marginBottom: '0.25rem' }}>Workflow ID: {workflow.workflow_id}</p>
                      <p style={{ fontSize: '0.875rem', color: '#666' }}>Run ID: {workflow.run_id}</p>
                      <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                        Started: {new Date(workflow.started_at).toLocaleString()}
                      </p>
                      {workflow.completed_at && (
                        <p style={{ fontSize: '0.875rem', color: '#666' }}>
                          Completed: {new Date(workflow.completed_at).toLocaleString()}
                        </p>
                      )}
                      <a
                        href={`http://localhost:8233/namespaces/default/workflows/${workflow.workflow_id}/${workflow.run_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-block',
                          marginTop: '0.5rem',
                          color: '#2563eb',
                          fontSize: '0.875rem',
                          textDecoration: 'none'
                        }}
                      >
                        View in Temporal UI →
                      </a>
                    </div>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      backgroundColor: workflow.status === 'running' ? '#3b82f6' : workflow.status === 'completed' ? '#10b981' : '#ef4444',
                      color: '#fff'
                    }}>
                      {workflow.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {workflow.status === 'running' && (
                      <button
                        onClick={() => stopWorkflowMutation.mutate(workflow.workflow_id)}
                        disabled={stopWorkflowMutation.isPending}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        {stopWorkflowMutation.isPending ? 'Stopping...' : 'Stop Workflow'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this workflow execution record?')) {
                          deleteWorkflowMutation.mutate(workflow.id);
                        }
                      }}
                      disabled={deleteWorkflowMutation.isPending}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#6b7280',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      {deleteWorkflowMutation.isPending ? 'Deleting...' : 'Delete Record'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#666' }}>No workflows started yet. Click "Start Workflow" to begin.</p>
          )}
        </div>
      )}

      {activeTab === 'communications' && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          border: '1px solid #e5e5e5',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Communications</h2>
          {communications && communications.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {communications.map((comm: any) => (
                <div key={comm.id} style={{
                  padding: '1rem',
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{
                      fontWeight: '500',
                      textTransform: 'uppercase',
                      fontSize: '0.875rem'
                    }}>
                      {comm.type} - {comm.direction}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      color: '#666'
                    }}>
                      {new Date(comm.created_at).toLocaleString()}
                    </span>
                  </div>
                  {comm.content && (
                    <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>{comm.content}</p>
                  )}
                  <span style={{
                    display: 'inline-block',
                    marginTop: '0.5rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    backgroundColor: '#f3f4f6'
                  }}>
                    {comm.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#666' }}>No communications yet.</p>
          )}
        </div>
      )}

      {activeTab === 'providers' && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          border: '1px solid #e5e5e5',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Providers</h2>
          {providers && providers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {providers.map((provider: any) => (
                <div key={provider.id} style={{
                  padding: '1rem',
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px'
                }}>
                  <h3 style={{ fontWeight: '500', marginBottom: '0.5rem' }}>{provider.name}</h3>
                  {provider.specialty && (
                    <p style={{ fontSize: '0.875rem', color: '#666' }}>Specialty: {provider.specialty}</p>
                  )}
                  {provider.contact_method && (
                    <p style={{ fontSize: '0.875rem', color: '#666' }}>
                      Contact: {provider.contact_method} - {provider.contact_info}
                    </p>
                  )}
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      backgroundColor: provider.verified ? '#d1fae5' : '#f3f4f6',
                      color: provider.verified ? '#065f46' : '#374151'
                    }}>
                      {provider.verified ? 'Verified' : 'Not Verified'}
                    </span>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      backgroundColor: provider.records_received ? '#d1fae5' : '#f3f4f6',
                      color: provider.records_received ? '#065f46' : '#374151'
                    }}>
                      {provider.records_received ? 'Records Received' : 'Awaiting Records'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#666' }}>No providers extracted yet.</p>
          )}
        </div>
      )}

      {activeTab === 'transcripts' && (
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '8px',
          border: '1px solid #e5e5e5',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Call Transcripts</h2>
          {transcripts && transcripts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {transcripts.map((transcript: any) => (
                <div key={transcript.id} style={{
                  padding: '1rem',
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px'
                }}>
                  <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>
                    {new Date(transcript.created_at).toLocaleString()}
                  </p>
                  <p style={{ fontSize: '0.875rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                    {transcript.transcript}
                  </p>
                  {transcript.analysis && Object.keys(transcript.analysis).length > 0 && (
                    <details style={{ marginTop: '1rem' }}>
                      <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500' }}>
                        View Analysis
                      </summary>
                      <pre style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        overflow: 'auto'
                      }}>
                        {JSON.stringify(transcript.analysis, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#666' }}>No transcripts available yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
