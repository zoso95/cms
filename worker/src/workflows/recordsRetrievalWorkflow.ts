import { proxyActivities, sleep, log } from '@temporalio/workflow';
import type * as activities from '../activities';
import { RecordsRetrievalParams } from './registry';
import { setupPauseHandlers, checkPaused } from '../utils/pauseResume';

const a = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

export interface RecordsRetrievalResult {
  success: boolean;
  requestId: string;
  followUpAttempts: number;
}

/**
 * Records Retrieval Workflow
 *
 * Handles the complete process of requesting and retrieving medical records from a single provider:
 * 1. Create records request
 * 2. Wait for patient signature
 * 3. Find and verify doctor's office contact
 * 4. Send request via fax or email
 * 5. Wait for records (with optional follow-ups)
 * 6. Ingest records into system
 */
export async function recordsRetrievalWorkflow(
  patientCaseId: number,
  provider: string,
  params: RecordsRetrievalParams
): Promise<RecordsRetrievalResult> {
  log.info('Starting records retrieval workflow', { patientCaseId, provider, params });

  // Set up pause/resume handlers
  setupPauseHandlers();

  await checkPaused();
  const requestId = await a.createRecordsRequest(provider);
  log.info('Records request created', { patientCaseId, provider, requestId });

  await checkPaused();
  await a.waitForSignature(requestId);
  log.info('Signature received', { patientCaseId, provider, requestId });

  await checkPaused();
  const contact = await a.findDoctorOffice(provider);
  log.info('Doctor office contact found', { patientCaseId, provider, contact });

  await checkPaused();
  const verified = await a.manualVerify(contact);
  if (!verified) {
    log.error('Verification failed', { patientCaseId, provider, contact });
    throw new Error('Verification failed for ' + provider);
  }
  log.info('Contact verified', { patientCaseId, provider });

  await checkPaused();
  // Send request via fax or email
  if (contact.method === 'fax') {
    log.info('Sending fax', { patientCaseId, provider });
    await a.sendFax(contact, requestId);
  } else {
    log.info('Sending email', { patientCaseId, provider });
    await a.sendEmail(contact, requestId);
  }

  await checkPaused();
  let followUpAttempts = 0;
  /*
  // Wait for records with optional follow-ups
  let followUpAttempts = 0;
  let recordsReceived = false;

  while (!recordsReceived) {
    try {
      log.info('Waiting for records', { patientCaseId, provider, followUpAttempts });
      await a.waitForRecords(provider);
      recordsReceived = true;
    } catch (error) {
      // If follow-ups are enabled and we haven't hit the max, try again
      if (params.followUpEnabled && followUpAttempts < params.maxFollowUps) {
        followUpAttempts++;
        log.info('Records not received, sending follow-up', {
          patientCaseId,
          provider,
          followUpAttempts,
          maxFollowUps: params.maxFollowUps,
        });

        // Wait before follow-up
        await sleep(params.followUpInterval as any);

        // Send follow-up request
        if (contact.method === 'fax') {
          await a.sendFax(contact, requestId);
        } else {
          await a.sendEmail(contact, requestId);
        }
      } else {
        // No more follow-ups, throw error
        log.error('Failed to receive records after follow-ups', {
          patientCaseId,
          provider,
          followUpAttempts,
        });
        throw error;
      }
    }
  }
  */

  await checkPaused();
  log.info('Ingesting records', { patientCaseId, provider });
  await a.ingestRecords(provider);

  log.info('Records retrieval workflow completed', { patientCaseId, provider });
  return {
    success: true,
    requestId,
    followUpAttempts,
  };
}
