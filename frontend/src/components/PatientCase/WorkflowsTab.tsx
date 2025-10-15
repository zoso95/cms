import WorkflowHierarchy from './WorkflowHierarchy';

interface WorkflowsTabProps {
  workflows: any[] | undefined;
  isLoading: boolean;
  stopWorkflow: (workflowId: string) => void;
  pauseWorkflow: (workflowId: string) => void;
  resumeWorkflow: (workflowId: string) => void;
  deleteWorkflow: (executionId: string) => void;
  isStoppingWorkflow: boolean;
  isPausingWorkflow: boolean;
  isResumingWorkflow: boolean;
  isDeletingWorkflow: boolean;
}

export default function WorkflowsTab({
  workflows,
  isLoading,
  stopWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  deleteWorkflow,
  isStoppingWorkflow,
  isPausingWorkflow,
  isResumingWorkflow,
  isDeletingWorkflow,
}: WorkflowsTabProps) {
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '8px',
      border: '1px solid #e5e5e5',
      padding: '1.5rem'
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Workflows</h2>
      {isLoading ? (
        <p>Loading workflows...</p>
      ) : workflows && workflows.length > 0 ? (
        <WorkflowHierarchy
          workflows={workflows}
          stopWorkflow={stopWorkflow}
          pauseWorkflow={pauseWorkflow}
          resumeWorkflow={resumeWorkflow}
          deleteWorkflow={deleteWorkflow}
          isStoppingWorkflow={isStoppingWorkflow}
          isPausingWorkflow={isPausingWorkflow}
          isResumingWorkflow={isResumingWorkflow}
          isDeletingWorkflow={isDeletingWorkflow}
        />
      ) : (
        <p style={{ color: '#666' }}>No workflows started yet. Click "Start Workflow" to begin.</p>
      )}
    </div>
  );
}
