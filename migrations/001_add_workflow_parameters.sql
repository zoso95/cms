-- Migration: Add workflow parameters and workflow name to workflow_executions table
-- This allows storing configurable parameters for each workflow execution

-- Add workflow_name column to track which workflow type was executed
ALTER TABLE workflow_executions
ADD COLUMN IF NOT EXISTS workflow_name TEXT;

-- Add workflow_parameters column to store JSON parameters
ALTER TABLE workflow_executions
ADD COLUMN IF NOT EXISTS workflow_parameters JSONB;

-- Add index for faster lookups by workflow name
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_name
ON workflow_executions(workflow_name);

-- Comment for documentation
COMMENT ON COLUMN workflow_executions.workflow_name IS 'The name of the workflow that was executed (e.g., recordsWorkflow, testSMSWorkflow)';
COMMENT ON COLUMN workflow_executions.workflow_parameters IS 'JSON parameters used to configure the workflow execution';
