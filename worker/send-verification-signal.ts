/**
 * Manual script to send verification signals to a workflow
 *
 * Usage:
 *   npx ts-node send-verification-signal.ts <workflow-id> <verification-id> <approve|reject>
 *
 * Example:
 *   npx ts-node send-verification-signal.ts intakeCallWorkflow-4054-1760590201844 abc-123-def approve
 */

import { Connection, Client } from '@temporalio/client';

async function sendVerificationSignal() {
  const [workflowId, verificationId, action] = process.argv.slice(2);

  if (!workflowId || !verificationId || !action) {
    console.error('Usage: npx ts-node send-verification-signal.ts <workflow-id> <verification-id> <approve|reject>');
    console.error('');
    console.error('Example:');
    console.error('  npx ts-node send-verification-signal.ts intakeCallWorkflow-4054-1760590201844 abc-123 approve');
    process.exit(1);
  }

  const approved = action.toLowerCase() === 'approve';

  console.log(`Sending verification signal to workflow ${workflowId}`);
  console.log(`  Verification ID: ${verificationId}`);
  console.log(`  Action: ${approved ? 'APPROVE' : 'REJECT'}`);

  try {
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    });

    const client = new Client({ connection });

    const handle = client.workflow.getHandle(workflowId);

    const payload = approved ? {
      verificationId,
      faxNumber: '555-123-4567', // Example data
      email: 'provider@example.com',
    } : {
      verificationId,
      rejection_reason: 'Manual rejection via script',
    };

    console.log(`Sending payload:`, payload);

    await handle.signal('verificationComplete', approved, payload);

    console.log(`✅ Signal sent successfully!`);
  } catch (error: any) {
    console.error(`❌ Error sending signal: ${error.message}`);
    process.exit(1);
  }
}

sendVerificationSignal();
