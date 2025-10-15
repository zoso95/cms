-- ============================================
-- Add Case Tasks Table
-- ============================================
-- This table tracks individual tasks for each patient case
-- allowing fine-grained progress tracking through the workflow pipeline

CREATE TABLE case_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_case_id BIGINT NOT NULL REFERENCES patient_cases(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  assigned_to TEXT NOT NULL, -- 'AI' or 'Ben' or user name
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed', 'blocked', 'failed')),
  notes TEXT, -- Additional context (e.g., "Found 3 providers", "Waiting for fax confirmation")
  sort_order INTEGER NOT NULL, -- Display order (1-7 for default tasks)
  metadata JSONB DEFAULT '{}', -- Flexible field for task-specific data
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(patient_case_id, task_name)
);

CREATE INDEX idx_case_tasks_patient_case_id ON case_tasks(patient_case_id);
CREATE INDEX idx_case_tasks_status ON case_tasks(status);
CREATE INDEX idx_case_tasks_assigned_to ON case_tasks(assigned_to);

-- Trigger for updated_at
CREATE TRIGGER update_case_tasks_updated_at
  BEFORE UPDATE ON case_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
