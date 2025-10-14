import { proxyActivities, sleep, condition, defineSignal, setHandler, log } from '@temporalio/workflow';
import type * as activities from '../activities';
import { PatientOutreachParams } from './registry';
import { setupPauseHandlers, checkPaused } from '../utils/pauseResume';

const a = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

// User response signal
export interface UserResponse {
  message: string;
  timestamp: string;
}

export const userResponseSignal = defineSignal<[UserResponse]>('userResponse');

// Call completion signal
export interface CallCompletionData {
  conversationId: string;
  talkedToHuman: boolean;
  failed: boolean;
  failureReason?: string;
}

export const callCompletedSignal = defineSignal<[CallCompletionData]>('callCompleted');

export interface PatientOutreachResult {
  success: boolean;
  pickedUp: boolean;
  userResponded: UserResponse | null;
  attempts: number;
}

/**
 * Patient Outreach Workflow
 *
 * Contacts a patient via SMS and calls until they respond or max attempts reached.
 * Can be interrupted early by user response signal.
 */
export async function patientOutreachWorkflow(
  patientCaseId: number,
  params: PatientOutreachParams
): Promise<PatientOutreachResult> {
  log.info('Starting patient outreach workflow', { patientCaseId, params });

  // Set up pause/resume handlers
  setupPauseHandlers();

  let pickedUp = false;
  let userResponded: UserResponse | null = null;
  let attemptCount = 0;
  let callCompletionData: CallCompletionData | null = null;

  // Signal handler: called when a user texts back
  setHandler(userResponseSignal, (response: UserResponse) => {
    log.info('User responded via signal', { patientCaseId, response });
    userResponded = response;
  });

  // Signal handler: called when call completes (from webhook)
  setHandler(callCompletedSignal, (data: CallCompletionData) => {
    log.info('Call completed via signal', { patientCaseId, data });
    callCompletionData = data;
  });

  // Try to reach the customer (SMS + call, up to maxAttempts)
  for (let i = 0; i < params.maxAttempts && !pickedUp && !userResponded; i++) {
    // Check if workflow is paused before each attempt
    await checkPaused();

    attemptCount = i + 1;
    log.info(`Attempt ${i + 1}/${params.maxAttempts} to reach patient`, { patientCaseId });

    await a.updateWorkflowStatus(`Attempt ${i + 1}/${params.maxAttempts}: Sending SMS`);
    await a.sendSMS(patientCaseId, params.smsTemplate);

    // Check pause state before waiting
    await checkPaused();

    // Wait 1 minute before calling to give patient time to see the SMS
    await a.updateWorkflowStatus(`Attempt ${i + 1}/${params.maxAttempts}: Waiting 1 minute before call`);
    await sleep('1 minute');

    // Check pause state before making call
    await checkPaused();

    // Initiate call (non-blocking)
    await a.updateWorkflowStatus(`Attempt ${i + 1}/${params.maxAttempts}: Placing call`);
    const conversationId = await a.placeCall(patientCaseId);
    log.info('Call initiated, waiting for completion', { patientCaseId, conversationId });
    await a.updateWorkflowStatus(`Attempt ${i + 1}/${params.maxAttempts}: Waiting for call to complete`);

    // Reset call completion data for this attempt
    callCompletionData = null;

    // Wait for webhook signal (with 30 minute timeout)
    const signalReceived = await condition(
      () => callCompletionData !== null && callCompletionData.conversationId === conversationId,
      '30 minutes'
    );

    if (signalReceived && callCompletionData) {
      // Webhook signal received
      const completionData = callCompletionData as CallCompletionData;
      log.info('Call result received via webhook', { patientCaseId, data: completionData });

      if (completionData.failed) {
        log.info('Call failed', { patientCaseId, reason: completionData.failureReason });
        await a.updateWorkflowStatus(`Attempt ${i + 1}/${params.maxAttempts}: Call failed - ${completionData.failureReason}`);
        // Continue to next attempt
      } else if (completionData.talkedToHuman) {
        log.info('Patient picked up call', { patientCaseId, attempt: i + 1 });
        await a.updateWorkflowStatus(`Attempt ${i + 1}/${params.maxAttempts}: Patient answered call!`);
        pickedUp = true;
        break;
      } else {
        log.info('Call went to voicemail', { patientCaseId });
        await a.updateWorkflowStatus(`Attempt ${i + 1}/${params.maxAttempts}: Call went to voicemail`);
        // Continue to next attempt
      }
    } else {
      // Timeout - webhook didn't arrive, fall back to polling
      log.warn('Webhook timeout, falling back to API polling', { patientCaseId, conversationId });

      const status = await a.checkCallStatus(conversationId);

      if (status.completed) {
        if (status.failed) {
          log.info('Call failed (from polling)', { patientCaseId, reason: status.failureReason });
          await a.updateWorkflowStatus(`Attempt ${i + 1}/${params.maxAttempts}: Call failed - ${status.failureReason}`);
        } else if (status.talkedToHuman) {
          log.info('Patient picked up call (from polling)', { patientCaseId, attempt: i + 1 });
          await a.updateWorkflowStatus(`Attempt ${i + 1}/${params.maxAttempts}: Patient answered call!`);
          pickedUp = true;
          break;
        } else {
          log.info('Call went to voicemail (from polling)', { patientCaseId });
          await a.updateWorkflowStatus(`Attempt ${i + 1}/${params.maxAttempts}: Call went to voicemail`);
        }
      } else {
        log.warn('Call still not complete after 30 minutes', { patientCaseId, conversationId });
        await a.updateWorkflowStatus(`Attempt ${i + 1}/${params.maxAttempts}: Call timeout after 30 minutes`);
        // Treat as failure and continue to next attempt
      }
    }

    // Wait between attempts, but interrupt early if user responds
    if (i < params.maxAttempts - 1) { // Don't wait after last attempt
      log.info(`Waiting ${params.waitBetweenAttempts} before next attempt`, { patientCaseId, attempt: i + 1 });
      await a.updateWorkflowStatus(`Waiting ${params.waitBetweenAttempts} before next attempt`);
      await condition(() => userResponded !== null, params.waitBetweenAttempts as any);

      if (userResponded) {
        log.info('Wait interrupted by user response', { patientCaseId });
        await a.updateWorkflowStatus('Patient responded via SMS!');
        break;
      }
    }
  }

  // Handle user response if they texted back
  if (userResponded !== null) {
    const response = userResponded as UserResponse;
    log.info('Patient responded - scheduling callback', { patientCaseId });
    await a.updateWorkflowStatus('Processing patient SMS response');
    await a.scheduleCall(patientCaseId, response.message);
    await a.updateWorkflowStatus('Completed - Patient contacted via SMS');
  } else if (pickedUp) {
    await a.updateWorkflowStatus('Completed - Patient answered call');
  } else {
    // Handle no contact after all attempts
    log.warn(`Failed to reach patient after ${params.maxAttempts} attempts`, { patientCaseId });
    await a.updateWorkflowStatus(`Failed to reach patient after ${params.maxAttempts} attempts`);
    await a.logFailure(patientCaseId, `Could not reach patient after ${params.maxAttempts} attempts`);
  }

  const result: PatientOutreachResult = {
    success: pickedUp,
    pickedUp,
    userResponded,
    attempts: attemptCount,
  };

  log.info('Patient outreach workflow completed', { patientCaseId, result });
  return result;
}
