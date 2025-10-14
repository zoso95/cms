import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import WorkflowSelector from '../components/WorkflowSelector';
import { getSocket, subscribeToPatientCase, unsubscribeFromPatientCase } from '../lib/socket';

// Workflow card component
function WorkflowCard({
  workflow,
  isChild = false,
  stopWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  deleteWorkflow,
  isStoppingWorkflow,
  isPausingWorkflow,
  isResumingWorkflow,
  isDeletingWorkflow,
}: {
  workflow: any;
  isChild?: boolean;
  stopWorkflow: (workflowId: string) => void;
  pauseWorkflow: (workflowId: string) => void;
  resumeWorkflow: (workflowId: string) => void;
  deleteWorkflow: (executionId: string) => void;
  isStoppingWorkflow: boolean;
  isPausingWorkflow: boolean;
  isResumingWorkflow: boolean;
  isDeletingWorkflow: boolean;
}) {
  return (
    <div
      key={workflow.id}
      style={{
        padding: '1rem',
        border: '1px solid #e5e5e5',
        borderRadius: '6px',
        marginLeft: isChild ? '2rem' : '0',
        borderLeft: isChild ? '3px solid #3b82f6' : undefined,
        backgroundColor: isChild ? '#f9fafb' : '#fff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            {isChild && <span style={{ fontSize: '0.875rem', color: '#666' }}>↳</span>}
            <p style={{ fontWeight: '500' }}>
              {workflow.workflow_name || 'Unknown Workflow'}
            </p>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
            ID: {workflow.workflow_id}
          </p>
          {workflow.entity_type && workflow.entity_id && (
            <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
              Entity: {workflow.entity_type} #{workflow.entity_id}
            </p>
          )}
          <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
            Started: {new Date(workflow.started_at).toLocaleString()}
          </p>
          {workflow.completed_at && (
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              Completed: {new Date(workflow.completed_at).toLocaleString()}
            </p>
          )}
          {workflow.error && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                backgroundColor: '#fee',
                border: '1px solid #fcc',
                borderRadius: '4px',
              }}
            >
              <p style={{ fontSize: '0.75rem', fontWeight: '500', color: '#c00', marginBottom: '0.25rem' }}>
                Error:
              </p>
              <p style={{ fontSize: '0.75rem', color: '#600', whiteSpace: 'pre-wrap' }}>{workflow.error}</p>
            </div>
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
              textDecoration: 'none',
            }}
          >
            View in Temporal UI →
          </a>
        </div>
        <span
          style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: '500',
            backgroundColor:
              workflow.status === 'running'
                ? '#3b82f6'
                : workflow.status === 'completed'
                ? '#10b981'
                : workflow.status === 'failed'
                ? '#ef4444'
                : workflow.status === 'terminated'
                ? '#f97316'
                : '#6b7280',
            color: '#fff',
          }}
        >
          {workflow.status}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {workflow.status === 'running' && !workflow.paused && (
          <button
            onClick={() => pauseWorkflow(workflow.workflow_id)}
            disabled={isPausingWorkflow}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            {isPausingWorkflow ? 'Pausing...' : 'Pause'}
          </button>
        )}
        {workflow.status === 'running' && workflow.paused && (
          <button
            onClick={() => resumeWorkflow(workflow.workflow_id)}
            disabled={isResumingWorkflow}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            {isResumingWorkflow ? 'Resuming...' : 'Resume'}
          </button>
        )}
        {workflow.status === 'running' && (
          <button
            onClick={() => stopWorkflow(workflow.workflow_id)}
            disabled={isStoppingWorkflow}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            {isStoppingWorkflow ? 'Stopping...' : 'Stop'}
          </button>
        )}
        <button
          onClick={() => {
            if (confirm('Are you sure you want to delete this workflow execution record?')) {
              deleteWorkflow(workflow.id);
            }
          }}
          disabled={isDeletingWorkflow}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#6b7280',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.875rem',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          {isDeletingWorkflow ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </div>
  );
}

// Workflow hierarchy component
function WorkflowHierarchy({
  workflows,
  stopWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  deleteWorkflow,
  isStoppingWorkflow,
  isPausingWorkflow,
  isResumingWorkflow,
  isDeletingWorkflow,
}: {
  workflows: any[];
  stopWorkflow: (workflowId: string) => void;
  pauseWorkflow: (workflowId: string) => void;
  resumeWorkflow: (workflowId: string) => void;
  deleteWorkflow: (executionId: string) => void;
  isStoppingWorkflow: boolean;
  isPausingWorkflow: boolean;
  isResumingWorkflow: boolean;
  isDeletingWorkflow: boolean;
}) {
  // Separate parent workflows from children
  const parentWorkflows = workflows.filter((w) => !w.parent_workflow_id);
  const childWorkflows = workflows.filter((w) => w.parent_workflow_id);

  // Group children by parent workflow ID
  const childrenByParent = childWorkflows.reduce((acc, child) => {
    const parentId = child.parent_workflow_id;
    if (!acc[parentId]) {
      acc[parentId] = [];
    }
    acc[parentId].push(child);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {parentWorkflows.map((parent) => (
        <div key={parent.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Parent workflow */}
          <WorkflowCard
            workflow={parent}
            isChild={false}
            stopWorkflow={stopWorkflow}
            pauseWorkflow={pauseWorkflow}
            resumeWorkflow={resumeWorkflow}
            deleteWorkflow={deleteWorkflow}
            isStoppingWorkflow={isStoppingWorkflow}
            isPausingWorkflow={isPausingWorkflow}
            isResumingWorkflow={isResumingWorkflow}
            isDeletingWorkflow={isDeletingWorkflow}
          />

          {/* Child workflows */}
          {childrenByParent[parent.workflow_id]?.map((child) => (
            <WorkflowCard
              key={child.id}
              workflow={child}
              isChild={true}
              stopWorkflow={stopWorkflow}
              pauseWorkflow={pauseWorkflow}
              resumeWorkflow={resumeWorkflow}
              deleteWorkflow={deleteWorkflow}
              isStoppingWorkflow={isStoppingWorkflow}
              isPausingWorkflow={isPausingWorkflow}
              isResumingWorkflow={isResumingWorkflow}
              isDeletingWorkflow={isDeletingWorkflow}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function PatientCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'workflows' | 'communications' | 'providers' | 'transcripts'>('workflows');
  const [showWorkflowSelector, setShowWorkflowSelector] = useState(false);

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
    mutationFn: ({ workflowName, parameters }: { workflowName: string; parameters: any }) =>
      api.startWorkflow(Number(id), workflowName, parameters),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-workflows', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case', id] });
      setShowWorkflowSelector(false);
    },
  });

  const stopWorkflowMutation = useMutation({
    mutationFn: (workflowId: string) => api.stopWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-workflows', id] });
    },
  });

  const pauseWorkflowMutation = useMutation({
    mutationFn: (workflowId: string) => api.pauseWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-workflows', id] });
    },
  });

  const resumeWorkflowMutation = useMutation({
    mutationFn: (workflowId: string) => api.resumeWorkflow(workflowId),
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

  // WebSocket subscription for real-time updates
  useEffect(() => {
    if (!id) return;

    const patientCaseId = Number(id);
    const socket = getSocket();

    // Subscribe to this patient case
    subscribeToPatientCase(patientCaseId);

    // Listen for workflow updates
    const handleWorkflowUpdate = (data: any) => {
      console.log('Workflow updated:', data);

      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['patient-case-workflows', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case-communications', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case-providers', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case-transcripts', id] });
    };

    socket.on('workflow-updated', handleWorkflowUpdate);

    // Cleanup on unmount
    return () => {
      socket.off('workflow-updated', handleWorkflowUpdate);
      unsubscribeFromPatientCase(patientCaseId);
    };
  }, [id, queryClient]);

  if (caseLoading) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>;
  }

  if (!patientCase) {
    return <div style={{ textAlign: 'center', padding: '3rem' }}>Patient case not found</div>;
  }

  return (
    <div>
      {showWorkflowSelector && (
        <WorkflowSelector
          patientCaseId={Number(id)}
          onStart={(workflowName, parameters) => {
            startWorkflowMutation.mutate({ workflowName, parameters });
          }}
          onCancel={() => setShowWorkflowSelector(false)}
        />
      )}

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
            onClick={() => setShowWorkflowSelector(true)}
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
            <WorkflowHierarchy
              workflows={workflows}
              stopWorkflow={stopWorkflowMutation.mutate}
              pauseWorkflow={pauseWorkflowMutation.mutate}
              resumeWorkflow={resumeWorkflowMutation.mutate}
              deleteWorkflow={deleteWorkflowMutation.mutate}
              isStoppingWorkflow={stopWorkflowMutation.isPending}
              isPausingWorkflow={pauseWorkflowMutation.isPending}
              isResumingWorkflow={resumeWorkflowMutation.isPending}
              isDeletingWorkflow={deleteWorkflowMutation.isPending}
            />
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
