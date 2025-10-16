import { proxyActivities, sleep, log } from '@temporalio/workflow';
import type * as activities from '../activities';
import { setupPauseHandlers, checkPaused } from '../utils/pauseResume';

// Short-running activities (status updates, quick DB queries)
const a = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

// Long-running activities (API calls) with limited retry for calls/SMS
const longActivities = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
  retry: {
    maximumAttempts: 2, // Try once, then retry once = 2 total attempts (max 1 retry)
    initialInterval: '10 seconds',
    maximumInterval: '10 seconds',
    backoffCoefficient: 1,
  },
});

export interface ProviderRecordsResult {
  success: boolean;
  requestId: string;
  providerName: string;
}

/**
 * Provider Records Workflow
 *
 * Handles records retrieval for a single verified provider:
 * 1. Create records request (patient authorization)
 * 2. Wait for patient signature
 * 3. Send signed request to provider via fax/email
 *
 * Note: Provider contact info is already verified (Task 5), so no verification needed
 */
export async function providerRecordsWorkflow(
  patientCaseId: number,
  providerId: string,
  providerName: string
): Promise<ProviderRecordsResult> {
  log.info('Starting provider records workflow', { patientCaseId, providerId, providerName });

  // Mark workflow as running (in case it was scheduled)
  await a.markWorkflowAsRunning();

  // Set up pause/resume handlers
  setupPauseHandlers();

  // Step 1: Create records request (e-signature authorization)
  await checkPaused();
  await a.updateWorkflowStatus(`Creating records request for ${providerName}`);
  log.info('Creating records request', { patientCaseId, providerId, providerName });

  const requestId = await longActivities.createRecordsRequest(patientCaseId, providerName);
  log.info('Records request created', { patientCaseId, providerName, requestId });

  // Step 2: Wait for patient signature
  await checkPaused();
  await a.updateWorkflowStatus(`Waiting for patient signature - ${providerName}`);

  // TODO: Switch to webhook/signal-based polling instead of sleep-based polling
  // Current approach: Check frequently for first 30 min (for demo), then slow down
  // Better approach: Use OpenSign webhook or Temporal signals to notify when signed

  const fastPollingAttempts = 20; // 10 attempts × 3 min = 30 minutes
  const slowPollingAttempts = 60; // 60 attempts × 12 hours = 30 days
  const maxSignatureAttempts = fastPollingAttempts + slowPollingAttempts;

  let signatureAttempts = 0;
  let signatureDone = false;
  let signatureSigned = false;

  while (!signatureDone && signatureAttempts < maxSignatureAttempts) {
    log.info('Checking signature status', { patientCaseId, providerName, requestId, attempt: signatureAttempts + 1 });

    const signatureStatus = await longActivities.waitForSignature(requestId, patientCaseId);
    signatureDone = signatureStatus.done;
    signatureSigned = signatureStatus.signed;

    if (!signatureDone) {
      // Fast polling for first 30 minutes (for demo), then slow polling
      if (signatureAttempts < fastPollingAttempts) {
        await sleep('2 minutes'); // Fast: check every 3 minutes for first 30 min
      } else {
        await sleep('12 hours'); // Slow: check every 12 hours after 30 min
      }
      signatureAttempts++;
    }
  }

  if (!signatureDone) {
    log.error('Signature timed out', { patientCaseId, providerName, requestId, attempts: signatureAttempts });
    await a.updateWorkflowStatus(`Signature timeout - ${providerName}`);
    throw new Error(`Signature request timed out after ${signatureAttempts} attempts`);
  }

  if (!signatureSigned) {
    log.error('Signature declined or expired', { patientCaseId, providerName, requestId });
    await a.updateWorkflowStatus(`Signature declined - ${providerName}`);
    throw new Error(`Patient declined or signature expired for ${providerName}`);
  }

  log.info('Signature received', { patientCaseId, providerName, requestId });
  await a.updateWorkflowStatus(`Signature received - ${providerName}`);

  // Step 3: Get verified provider contact info from database
  await checkPaused();
  log.info('Getting verified provider contact info', { patientCaseId, providerId, providerName });

  // Get provider from database (should have verified contact info from Task 5)
  const providerInfo = await a.getVerifiedProvider(providerId);
  if (!providerInfo || !providerInfo.verified) {
    log.error('Provider not verified', { patientCaseId, providerId, providerName });
    throw new Error(`Provider ${providerName} is not verified`);
  }

  // Determine contact method and info
  const contact = {
    name: providerInfo.full_name || providerInfo.name,
    method: providerInfo.fax_number ? 'fax' : 'email',
    contact: providerInfo.fax_number || providerInfo.contact_info,
  };

  if (!contact.contact) {
    log.error('No contact info for provider', { patientCaseId, providerId, providerName });
    throw new Error(`No contact information found for ${providerName}`);
  }

  log.info('Provider contact retrieved', { patientCaseId, providerName, method: contact.method });

  // Step 4: Send request via fax or email
  await checkPaused();
  if (contact.method === 'fax') {
    log.info('Sending fax', { patientCaseId, providerName, faxNumber: contact.contact });
    await a.updateWorkflowStatus(`Sending fax - ${providerName}`);
    const faxId = await longActivities.sendFax(patientCaseId, contact, requestId);
    log.info('Fax sent successfully', { patientCaseId, providerName, faxId });
    await a.updateWorkflowStatus(`Fax sent - ${providerName}`);
  } else {
    log.info('Sending email', { patientCaseId, providerName, email: contact.contact });
    await a.updateWorkflowStatus(`Sending email - ${providerName}`);
    const messageId = await longActivities.sendRecordsEmail(patientCaseId, contact, requestId);
    log.info('Email sent successfully', { patientCaseId, providerName, messageId });
    await a.updateWorkflowStatus(`Email sent - ${providerName}`);
  }

  // Step 5: Call the provider's office (if they have a phone number)
  await checkPaused();
  if (providerInfo.phone_number) {
    log.info('Provider has phone number - placing follow-up call', { patientCaseId, providerId, providerName, phone: providerInfo.phone_number });
    await a.updateWorkflowStatus(`Calling provider office - ${providerName}`);

    try {
      const conversationId = await longActivities.placeProviderCall(patientCaseId, providerId);
      log.info('Provider call initiated successfully', { patientCaseId, providerName, conversationId });
      await a.updateWorkflowStatus(`Provider call initiated - ${providerName}`);

      // Note: We don't wait for the call to complete - it's fire-and-forget
      // The call result will be logged via webhook independently
    } catch (error: any) {
      // Log error but don't fail the workflow - the fax/email was already sent successfully
      log.warn('Provider call failed but continuing workflow', {
        patientCaseId,
        providerName,
        error: error.message,
      });
      await a.updateWorkflowStatus(`Provider call failed (continuing) - ${providerName}`);
    }
  } else {
    log.info('Provider has no phone number - skipping call', { patientCaseId, providerId, providerName });
  }

  log.info('Provider records workflow completed', { patientCaseId, providerName });
  await a.updateWorkflowStatus(`Completed - ${providerName}`);

  return {
    success: true,
    requestId,
    providerName,
  };
}
