-- ============================================
-- Remove Schedule ID (No longer needed)
-- ============================================
-- We're using Temporal's startDelay option instead of Schedules
-- for one-time delayed workflow execution

-- Drop the index
DROP INDEX IF EXISTS idx_workflow_executions_scheduled_at;

-- Drop the schedule_id column
ALTER TABLE workflow_executions
DROP COLUMN IF EXISTS schedule_id;
