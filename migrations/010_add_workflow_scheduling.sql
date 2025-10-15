-- ============================================
-- Add Workflow Scheduling Support
-- ============================================

-- Add scheduled_at column to workflow_executions
ALTER TABLE workflow_executions
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Add schedule_id column to track Temporal schedule ID
ALTER TABLE workflow_executions
ADD COLUMN IF NOT EXISTS schedule_id TEXT;

-- Add index for efficient querying of scheduled workflows
CREATE INDEX IF NOT EXISTS idx_workflow_executions_scheduled_at
ON workflow_executions(scheduled_at)
WHERE scheduled_at IS NOT NULL AND status = 'scheduled';

-- Update status check constraint to include 'scheduled'
ALTER TABLE workflow_executions
DROP CONSTRAINT IF EXISTS workflow_executions_status_check;

ALTER TABLE workflow_executions
ADD CONSTRAINT workflow_executions_status_check
CHECK (status IN ('scheduled', 'running', 'completed', 'failed', 'terminated'));
