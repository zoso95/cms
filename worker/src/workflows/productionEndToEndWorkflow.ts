import { proxyActivities, executeChild, log, condition, setHandler } from '@temporalio/workflow';
import type * as activities from '../activities';
import { intakeCallWorkflow } from './intakeCallWorkflow';
import { recordsCoordinatorWorkflow } from './recordsCoordinatorWorkflow';
import { verificationCompleteSignal } from './recordsRetrievalWorkflow';
import { setupPauseHandlers, checkPaused } from '../utils/pauseResume';

// Regular activities with 1 minute timeout
const a = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export interface ProductionEndToEndResult {
  success: boolean;
  reason: string;
  completedIntake: boolean;
  providerCount?: number;
  recordsRequestsSent?: number;
}

/**
 * Production End-to-End Medical Records Workflow
 *
 * Simple orchestrator workflow that:
 * 1. Calls intakeCallWorkflow as a child (handles Tasks 1-5)
 * 2. Calls recordsCoordinatorWorkflow as a child (handles Tasks 6-8)
 */
export async function productionEndToEndWorkflow(
  patientCaseId: number
): Promise<ProductionEndToEndResult> {
  log.info('Starting production end-to-end workflow', { patientCaseId });

  // Mark workflow as running (in case it was scheduled)
  await a.markWorkflowAsRunning();

  // Set up pause/resume handlers
  setupPauseHandlers();

  await a.updateWorkflowStatus('Starting intake call workflow');

  // ============================================
  // PHASE 1: Run Intake Call Workflow (Tasks 1-5)
  // ============================================
  const intakeWorkflowId = `intake-call-${patientCaseId}-${Date.now()}`;
  await a.registerChildWorkflow({
    workflowId: intakeWorkflowId,
    workflowName: 'intakeCallWorkflow',
    patientCaseId,
    parameters: {},
  });

  const intakeResult = await executeChild(intakeCallWorkflow, {
    workflowId: intakeWorkflowId,
    args: [patientCaseId],
  });

  log.info('Intake call workflow completed', { patientCaseId, intakeResult });

  // If intake didn't complete, exit
  if (!intakeResult.completedIntake) {
    await a.updateWorkflowStatus('Workflow ended - Intake not completed');
    return {
      success: false,
      reason: 'intake_failed',
      completedIntake: false,
    };
  }

  // ============================================
  // PHASE 1.5: Wait for Provider Verifications
  // ============================================
  await checkPaused();
  await a.updateWorkflowStatus('Intake complete - Checking for pending verifications');

  // Get verifications that need approval
  const verifications = await a.getPatientCaseVerifications(patientCaseId);
  const pendingVerifications = verifications.filter((v: any) => v.status === 'pending');

  if (pendingVerifications.length > 0) {
    log.info('Waiting for provider verifications', { patientCaseId, pendingCount: pendingVerifications.length });
    await a.updateWorkflowStatus(`Waiting for ${pendingVerifications.length} provider verification(s)`);

    // Set up signal handler for verification completion
    const verifiedProviders = new Set<string>();
    const rejectedProviders = new Set<string>();

    setHandler(verificationCompleteSignal, (approved: boolean, contactInfo?: any) => {
      log.info('Received verification signal', { approved, contactInfo });

      const verificationId = contactInfo?.verificationId;
      if (verificationId) {
        if (approved) {
          verifiedProviders.add(verificationId);
        } else {
          rejectedProviders.add(verificationId);
        }
      }
    });

    // Wait for all verifications (with 7 day timeout)
    const allVerified = await condition(
      () => {
        const allDone = pendingVerifications.every((v: any) =>
          verifiedProviders.has(v.id) || rejectedProviders.has(v.id)
        );
        return allDone;
      },
      '7 days'
    );

    if (!allVerified) {
      log.error('Verification timed out', { patientCaseId, pending: pendingVerifications.length });
      await a.updateWorkflowStatus(`Verification timed out after 7 days`);
      await a.updateTaskStatus(patientCaseId, 'Verify Providers', 'failed', `Verification timed out after 7 days`);
      return {
        success: false,
        reason: 'verification_timeout',
        completedIntake: true,
      };
    }

    log.info('All verifications complete', {
      patientCaseId,
      verified: verifiedProviders.size,
      rejected: rejectedProviders.size,
    });

    // Update Task 5 to completed
    await a.updateTaskStatus(patientCaseId, 'Verify Providers', 'completed', `Verified ${verifiedProviders.size} provider(s), rejected ${rejectedProviders.size}`);
    await a.updateWorkflowStatus(`All verifications complete: ${verifiedProviders.size} approved, ${rejectedProviders.size} rejected`);
  } else {
    log.info('No pending verifications', { patientCaseId });
    await a.updateWorkflowStatus('No pending verifications - proceeding to records retrieval');
  }

  // ============================================
  // PHASE 2: Run Records Coordinator Workflow (Tasks 6-8)
  // ============================================
  await checkPaused();
  await a.updateWorkflowStatus('Starting records coordinator workflow');

  const coordinatorWorkflowId = `records-coordinator-${patientCaseId}-${Date.now()}`;
  await a.registerChildWorkflow({
    workflowId: coordinatorWorkflowId,
    workflowName: 'recordsCoordinatorWorkflow',
    patientCaseId,
    parameters: {},
  });

  const coordinatorResult = await executeChild(recordsCoordinatorWorkflow, {
    workflowId: coordinatorWorkflowId,
    args: [patientCaseId],
  });

  log.info('Records coordinator workflow completed', { patientCaseId, coordinatorResult });

  // ============================================
  // COMPLETE
  // ============================================
  log.info('Production end-to-end workflow completed successfully', { patientCaseId });
  await a.updateWorkflowStatus('Workflow completed successfully');

  return {
    success: coordinatorResult.success,
    reason: 'completed',
    completedIntake: true,
    providerCount: coordinatorResult.providersProcessed,
    recordsRequestsSent: coordinatorResult.providersProcessed,
  };
}
