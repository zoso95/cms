import { Connection, ScheduleClient, ScheduleHandle } from '@temporalio/client';

export interface ScheduleWorkflowOptions {
  scheduleId: string;
  workflowType: string;
  taskQueue: string;
  args: any[];
  startAt?: Date;
  cronSchedule?: string;
  memo?: Record<string, any>;
}

/**
 * Schedule a workflow to run at a specific time or on a cron schedule
 */
export async function scheduleWorkflow(options: ScheduleWorkflowOptions): Promise<ScheduleHandle> {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const scheduleClient = new ScheduleClient({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  // Build the schedule spec
  const spec: any = {};

  if (options.startAt) {
    // One-time execution at a specific time
    spec.startAt = options.startAt;
  } else if (options.cronSchedule) {
    // Recurring execution on a cron schedule
    spec.cronExpressions = [options.cronSchedule];
  } else {
    throw new Error('Either startAt or cronSchedule must be provided');
  }

  const handle = await scheduleClient.create({
    scheduleId: options.scheduleId,
    spec,
    action: {
      type: 'startWorkflow',
      workflowType: options.workflowType,
      taskQueue: options.taskQueue,
      args: options.args,
      memo: options.memo,
    },
  });

  console.log(`✅ Scheduled workflow: ${options.scheduleId}`);
  console.log(`   Workflow Type: ${options.workflowType}`);
  console.log(`   Start At: ${options.startAt || 'Cron: ' + options.cronSchedule}`);

  return handle;
}

/**
 * Delete a scheduled workflow
 */
export async function deleteSchedule(scheduleId: string): Promise<void> {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const scheduleClient = new ScheduleClient({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  const handle = scheduleClient.getHandle(scheduleId);
  await handle.delete();

  console.log(`✅ Deleted schedule: ${scheduleId}`);
}

/**
 * Pause a scheduled workflow
 */
export async function pauseSchedule(scheduleId: string, note?: string): Promise<void> {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const scheduleClient = new ScheduleClient({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  const handle = scheduleClient.getHandle(scheduleId);
  await handle.pause(note);

  console.log(`⏸️  Paused schedule: ${scheduleId}`);
}

/**
 * Resume a paused scheduled workflow
 */
export async function resumeSchedule(scheduleId: string, note?: string): Promise<void> {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const scheduleClient = new ScheduleClient({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  const handle = scheduleClient.getHandle(scheduleId);
  await handle.unpause(note);

  console.log(`▶️  Resumed schedule: ${scheduleId}`);
}

/**
 * Get information about a scheduled workflow
 */
export async function getScheduleInfo(scheduleId: string): Promise<any> {
  const connection = await Connection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const scheduleClient = new ScheduleClient({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
  });

  const handle = scheduleClient.getHandle(scheduleId);
  const description = await handle.describe();

  return description;
}
