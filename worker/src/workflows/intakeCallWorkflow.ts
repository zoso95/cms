import { proxyActivities, sleep, condition, defineSignal, setHandler, log, executeChild } from '@temporalio/workflow';
import type * as activities from '../activities';
import { setupPauseHandlers, checkPaused } from '../utils/pauseResume';
import { recordsRetrievalWorkflow, verificationCompleteSignal } from './recordsRetrievalWorkflow';

// Regular activities (no retry)
const a = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

// Communication activities with retry on API failures
const commActivities = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    maximumAttempts: 2, // Try once, then retry once = 2 total attempts
    initialInterval: '10 seconds',
    maximumInterval: '10 seconds',
    backoffCoefficient: 1,
  },
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

export interface IntakeCallResult {
  success: boolean;
  pickedUp: boolean;
  userResponded: UserResponse | null;
  attempts: number;
  completedIntake: boolean;
}

// Hardcoded configuration for demo (exactly 1 week)
const MAX_ATTEMPTS = 7;
const WAIT_BETWEEN_ATTEMPTS = '1 day';
// const WAIT_BETWEEN_ATTEMPTS = '5 minutes';
const SMS_MESSAGES = [
  "Hi! This is Check My Charts. We wanted to give you a follow up about the healthcare investigation that you left on our website. We'll give you a call in a few minutes.",
  "Hi again! We'd love discuss your investigation with you. We'll call in a few minutes.",
  "Following up! We're ready to assist with you.",
  "Hey there! Just checking in about helping with your case. Can we connect?",
  "Hi! We're still here to help with your medical case. We'll try calling in a few minutes.",
  "Following up one more time about your case. Let us know if you'd like our help!",
  "Final reminder! We're available to assist with your medical case."
];

/**
 * Intake Call Workflow (Production)
 *
 * Hardcoded for 1 week of daily outreach (7 attempts).
 * Handles initial patient contact, intake call, and case evaluation.
 * Updates Tasks 1 (Intake Call) and 2 (Case Evaluation) throughout the process.
 *
 * @param patientCaseId - Patient case ID
 * @param parentWorkflowExecutionId - Optional parent workflow execution ID for signal routing
 */
export async function intakeCallWorkflow(
  patientCaseId: number,
  parentWorkflowExecutionId?: string
): Promise<IntakeCallResult> {
  log.info('Starting intake call workflow', { patientCaseId, maxAttempts: MAX_ATTEMPTS });

  // Mark workflow as running (in case it was scheduled)
  await a.markWorkflowAsRunning();

  // Set up pause/resume handlers
  setupPauseHandlers();

  // Update Task: Intake Call - In Progress
  await a.updateTaskStatus(patientCaseId, 'Intake Call', 'in_progress', 'Starting patient outreach');
  await a.updateWorkflowStatus('Task: Intake Call - Starting outreach');

  let pickedUp = false;
  let userResponded: UserResponse | null = null;
  let attemptCount = 0;
  let callCompletionData: CallCompletionData | null = null;
  let completedIntake = false;

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

  // Try to reach the patient (SMS + call, up to MAX_ATTEMPTS over 1 week)
  for (let i = 0; i < MAX_ATTEMPTS && !pickedUp && !userResponded; i++) {
    // Check if workflow is paused before each attempt
    await checkPaused();

    attemptCount = i + 1;
    const dayNumber = i + 1;
    log.info(`Day ${dayNumber}/${MAX_ATTEMPTS}: Attempting to reach patient`, { patientCaseId });

    // Send SMS with day-specific message (will retry once on API failure)
    await a.updateWorkflowStatus(`Day ${dayNumber}: Sending SMS`);
    await a.updateTaskStatus(patientCaseId, 'Intake Call', 'in_progress', `Day ${dayNumber}: Sending SMS`);
    await commActivities.sendSMS(patientCaseId, SMS_MESSAGES[i]);

    // Check pause state before waiting
    await checkPaused();

    // Wait 1 minute before calling to give patient time to see the SMS
    await a.updateWorkflowStatus(`Day ${dayNumber}: Waiting 5 minute before call`);
    await sleep('1 minute');

    // Check pause state before making call
    await checkPaused();

    // Initiate call (will retry once on API failure)
    await a.updateWorkflowStatus(`Day ${dayNumber}: Placing call`);
    await a.updateTaskStatus(patientCaseId, 'Intake Call', 'in_progress', `Day ${dayNumber}: Placing call`);
    const conversationId = await commActivities.placeCall(patientCaseId);
    log.info('Call initiated, waiting for completion', { patientCaseId, conversationId });
    await a.updateWorkflowStatus(`Day ${dayNumber}: Waiting for call to complete`);

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
        await a.updateWorkflowStatus(`Day ${dayNumber}: Call failed - ${completionData.failureReason}`);
        await a.updateTaskStatus(patientCaseId, 'Intake Call', 'in_progress', `Day ${dayNumber}: Call failed - ${completionData.failureReason}`);
        // Continue to next attempt
      } else if (completionData.talkedToHuman) {
        log.info('Patient picked up call', { patientCaseId, attempt: attemptCount });
        await a.updateWorkflowStatus(`Day ${dayNumber}: Patient answered call!`);
        await a.updateTaskStatus(patientCaseId, 'Intake Call', 'in_progress', `Day ${dayNumber}: Patient answered - completing intake`);
        pickedUp = true;
        completedIntake = true;
        break;
      } else {
        log.info('Call went to voicemail', { patientCaseId });
        await a.updateWorkflowStatus(`Day ${dayNumber}: Call went to voicemail`);
        await a.updateTaskStatus(patientCaseId, 'Intake Call', 'in_progress', `Day ${dayNumber}: Voicemail left`);
        // Continue to next attempt
      }
    } else {
      // Timeout - webhook didn't arrive, fall back to polling
      log.warn('Webhook timeout, falling back to API polling', { patientCaseId, conversationId });

      const status = await a.checkCallStatus(conversationId);

      if (status.completed) {
        if (status.failed) {
          log.info('Call failed (from polling)', { patientCaseId, reason: status.failureReason });
          await a.updateWorkflowStatus(`Day ${dayNumber}: Call failed - ${status.failureReason}`);
          await a.updateTaskStatus(patientCaseId, 'Intake Call', 'in_progress', `Day ${dayNumber}: Call failed - ${status.failureReason}`);
        } else if (status.talkedToHuman) {
          log.info('Patient picked up call (from polling)', { patientCaseId, attempt: attemptCount });
          await a.updateWorkflowStatus(`Day ${dayNumber}: Patient answered call!`);
          await a.updateTaskStatus(patientCaseId, 'Intake Call', 'in_progress', `Day ${dayNumber}: Patient answered - completing intake`);
          pickedUp = true;
          completedIntake = true;
          break;
        } else {
          log.info('Call went to voicemail (from polling)', { patientCaseId });
          await a.updateWorkflowStatus(`Day ${dayNumber}: Call went to voicemail`);
          await a.updateTaskStatus(patientCaseId, 'Intake Call', 'in_progress', `Day ${dayNumber}: Voicemail left`);
        }
      } else {
        log.warn('Call still not complete after 30 minutes', { patientCaseId, conversationId });
        await a.updateWorkflowStatus(`Day ${dayNumber}: Call timeout after 30 minutes`);
        await a.updateTaskStatus(patientCaseId, 'Intake Call', 'in_progress', `Day ${dayNumber}: Call timeout`);
        // Treat as failure and continue to next attempt
      }
    }

    // Wait between attempts, but interrupt early if user responds
    if (i < MAX_ATTEMPTS - 1) { // Don't wait after last attempt
      log.info(`Waiting ${WAIT_BETWEEN_ATTEMPTS} before next attempt`, { patientCaseId, attempt: attemptCount });
      await a.updateWorkflowStatus(`Waiting until tomorrow (Day ${dayNumber + 1})`);
      await a.updateTaskStatus(patientCaseId, 'Intake Call', 'in_progress', `Waiting until tomorrow (Day ${dayNumber + 1})`);
      await condition(() => userResponded !== null, WAIT_BETWEEN_ATTEMPTS as any);

      if (userResponded) {
        log.info('Wait interrupted by user response', { patientCaseId });
        await a.updateWorkflowStatus('Patient responded via SMS!');
        await a.updateTaskStatus(patientCaseId, 'Intake Call', 'in_progress', 'Patient responded via SMS - scheduling callback');
        completedIntake = true;
        break;
      }
    }
  }

  // TODO - after demo: Handle user SMS responses (currently not implemented)

  if (pickedUp && completedIntake) {
    // Successful intake call completed
    await a.updateWorkflowStatus('Intake call completed - Starting case evaluation');
    await a.updateTaskStatus(patientCaseId, 'Intake Call', 'completed', 'Intake call completed successfully');

    // Task 2: Case Evaluation - Collect and analyze transcript
    await a.updateTaskStatus(patientCaseId, 'Case Evaluation', 'in_progress', 'Collecting call transcript');
    await a.updateWorkflowStatus('Task 2 (Case Evaluation): Collecting transcript');

    const transcript = await a.collectTranscript(patientCaseId);
    log.info('Transcript collected', { patientCaseId, transcriptLength: transcript.length });

    await a.updateWorkflowStatus('Task 2 (Case Evaluation): Analyzing transcript with AI');
    await a.updateTaskStatus(patientCaseId, 'Case Evaluation', 'in_progress', 'AI analyzing case from transcript');
    const analysis = await a.analyzeTranscript(patientCaseId, transcript);
    log.info('Transcript analyzed', { patientCaseId, qualityScore: analysis.qualityScore });

    await a.updateTaskStatus(patientCaseId, 'Case Evaluation', 'completed', `Case evaluation completed - Quality score: ${analysis.qualityScore}`);
    await a.updateWorkflowStatus(`Task 2 complete: Quality score ${analysis.qualityScore}`);

    // Task 3: Extract Providers
    await a.updateTaskStatus(patientCaseId, 'Extract Providers', 'in_progress', 'Extracting provider information from transcript');
    await a.updateWorkflowStatus('Task 3 (Extract Providers): Extracting provider information');

    const providers = await a.extractProviders(patientCaseId, transcript);
    log.info('Providers extracted', { patientCaseId, providerCount: providers.length, providers });

    await a.updateTaskStatus(patientCaseId, 'Extract Providers', 'completed', `Found ${providers.length} provider(s)`);
    await a.updateWorkflowStatus(`Task 3 complete: Found ${providers.length} provider(s)`);

    // Task 5: Verify Providers - Trigger verification for each provider
    if (providers.length > 0) {
      await a.updateTaskStatus(patientCaseId, 'Verify Providers', 'in_progress', `Verifying ${providers.length} provider(s)`);
      await a.updateWorkflowStatus('Task 5 (Verify Providers): Looking up provider contact info');

      for (const provider of providers) {
        log.info('Finding doctor office for provider', { patientCaseId, providerName: provider.fullName });
        await a.updateWorkflowStatus(`Task 5: Looking up ${provider.fullName}`);

        try {
          const contact = await a.findDoctorOffice(patientCaseId, provider.fullName, parentWorkflowExecutionId);
          log.info('Provider lookup complete', { patientCaseId, provider: provider.fullName, contact });

          if (contact.verificationRequired) {
            log.info('Verification required for provider', { patientCaseId, provider: provider.fullName, verificationId: contact.verificationId });
          }
        } catch (error: any) {
          log.error('Error finding doctor office', { patientCaseId, provider: provider.fullName, error: error.message });
        }
      }

      await a.updateTaskStatus(patientCaseId, 'Verify Providers', 'in_progress', `Awaiting manual verification for ${providers.length} provider(s)`);
      await a.updateWorkflowStatus(`Verification requests created for ${providers.length} provider(s) - awaiting manual verification`);
    }

    await a.updateWorkflowStatus('Workflow completed successfully - Awaiting provider verification');
  } else {
    // Handle no contact after all attempts
    log.warn(`Failed to reach patient after ${MAX_ATTEMPTS} days`, { patientCaseId });
    await a.updateWorkflowStatus(`Failed to reach patient after ${MAX_ATTEMPTS} days`);
    await a.updateTaskStatus(patientCaseId, 'Intake Call', 'failed', `Could not reach patient after ${MAX_ATTEMPTS} days`);
    await a.logFailure(patientCaseId, `Could not reach patient after ${MAX_ATTEMPTS} attempts over 1 week`);
  }

  const result: IntakeCallResult = {
    success: completedIntake,
    pickedUp,
    userResponded,
    attempts: attemptCount,
    completedIntake,
  };

  log.info('Intake call workflow completed', { patientCaseId, result });
  return result;
}
