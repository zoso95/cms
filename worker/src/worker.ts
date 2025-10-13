import { Worker } from '@temporalio/worker';
import * as activities from './activities';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config();

async function run() {
  const worker = await Worker.create({
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
