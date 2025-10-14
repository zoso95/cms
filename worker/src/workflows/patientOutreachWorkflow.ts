import { proxyActivities, sleep, condition, defineSignal, setHandler, log } from '@temporalio/workflow';
import type * as activities from '../activities';
import { PatientOutreachParams } from './registry';

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
    attemptCount = i + 1;
    log.info(`Attempt ${i + 1}/${params.maxAttempts} to reach patient`, { patientCaseId });

    await a.sendSMS(patientCaseId, params.smsTemplate);

    // Wait 1 minute before calling to give patient time to see the SMS
    await sleep('1 minute');

    // Initiate call (non-blocking)
    const conversationId = await a.placeCall(patientCaseId);
    log.info('Call initiated, waiting for completion', { patientCaseId, conversationId });

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
        // Continue to next attempt
      } else if (completionData.talkedToHuman) {
        log.info('Patient picked up call', { patientCaseId, attempt: i + 1 });
        pickedUp = true;
        break;
      } else {
        log.info('Call went to voicemail', { patientCaseId });
        // Continue to next attempt
      }
    } else {
      // Timeout - webhook didn't arrive, fall back to polling
      log.warn('Webhook timeout, falling back to API polling', { patientCaseId, conversationId });

      const status = await a.checkCallStatus(conversationId);

      if (status.completed) {
        if (status.failed) {
          log.info('Call failed (from polling)', { patientCaseId, reason: status.failureReason });
        } else if (status.talkedToHuman) {
          log.info('Patient picked up call (from polling)', { patientCaseId, attempt: i + 1 });
          pickedUp = true;
          break;
        } else {
          log.info('Call went to voicemail (from polling)', { patientCaseId });
        }
      } else {
        log.warn('Call still not complete after 30 minutes', { patientCaseId, conversationId });
        // Treat as failure and continue to next attempt
      }
    }

    // Wait between attempts, but interrupt early if user responds
    if (i < params.maxAttempts - 1) { // Don't wait after last attempt
      log.info(`Waiting ${params.waitBetweenAttempts} before next attempt`, { patientCaseId, attempt: i + 1 });
      await condition(() => userResponded !== null, params.waitBetweenAttempts as any);

      if (userResponded) {
        log.info('Wait interrupted by user response', { patientCaseId });
        break;
      }
    }
  }

  // Handle user response if they texted back
  if (userResponded !== null) {
    const response = userResponded as UserResponse;
    log.info('Patient responded - scheduling callback', { patientCaseId });
    await a.scheduleCall(patientCaseId, response.message);
  }

  // Handle no contact after all attempts
  if (!pickedUp && userResponded === null) {
    log.warn(`Failed to reach patient after ${params.maxAttempts} attempts`, { patientCaseId });
    await a.logFailure(patientCaseId, `Could not reach patient after ${params.maxAttempts} attempts`);
  }

  const result: PatientOutreachResult = {
    success: pickedUp || userResponded !== null,
    pickedUp,
    userResponded,
    attempts: attemptCount,
  };

  log.info('Patient outreach workflow completed', { patientCaseId, result });
  return result;
}
