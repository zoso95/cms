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

// ElevenLabs webhook route MUST come before express.json() to preserve raw body
app.post('/api/webhooks/elevenlabs/conversation', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    console.log('🎯 ElevenLabs webhook received!');
    console.log('📋 Headers:', req.headers);

    // Validate ElevenLabs webhook signature
    const signature = req.headers['elevenlabs-signature'];
    if (!signature) {
      console.error('❌ Missing ElevenLabs-Signature header');
      return res.status(403).send('Missing signature header');
    }

    const crypto = require('crypto');

    // Use environment-specific webhook secret
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev';
    const secret = isDevelopment
      ? process.env.ELEVENLABS_WEBHOOK_SECRET_DEV
      : process.env.ELEVENLABS_WEBHOOK_SECRET_PROD;

    if (!secret) {
      console.error(`❌ Missing webhook secret for ${isDevelopment ? 'development' : 'production'} environment`);
      console.error(`   Set ELEVENLABS_WEBHOOK_SECRET_${isDevelopment ? 'DEV' : 'PROD'} in .env`);
      return res.status(500).send('Webhook secret not configured');
    }

    console.log(`🔐 Using ${isDevelopment ? 'development' : 'production'} webhook secret`);

    // Parse signature header
    const headers = signature.toString().split(',');
    const timestampHeader = headers.find((e: string) => e.startsWith('t='));
    const sigHeader = headers.find((e: string) => e.startsWith('v0='));

    if (!timestampHeader || !sigHeader) {
      console.error('❌ Invalid signature header format');
      return res.status(403).send('Invalid signature header format');
    }

    const timestamp = timestampHeader.substring(2);
    const sig = sigHeader;

    // Validate timestamp (within 30 minutes)
    const reqTimestamp = parseInt(timestamp) * 1000;
    const tolerance = Date.now() - 30 * 60 * 1000;
    if (reqTimestamp < tolerance) {
      console.error('❌ Request expired');
      return res.status(403).send('Request expired');
    }

    // Validate signature
    const message = `${timestamp}.${req.body}`;
    const digest = 'v0=' + crypto.createHmac('sha256', secret).update(message).digest('hex');

    if (sig !== digest) {
      console.error('❌ Invalid signature');
      console.info('Expected:', digest);
      console.info('Received:', sig);
      return res.status(401).send('Request unauthorized');
    }

    console.log('✅ ElevenLabs webhook signature validated');

    // Parse the JSON body (since we received it as raw buffer)
    const webhookData = JSON.parse(req.body.toString());
    console.log('📦 Parsed webhook data:', JSON.stringify(webhookData, null, 2));

    const { type, data } = webhookData;

    // Log webhook event to database (before processing)
    const webhookEventId = uuidv4();
    await supabase.from('webhook_events').insert({
      id: webhookEventId,
      event_type: `elevenlabs:${type}`,
      payload: webhookData,
      processed: false,
    });
    console.log(`✅ Logged webhook event ${webhookEventId} to database`);

    switch (type) {
      case 'post_call_transcription':
        console.log(`🏁 Post-call transcription received for conversation: ${data.conversation_id}`);
        console.log(`📞 Call duration: ${data.metadata?.call_duration_secs} seconds`);
        console.log(`✅ Call successful: ${data.analysis?.call_successful}`);

        // Find the call record
        const { data: callRecord } = await supabase
          .from('elevenlabs_calls')
          .select('*')
          .eq('conversation_id', data.conversation_id)
          .maybeSingle();

        if (!callRecord) {
          console.error(`❌ No call record found for conversation ${data.conversation_id}`);
          // Mark webhook as processed with error
          await supabase.from('webhook_events').update({
            processed: true,
            workflow_execution_id: null,
          }).eq('id', webhookEventId);
          return res.status(404).json({ error: 'Call record not found' });
        }

        // Update webhook event with related IDs
        await supabase.from('webhook_events').update({
          patient_case_id: callRecord.patient_case_id,
          workflow_execution_id: callRecord.id,
        }).eq('id', webhookEventId);

        // Extract whether human was reached from evaluation criteria
        // ElevenLabs returns: { talked_to_a_human: { result: "success" | "failure", ... } }
        const evaluationResults = data.analysis?.evaluation_criteria_results || {};
        const humanContactResult = evaluationResults.talked_to_a_human?.result;
        const talkedToHuman = humanContactResult === 'success';

        console.log(`👤 Talked to human: ${talkedToHuman} (result: ${humanContactResult})`);

        // Create plain text transcript
        let transcriptText = '';
        if (data.transcript && Array.isArray(data.transcript)) {
          transcriptText = data.transcript
            .map((exchange: any) => `${exchange.role}: ${exchange.message}`)
            .join('\n');
        }

        // Extract collected variables
        const collectedVariables: Record<string, any> = {};
        if (data.analysis?.data_collection_results) {
          Object.entries(data.analysis.data_collection_results).forEach(([key, value]: [string, any]) => {
            collectedVariables[key] = value?.value || value;
          });
        }

        // Update the call record
        const { error: updateError } = await supabase
          .from('elevenlabs_calls')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            duration_seconds: data.metadata?.call_duration_secs || 0,
            talked_to_human: talkedToHuman,
            transcript: data.transcript,
            transcript_text: transcriptText,
            variables_collected: collectedVariables,
            analysis: data.analysis,
          })
          .eq('id', callRecord.id);

        if (updateError) {
          console.error(`❌ Failed to update call record: ${updateError.message}`);
          return res.status(500).json({ error: updateError.message });
        }

        console.log(`✅ Updated call record ${callRecord.id} - talked_to_human: ${talkedToHuman}`);

        // Log to communication_logs
        await supabase
          .from('communication_logs')
          .insert({
            id: uuidv4(),
            patient_case_id: callRecord.patient_case_id,
            workflow_execution_id: callRecord.id,
            type: 'call',
            direction: 'outbound',
            status: 'completed',
            content: transcriptText,
            metadata: {
              conversation_id: data.conversation_id,
              call_sid: callRecord.call_sid,
              duration_seconds: data.metadata?.call_duration_secs || 0,
              talked_to_human: talkedToHuman,
              variables_collected: collectedVariables,
            },
          });

        console.log(`✅ Logged call completion to communication_logs`);

        // Send signal to workflow
        try {
          const client = await getTemporalClient();
          const handle = client.workflow.getHandle(callRecord.workflow_id);

          await handle.signal('callCompleted', {
            conversationId: data.conversation_id,
            talkedToHuman,
            failed: false,
          });

          console.log(`✅ Sent callCompleted signal to workflow ${callRecord.workflow_id}`);
        } catch (error: any) {
          console.error(`❌ Failed to send signal to workflow: ${error.message}`);
          // Don't fail the webhook - the workflow will fall back to polling
        }

        // Mark webhook as successfully processed
        await supabase.from('webhook_events').update({
          processed: true,
        }).eq('id', webhookEventId);

        break;

      case 'call_initiation_failure':
        console.log(`❌ Call initiation failure for conversation: ${data.conversation_id}`);
        console.log(`   Failure reason: ${data.failure_reason}`);

        // Find the call record by conversation_id or call_sid
        const failureCallSid = data.metadata?.body?.CallSid || data.metadata?.body?.call_sid;

        let { data: failedCall } = await supabase
          .from('elevenlabs_calls')
          .select('*')
          .eq('conversation_id', data.conversation_id)
          .maybeSingle();

        if (!failedCall && failureCallSid) {
          const result = await supabase
            .from('elevenlabs_calls')
            .select('*')
            .eq('call_sid', failureCallSid)
            .maybeSingle();
          failedCall = result.data;
        }

        if (!failedCall) {
          console.error(`❌ No call record found for failed conversation ${data.conversation_id}`);
          // Mark webhook as processed with error
          await supabase.from('webhook_events').update({
            processed: true,
          }).eq('id', webhookEventId);
          return res.status(404).json({ error: 'Call record not found' });
        }

        // Update webhook event with related IDs
        await supabase.from('webhook_events').update({
          patient_case_id: failedCall.patient_case_id,
          workflow_execution_id: failedCall.id,
        }).eq('id', webhookEventId);

        // Update the call record to mark it as failed
        const { error: failureUpdateError } = await supabase
          .from('elevenlabs_calls')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            failure_reason: data.failure_reason,
            talked_to_human: false,
            analysis: {
              failure_reason: data.failure_reason,
              failure_metadata: data.metadata,
            },
          })
          .eq('id', failedCall.id);

        if (failureUpdateError) {
          console.error(`❌ Failed to update call record: ${failureUpdateError.message}`);
          return res.status(500).json({ error: failureUpdateError.message });
        }

        console.log(`✅ Marked call ${failedCall.id} as failed (${data.failure_reason})`);

        // Log to communication_logs
        await supabase
          .from('communication_logs')
          .insert({
            id: uuidv4(),
            patient_case_id: failedCall.patient_case_id,
            workflow_execution_id: failedCall.id,
            type: 'call',
            direction: 'outbound',
            status: 'failed',
            content: `Call failed: ${data.failure_reason}`,
            metadata: {
              conversation_id: data.conversation_id,
              call_sid: failedCall.call_sid,
              failure_reason: data.failure_reason,
              failure_metadata: data.metadata,
            },
          });

        console.log(`✅ Logged call failure to communication_logs`);

        // Send signal to workflow
        try {
          const client = await getTemporalClient();
          const handle = client.workflow.getHandle(failedCall.workflow_id);

          await handle.signal('callCompleted', {
            conversationId: data.conversation_id,
            talkedToHuman: false,
            failed: true,
            failureReason: data.failure_reason,
          });

          console.log(`✅ Sent callCompleted signal to workflow ${failedCall.workflow_id}`);
        } catch (error: any) {
          console.error(`❌ Failed to send signal to workflow: ${error.message}`);
          // Don't fail the webhook - the workflow will fall back to polling
        }

        // Mark webhook as successfully processed
        await supabase.from('webhook_events').update({
          processed: true,
        }).eq('id', webhookEventId);

        break;

      default:
        console.log(`📋 Unknown event type: ${type}`);
        // Mark webhook as processed (even though we don't handle it)
        await supabase.from('webhook_events').update({
          processed: true,
        }).eq('id', webhookEventId);
    }

    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    console.error('Error handling ElevenLabs webhook:', error);
    res.status(500).json({ error: error.message });
  }
});

// Apply JSON parsing to all other routes
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
        name: 'endToEndWorkflow',
        displayName: 'End-to-End Medical Records',
        description: 'Complete workflow: patient outreach, transcript collection, provider records retrieval, and downstream analysis',
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
      endToEndWorkflow: 'recordsWorkflow.ts',
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
    const { patientCaseId, workflowName = 'endToEndWorkflow', parameters = {} } = req.body;

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
        parameters: parameters,
      })
      .select()
      .single();

    if (execError) throw execError;

    // Prepare workflow args based on workflow type
    let args: any[] = [patientCaseId];
    if (workflowName === 'endToEndWorkflow') {
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

    // Get workflow status from Temporal
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    const description = await handle.describe();

    // Get additional metadata from database (includes hierarchy info)
    const { data: dbRecord } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('workflow_id', workflowId)
      .maybeSingle();

    res.json({
      workflowId: description.workflowId,
      runId: description.runId,
      status: description.status.name,
      startTime: description.startTime,
      closeTime: description.closeTime,
      // Include database metadata if available
      ...(dbRecord && {
        patientCaseId: dbRecord.patient_case_id,
        parentWorkflowId: dbRecord.parent_workflow_id,
        entityType: dbRecord.entity_type,
        entityId: dbRecord.entity_id,
        workflowName: dbRecord.workflow_name,
        parameters: dbRecord.parameters,
      }),
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

    // Enrich workflows with provider names
    const enrichedWorkflows = await Promise.all(
      (data || []).map(async (workflow) => {
        if (workflow.entity_type === 'provider' && workflow.entity_id) {
          const { data: provider } = await supabase
            .from('providers')
            .select('full_name, name')
            .eq('id', workflow.entity_id)
            .maybeSingle();

          return {
            ...workflow,
            entity_name: provider?.full_name || provider?.name || null,
          };
        }
        return workflow;
      })
    );

    res.json(enrichedWorkflows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get child workflows for a parent workflow
app.get('/api/workflows/:workflowId/children', async (req, res) => {
  try {
    const { workflowId } = req.params;

    const { data, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('parent_workflow_id', workflowId)
      .order('started_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
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

// Pause workflow
app.post('/api/workflows/:workflowId/pause', async (req, res) => {
  try {
    const { workflowId } = req.params;

    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);

    // Send pause signal
    await handle.signal('pause');

    // Update database
    await supabase
      .from('workflow_executions')
      .update({ paused: true })
      .eq('workflow_id', workflowId);

    // Get child workflows
    const { data: children } = await supabase
      .from('workflow_executions')
      .select('workflow_id')
      .eq('parent_workflow_id', workflowId)
      .eq('status', 'running');

    // Pause all children
    if (children && children.length > 0) {
      for (const child of children) {
        try {
          const childHandle = client.workflow.getHandle(child.workflow_id);
          await childHandle.signal('pause');

          await supabase
            .from('workflow_executions')
            .update({ paused: true })
            .eq('workflow_id', child.workflow_id);
        } catch (error) {
          console.error(`Failed to pause child ${child.workflow_id}:`, error);
        }
      }
    }

    res.json({ success: true, childrenPaused: children?.length || 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Resume workflow
app.post('/api/workflows/:workflowId/resume', async (req, res) => {
  try {
    const { workflowId } = req.params;

    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);

    // Send resume signal
    await handle.signal('resume');

    // Update database
    await supabase
      .from('workflow_executions')
      .update({ paused: false })
      .eq('workflow_id', workflowId);

    // Get child workflows
    const { data: children } = await supabase
      .from('workflow_executions')
      .select('workflow_id')
      .eq('parent_workflow_id', workflowId)
      .eq('status', 'running');

    // Resume all children
    if (children && children.length > 0) {
      for (const child of children) {
        try {
          const childHandle = client.workflow.getHandle(child.workflow_id);
          await childHandle.signal('resume');

          await supabase
            .from('workflow_executions')
            .update({ paused: false })
            .eq('workflow_id', child.workflow_id);
        } catch (error) {
          console.error(`Failed to resume child ${child.workflow_id}:`, error);
        }
      }
    }

    res.json({ success: true, childrenResumed: children?.length || 0 });
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
// Claude Analysis Routes
// ============================================

app.get('/api/patient-cases/:id/analysis', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('claude_case_analysis')
      .select('*')
      .eq('patient_case_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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

        // Update run_id if it's missing (for child workflows registered before starting)
        if (!execution.run_id && description.runId) {
          await supabase
            .from('workflow_executions')
            .update({ run_id: description.runId })
            .eq('id', execution.id);
        }

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

          // Also update run_id if we didn't have it before
          if (!execution.run_id && description.runId) {
            updateData.run_id = description.runId;
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
