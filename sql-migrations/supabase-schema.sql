-- ============================================
-- NOTE: Using existing patient_cases table
-- No need to create leads table - it already exists
-- ============================================

-- ============================================
-- Workflow Executions Table
-- ============================================
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_case_id BIGINT NOT NULL REFERENCES patient_cases(id) ON DELETE CASCADE,
  workflow_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'terminated')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  UNIQUE(workflow_id, run_id)
);

CREATE INDEX idx_workflow_executions_patient_case_id ON workflow_executions(patient_case_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started_at ON workflow_executions(started_at);

-- ============================================
-- Communication Logs Table
-- ============================================
CREATE TABLE IF NOT EXISTS communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_case_id BIGINT NOT NULL REFERENCES patient_cases(id) ON DELETE CASCADE,
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sms', 'call', 'email', 'fax')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'received')),
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_communication_logs_patient_case_id ON communication_logs(patient_case_id);
CREATE INDEX idx_communication_logs_workflow_execution_id ON communication_logs(workflow_execution_id);
CREATE INDEX idx_communication_logs_type ON communication_logs(type);
CREATE INDEX idx_communication_logs_created_at ON communication_logs(created_at);

-- ============================================
-- Call Transcripts Table
-- ============================================
CREATE TABLE IF NOT EXISTS call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_case_id BIGINT NOT NULL REFERENCES patient_cases(id) ON DELETE CASCADE,
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  communication_log_id UUID NOT NULL REFERENCES communication_logs(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,
  analysis JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_transcripts_patient_case_id ON call_transcripts(patient_case_id);
CREATE INDEX idx_call_transcripts_workflow_execution_id ON call_transcripts(workflow_execution_id);

-- ============================================
-- Providers Table
-- ============================================
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_case_id BIGINT NOT NULL REFERENCES patient_cases(id) ON DELETE CASCADE,
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialty TEXT,
  contact_method TEXT CHECK (contact_method IN ('email', 'fax')),
  contact_info TEXT,
  verified BOOLEAN DEFAULT FALSE,
  records_received BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_providers_patient_case_id ON providers(patient_case_id);
CREATE INDEX idx_providers_workflow_execution_id ON providers(workflow_execution_id);

-- ============================================
-- Records Requests Table
-- ============================================
CREATE TABLE IF NOT EXISTS records_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  workflow_execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'awaiting_signature', 'sent', 'received', 'failed')),
  signature_url TEXT,
  signed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_records_requests_provider_id ON records_requests(provider_id);
CREATE INDEX idx_records_requests_status ON records_requests(status);

-- ============================================
-- Webhook Events Table
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_case_id BIGINT REFERENCES patient_cases(id) ON DELETE SET NULL,
  workflow_execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);

-- ============================================
-- Updated At Trigger Function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
