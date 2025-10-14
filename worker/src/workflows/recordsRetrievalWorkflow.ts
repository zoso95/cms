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
  await a.updateWorkflowStatus(`Creating records request for ${provider}`);
  const requestId = await a.createRecordsRequest(patientCaseId, provider);
  log.info('Records request created', { patientCaseId, provider, requestId });

  // Poll for signature completion (OpenSign doesn't have webhooks yet)
  await checkPaused();
  await a.updateWorkflowStatus('Waiting for patient signature');

  const maxSignatureAttempts = 240; // Check for up to 30 days (every 3 hours)
  let signatureAttempts = 0;
  let signatureDone = false;
  let signatureSigned = false;

  while (!signatureDone && signatureAttempts < maxSignatureAttempts) {
    log.info('Checking signature status', { patientCaseId, provider, requestId, attempt: signatureAttempts + 1 });

    const signatureStatus = await a.waitForSignature(requestId, patientCaseId);
    signatureDone = signatureStatus.done;
    signatureSigned = signatureStatus.signed;

    if (!signatureDone) {
      //await sleep('3 hours'); // Check every 3 hours
      // TODO fix me!
      await sleep('1 minute'); // Check every 3 hours
      signatureAttempts++;
    }
  }

  if (!signatureDone) {
    log.error('Signature timed out', { patientCaseId, provider, requestId, attempts: signatureAttempts });
    await a.updateWorkflowStatus('Signature request timed out');
    throw new Error(`Signature request timed out after ${signatureAttempts} attempts`);
  }

  if (!signatureSigned) {
    log.error('Signature declined or expired', { patientCaseId, provider, requestId });
    await a.updateWorkflowStatus('Signature declined or expired');
    throw new Error('Patient declined or signature expired');
  }

  log.info('Signature received', { patientCaseId, provider, requestId });

  await checkPaused();
  await a.updateWorkflowStatus(`Finding contact info for ${provider}`);
  const contact = await a.findDoctorOffice(provider);
  log.info('Doctor office contact found', { patientCaseId, provider, contact });

  await checkPaused();
  await a.updateWorkflowStatus('Waiting for manual verification of contact');
  const verified = await a.manualVerify(contact);
  if (!verified) {
    log.error('Verification failed', { patientCaseId, provider, contact });
    await a.updateWorkflowStatus(`Verification failed for ${provider}`);
    throw new Error('Verification failed for ' + provider);
  }
  log.info('Contact verified', { patientCaseId, provider });

  await checkPaused();
  // Send request via fax or email
  if (contact.method === 'fax') {
    log.info('Sending fax', { patientCaseId, provider });
    await a.updateWorkflowStatus(`Sending fax to ${provider}`);
    await a.sendFax(contact, requestId);
  } else {
    log.info('Sending email', { patientCaseId, provider });
    await a.updateWorkflowStatus(`Sending email to ${provider}`);
    await a.sendEmail(contact, requestId);
  }

  await checkPaused();
  await a.updateWorkflowStatus('Request sent, waiting for records');
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
  await a.updateWorkflowStatus(`Ingesting records from ${provider}`);
  await a.ingestRecords(provider);

  log.info('Records retrieval workflow completed', { patientCaseId, provider });
  await a.updateWorkflowStatus(`Completed: Records from ${provider} retrieved successfully`);
  return {
    success: true,
    requestId,
    followUpAttempts,
  };
}
