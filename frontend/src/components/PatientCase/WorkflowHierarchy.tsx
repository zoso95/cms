import WorkflowCard from './WorkflowCard';

interface WorkflowHierarchyProps {
  workflows: any[];
  stopWorkflow: (workflowId: string) => void;
  pauseWorkflow: (workflowId: string) => void;
  resumeWorkflow: (workflowId: string) => void;
  deleteWorkflow: (executionId: string) => void;
  isStoppingWorkflow: boolean;
  isPausingWorkflow: boolean;
  isResumingWorkflow: boolean;
  isDeletingWorkflow: boolean;
}

export default function WorkflowHierarchy({
  workflows,
  stopWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  deleteWorkflow,
  isStoppingWorkflow,
  isPausingWorkflow,
  isResumingWorkflow,
  isDeletingWorkflow,
}: WorkflowHierarchyProps) {
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
          {childrenByParent[parent.workflow_id]
            ?.sort((a: any, b: any) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
            .map((child: any) => (
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
