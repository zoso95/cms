import { proxyActivities, sleep, log, setHandler, condition, defineSignal } from '@temporalio/workflow';
import type * as activities from '../activities';
import { RecordsRetrievalParams } from './registry';
import { setupPauseHandlers, checkPaused } from '../utils/pauseResume';

// Define verification signal
export const verificationCompleteSignal = defineSignal<[boolean, any?]>('verificationComplete');

// Define fax completion signal
export const faxCompletedSignal = defineSignal<[{ success: boolean; faxId: string; error?: string }]>('faxCompleted');

// Short-running activities (status updates, quick DB queries)
const a = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

// Long-running activities (API calls)
const longActivities = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
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

  // Mark workflow as running (in case it was scheduled)
  await a.markWorkflowAsRunning();

  // Set up pause/resume handlers
  setupPauseHandlers();

  await checkPaused();
  await a.updateWorkflowStatus(`Creating records request for ${provider}`);
  const requestId = await longActivities.createRecordsRequest(patientCaseId, provider);
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

    const signatureStatus = await longActivities.waitForSignature(requestId, patientCaseId);
    signatureDone = signatureStatus.done;
    signatureSigned = signatureStatus.signed;

    if (!signatureDone) {
      //await sleep('3 hours'); // Check every 3 hours
      // TODO fix me!
      await sleep('3 minute'); // Check every 3 hours
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
  const contact = await longActivities.findDoctorOffice(patientCaseId, provider);
  log.info('Doctor office contact found', { patientCaseId, provider, contact });

  // If verification is required, wait for signal from frontend
  if (contact.verificationRequired && contact.verificationId) {
    await checkPaused();
    await a.updateWorkflowStatus('Waiting for manual verification of contact');
    log.info('Waiting for manual verification signal', { verificationId: contact.verificationId });

    // Set up signal handler for verification completion
    let verificationApproved = false;
    let verificationRejected = false;
    let verifiedContactInfo: any = null;

    setHandler(verificationCompleteSignal, (approved: boolean, contactInfo?: any) => {
      log.info('Received verification signal', { approved, contactInfo });
      if (approved) {
        verificationApproved = true;
        verifiedContactInfo = contactInfo;
      } else {
        verificationRejected = true;
      }
    });

    // Wait for signal (with timeout)
    const verificationTimeout = condition(() => verificationApproved || verificationRejected, '7 days');
    const verified = await verificationTimeout;

    if (!verified) {
      log.error('Verification timed out', { patientCaseId, provider, verificationId: contact.verificationId });
      await a.updateWorkflowStatus(`Verification timed out for ${provider}`);
      throw new Error(`Verification timed out for ${provider} after 7 days`);
    }

    if (verificationRejected) {
      log.error('Verification rejected', { patientCaseId, provider, verificationId: contact.verificationId });
      await a.updateWorkflowStatus(`Verification rejected for ${provider}`);
      throw new Error('Verification rejected for ' + provider);
    }

    log.info('Contact verified', { patientCaseId, provider });

    // Update contact info with verified details
    if (verifiedContactInfo) {
      contact.contact = verifiedContactInfo.faxNumber || verifiedContactInfo.email || contact.contact;
      contact.method = verifiedContactInfo.faxNumber ? 'fax' : 'email';
    }
  } else {
    log.info('No verification required - using existing contact info', { patientCaseId, provider });
  }

  await checkPaused();
  // Send request via fax or email
  if (contact.method === 'fax') {
    log.info('Sending fax', { patientCaseId, provider });
    await a.updateWorkflowStatus(`Sending fax to ${provider}`);
    const faxId = await longActivities.sendFax(patientCaseId, contact, requestId);
    log.info('Fax sent, waiting for delivery confirmation', { patientCaseId, provider, faxId });

    // Wait for fax completion signal from webhook
    await a.updateWorkflowStatus(`Waiting for fax delivery confirmation`);
    let faxSuccess = false;
    let faxFailed = false;
    let faxError: string | undefined;

    setHandler(faxCompletedSignal, (result: { success: boolean; faxId: string; error?: string }) => {
      log.info('Received fax completion signal', { result });
      if (result.success) {
        faxSuccess = true;
      } else {
        faxFailed = true;
        faxError = result.error;
      }
    });

    // Wait for signal (with timeout of 30 minutes - HumbleFax usually completes within this time)
    const faxTimeout = condition(() => faxSuccess || faxFailed, '30 minutes');
    const faxCompleted = await faxTimeout;

    if (!faxCompleted) {
      log.error('Fax delivery confirmation timed out', { patientCaseId, provider, faxId });
      await a.updateWorkflowStatus(`Fax delivery confirmation timed out`);
      throw new Error(`Fax delivery confirmation timed out after 30 minutes`);
    }

    if (faxFailed) {
      log.error('Fax delivery failed', { patientCaseId, provider, faxId, error: faxError });
      await a.updateWorkflowStatus(`Fax delivery failed: ${faxError}`);
      throw new Error(`Fax delivery failed: ${faxError}`);
    }

    log.info('Fax delivered successfully', { patientCaseId, provider, faxId });
    await a.updateWorkflowStatus(`Fax delivered successfully to ${provider}`);
  } else {
    log.info('Sending email', { patientCaseId, provider });
    await a.updateWorkflowStatus(`Sending email to ${provider}`);
    await longActivities.sendRecordsEmail(patientCaseId, contact, requestId);
    // Email delivery is immediate, no need to wait for confirmation
    log.info('Email sent successfully', { patientCaseId, provider });
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
      await longActivities.waitForRecords(provider);
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
          await longActivities.sendFax(contact, requestId);
        } else {
          await longActivities.sendEmail(contact, requestId);
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

  await checkPaused();
  log.info('Ingesting records', { patientCaseId, provider });
  await a.updateWorkflowStatus(`Ingesting records from ${provider}`);
  await longActivities.ingestRecords(provider);

  log.info('Records retrieval workflow completed', { patientCaseId, provider });
  await a.updateWorkflowStatus(`Completed: Records from ${provider} retrieved successfully`);
  */
 await a.updateWorkflowStatus(`Completed: Records successfully sent`);
  return {
    success: true,
    requestId,
    followUpAttempts,
  };
}
