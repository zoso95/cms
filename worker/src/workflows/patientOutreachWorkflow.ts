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

  // Signal handler: called when a user texts back
  setHandler(userResponseSignal, (response: UserResponse) => {
    log.info('User responded via signal', { patientCaseId, response });
    userResponded = response;
  });

  // Try to reach the customer (SMS + call, up to maxAttempts)
  for (let i = 0; i < params.maxAttempts && !pickedUp && !userResponded; i++) {
    log.info(`Attempt ${i + 1}/${params.maxAttempts} to reach patient`, { patientCaseId });

    await a.sendSMS(patientCaseId, params.smsTemplate);
    pickedUp = await a.placeCall(patientCaseId);

    if (pickedUp) {
      log.info('Patient picked up call', { patientCaseId, attempt: i + 1 });
      break;
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

  const result: PatientOutreachResult = {
    success: pickedUp || userResponded !== null,
    pickedUp,
    userResponded,
    attempts: pickedUp ? 0 : params.maxAttempts,
  };

  log.info('Patient outreach workflow completed', { patientCaseId, result });
  return result;
}
