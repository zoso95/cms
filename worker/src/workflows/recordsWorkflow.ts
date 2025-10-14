import { proxyActivities, executeChild, log, getExternalWorkflowHandle } from '@temporalio/workflow';
import type * as activities from '../activities';
import { recordsRetrievalWorkflow } from './recordsRetrievalWorkflow';
import { patientOutreachWorkflow } from './patientOutreachWorkflow';
import { RecordsWorkflowParams } from './registry';
import { setupPauseHandlers, checkPaused, pauseSignal, resumeSignal } from '../utils/pauseResume';

const a = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
});

/**
 * End-to-End Medical Records Workflow
 *
 * Complete workflow for retrieving medical records:
 * 1. Patient Outreach - Contact patient via SMS/calls
 * 2. Transcript Collection & Analysis
 * 3. Provider Records Retrieval (parallel)
 * 4. Downstream Analysis
 */
export async function endToEndWorkflow(
  patientCaseId: number,
  params?: Partial<RecordsWorkflowParams>
) {
  // Set up pause/resume handlers with child propagation
  setupPauseHandlers();

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

  log.info('Starting end-to-end medical records workflow', { patientCaseId, params: config });

  // ============================================
  // Phase 1: Patient Outreach (via child workflow)
  // ============================================
  await checkPaused();
  log.info('Phase 1: Patient Outreach', { patientCaseId });

  // Register child workflow before starting it
  const outreachWorkflowId = `patient-outreach-${patientCaseId}-${Date.now()}`;
  await a.registerChildWorkflow({
    workflowId: outreachWorkflowId,
    workflowName: 'patientOutreachWorkflow',
    patientCaseId,
    parameters: config.patientOutreach,
  });

  // Start the child workflow
  const outreachResult = await executeChild(patientOutreachWorkflow, {
    workflowId: outreachWorkflowId,
    args: [patientCaseId, config.patientOutreach],
  });

  log.info('Patient outreach completed', { patientCaseId, outreachResult });

  // If patient didn't respond and didn't pick up, workflow ends
  if (!outreachResult.success) {
    return { success: false, reason: 'no_contact', outreachResult };
  }

  // ============================================
  // Phase 2: Collect and analyze transcript
  // ============================================
  // Note: If user texted back, we still continue - they may be trying to opt out
  // or reschedule (we'll handle those cases later with the transcript analysis)
  await checkPaused();
  log.info('Phase 2: Collecting and analyzing transcript', { patientCaseId });

  const transcript = await a.collectTranscript(patientCaseId);
  log.info('Transcript collected', { patientCaseId, transcriptLength: transcript.length });

  const analysis = await a.analyzeTranscript(transcript);
  log.info('Transcript analyzed', { patientCaseId, analysis });

  const providers = await a.extractProviders(analysis);
  log.info('Providers extracted', { patientCaseId, providerCount: providers.length, providers });

  // 4️⃣ Parallelize provider subflows using child workflows
  await checkPaused();
  log.info('Phase 3: Processing provider records requests', { patientCaseId, providerCount: providers.length });

  const retrievalResults = await Promise.all(
    providers.map(async (provider, index) => {
      log.info(`Starting records retrieval for provider ${index + 1}/${providers.length}`, {
        patientCaseId,
        provider,
      });

      // Register child workflow before starting it
      const retrievalWorkflowId = `records-retrieval-${patientCaseId}-${provider.replace(/\s/g, '-')}-${Date.now()}`;
      await a.registerChildWorkflow({
        workflowId: retrievalWorkflowId,
        workflowName: 'recordsRetrievalWorkflow',
        patientCaseId,
        entityType: 'provider',
        entityId: provider, // Using provider name as entity ID for now
        parameters: {
          provider,
          ...config.recordsRetrieval,
        },
      });

      // Start the child workflow
      return executeChild(recordsRetrievalWorkflow, {
        workflowId: retrievalWorkflowId,
        args: [patientCaseId, provider, config.recordsRetrieval],
      });
    })
  );

  log.info('All provider records retrieved', { patientCaseId, providerCount: providers.length, retrievalResults });

  await checkPaused();
  log.info('Phase 4: Running downstream analysis', { patientCaseId });
  await a.downstreamAnalysis(patientCaseId);

  log.info('Records workflow completed successfully', { patientCaseId });
  return { success: true, reason: 'completed', providerCount: providers.length };
}
