import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { supabase } from './db';
import { getTemporalClient } from './temporal';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import routes from './routes';
import * as webhookController from './controllers/webhookController';
import { validateElevenLabsSignature } from './middleware/webhookSignature';

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
app.post(
  '/api/webhooks/elevenlabs/conversation',
  express.raw({ type: '*/*' }),
  validateElevenLabsSignature,
  webhookController.handleElevenLabsWebhook
);

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

// Mount all API routes
app.use('/api', routes);

// Health check
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
