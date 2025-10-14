-- Create provider_verifications table for manual verification workflow
CREATE TABLE IF NOT EXISTS provider_verifications (
  id UUID PRIMARY KEY,
  patient_case_id INTEGER NOT NULL REFERENCES patient_cases(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES providers(id) ON DELETE SET NULL,
  workflow_execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,
  call_transcript_id UUID REFERENCES call_transcripts(id) ON DELETE SET NULL,

  -- What was extracted from the call
  extracted_provider_info JSONB NOT NULL,

  -- What NPI lookup returned (null if nothing found)
  npi_lookup_results JSONB,

  -- Verification status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Final verified contact info after human review
  verified_contact_info JSONB,

  -- Who verified and when
  verified_by TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_provider_verifications_patient_case ON provider_verifications(patient_case_id);
CREATE INDEX IF NOT EXISTS idx_provider_verifications_status ON provider_verifications(status);
CREATE INDEX IF NOT EXISTS idx_provider_verifications_provider ON provider_verifications(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_verifications_workflow ON provider_verifications(workflow_execution_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_provider_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER provider_verifications_updated_at
  BEFORE UPDATE ON provider_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_provider_verifications_updated_at();

COMMENT ON TABLE provider_verifications IS 'Manual verification requests for provider contact information from NPI lookup';
COMMENT ON COLUMN provider_verifications.extracted_provider_info IS 'Provider information extracted from call transcript by Claude';
COMMENT ON COLUMN provider_verifications.npi_lookup_results IS 'Results returned by NPI registry lookup (null if no results found)';
COMMENT ON COLUMN provider_verifications.verified_contact_info IS 'Final verified contact information after manual review';
