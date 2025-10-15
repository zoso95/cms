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

/**
 * Normalize phone number for lookup
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let normalized = phone.replace(/\D/g, '');

  // If it starts with 1 and is 11 digits, keep it as is
  // If it's 10 digits, add country code
  if (normalized.length === 10) {
    normalized = '1' + normalized;
  }

  // Add + prefix for E.164 format
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }

  return normalized;
}

/**
 * Handle ElevenLabs inbound call webhook
 * This is called when someone calls into the ElevenLabs agent
 * We need to provide customer context so the agent knows who they're talking to
 */
export async function handleElevenLabsInboundCall(req: Request, res: Response) {
  try {
    // ElevenLabs sends the request body as a Buffer
    let bodyStr: string;
    if (Buffer.isBuffer(req.body)) {
      bodyStr = req.body.toString('utf8');
      console.log(`📞 [ELEVENLABS INBOUND] Converted buffer to string: ${bodyStr}`);
    } else if (typeof req.body === 'string') {
      bodyStr = req.body;
      console.log(`📞 [ELEVENLABS INBOUND] Body is already string: ${bodyStr}`);
    } else {
      bodyStr = JSON.stringify(req.body);
      console.log(`📞 [ELEVENLABS INBOUND] Body as JSON: ${bodyStr}`);
    }

    // Parse the JSON string to get call data
    const callData = JSON.parse(bodyStr);
    console.log(`📞 [ELEVENLABS INBOUND] Parsed call data: ${JSON.stringify(callData)}`);

    const { caller_id, agent_id, called_number, call_sid } = callData;

    console.log(`📞 [ELEVENLABS INBOUND] Call from ${caller_id} to agent ${agent_id}`);
    console.log(`   Call SID: ${call_sid}`);
    console.log(`   Called Number: ${called_number}`);

    // Find patient case by phone number
    // Build multiple format variations to check
    const digitsOnly = caller_id.replace(/\D/g, '');
    const last10 = digitsOnly.slice(-10);

    // Common phone number formats to try
    const phoneFormats = [
      caller_id,                                                              // Original: +14155334125
      `+1${last10}`,                                                         // E.164: +14155334125
      `+${last10}`,                                                          // E.164 no country: +4155334125
      last10,                                                                 // Just 10 digits: 4155334125
      `1${last10}`,                                                          // 11 digits: 14155334125
      `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`,  // Formatted: (415) 533-4125
      `${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6)}`,    // Dashed: 415-533-4125
    ];

    console.log(`🔍 Looking up patient case for phone: ${caller_id}`);
    console.log(`   Trying ${phoneFormats.length} format variations`);

    // Try all formats in a single query using .in()
    const { data: patientCases, error: lookupError } = await supabase
      .from('patient_cases')
      .select('*')
      .in('phone', phoneFormats)
      .limit(1);

    if (lookupError) {
      console.error(`❌ Error looking up patient: ${lookupError.message}`);
    }

    if (!patientCases || patientCases.length === 0) {
      console.log(`⚠️  No patient case found for ${caller_id} - providing minimal context`);

      // No patient found - provide minimal context
      return res.status(200).json({
        type: 'conversation_initiation_client_data',
        dynamic_variables: {
          customer_name: 'caller',
          customer_context: JSON.stringify({
            status: 'new_caller',
            message: 'First time caller - no existing information',
            phone: caller_id
          })
        }
      });
    }

    const patientCase = patientCases[0];
    console.log(`✅ Found patient case: ${patientCase.first_name} ${patientCase.last_name} (ID: ${patientCase.id})`);

    // Gather comprehensive context about this patient
    console.log(`📊 Gathering comprehensive context for patient ${patientCase.id}...`);

    // Fetch all related data
    const [
      { data: communications },
      { data: providers },
      { data: transcripts },
      { data: workflowExecutions },
      { data: analysis }
    ] = await Promise.all([
      supabase.from('communication_logs').select('*').eq('patient_case_id', patientCase.id).order('created_at', { ascending: false }),
      supabase.from('providers').select('*').eq('patient_case_id', patientCase.id).order('created_at', { ascending: false }),
      supabase.from('call_transcripts').select('*').eq('patient_case_id', patientCase.id).order('created_at', { ascending: false }),
      supabase.from('workflow_executions').select('*').eq('patient_case_id', patientCase.id).order('started_at', { ascending: false }),
      supabase.from('claude_case_analysis').select('*').eq('patient_case_id', patientCase.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    ]);

    // Build dynamic variables for ElevenLabs
    const dynamicVariables: Record<string, any> = {
      // Patient info
      customer_name: patientCase.first_name || 'caller',
      first_name: patientCase.first_name || '',
      last_name: patientCase.last_name || '',
      phone: patientCase.phone || '',
      email: patientCase.email || '',
      patient_status: patientCase.status || '',

      // Counts for quick reference
      total_communications: communications?.length || 0,
      total_providers: providers?.length || 0,
      total_transcripts: transcripts?.length || 0,
      call_count: communications?.filter(c => c.type === 'call').length || 0,
      sms_count: communications?.filter(c => c.type === 'sms').length || 0,
      email_count: communications?.filter(c => c.type === 'email').length || 0,
      fax_count: communications?.filter(c => c.type === 'fax').length || 0,
    };

    // Add workflow info if available
    if (workflowExecutions && workflowExecutions.length > 0) {
      const activeWorkflow = workflowExecutions.find(w => w.status === 'running') || workflowExecutions[0];
      dynamicVariables.has_active_workflow = activeWorkflow.status === 'running';
      dynamicVariables.workflow_status = activeWorkflow.status;
      dynamicVariables.workflow_name = activeWorkflow.workflow_name || '';
    }

    // Add provider info if available
    if (providers && providers.length > 0) {
      dynamicVariables.has_providers = true;
      dynamicVariables.provider_count = providers.length;
    } else {
      dynamicVariables.has_providers = false;
    }

    // Build comprehensive customer context
    const customerContext = {
      patient_case_id: patientCase.id,
      patient_info: {
        first_name: patientCase.first_name,
        last_name: patientCase.last_name,
        email: patientCase.email,
        phone: patientCase.phone,
        status: patientCase.status,
        details: patientCase.details
      },
      communications: communications || [],
      providers: providers || [],
      transcripts: transcripts?.map(t => ({
        id: t.id,
        created_at: t.created_at,
        transcript_preview: t.transcript
      })) || [],
      workflow_executions: workflowExecutions?.map(w => ({
        id: w.id,
        workflow_id: w.workflow_id,
        workflow_name: w.workflow_name,
        status: w.status,
        started_at: w.started_at,
        completed_at: w.completed_at
      })) || [],
      case_analysis: analysis ? {
        quality_score: analysis.quality_score,
        summary: analysis.summary,
        medical_subject: analysis.medical_subject,
        next_actions: analysis.next_actions
      } : null,
      metadata: {
        generated_at: new Date().toISOString(),
        call_type: 'inbound'
      }
    };

    // Add customer_context as stringified JSON
    dynamicVariables.customer_context = JSON.stringify(customerContext);

    console.log(`✅ Sending context with ${Object.keys(dynamicVariables).length} dynamic variables`);
    console.log(`   customer_context size: ${dynamicVariables.customer_context.length} chars`);

    // Create elevenlabs_calls record for inbound call
    // Note: We don't have the conversation_id yet (ElevenLabs will send it later)
    // So we store the call_sid and will update with conversation_id when we get the completion webhook
    const { data: callRecord, error: dbError } = await supabase
      .from('elevenlabs_calls')
      .insert({
        id: uuidv4(),
        patient_case_id: patientCase.id,
        workflow_id: `inbound-${call_sid}`, // Placeholder workflow_id for inbound calls
        call_sid: call_sid,
        to_number: called_number, // The number that was called
        agent_id: agent_id,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error(`⚠️ Failed to create call record: ${dbError.message}`);
    } else {
      console.log(`✅ Created inbound call record: ${callRecord.id} (call_sid: ${call_sid})`);
    }

    // Return context to ElevenLabs
    return res.status(200).json({
      type: 'conversation_initiation_client_data',
      dynamic_variables: dynamicVariables
    });

  } catch (error: any) {
    console.error('❌ [ELEVENLABS INBOUND] Error:', error);

    // Return minimal context on error so call doesn't fail
    return res.status(200).json({
      type: 'conversation_initiation_client_data',
      dynamic_variables: {
        customer_name: 'caller',
        customer_context: JSON.stringify({
          status: 'error',
          message: 'Error loading customer information'
        })
      }
    });
  }
}
