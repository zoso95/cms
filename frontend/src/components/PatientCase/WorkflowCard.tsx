import { initTemporalUISession } from '../../utils/temporalUI';

interface WorkflowCardProps {
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
}

export default function WorkflowCard({
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
}: WorkflowCardProps) {
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
              {workflow.entity_type === 'provider' && workflow.entity_name ? (
                <>Provider: {workflow.entity_name}</>
              ) : (
                <>Entity: {workflow.entity_type} #{workflow.entity_id}</>
              )}
            </p>
          )}
          {workflow.status === 'scheduled' && workflow.scheduled_at ? (
            <p style={{ fontSize: '0.875rem', color: '#2563eb', marginTop: '0.5rem', fontWeight: '500' }}>
              Scheduled to run at: {new Date(workflow.scheduled_at).toLocaleString()}
            </p>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
              Started: {new Date(workflow.started_at).toLocaleString()}
            </p>
          )}
          {workflow.completed_at && (
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              Completed: {new Date(workflow.completed_at).toLocaleString()}
            </p>
          )}
          {workflow.status_message && (
            <p style={{ fontSize: '0.875rem', color: '#2563eb', marginTop: '0.5rem', fontWeight: '500' }}>
              Status: {workflow.status_message}
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
            href={`${import.meta.env.VITE_TEMPORAL_UI_URL || 'http://localhost:3001/api/temporal-ui'}/namespaces/default/workflows/${workflow.workflow_id}/${workflow.run_id}`}
            onMouseEnter={() => {
              // Pre-initialize session when user hovers over link
              initTemporalUISession();
            }}
            style={{
              display: 'inline-block',
              marginTop: '0.5rem',
              color: '#2563eb',
              fontSize: '0.875rem',
              textDecoration: 'underline',
              cursor: 'pointer',
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
              workflow.status === 'scheduled'
                ? '#8b5cf6'
                : workflow.status === 'running'
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
