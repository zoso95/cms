-- Add pause/resume support to workflows
-- Allows workflows to be paused and resumed, with hierarchical propagation

ALTER TABLE workflow_executions
  ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_workflow_executions_paused
  ON workflow_executions(paused)
  WHERE paused = true;

COMMENT ON COLUMN workflow_executions.paused IS 'Whether this workflow is currently paused';
