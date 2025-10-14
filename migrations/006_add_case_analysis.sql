-- Create claude_case_analysis table to store AI-powered case evaluations
CREATE TABLE IF NOT EXISTS claude_case_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_case_id BIGINT NOT NULL REFERENCES patient_cases(id) ON DELETE CASCADE,
  workflow_execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
  call_transcript_id UUID REFERENCES call_transcripts(id) ON DELETE SET NULL,

  -- Overall scores
  quality_score DECIMAL(3,1), -- Calculated mean of core scales (0-10)

  -- Core analysis
  summary TEXT,
  medical_subject TEXT,

  -- Full analysis data (JSONB for flexibility)
  patient_info JSONB,
  doctor_info_quality JSONB,
  core_scales JSONB,
  case_factors JSONB,
  legal_practical_factors JSONB,
  call_quality_assessment JSONB,
  next_actions JSONB,
  compliance_notes JSONB,
  overall_case_assessment JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_claude_case_analysis_patient_case_id ON claude_case_analysis(patient_case_id);
CREATE INDEX IF NOT EXISTS idx_claude_case_analysis_quality_score ON claude_case_analysis(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_claude_case_analysis_created_at ON claude_case_analysis(created_at DESC);

-- Only one analysis per patient case (can be updated/replaced)
CREATE UNIQUE INDEX IF NOT EXISTS idx_claude_case_analysis_unique_patient ON claude_case_analysis(patient_case_id);
