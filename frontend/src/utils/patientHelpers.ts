export function getPriorityLabel(priority: number | null | undefined): string {
  switch (priority) {
    case 0:
      return 'None';
    case 1:
      return 'Low';
    case 2:
      return 'Med';
    case 3:
      return 'High';
    case 4:
      return 'Critical';
    default:
      return 'None';
  }
}

export function getPriorityColor(priority: number | null | undefined): string {
  switch (priority) {
    case 0:
      return '#9ca3af'; // gray - no priority
    case 1:
      return '#3b82f6'; // blue - low priority
    case 2:
      return '#f59e0b'; // amber - medium priority
    case 3:
      return '#f97316'; // orange - high priority
    case 4:
      return '#dc2626'; // red - critical priority
    default:
      return '#9ca3af'; // gray - default
  }
}

export function getStatusColor(status: string | null): string {
  switch (status?.toLowerCase()) {
    case 'confirmed':
      return '#10b981'; // green - positive outcome
    case 'stopped_engaging':
      return '#f59e0b'; // amber - warning/paused
    case 'disqualified':
      return '#ef4444'; // red - negative outcome
    case 'chat_consultation':
      return '#8b5cf6'; // purple - special consultation type
    case 'in_progress':
      return '#3b82f6'; // blue - actively working
    case 'pending':
      return '#9ca3af'; // gray - waiting to start
    case 'contacted':
      return '#06b6d4'; // cyan - initial contact made
    case 'completed':
      return '#10b981'; // green - successfully finished
    case 'failed':
      return '#ef4444'; // red - failed
    default:
      return '#6b7280'; // dark gray - unknown status
  }
}
