import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import WorkflowSelector from '../components/WorkflowSelector';
import { getSocket, subscribeToPatientCase, unsubscribeFromPatientCase } from '../lib/socket';
import PatientInfoCard from '../components/PatientCase/PatientInfoCard';
import TasksSection from '../components/PatientCase/TasksSection';
import DetailsSection from '../components/PatientCase/DetailsSection';
import WorkflowsTab from '../components/PatientCase/WorkflowsTab';
import CommunicationsTab from '../components/PatientCase/CommunicationsTab';
import ProvidersTab from '../components/PatientCase/ProvidersTab';
import VerificationsTab from '../components/PatientCase/VerificationsTab';
import TranscriptsTab from '../components/PatientCase/TranscriptsTab';
import ClaudeAnalysisTab from '../components/PatientCase/ClaudeAnalysisTab';

export default function PatientCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'workflows' | 'communications' | 'providers' | 'transcripts' | 'analysis' | 'verifications'>('workflows');
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

  const { data: analysis } = useQuery({
    queryKey: ['patient-case-analysis', id],
    queryFn: () => api.getPatientCaseAnalysis(id!),
    enabled: !!id && activeTab === 'analysis',
  });

  const { data: verifications } = useQuery({
    queryKey: ['patient-case-verifications', id],
    queryFn: () => api.getPatientCaseVerifications(id!),
    enabled: !!id,
    refetchInterval: activeTab === 'verifications' ? false : 5000, // Poll when not active
  });

  // Count pending verifications
  const pendingVerificationsCount = verifications?.filter((v: any) => v.status === 'pending').length || 0;

  const { data: tasks } = useQuery({
    queryKey: ['patient-case-tasks', id],
    queryFn: () => api.getPatientCaseTasks(id!),
    enabled: !!id,
  });

  const startWorkflowMutation = useMutation({
    mutationFn: ({ workflowName, parameters, scheduledAt }: { workflowName: string; parameters: any; scheduledAt?: string }) =>
      api.startWorkflow(Number(id), workflowName, parameters, scheduledAt),
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

  const approveVerificationMutation = useMutation({
    mutationFn: ({ verificationId, contactInfo }: { verificationId: string; contactInfo: any }) =>
      api.approveVerification(verificationId, contactInfo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-verifications', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case-providers', id] });
    },
  });

  const rejectVerificationMutation = useMutation({
    mutationFn: ({ verificationId, reason }: { verificationId: string; reason: string }) =>
      api.rejectVerification(verificationId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-verifications', id] });
    },
  });

  const updateDetailsMutation = useMutation({
    mutationFn: (details: string) => api.updatePatientDetails(id!, details),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case', id] });
    },
  });

  const initializeTasksMutation = useMutation({
    mutationFn: () => api.initializePatientTasks(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-tasks', id] });
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      api.updateTaskStatus(taskId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-tasks', id] });
    },
  });

  const updateTaskAssigneeMutation = useMutation({
    mutationFn: ({ taskId, assigned_to }: { taskId: string; assigned_to: string }) =>
      api.updateTaskStatus(taskId, '', assigned_to),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-case-tasks', id] });
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
      queryClient.invalidateQueries({ queryKey: ['patient-case-analysis', id] });
      queryClient.invalidateQueries({ queryKey: ['patient-case-verifications', id] });
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
          onStart={async (workflowName, parameters, scheduledAt) => {
            // Frontend hack: Initialize tasks if they don't exist
            if (!tasks || tasks.length === 0) {
              await initializeTasksMutation.mutateAsync();
            }
            startWorkflowMutation.mutate({ workflowName, parameters, scheduledAt });
          }}
          onCancel={() => setShowWorkflowSelector(false)}
        />
      )}

      <Link to="/" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1rem', display: 'inline-block' }}>
        ← Back to Dashboard
      </Link>

      <PatientInfoCard
        patientCase={patientCase}
        onStartWorkflow={() => setShowWorkflowSelector(true)}
        isStartingWorkflow={startWorkflowMutation.isPending}
      />

      <TasksSection
        tasks={tasks}
        onInitializeTasks={() => initializeTasksMutation.mutate()}
        isInitializing={initializeTasksMutation.isPending}
        onUpdateTaskStatus={(taskId, status) => updateTaskStatusMutation.mutate({ taskId, status })}
        onUpdateTaskAssignee={(taskId, assigned_to) => updateTaskAssigneeMutation.mutate({ taskId, assigned_to })}
      />

      <DetailsSection
        patientCase={patientCase}
        onUpdateDetails={(details) => updateDetailsMutation.mutate(details)}
        isUpdating={updateDetailsMutation.isPending}
      />

      {/* Tabs */}
      <div style={{
        borderBottom: '1px solid #e5e5e5',
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '2rem'
      }}>
        {(['workflows', 'communications', 'providers', 'verifications', 'transcripts', 'analysis'] as const).map((tab) => (
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
              textTransform: 'capitalize',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              position: 'relative'
            }}
          >
            {tab}
            {tab === 'verifications' && pendingVerificationsCount > 0 && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '1.25rem',
                height: '1.25rem',
                padding: '0 0.35rem',
                backgroundColor: '#ef4444',
                color: '#fff',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '600',
                lineHeight: '1'
              }}>
                {pendingVerificationsCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'workflows' && (
        <WorkflowsTab
          workflows={workflows}
          isLoading={workflowsLoading}
          stopWorkflow={stopWorkflowMutation.mutate}
          pauseWorkflow={pauseWorkflowMutation.mutate}
          resumeWorkflow={resumeWorkflowMutation.mutate}
          deleteWorkflow={deleteWorkflowMutation.mutate}
          isStoppingWorkflow={stopWorkflowMutation.isPending}
          isPausingWorkflow={pauseWorkflowMutation.isPending}
          isResumingWorkflow={resumeWorkflowMutation.isPending}
          isDeletingWorkflow={deleteWorkflowMutation.isPending}
        />
      )}

      {activeTab === 'communications' && <CommunicationsTab communications={communications} />}

      {activeTab === 'providers' && <ProvidersTab providers={providers} />}

      {activeTab === 'verifications' && (
        <VerificationsTab
          verifications={verifications}
          approveVerificationMutation={approveVerificationMutation}
          rejectVerificationMutation={rejectVerificationMutation}
        />
      )}

      {activeTab === 'transcripts' && <TranscriptsTab transcripts={transcripts} />}

      {activeTab === 'analysis' && <ClaudeAnalysisTab analysis={analysis} />}
    </div>
  );
}
