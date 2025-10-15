import { proxyActivities, executeChild, log } from '@temporalio/workflow';
import type * as activities from '../activities';
import { providerRecordsWorkflow } from './providerRecordsWorkflow';
import { setupPauseHandlers, checkPaused } from '../utils/pauseResume';

// Short-running activities
const a = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export interface RecordsCoordinatorResult {
  success: boolean;
  providersProcessed: number;
  results: Array<{ providerName: string; success: boolean; error?: string }>;
}

/**
 * Records Coordinator Workflow (Production)
 *
 * Coordinates records retrieval for all verified providers in a patient case:
 * 1. Gets all verified providers (Task 5 must be complete)
 * 2. Launches a child workflow for each provider
 * 3. Updates Task 6 (Gather Releases)
 * 4. Updates Task 7 (Send Out Records Requests)
 * 5. Updates Task 8 (Follow up on Records Requests)
 *
 * This workflow handles the entire records retrieval process after providers are verified.
 */
export async function recordsCoordinatorWorkflow(
  patientCaseId: number
): Promise<RecordsCoordinatorResult> {
  log.info('Starting records coordinator workflow', { patientCaseId });

  // Mark workflow as running (in case it was scheduled)
  await a.markWorkflowAsRunning();

  // Set up pause/resume handlers
  setupPauseHandlers();

  await a.updateWorkflowStatus('Records Coordinator: Starting');

  // Step 1: Verify that Task 5 (Verify Providers) is complete
  await checkPaused();
  log.info('Checking if providers are verified', { patientCaseId });
  await a.updateWorkflowStatus('Checking provider verification status');

  const verifyTask = await a.getTaskByName(patientCaseId, 'Verify Providers');
  if (!verifyTask || verifyTask.status !== 'completed') {
    log.error('Provider verification not complete', { patientCaseId, taskStatus: verifyTask?.status });
    await a.updateWorkflowStatus('Error: Providers not verified yet');
    throw new Error('Task 5 (Verify Providers) must be completed before requesting records');
  }

  log.info('Providers verified, proceeding with records retrieval', { patientCaseId });

  // Step 2: Get all verified providers from database
  await checkPaused();
  log.info('Fetching verified providers', { patientCaseId });
  await a.updateWorkflowStatus('Fetching verified providers');

  // We need to get providers from the database via an activity
  // For now, we'll use a simple query - you may want to create a dedicated activity
  const providers = await a.getVerifiedProviders(patientCaseId);
  log.info('Retrieved verified providers', { patientCaseId, providerCount: providers.length });

  if (providers.length === 0) {
    log.warn('No verified providers found', { patientCaseId });
    await a.updateWorkflowStatus('No verified providers found');
    return {
      success: true,
      providersProcessed: 0,
      results: [],
    };
  }

  // Step 3: Update Task 6 (Gather Releases) to in_progress
  await checkPaused();
  await a.updateTaskStatus(patientCaseId, 'Gather Releases', 'in_progress', `Creating release forms for ${providers.length} provider(s)`);
  await a.updateWorkflowStatus(`Task 6 (Gather Releases): Creating forms for ${providers.length} provider(s)`);

  // Step 4: Launch child workflows for each provider in parallel
  log.info('Launching provider records workflows', { patientCaseId, providerCount: providers.length });
  await a.updateWorkflowStatus(`Launching workflows for ${providers.length} provider(s)`);

  const providerResults = await Promise.allSettled(
    providers.map(async (provider: any) => {
      log.info('Starting records workflow for provider', {
        patientCaseId,
        providerId: provider.id,
        providerName: provider.full_name || provider.name,
      });

      // Register child workflow before starting it
      const workflowId = `provider-records-${patientCaseId}-${provider.id}-${Date.now()}`;
      await a.registerChildWorkflow({
        workflowId,
        workflowName: 'providerRecordsWorkflow',
        patientCaseId,
        entityType: 'provider',
        entityId: provider.id,
        parameters: {
          providerId: provider.id,
          providerName: provider.full_name || provider.name,
        },
      });

      // Start the child workflow
      return executeChild(providerRecordsWorkflow, {
        workflowId,
        args: [patientCaseId, provider.id, provider.full_name || provider.name],
      });
    })
  );

  // Process results
  const results = providerResults.map((result, index) => {
    const provider = providers[index];
    const providerName = provider.full_name || provider.name;

    if (result.status === 'fulfilled') {
      return {
        providerName,
        success: true,
      };
    } else {
      log.error('Provider records workflow failed', {
        patientCaseId,
        providerName,
        error: result.reason,
      });
      return {
        providerName,
        success: false,
        error: result.reason?.message || 'Unknown error',
      };
    }
  });

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  log.info('All provider workflows completed', {
    patientCaseId,
    total: providers.length,
    success: successCount,
    failed: failureCount,
  });

  // Step 5: Update Task 6 (Gather Releases) to completed
  await checkPaused();
  await a.updateTaskStatus(
    patientCaseId,
    'Gather Releases',
    'completed',
    `Release forms gathered for ${successCount}/${providers.length} provider(s)`
  );
  await a.updateWorkflowStatus(`Task 6 complete: ${successCount}/${providers.length} releases gathered`);

  // Step 6: Update Task 7 (Send Out Records Requests) to completed
  await a.updateTaskStatus(
    patientCaseId,
    'Send Out Records Requests',
    'completed',
    `Records requests sent to ${successCount}/${providers.length} provider(s)`
  );
  await a.updateWorkflowStatus(`Task 7 complete: Requests sent to ${successCount}/${providers.length} provider(s)`);

  // Step 7: Update Task 8 (Follow up on Records Requests) to in_progress
  await a.updateTaskStatus(
    patientCaseId,
    'Follow up on Records Requests',
    'in_progress',
    `Awaiting records from ${successCount} provider(s)`
  );
  await a.updateWorkflowStatus(`Task 8: Awaiting records from ${successCount} provider(s)`);

  log.info('Records coordinator workflow completed', { patientCaseId, results });
  await a.updateWorkflowStatus(`Completed: ${successCount}/${providers.length} provider(s) processed successfully`);

  return {
    success: failureCount === 0,
    providersProcessed: providers.length,
    results,
  };
}
