import { Request, Response } from 'express';
import { supabase } from '../db';
import { getTemporalClient } from '../temporal';

/**
 * Get single verification with full details
 */
export async function getVerification(req: Request, res: Response) {
  try {
    const { data, error } = await supabase
      .from('provider_verifications')
      .select(`
        *,
        provider:providers(*),
        call_transcript:call_transcripts(*),
        workflow:workflow_executions(workflow_id, workflow_name)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Approve verification with contact info
 */
export async function approveVerification(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { faxNumber, email, ...otherContactInfo } = req.body;

    if (!faxNumber && !email) {
      return res.status(400).json({ error: 'Either fax number or email is required' });
    }

    // Get verification to find provider
    const { data: verification, error: verifyError } = await supabase
      .from('provider_verifications')
      .select('provider_id')
      .eq('id', id)
      .single();

    if (verifyError) throw verifyError;

    // Update verification status
    const { error: updateError } = await supabase
      .from('provider_verifications')
      .update({
        status: 'approved',
        verified_contact_info: {
          fax_number: faxNumber,
          email,
          ...otherContactInfo
        },
        verified_by: 'user', // TODO: Add actual user tracking
        verified_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // Update provider record with verified contact info
    if (verification.provider_id) {
      const updateData: any = {
        verified: true, // Mark provider as verified
      };
      if (faxNumber) updateData.fax_number = faxNumber;
      if (email) updateData.contact_info = email;
      if (otherContactInfo.organization) updateData.organization = otherContactInfo.organization;
      if (otherContactInfo.specialty) updateData.specialty = otherContactInfo.specialty;
      if (otherContactInfo.address) updateData.address = otherContactInfo.address;
      if (otherContactInfo.city) updateData.city = otherContactInfo.city;
      if (otherContactInfo.state) updateData.state = otherContactInfo.state;
      if (otherContactInfo.phoneNumber) updateData.phone_number = otherContactInfo.phoneNumber;
      if (otherContactInfo.npi) updateData.npi = otherContactInfo.npi;

      await supabase
        .from('providers')
        .update(updateData)
        .eq('id', verification.provider_id);
    }

    // Send signal to workflow to continue
    const { data: fullVerification } = await supabase
      .from('provider_verifications')
      .select('workflow_execution_id')
      .eq('id', id)
      .single();

    console.log(`[VERIFICATION APPROVE] Verification ${id} - workflow_execution_id: ${fullVerification?.workflow_execution_id}`);

    if (fullVerification?.workflow_execution_id) {
      const { data: workflowExec } = await supabase
        .from('workflow_executions')
        .select('workflow_id, status')
        .eq('id', fullVerification.workflow_execution_id)
        .single();

      console.log(`[VERIFICATION APPROVE] Workflow execution: ${JSON.stringify(workflowExec)}`);

      if (workflowExec?.workflow_id) {
        try {
          const client = await getTemporalClient();
          const handle = client.workflow.getHandle(workflowExec.workflow_id);

          console.log(`[VERIFICATION APPROVE] Sending signal with data:`, { faxNumber, email, otherContactInfo });

          await handle.signal('verificationComplete', true, {
            faxNumber,
            email,
            ...otherContactInfo
          });
          console.log(`✅ Sent verificationComplete signal to workflow ${workflowExec.workflow_id}`);
        } catch (error: any) {
          console.error(`❌ Failed to send signal to workflow: ${error.message}`);
          console.error(`   Full error:`, error);
          // Don't fail the request - verification is still saved
        }
      } else {
        console.warn(`⚠️ No workflow_id found for workflow_execution_id: ${fullVerification.workflow_execution_id}`);
      }
    } else {
      console.warn(`⚠️ No workflow_execution_id found for verification: ${id}`);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Reject verification
 */
export async function rejectVerification(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { error } = await supabase
      .from('provider_verifications')
      .update({
        status: 'rejected',
        verified_contact_info: { rejection_reason: reason },
        verified_by: 'user', // TODO: Add actual user tracking
        verified_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    // Send signal to workflow to fail
    const { data: fullVerification } = await supabase
      .from('provider_verifications')
      .select('workflow_execution_id')
      .eq('id', id)
      .single();

    if (fullVerification?.workflow_execution_id) {
      const { data: workflowExec } = await supabase
        .from('workflow_executions')
        .select('workflow_id')
        .eq('id', fullVerification.workflow_execution_id)
        .single();

      if (workflowExec?.workflow_id) {
        try {
          const client = await getTemporalClient();
          const handle = client.workflow.getHandle(workflowExec.workflow_id);
          await handle.signal('verificationComplete', false);
          console.log(`✅ Sent verificationComplete (rejected) signal to workflow ${workflowExec.workflow_id}`);
        } catch (error: any) {
          console.error(`❌ Failed to send signal to workflow: ${error.message}`);
          // Don't fail the request - rejection is still saved
        }
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
