import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { supabase } from './db';
import { getTemporalClient } from './temporal';
import { v4 as uuidv4 } from 'uuid';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  socket.on('subscribe-patient-case', (patientCaseId: number) => {
    console.log(`Client ${socket.id} subscribed to patient case ${patientCaseId}`);
    socket.join(`patient-case-${patientCaseId}`);
  });

  socket.on('unsubscribe-patient-case', (patientCaseId: number) => {
    console.log(`Client ${socket.id} unsubscribed from patient case ${patientCaseId}`);
    socket.leave(`patient-case-${patientCaseId}`);
  });
});

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

// Get available workflows catalog
app.get('/api/workflows/catalog', async (req, res) => {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Read the registry file and extract workflow metadata
    const registryPath = path.join(__dirname, '../../worker/src/workflows/registry.ts');
    const registryContent = await fs.readFile(registryPath, 'utf-8');

    // Simple workflow metadata (hardcoded for reliability)
    const workflows = [
      {
        name: 'recordsWorkflow',
        displayName: 'Medical Records Retrieval',
        description: 'Full workflow for contacting patients, collecting transcripts, and requesting medical records from providers',
        category: 'production',
        defaultParams: {
          patientOutreach: {
            maxAttempts: 7,
            waitBetweenAttempts: '1 day',
            smsTemplate: 'Please call us back to discuss your medical records.',
          },
          recordsRetrieval: {
            followUpEnabled: false,
            followUpInterval: '3 days',
            maxFollowUps: 2,
          },
          call: {
            maxDuration: 300,
          },
        },
      },
      {
        name: 'patientOutreachWorkflow',
        displayName: 'Patient Outreach',
        description: 'Contact patient via SMS and calls until they respond or max attempts reached',
        category: 'production',
        defaultParams: {
          maxAttempts: 7,
          waitBetweenAttempts: '1 day',
          smsTemplate: 'Please call us back to discuss your medical records.',
        },
      },
      {
        name: 'testSMSWorkflow',
        displayName: 'Test SMS',
        description: 'Send a test SMS to a patient',
        category: 'test',
        defaultParams: {
          message: 'Test message from Afterimage',
        },
      },
      {
        name: 'testCallWorkflow',
        displayName: 'Test Call',
        description: 'Place a test call to a patient',
        category: 'test',
        defaultParams: {
          maxDuration: 300,
        },
      },
      {
        name: 'testFaxWorkflow',
        displayName: 'Test Fax',
        description: 'Send a test fax to a number',
        category: 'test',
        defaultParams: {
          faxNumber: '',
          message: 'Test fax',
        },
      },
      {
        name: 'testEmailWorkflow',
        displayName: 'Test Email',
        description: 'Send a test email',
        category: 'test',
        defaultParams: {
          to: '',
          subject: 'Test email',
          body: 'This is a test email',
        },
      },
    ];

    res.json(workflows);
  } catch (error: any) {
    console.error('Error loading workflow catalog:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get workflow source code
app.get('/api/workflows/:workflowName/source', async (req, res) => {
  try {
    const { workflowName } = req.params;
    const fs = await import('fs/promises');
    const path = await import('path');

    // Map workflow names to file paths
    const workflowFiles: Record<string, string> = {
      recordsWorkflow: 'recordsWorkflow.ts',
      patientOutreachWorkflow: 'patientOutreachWorkflow.ts',
      recordsRetrievalWorkflow: 'recordsRetrievalWorkflow.ts',
      testSMSWorkflow: 'testWorkflows.ts',
      testCallWorkflow: 'testWorkflows.ts',
      testFaxWorkflow: 'testWorkflows.ts',
      testEmailWorkflow: 'testWorkflows.ts',
    };

    const fileName = workflowFiles[workflowName];
    if (!fileName) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const filePath = path.join(__dirname, '../../worker/src/workflows', fileName);
    const source = await fs.readFile(filePath, 'utf-8');

    res.json({ workflowName, source });
  } catch (error: any) {
    console.error('Error reading workflow source:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start workflow for a patient case
app.post('/api/workflows/start', async (req, res) => {
  try {
    const { patientCaseId, workflowName = 'recordsWorkflow', parameters = {} } = req.body;

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
    const workflowId = `${workflowName}-${patientCaseId}-${Date.now()}`;

    // Create workflow execution record
    const { data: execution, error: execError } = await supabase
      .from('workflow_executions')
      .insert({
        id: uuidv4(),
        patient_case_id: patientCaseId,
        workflow_id: workflowId,
        run_id: '', // Will be updated when we get the run ID
        status: 'running',
        workflow_name: workflowName,
        workflow_parameters: parameters,
      })
      .select()
      .single();

    if (execError) throw execError;

    // Prepare workflow args based on workflow type
    let args: any[] = [patientCaseId];
    if (workflowName === 'recordsWorkflow') {
      args = [patientCaseId, parameters];
    } else if (workflowName.startsWith('test')) {
      args = [patientCaseId, parameters];
    } else {
      // For other workflows, include parameters
      args = [patientCaseId, parameters];
    }

    // Start the workflow
    const handle = await client.workflow.start(workflowName, {
      taskQueue: 'records-workflow',
      args,
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
// Workflow Monitor
// ============================================

// Monitor running workflows and emit updates when they complete
async function monitorWorkflows() {
  try {
    const { data: runningWorkflows } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('status', 'running');

    if (!runningWorkflows || runningWorkflows.length === 0) {
      return;
    }

    const client = await getTemporalClient();

    for (const execution of runningWorkflows) {
      try {
        const handle = client.workflow.getHandle(execution.workflow_id);
        const description = await handle.describe();

        // Check if workflow completed
        if (description.status.name !== 'RUNNING') {
          const newStatus = description.status.name.toLowerCase();

          // Get failure information if workflow failed
          let errorMessage = null;
          if (newStatus === 'failed' || newStatus === 'terminated') {
            try {
              const result = await handle.result();
            } catch (err: any) {
              errorMessage = err.message || 'Unknown error';
            }
          }

          // Update database
          const updateData: any = {
            status: newStatus,
            completed_at: new Date().toISOString(),
          };

          if (errorMessage) {
            updateData.error = errorMessage;
          }

          await supabase
            .from('workflow_executions')
            .update(updateData)
            .eq('id', execution.id);

          // Emit socket event to all clients subscribed to this patient case
          io.to(`patient-case-${execution.patient_case_id}`).emit('workflow-updated', {
            executionId: execution.id,
            workflowId: execution.workflow_id,
            patientCaseId: execution.patient_case_id,
            status: newStatus,
            completedAt: new Date().toISOString(),
            error: errorMessage,
          });

          console.log(`Workflow ${execution.workflow_id} completed with status ${newStatus}${errorMessage ? `: ${errorMessage}` : ''}`);
        }
      } catch (error) {
        console.error(`Error checking workflow ${execution.workflow_id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error monitoring workflows:', error);
  }
}

// Start monitoring (check every 2 seconds)
setInterval(monitorWorkflows, 2000);

// ============================================
// Start Server
// ============================================

httpServer.listen(PORT, () => {
  console.log(`🚀 Backend API running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Temporal: ${process.env.TEMPORAL_ADDRESS || 'localhost:7233'}`);
});
