import { Request, Response } from 'express';
import { supabase } from '../db';
import { getTemporalClient } from '../temporal';
import { v4 as uuidv4 } from 'uuid';

/**
 * Handle ElevenLabs conversation webhook
 * Note: This assumes the webhook signature has already been validated by middleware
 */
export async function handleElevenLabsWebhook(req: Request, res: Response) {
  try {
    const webhookData = req.body;
    console.log('📦 Parsed webhook data:', JSON.stringify(webhookData, null, 2));

    const { type, data } = webhookData;

    // Log webhook event to database (before processing)
    const webhookEventId = uuidv4();
    await supabase.from('webhook_events').insert({
      id: webhookEventId,
      event_type: `elevenlabs:${type}`,
      payload: webhookData,
      processed: false,
    });
    console.log(`✅ Logged webhook event ${webhookEventId} to database`);

    switch (type) {
      case 'post_call_transcription':
        await handlePostCallTranscription(data, webhookEventId);
        break;

      case 'call_initiation_failure':
        await handleCallInitiationFailure(data, webhookEventId);
        break;

      default:
        console.log(`📋 Unknown event type: ${type}`);
        // Mark webhook as processed (even though we don't handle it)
        await supabase.from('webhook_events').update({
          processed: true,
        }).eq('id', webhookEventId);
    }

    res.status(200).json({ status: 'success' });
  } catch (error: any) {
    console.error('Error handling ElevenLabs webhook:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle post-call transcription event
 */
async function handlePostCallTranscription(data: any, webhookEventId: string) {
  console.log(`🏁 Post-call transcription received for conversation: ${data.conversation_id}`);
  console.log(`📞 Call duration: ${data.metadata?.call_duration_secs} seconds`);
  console.log(`✅ Call successful: ${data.analysis?.call_successful}`);

  // Find the call record
  const { data: callRecord } = await supabase
    .from('elevenlabs_calls')
    .select('*')
    .eq('conversation_id', data.conversation_id)
    .maybeSingle();

  if (!callRecord) {
    console.error(`❌ No call record found for conversation ${data.conversation_id}`);
    // Mark webhook as processed with error
    await supabase.from('webhook_events').update({
      processed: true,
      workflow_execution_id: null,
    }).eq('id', webhookEventId);
    return;
  }

  // Update webhook event with related IDs
  await supabase.from('webhook_events').update({
    patient_case_id: callRecord.patient_case_id,
    workflow_execution_id: callRecord.id,
  }).eq('id', webhookEventId);

  // Extract whether human was reached from evaluation criteria
  const evaluationResults = data.analysis?.evaluation_criteria_results || {};
  const humanContactResult = evaluationResults.talked_to_a_human?.result;
  const talkedToHuman = humanContactResult === 'success';

  console.log(`👤 Talked to human: ${talkedToHuman} (result: ${humanContactResult})`);

  // Create plain text transcript
  let transcriptText = '';
  if (data.transcript && Array.isArray(data.transcript)) {
    transcriptText = data.transcript
      .map((exchange: any) => `${exchange.role}: ${exchange.message}`)
      .join('\n');
  }

  // Extract collected variables
  const collectedVariables: Record<string, any> = {};
  if (data.analysis?.data_collection_results) {
    Object.entries(data.analysis.data_collection_results).forEach(([key, value]: [string, any]) => {
      collectedVariables[key] = value?.value || value;
    });
  }

  // Update the call record
  const { error: updateError } = await supabase
    .from('elevenlabs_calls')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      duration_seconds: data.metadata?.call_duration_secs || 0,
      talked_to_human: talkedToHuman,
      transcript: data.transcript,
      transcript_text: transcriptText,
      variables_collected: collectedVariables,
      analysis: data.analysis,
    })
    .eq('id', callRecord.id);

  if (updateError) {
    console.error(`❌ Failed to update call record: ${updateError.message}`);
    throw updateError;
  }

  console.log(`✅ Updated call record ${callRecord.id} - talked_to_human: ${talkedToHuman}`);

  // Log to communication_logs
  await supabase
    .from('communication_logs')
    .insert({
      id: uuidv4(),
      patient_case_id: callRecord.patient_case_id,
      workflow_execution_id: callRecord.id,
      type: 'call',
      direction: 'outbound',
      status: 'completed',
      content: transcriptText,
      metadata: {
        conversation_id: data.conversation_id,
        call_sid: callRecord.call_sid,
        duration_seconds: data.metadata?.call_duration_secs || 0,
        talked_to_human: talkedToHuman,
        variables_collected: collectedVariables,
      },
    });

  console.log(`✅ Logged call completion to communication_logs`);

  // Send signal to workflow
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(callRecord.workflow_id);

    await handle.signal('callCompleted', {
      conversationId: data.conversation_id,
      talkedToHuman,
      failed: false,
    });

    console.log(`✅ Sent callCompleted signal to workflow ${callRecord.workflow_id}`);
  } catch (error: any) {
    console.error(`❌ Failed to send signal to workflow: ${error.message}`);
    // Don't fail the webhook - the workflow will fall back to polling
  }

  // Mark webhook as successfully processed
  await supabase.from('webhook_events').update({
    processed: true,
  }).eq('id', webhookEventId);
}

/**
 * Handle call initiation failure event
 */
async function handleCallInitiationFailure(data: any, webhookEventId: string) {
  console.log(`❌ Call initiation failure for conversation: ${data.conversation_id}`);
  console.log(`   Failure reason: ${data.failure_reason}`);

  // Find the call record by conversation_id or call_sid
  const failureCallSid = data.metadata?.body?.CallSid || data.metadata?.body?.call_sid;

  let { data: failedCall } = await supabase
    .from('elevenlabs_calls')
    .select('*')
    .eq('conversation_id', data.conversation_id)
    .maybeSingle();

  if (!failedCall && failureCallSid) {
    const result = await supabase
      .from('elevenlabs_calls')
      .select('*')
      .eq('call_sid', failureCallSid)
      .maybeSingle();
    failedCall = result.data;
  }

  if (!failedCall) {
    console.error(`❌ No call record found for failed conversation ${data.conversation_id}`);
    // Mark webhook as processed with error
    await supabase.from('webhook_events').update({
      processed: true,
    }).eq('id', webhookEventId);
    return;
  }

  // Update webhook event with related IDs
  await supabase.from('webhook_events').update({
    patient_case_id: failedCall.patient_case_id,
    workflow_execution_id: failedCall.id,
  }).eq('id', webhookEventId);

  // Update the call record to mark it as failed
  const { error: failureUpdateError } = await supabase
    .from('elevenlabs_calls')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      failure_reason: data.failure_reason,
      talked_to_human: false,
      analysis: {
        failure_reason: data.failure_reason,
        failure_metadata: data.metadata,
      },
    })
    .eq('id', failedCall.id);

  if (failureUpdateError) {
    console.error(`❌ Failed to update call record: ${failureUpdateError.message}`);
    throw failureUpdateError;
  }

  console.log(`✅ Marked call ${failedCall.id} as failed (${data.failure_reason})`);

  // Log to communication_logs
  await supabase
    .from('communication_logs')
    .insert({
      id: uuidv4(),
      patient_case_id: failedCall.patient_case_id,
      workflow_execution_id: failedCall.id,
      type: 'call',
      direction: 'outbound',
      status: 'failed',
      content: `Call failed: ${data.failure_reason}`,
      metadata: {
        conversation_id: data.conversation_id,
        call_sid: failedCall.call_sid,
        failure_reason: data.failure_reason,
        failure_metadata: data.metadata,
      },
    });

  console.log(`✅ Logged call failure to communication_logs`);

  // Send signal to workflow
  try {
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(failedCall.workflow_id);

    await handle.signal('callCompleted', {
      conversationId: data.conversation_id,
      talkedToHuman: false,
      failed: true,
      failureReason: data.failure_reason,
    });

    console.log(`✅ Sent callCompleted signal to workflow ${failedCall.workflow_id}`);
  } catch (error: any) {
    console.error(`❌ Failed to send signal to workflow: ${error.message}`);
    // Don't fail the webhook - the workflow will fall back to polling
  }

  // Mark webhook as successfully processed
  await supabase.from('webhook_events').update({
    processed: true,
  }).eq('id', webhookEventId);
}

/**
 * Handle HumbleFax webhook
 */
export async function handleHumbleFaxWebhook(req: Request, res: Response) {
  try {
    const webhookData = req.body;

    console.log('📠 [HUMBLEFAX WEBHOOK] Received fax status notification:', JSON.stringify(webhookData, null, 2));

    const { type, data } = webhookData;

    // Log webhook event to database
    const webhookEventId = uuidv4();
    await supabase.from('webhook_events').insert({
      id: webhookEventId,
      event_type: `humblefax:${type}`,
      payload: webhookData,
      processed: false,
    });
    console.log(`✅ Logged webhook event ${webhookEventId} to database`);

    if (type === 'SentFax.SendComplete' && data?.SentFax) {
      const fax = data.SentFax;
      const faxId = fax.id.toString();

      console.log(`📠 [HUMBLEFAX WEBHOOK] Fax ${faxId} completed with status: ${fax.status}`);

      // Find the communication log by fax ID
      const { data: commLog, error: commError } = await supabase
        .from('communication_logs')
        .select('*')
        .eq('metadata->>fax_id', faxId)
        .eq('type', 'fax')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (commError || !commLog) {
        console.info(`⚠️ Could not find communication log for fax ID: ${faxId}`);
        // Mark webhook as processed
        await supabase.from('webhook_events').update({
          processed: true,
        }).eq('id', webhookEventId);
        return res.status(200).json({ received: true });
      }

      console.log(`✅ Found communication log ${commLog.id} for fax ${faxId}`);

      // Update webhook event with related IDs
      await supabase.from('webhook_events').update({
        patient_case_id: commLog.patient_case_id,
        workflow_execution_id: commLog.workflow_execution_id,
      }).eq('id', webhookEventId);

      // Determine success based on fax status and recipients
      const isSuccess = fax.status === 'success' && fax.numSuccesses > 0;
      const successfulRecipients = fax.recipients?.filter((r: any) => r.status === 'success') || [];
      const failedRecipients = fax.recipients?.filter((r: any) => r.status === 'failure') || [];

      console.log(`📊 [HUMBLEFAX WEBHOOK] Results: ${fax.numSuccesses} successes, ${fax.numFailures} failures`);

      // Prepare result data
      const resultData = {
        fax_id: faxId,
        status: fax.status,
        pages_sent: fax.numPages,
        successes: fax.numSuccesses,
        failures: fax.numFailures,
        successful_recipients: successfulRecipients.map((r: any) => r.toNumber),
        failed_recipients: failedRecipients.map((r: any) => ({
          number: r.toNumber,
          reason: r.attempts?.calls?.[0]?.failureReason || 'Unknown failure'
        })),
        completion_time: new Date().toISOString(),
        transmission_details: fax.recipients
      };

      // Update communication log status
      if (isSuccess) {
        console.log(`✅ [HUMBLEFAX WEBHOOK] Fax sent successfully to ${fax.numSuccesses} recipient(s)`);
        await supabase
          .from('communication_logs')
          .update({
            status: 'delivered',
            metadata: {
              ...commLog.metadata,
              ...resultData
            }
          })
          .eq('id', commLog.id);
      } else {
        console.log(`❌ [HUMBLEFAX WEBHOOK] Fax failed or partially failed`);
        await supabase
          .from('communication_logs')
          .update({
            status: 'failed',
            metadata: {
              ...commLog.metadata,
              ...resultData,
              error_message: `Fax failed: ${fax.numFailures} failures out of ${fax.recipients?.length || 1} recipients`
            }
          })
          .eq('id', commLog.id);
      }

      console.log(`🎉 [HUMBLEFAX WEBHOOK] Communication log ${commLog.id} updated`);

      // Send signal to workflow
      if (commLog.workflow_execution_id) {
        const { data: workflowExec } = await supabase
          .from('workflow_executions')
          .select('workflow_id')
          .eq('id', commLog.workflow_execution_id)
          .single();

        if (workflowExec?.workflow_id) {
          try {
            const client = await getTemporalClient();
            const handle = client.workflow.getHandle(workflowExec.workflow_id);

            await handle.signal('faxCompleted', {
              success: isSuccess,
              faxId: faxId,
              error: isSuccess ? undefined : `${fax.numFailures} of ${fax.recipients?.length || 1} recipients failed`
            });

            console.log(`✅ Sent faxCompleted signal to workflow ${workflowExec.workflow_id}`);
          } catch (error: any) {
            console.error(`❌ Failed to send signal to workflow: ${error.message}`);
            // Don't fail the webhook - the status is still updated in the database
          }
        }
      }

      // Mark webhook as successfully processed
      await supabase.from('webhook_events').update({
        processed: true,
      }).eq('id', webhookEventId);

    } else {
      console.log(`📠 [HUMBLEFAX WEBHOOK] Ignoring webhook type: ${type}`);
      // Mark webhook as processed (even though we don't handle it)
      await supabase.from('webhook_events').update({
        processed: true,
      }).eq('id', webhookEventId);
    }

    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error: any) {
    console.error('❌ [HUMBLEFAX WEBHOOK] Error processing webhook:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process HumbleFax webhook'
    });
  }
}

/**
 * Handle Twilio SMS webhook
 */
export async function handleTwilioSmsWebhook(req: Request, res: Response) {
  try {
    const { From, Body, MessageSid } = req.body;

    // Find patient case by phone
    const { data: patientCase } = await supabase
      .from('patient_cases')
      .select('id')
      .eq('phone', From)
      .single();

    if (!patientCase) {
      return res.status(404).json({ error: 'Patient case not found' });
    }

    // Find running workflow for this patient
    const { data: execution } = await supabase
      .from('workflow_executions')
      .select('workflow_id')
      .eq('patient_case_id', patientCase.id)
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (execution) {
      // Send signal to workflow
      const client = await getTemporalClient();
      const handle = client.workflow.getHandle(execution.workflow_id);
      await handle.signal('userResponse', {
        message: Body,
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle Twilio Voice webhook
 */
export async function handleTwilioVoiceWebhook(req: Request, res: Response) {
  const twiml = `
    <Response>
      <Say>Thank you for calling. This call is being recorded for quality assurance.</Say>
      <Record maxLength="300" transcribe="true" transcribeCallback="/api/webhooks/twilio/transcription" />
    </Response>
  `;
  res.type('text/xml');
  res.send(twiml);
}

/**
 * Handle Twilio Transcription webhook
 */
export async function handleTwilioTranscriptionWebhook(req: Request, res: Response) {
  try {
    const { TranscriptionText, CallSid } = req.body;

    // Store transcription
    // In a real implementation, you'd link this to the appropriate patient case and workflow

    console.log('Transcription received:', TranscriptionText);

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Transcription webhook error:', error);
    res.status(500).json({ error: error.message });
  }
}
