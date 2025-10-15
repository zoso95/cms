interface TasksSectionProps {
  tasks: any[] | undefined;
  onInitializeTasks: () => void;
  isInitializing: boolean;
  onUpdateTaskStatus: (taskId: string, status: string) => void;
  onUpdateTaskAssignee: (taskId: string, assigned_to: string) => void;
}

function getTaskStatusColor(status: string) {
  switch (status) {
    case 'not_started': return '#9ca3af';
    case 'in_progress': return '#3b82f6';
    case 'completed': return '#10b981';
    case 'blocked': return '#f59e0b';
    case 'failed': return '#ef4444';
    default: return '#6b7280';
  }
}

function getAssigneeColors(assignee: string) {
  switch (assignee) {
    case 'AI': return { bg: '#ede9fe', color: '#6b21a8' };
    case 'Ben': return { bg: '#fef3c7', color: '#92400e' };
    case 'Geoffrey': return { bg: '#dbeafe', color: '#1e40af' };
    case 'Andrew': return { bg: '#d1fae5', color: '#065f46' };
    default: return { bg: '#f3f4f6', color: '#374151' };
  }
}

export default function TasksSection({ tasks, onInitializeTasks, isInitializing, onUpdateTaskStatus, onUpdateTaskAssignee }: TasksSectionProps) {
  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '8px',
      border: '1px solid #e5e5e5',
      padding: '1.5rem',
      marginBottom: '1.5rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>Tasks</h2>
        <button
          onClick={onInitializeTasks}
          disabled={isInitializing || (tasks && tasks.length > 0)}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: (tasks && tasks.length > 0) ? '#9ca3af' : '#2563eb',
            color: '#fff',
            cursor: (isInitializing || (tasks && tasks.length > 0)) ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500'
          }}
        >
          {isInitializing ? 'Generating...' : (tasks && tasks.length > 0) ? 'Tasks Created' : 'Generate Default Tasks'}
        </button>
      </div>
      {tasks && tasks.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e5e5' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>
                  Task
                </th>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>
                  Assigned To
                </th>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>
                  Status
                </th>
                <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase' }}>
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task: any) => (
                <tr key={task.id} style={{ borderBottom: '1px solid #e5e5e5' }}>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                    <div>
                      <div style={{ fontWeight: '500' }}>{task.task_name}</div>
                      {task.notes && (
                        <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                          {task.notes}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                    <select
                      value={task.assigned_to}
                      onChange={(e) => onUpdateTaskAssignee(task.id, e.target.value)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        border: 'none',
                        backgroundColor: getAssigneeColors(task.assigned_to).bg,
                        color: getAssigneeColors(task.assigned_to).color,
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="AI">AI</option>
                      <option value="Ben">Ben</option>
                      <option value="Geoffrey">Geoffrey</option>
                      <option value="Andrew">Andrew</option>
                    </select>
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                    <select
                      value={task.status}
                      onChange={(e) => onUpdateTaskStatus(task.id, e.target.value)}
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        border: 'none',
                        backgroundColor: getTaskStatusColor(task.status),
                        color: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="not_started">○ Not Started</option>
                      <option value="in_progress">◐ In Progress</option>
                      <option value="completed">● Completed</option>
                      <option value="blocked">⬤ Blocked</option>
                      <option value="failed">✖ Failed</option>
                    </select>
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.75rem', color: '#666' }}>
                    {new Date(task.updated_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
          <p>No tasks yet. Click "Generate Default Tasks" to create the default task list.</p>
        </div>
      )}
    </div>
  );
}
