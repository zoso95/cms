-- Table to track ElevenLabs calls and associate them with workflows
CREATE TABLE IF NOT EXISTS elevenlabs_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_case_id INTEGER NOT NULL REFERENCES patient_cases(id),
  workflow_id TEXT NOT NULL,
  conversation_id TEXT UNIQUE,
  call_sid TEXT,
  to_number TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  talked_to_human BOOLEAN,
  failure_reason TEXT,
  transcript JSONB,
  transcript_text TEXT,
  variables_collected JSONB,
  analysis JSONB,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_elevenlabs_calls_conversation_id ON elevenlabs_calls(conversation_id);
CREATE INDEX IF NOT EXISTS idx_elevenlabs_calls_workflow_id ON elevenlabs_calls(workflow_id);
CREATE INDEX IF NOT EXISTS idx_elevenlabs_calls_patient_case_id ON elevenlabs_calls(patient_case_id);
CREATE INDEX IF NOT EXISTS idx_elevenlabs_calls_status ON elevenlabs_calls(status);
