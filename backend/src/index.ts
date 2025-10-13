import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { supabase } from './db';
import { getTemporalClient } from './temporal';
import { v4 as uuidv4 } from 'uuid';

config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ============================================
// Patient Cases Routes
// ============================================

// Get all patient cases
app.get('/api/patient-cases', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patient_cases')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get patient cases with workflows
app.get('/api/patient-cases-with-workflows', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('workflow_executions')
      .select('patient_case_id')
      .order('started_at', { ascending: false });

    if (error) throw error;

    // Get unique patient case IDs
    const patientCaseIds = [...new Set(data.map(w => w.patient_case_id))];

    // Fetch patient cases
    const { data: cases, error: casesError } = await supabase
      .from('patient_cases')
      .select('*')
      .in('id', patientCaseIds)
      .order('created_at', { ascending: false });

    if (casesError) throw casesError;

    res.json(cases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single patient case
app.get('/api/patient-cases/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('patient_cases')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Workflow Routes
// ============================================

// Start workflow for a patient case
app.post('/api/workflows/start', async (req, res) => {
  try {
    const { patientCaseId } = req.body;

    if (!patientCaseId) {
      return res.status(400).json({ error: 'patientCaseId is required' });
    }

    // Check if patient case exists
    const { data: patientCase, error: caseError } = await supabase
      .from('patient_cases')
      .select('*')
      .eq('id', patientCaseId)
      .single();

    if (caseError) throw caseError;
    if (!patientCase) {
      return res.status(404).json({ error: 'Patient case not found' });
    }

    const client = await getTemporalClient();
    const workflowId = `records-workflow-${patientCaseId}-${Date.now()}`;

    // Create workflow execution record
    const { data: execution, error: execError } = await supabase
      .from('workflow_executions')
      .insert({
        id: uuidv4(),
        patient_case_id: patientCaseId,
        workflow_id: workflowId,
        run_id: '', // Will be updated when we get the run ID
        status: 'running',
      })
      .select()
      .single();

    if (execError) throw execError;

    // Start the workflow
    const handle = await client.workflow.start('recordsWorkflow', {
      taskQueue: 'records-workflow',
      args: [patientCaseId],
      workflowId,
    });

    // Update with run ID
    await supabase
      .from('workflow_executions')
      .update({ run_id: handle.firstExecutionRunId })
      .eq('id', execution.id);

    // Update patient case status
    await supabase
      .from('patient_cases')
      .update({ status: 'in_progress' })
      .eq('id', patientCaseId);

    res.json({
      workflowId,
      runId: handle.firstExecutionRunId,
      executionId: execution.id,
    });
  } catch (error: any) {
    console.error('Error starting workflow:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get workflow status
app.get('/api/workflows/:workflowId', async (req, res) => {
  try {
    const { workflowId } = req.params;

    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    const description = await handle.describe();

    res.json({
      workflowId: description.workflowId,
      runId: description.runId,
      status: description.status.name,
      startTime: description.startTime,
      closeTime: description.closeTime,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get workflows for a patient case
app.get('/api/patient-cases/:id/workflows', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('patient_case_id', req.params.id)
      .order('started_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send signal to workflow
app.post('/api/workflows/:workflowId/signal', async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { signalName, signalArgs } = req.body;

    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    await handle.signal(signalName, ...signalArgs);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Stop/terminate workflow
app.post('/api/workflows/:workflowId/stop', async (req, res) => {
  try {
    const { workflowId } = req.params;

    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    await handle.terminate('Stopped by user');

    // Update database
    await supabase
      .from('workflow_executions')
      .update({
        status: 'terminated',
        completed_at: new Date().toISOString(),
        error: 'Stopped by user'
      })
      .eq('workflow_id', workflowId);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete workflow execution record
app.delete('/api/workflows/:executionId', async (req, res) => {
  try {
    const { executionId } = req.params;

    const { error } = await supabase
      .from('workflow_executions')
      .delete()
      .eq('id', executionId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Communication Logs Routes
// ============================================

app.get('/api/patient-cases/:id/communications', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('communication_logs')
      .select('*')
      .eq('patient_case_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Providers Routes
// ============================================

app.get('/api/patient-cases/:id/providers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .eq('patient_case_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Transcripts Routes
// ============================================

app.get('/api/patient-cases/:id/transcripts', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('call_transcripts')
      .select('*')
      .eq('patient_case_id', req.params.id)
      .order('created_at', { ascending: false});

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Webhook Routes
// ============================================

// Twilio SMS webhook
app.post('/api/webhooks/twilio/sms', async (req, res) => {
  try {
    const { From, Body, MessageSid } = req.body;

    // Find patient case by phone
    const { data: patientCase } = await supabase
      .from('patient_cases')
      .select('id')
      .eq('phone', From)
      .single();

    if (!patientCase) {
      return res.status(404).json({ error: 'Patient case not found' });
    }

    // Find running workflow for this patient
    const { data: execution } = await supabase
      .from('workflow_executions')
      .select('workflow_id')
      .eq('patient_case_id', patientCase.id)
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (execution) {
      // Send signal to workflow
      const client = await getTemporalClient();
      const handle = client.workflow.getHandle(execution.workflow_id);
      await handle.signal('userResponse', {
        message: Body,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Twilio Voice webhook
app.post('/api/webhooks/twilio/voice', (req, res) => {
  const twiml = `
    <Response>
      <Say>Thank you for calling. This call is being recorded for quality assurance.</Say>
      <Record maxLength="300" transcribe="true" transcribeCallback="/api/webhooks/twilio/transcription" />
    </Response>
  `;
  res.type('text/xml');
  res.send(twiml);
});

// Twilio Transcription webhook
app.post('/api/webhooks/twilio/transcription', async (req, res) => {
  try {
    const { TranscriptionText, CallSid } = req.body;

    // Store transcription
    // In a real implementation, you'd link this to the appropriate patient case and workflow

    console.log('Transcription received:', TranscriptionText);

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Transcription webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Health Check
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log(`🚀 Backend API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Temporal: ${process.env.TEMPORAL_ADDRESS || 'localhost:7233'}`);
});
