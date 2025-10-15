import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';
import { config } from 'dotenv';
import path from 'path';

// Debug: Check environment before loading .env
console.log('🔍 TEMPORAL_ADDRESS before dotenv:', process.env.TEMPORAL_ADDRESS);

// Load environment variables (dotenv won't override existing env vars)
config();

// Debug: Check environment after loading .env
console.log('🔍 TEMPORAL_ADDRESS after dotenv:', process.env.TEMPORAL_ADDRESS);

async function run() {
  // Create connection to Temporal server
  const temporalAddress = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
  console.log('🔍 Connecting to Temporal at:', temporalAddress);

  const connection = await NativeConnection.connect({
    address: temporalAddress,
  });

  const worker = await Worker.create({
    connection,
    workflowsPath: path.join(__dirname, 'workflows'),
    activities,
    taskQueue: 'records-workflow',
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  console.log('🚀 Temporal Worker starting...');
  console.log(`   Task Queue: records-workflow`);
  console.log(`   Namespace: ${process.env.TEMPORAL_NAMESPACE || 'default'}`);
  console.log(`   Temporal Address: ${process.env.TEMPORAL_ADDRESS || 'localhost:7233'}`);

  await worker.run();
}

run().catch((err) => {
  console.error('Worker failed:', err);
  process.exit(1);
});
