-- Make workflow_execution_id nullable in both tables
-- Inbound calls don't have a workflow execution, so this field should be optional

ALTER TABLE communication_logs
ALTER COLUMN workflow_execution_id DROP NOT NULL;

ALTER TABLE call_transcripts
ALTER COLUMN workflow_execution_id DROP NOT NULL;

-- Also make communication_log_id nullable since we might not always have it
ALTER TABLE call_transcripts
ALTER COLUMN communication_log_id DROP NOT NULL;
