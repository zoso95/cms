-- Add status message column to track workflow progress
ALTER TABLE workflow_executions
  ADD COLUMN IF NOT EXISTS status_message TEXT;

-- Create index for efficient querying of status messages
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status_message
  ON workflow_executions(status_message)
  WHERE status_message IS NOT NULL;
