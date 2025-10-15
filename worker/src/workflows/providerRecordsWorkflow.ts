import { proxyActivities, sleep, log } from '@temporalio/workflow';
import type * as activities from '../activities';
import { setupPauseHandlers, checkPaused } from '../utils/pauseResume';

// Short-running activities (status updates, quick DB queries)
const a = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

// Long-running activities (API calls)
const longActivities = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 minutes',
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

  const maxSignatureAttempts = 240; // Check for up to 30 days (every 3 hours)
  let signatureAttempts = 0;
  let signatureDone = false;
  let signatureSigned = false;

  while (!signatureDone && signatureAttempts < maxSignatureAttempts) {
    log.info('Checking signature status', { patientCaseId, providerName, requestId, attempt: signatureAttempts + 1 });

    const signatureStatus = await longActivities.waitForSignature(requestId, patientCaseId);
    signatureDone = signatureStatus.done;
    signatureSigned = signatureStatus.signed;

    if (!signatureDone) {
      await sleep('3 minutes'); // TODO: Change to '3 hours' for production
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

  log.info('Provider records workflow completed', { patientCaseId, providerName });
  await a.updateWorkflowStatus(`Completed - ${providerName}`);

  return {
    success: true,
    requestId,
    providerName,
  };
}
