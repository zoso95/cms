-- Add workflow hierarchy tracking columns and metadata
-- This enables tracking parent-child workflow relationships and flexible entity types

-- First add the workflow_name and parameters columns that are missing from the base schema
ALTER TABLE workflow_executions
  ADD COLUMN IF NOT EXISTS workflow_name TEXT,
  ADD COLUMN IF NOT EXISTS parameters JSONB DEFAULT '{}'::jsonb;

-- Now add the hierarchy columns
ALTER TABLE workflow_executions
  ADD COLUMN IF NOT EXISTS parent_workflow_id TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT;

-- Create indexes for efficient queries
CREATE INDEX idx_workflow_executions_parent_workflow_id
  ON workflow_executions(parent_workflow_id)
  WHERE parent_workflow_id IS NOT NULL;

CREATE INDEX idx_workflow_executions_entity
  ON workflow_executions(entity_type, entity_id)
  WHERE entity_type IS NOT NULL AND entity_id IS NOT NULL;

-- Add comment to clarify the schema
COMMENT ON COLUMN workflow_executions.parent_workflow_id IS 'The workflow_id of the parent workflow that started this child workflow';
COMMENT ON COLUMN workflow_executions.entity_type IS 'Type of entity this workflow operates on (e.g., patient, provider, facility)';
COMMENT ON COLUMN workflow_executions.entity_id IS 'ID of the entity this workflow operates on (flexible, can be integer or UUID as string)';
COMMENT ON COLUMN workflow_executions.patient_case_id IS 'Primary entity - every workflow is associated with a patient case';

-- Add missing metadata columns (workflow_name and parameters)
ALTER TABLE workflow_executions
  ADD COLUMN IF NOT EXISTS workflow_name TEXT,
  ADD COLUMN IF NOT EXISTS parameters JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_name
  ON workflow_executions(workflow_name)
  WHERE workflow_name IS NOT NULL;

COMMENT ON COLUMN workflow_executions.workflow_name IS 'Human-readable name of the workflow (e.g., endToEndWorkflow, patientOutreachWorkflow)';
COMMENT ON COLUMN workflow_executions.parameters IS 'JSON parameters passed to the workflow at start time';

-- Make run_id nullable so we can register child workflows before they start
-- (Child workflows are registered immediately, but run_id comes after executeChild starts)
ALTER TABLE workflow_executions
  ALTER COLUMN run_id DROP NOT NULL;
