import { proxyActivities, sleep, condition, defineSignal, setHandler, log } from '@temporalio/workflow';
import type * as activities from '../activities';

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

export async function recordsWorkflow(patientCaseId: number) {
  log.info('Starting records workflow', { patientCaseId });

  let pickedUp = false;
  let userResponded: UserResponse | null = null;

  // Signal handler: called when a user texts back
  setHandler(userResponseSignal, (response: UserResponse) => {
    log.info('User responded via signal', { patientCaseId, response });
    userResponded = response;
  });

  // 1️⃣ Try to reach the customer (SMS + call, up to 7 times)
  log.info('Phase 1: Attempting to reach patient', { patientCaseId, maxAttempts: 7 });

  for (let i = 0; i < 7 && !pickedUp && !userResponded; i++) {
    log.info(`Attempt ${i + 1}/7 to reach patient`, { patientCaseId });

    await a.sendSMS(patientCaseId, "Please call us back");
    pickedUp = await a.placeCall(patientCaseId);

    if (pickedUp) {
      log.info('Patient picked up call', { patientCaseId, attempt: i + 1 });
      break;
    }

    // Wait 1 day, but interrupt early if user responds
    log.info('Waiting 1 day before next attempt', { patientCaseId, attempt: i + 1 });
    await condition(() => userResponded !== null, '1 day');

    if (userResponded) {
      log.info('Wait interrupted by user response', { patientCaseId });
      break;
    }
  }

  // 2️⃣ Branch logic
  if (userResponded) {
    log.info('Patient responded - scheduling callback', { patientCaseId });
    await a.scheduleCall(patientCaseId, userResponded.message);
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

  // 4️⃣ Parallelize provider subflows
  log.info('Phase 3: Processing provider records requests', { patientCaseId, providerCount: providers.length });

  await Promise.all(providers.map(async (provider, index) => {
    log.info(`Processing provider ${index + 1}/${providers.length}`, { patientCaseId, provider });

    const requestId = await a.createRecordsRequest(provider);
    log.info('Records request created', { patientCaseId, provider, requestId });

    await a.waitForSignature(requestId);
    log.info('Signature received', { patientCaseId, provider, requestId });

    const contact = await a.findDoctorOffice(provider);
    log.info('Doctor office contact found', { patientCaseId, provider, contact });

    const verified = await a.manualVerify(contact);
    if (!verified) {
      log.error('Verification failed', { patientCaseId, provider, contact });
      throw new Error('Verification failed for ' + provider);
    }
    log.info('Contact verified', { patientCaseId, provider });

    if (contact.method === 'fax') {
      log.info('Sending fax', { patientCaseId, provider });
      await a.sendFax(contact, requestId);
    } else {
      log.info('Sending email', { patientCaseId, provider });
      await a.sendEmail(contact, requestId);
    }

    log.info('Waiting for records', { patientCaseId, provider });
    await a.waitForRecords(provider);

    log.info('Ingesting records', { patientCaseId, provider });
    await a.ingestRecords(provider);

    log.info(`Provider ${index + 1}/${providers.length} completed`, { patientCaseId, provider });
  }));

  log.info('Phase 4: Running downstream analysis', { patientCaseId });
  await a.downstreamAnalysis(patientCaseId);

  log.info('Records workflow completed successfully', { patientCaseId });
  return { success: true, reason: 'completed', providerCount: providers.length };
}
