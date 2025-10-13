import { proxyActivities, executeChild, condition, defineSignal, setHandler, log } from '@temporalio/workflow';
import type * as activities from '../activities';
import { recordsRetrievalWorkflow } from './recordsRetrievalWorkflow';
import { RecordsWorkflowParams } from './registry';

const a = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

// User response type
export interface UserResponse {
  message: string;
  timestamp: string;
}

// Define the signal
export const userResponseSignal = defineSignal<[UserResponse]>('userResponse');

export async function recordsWorkflow(
  patientCaseId: number,
  params?: Partial<RecordsWorkflowParams>
) {
  // Apply defaults
  const config: RecordsWorkflowParams = {
    patientOutreach: {
      maxAttempts: params?.patientOutreach?.maxAttempts ?? 7,
      waitBetweenAttempts: params?.patientOutreach?.waitBetweenAttempts ?? '1 day',
      smsTemplate: params?.patientOutreach?.smsTemplate ?? 'Please call us back to discuss your medical records.',
    },
    recordsRetrieval: {
      followUpEnabled: params?.recordsRetrieval?.followUpEnabled ?? false,
      followUpInterval: params?.recordsRetrieval?.followUpInterval ?? '3 days',
      maxFollowUps: params?.recordsRetrieval?.maxFollowUps ?? 2,
    },
    call: {
      agentId: params?.call?.agentId,
      maxDuration: params?.call?.maxDuration ?? 300,
    },
  };

  log.info('Starting records workflow', { patientCaseId, params: config });

  let pickedUp = false;
  let userResponded: UserResponse | null = null;

  // Signal handler: called when a user texts back
  setHandler(userResponseSignal, (response: UserResponse) => {
    log.info('User responded via signal', { patientCaseId, response });
    userResponded = response;
  });

  // 1️⃣ Try to reach the customer (SMS + call, up to maxAttempts)
  log.info('Phase 1: Attempting to reach patient', {
    patientCaseId,
    maxAttempts: config.patientOutreach.maxAttempts,
  });

  for (let i = 0; i < config.patientOutreach.maxAttempts && !pickedUp && !userResponded; i++) {
    log.info(`Attempt ${i + 1}/${config.patientOutreach.maxAttempts} to reach patient`, { patientCaseId });

    await a.sendSMS(patientCaseId, config.patientOutreach.smsTemplate);
    pickedUp = await a.placeCall(patientCaseId);

    if (pickedUp) {
      log.info('Patient picked up call', { patientCaseId, attempt: i + 1 });
      break;
    }

    // Wait between attempts, but interrupt early if user responds
    if (i < config.patientOutreach.maxAttempts - 1) { // Don't wait after last attempt
      log.info(`Waiting ${config.patientOutreach.waitBetweenAttempts} before next attempt`, {
        patientCaseId,
        attempt: i + 1,
      });
      await condition(() => userResponded !== null, config.patientOutreach.waitBetweenAttempts as any);

      if (userResponded) {
        log.info('Wait interrupted by user response', { patientCaseId });
        break;
      }
    }
  }

  // 2️⃣ Branch logic
  if (userResponded !== null) {
    const response = userResponded as UserResponse;
    log.info('Patient responded - scheduling callback', { patientCaseId });
    await a.scheduleCall(patientCaseId, response.message);
    return { success: true, reason: 'user_responded' };
  }

  if (!pickedUp) {
    log.warn('Failed to reach patient after 7 days', { patientCaseId });
    await a.logFailure(patientCaseId, "Could not reach patient after 7 days");
    return { success: false, reason: 'no_contact' };
  }

  // 3️⃣ Otherwise continue normal flow
  log.info('Phase 2: Collecting and analyzing transcript', { patientCaseId });

  const transcript = await a.collectTranscript(patientCaseId);
  log.info('Transcript collected', { patientCaseId, transcriptLength: transcript.length });

  const analysis = await a.analyzeTranscript(transcript);
  log.info('Transcript analyzed', { patientCaseId, analysis });

  const providers = await a.extractProviders(analysis);
  log.info('Providers extracted', { patientCaseId, providerCount: providers.length, providers });

  // 4️⃣ Parallelize provider subflows using child workflows
  log.info('Phase 3: Processing provider records requests', { patientCaseId, providerCount: providers.length });

  const retrievalResults = await Promise.all(
    providers.map((provider, index) => {
      log.info(`Starting records retrieval for provider ${index + 1}/${providers.length}`, {
        patientCaseId,
        provider,
      });

      return executeChild(recordsRetrievalWorkflow, {
        workflowId: `records-retrieval-${patientCaseId}-${provider.replace(/\s/g, '-')}-${Date.now()}`,
        args: [patientCaseId, provider, config.recordsRetrieval],
      });
    })
  );

  log.info('All provider records retrieved', { patientCaseId, providerCount: providers.length, retrievalResults });

  log.info('Phase 4: Running downstream analysis', { patientCaseId });
  await a.downstreamAnalysis(patientCaseId);

  log.info('Records workflow completed successfully', { patientCaseId });
  return { success: true, reason: 'completed', providerCount: providers.length };
}
