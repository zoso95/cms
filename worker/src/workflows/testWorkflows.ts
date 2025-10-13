import { proxyActivities, log } from '@temporalio/workflow';
import type * as activities from '../activities';

const a = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

/**
 * Test SMS Workflow
 * Sends a single SMS to a patient
 */
export async function testSMSWorkflow(
  patientCaseId: number,
  params: { message: string }
): Promise<{ success: boolean }> {
  log.info('Test SMS workflow started', { patientCaseId, message: params.message });

  await a.sendSMS(patientCaseId, params.message);

  log.info('Test SMS workflow completed', { patientCaseId });
  return { success: true };
}

/**
 * Test Call Workflow
 * Places a single call to a patient
 */
export async function testCallWorkflow(
  patientCaseId: number,
  params: { agentId?: string; maxDuration?: number }
): Promise<{ success: boolean; pickedUp: boolean }> {
  log.info('Test call workflow started', { patientCaseId, params });

  const pickedUp = await a.placeCall(patientCaseId);

  log.info('Test call workflow completed', { patientCaseId, pickedUp });
  return { success: true, pickedUp };
}

/**
 * Test Fax Workflow
 * Sends a test fax to a number
 */
export async function testFaxWorkflow(
  patientCaseId: number,
  params: { faxNumber: string; message: string }
): Promise<{ success: boolean }> {
  log.info('Test fax workflow started', { patientCaseId, params });

  // Create a mock contact for fax testing
  const mockContact = {
    method: 'fax' as const,
    value: params.faxNumber,
  };

  await a.sendFax(mockContact, `test-fax-${Date.now()}`);

  log.info('Test fax workflow completed', { patientCaseId });
  return { success: true };
}

/**
 * Test Email Workflow
 * Sends a test email
 */
export async function testEmailWorkflow(
  patientCaseId: number,
  params: { to: string; subject: string; body: string }
): Promise<{ success: boolean }> {
  log.info('Test email workflow started', { patientCaseId, params });

  // Create a mock contact for email testing
  const mockContact = {
    method: 'email' as const,
    value: params.to,
  };

  await a.sendEmail(mockContact, `test-email-${Date.now()}`);

  log.info('Test email workflow completed', { patientCaseId });
  return { success: true };
}
