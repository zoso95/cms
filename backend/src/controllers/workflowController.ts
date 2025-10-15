import { Request, Response } from 'express';
import { supabase } from '../db';
import { getTemporalClient } from '../temporal';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get available workflows catalog
 */
export async function getWorkflowCatalog(req: Request, res: Response) {
  try {
    // Simple workflow metadata (hardcoded for reliability)
    const workflows = [
      {
        name: 'endToEndWorkflow',
        displayName: 'End-to-End Medical Records',
        description: 'Complete workflow: patient outreach, transcript collection, provider records retrieval, and downstream analysis',
        category: 'production',
        defaultParams: {
          patientOutreach: {
            maxAttempts: 7,
            waitBetweenAttempts: '1 day',
            smsTemplate: 'Please call us back to discuss your medical records.',
          },
          recordsRetrieval: {
            followUpEnabled: false,
            followUpInterval: '3 days',
            maxFollowUps: 2,
          },
          call: {
            maxDuration: 300,
          },
        },
      },
      {
        name: 'patientOutreachWorkflow',
        displayName: 'Patient Outreach',
        description: 'Contact patient via SMS and calls until they respond or max attempts reached',
        category: 'production',
        defaultParams: {
          maxAttempts: 7,
          waitBetweenAttempts: '1 day',
          smsTemplate: 'Please call us back to discuss your medical records.',
        },
      },
      {
        name: 'recordsRetrievalWorkflow',
        displayName: 'Records Retrieval',
        description: 'Request and retrieve medical records from a healthcare provider',
        category: 'production',
        defaultParams: {
          providerId: '',
          followUpEnabled: false,
          followUpInterval: '3 days',
          maxFollowUps: 2,
        },
      },
      {
        name: 'testSMSWorkflow',
        displayName: 'Test SMS',
        description: 'Send a test SMS to a patient',
        category: 'test',
        defaultParams: {
          message: 'Test message from Afterimage',
        },
      },
      {
        name: 'testCallWorkflow',
        displayName: 'Test Call',
        description: 'Place a test call to a patient',
        category: 'test',
        defaultParams: {
          maxDuration: 300,
        },
      },
      {
        name: 'testFaxWorkflow',
        displayName: 'Test Fax',
        description: 'Send a test fax to a number',
        category: 'test',
        defaultParams: {
          faxNumber: '',
          message: 'Test fax',
        },
      },
      {
        name: 'testEmailWorkflow',
        displayName: 'Test Email',
        description: 'Send a test email',
        category: 'test',
        defaultParams: {
          to: '',
          subject: 'Test email',
          body: 'This is a test email',
        },
      },
    ];

    res.json(workflows);
  } catch (error: any) {
    console.error('Error loading workflow catalog:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get workflow source code
 */
export async function getWorkflowSource(req: Request, res: Response) {
  try {
    const { workflowName } = req.params;
    const fs = await import('fs/promises');
    const path = await import('path');

    // Map workflow names to file paths
    const workflowFiles: Record<string, string> = {
      endToEndWorkflow: 'recordsWorkflow.ts',
      patientOutreachWorkflow: 'patientOutreachWorkflow.ts',
      recordsRetrievalWorkflow: 'recordsRetrievalWorkflow.ts',
      testSMSWorkflow: 'testWorkflows.ts',
      testCallWorkflow: 'testWorkflows.ts',
      testFaxWorkflow: 'testWorkflows.ts',
      testEmailWorkflow: 'testWorkflows.ts',
    };

    const fileName = workflowFiles[workflowName];
    if (!fileName) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const filePath = path.join(__dirname, '../../../worker/src/workflows', fileName);
    const source = await fs.readFile(filePath, 'utf-8');

    res.json({ workflowName, source });
  } catch (error: any) {
    console.error('Error reading workflow source:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Start workflow for a patient case
 */
export async function startWorkflow(req: Request, res: Response) {
  try {
    const { patientCaseId, workflowName = 'endToEndWorkflow', parameters = {}, scheduledAt } = req.body;

    if (!patientCaseId) {
      return res.status(400).json({ error: 'patientCaseId is required' });
    }

    // Check if patient case exists
    const { data: patientCase, error: caseError } = await supabase
      .from('patient_cases')
      .select('*')
      .eq('id', patientCaseId)
      .single();

    if (caseError) throw caseError;
    if (!patientCase) {
      return res.status(404).json({ error: 'Patient case not found' });
    }

    const workflowId = `${workflowName}-${patientCaseId}-${Date.now()}`;

    // Prepare workflow args based on workflow type
    let args: any[] = [patientCaseId];
    if (workflowName === 'endToEndWorkflow') {
      args = [patientCaseId, parameters];
    } else if (workflowName === 'recordsRetrievalWorkflow') {
      // Records retrieval needs provider name as second argument
      // Look up provider from providerId if provided
      let providerName = parameters.providerName || 'Unknown Provider';

      if (parameters.providerId) {
        const { data: provider } = await supabase
          .from('providers')
          .select('full_name, first_name, last_name, name')
          .eq('id', parameters.providerId)
          .maybeSingle();

        if (provider) {
          providerName = provider.full_name ||
                        `${provider.first_name || ''} ${provider.last_name || ''}`.trim() ||
                        provider.name ||
                        providerName;
        }
      }

      args = [patientCaseId, providerName, parameters];
    } else if (workflowName.startsWith('test')) {
      args = [patientCaseId, parameters];
    } else {
      // For other workflows, include parameters
      args = [patientCaseId, parameters];
    }

    // Handle scheduled vs immediate workflow
    if (scheduledAt) {
      // Use Temporal's startDelay option for one-time delayed execution
      const startAtDate = new Date(scheduledAt);

      if (startAtDate <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' });
      }

      // Calculate delay in milliseconds
      const delayMs = startAtDate.getTime() - Date.now();

      const client = await getTemporalClient();

      // Create workflow execution record with scheduled status
      const { data: execution, error: execError } = await supabase
        .from('workflow_executions')
        .insert({
          id: uuidv4(),
          patient_case_id: patientCaseId,
          workflow_id: workflowId,
          run_id: '',
          status: 'scheduled',
          scheduled_at: startAtDate.toISOString(),
          workflow_name: workflowName,
          parameters: parameters,
        })
        .select()
        .single();

      if (execError) throw execError;

      // Start workflow with delay
      const handle = await client.workflow.start(workflowName, {
        taskQueue: 'records-workflow',
        args,
        workflowId,
        startDelay: delayMs, // Delay in milliseconds
      });

      // Update with run ID
      await supabase
        .from('workflow_executions')
        .update({ run_id: handle.firstExecutionRunId })
        .eq('id', execution.id);

      console.log(`✅ Scheduled workflow ${workflowId} to start at ${startAtDate.toISOString()} (${delayMs}ms delay)`);

      res.json({
        workflowId,
        runId: handle.firstExecutionRunId,
        executionId: execution.id,
        scheduledAt: startAtDate.toISOString(),
        status: 'scheduled',
      });
    } else {
      // Start the workflow immediately
      const client = await getTemporalClient();

      // Create workflow execution record
      const { data: execution, error: execError } = await supabase
        .from('workflow_executions')
        .insert({
          id: uuidv4(),
          patient_case_id: patientCaseId,
          workflow_id: workflowId,
          run_id: '', // Will be updated when we get the run ID
          status: 'running',
          workflow_name: workflowName,
          parameters: parameters,
        })
        .select()
        .single();

      if (execError) throw execError;

      const handle = await client.workflow.start(workflowName, {
        taskQueue: 'records-workflow',
        args,
        workflowId,
      });

      // Update with run ID
      await supabase
        .from('workflow_executions')
        .update({ run_id: handle.firstExecutionRunId })
        .eq('id', execution.id);

      // Update patient case status
      await supabase
        .from('patient_cases')
        .update({ status: 'in_progress' })
        .eq('id', patientCaseId);

      res.json({
        workflowId,
        runId: handle.firstExecutionRunId,
        executionId: execution.id,
      });
    }
  } catch (error: any) {
    console.error('Error starting workflow:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get workflow status
 */
export async function getWorkflowStatus(req: Request, res: Response) {
  try {
    const { workflowId } = req.params;

    // Get workflow status from Temporal
    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    const description = await handle.describe();

    // Get additional metadata from database (includes hierarchy info)
    const { data: dbRecord } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('workflow_id', workflowId)
      .maybeSingle();

    res.json({
      workflowId: description.workflowId,
      runId: description.runId,
      status: description.status.name,
      startTime: description.startTime,
      closeTime: description.closeTime,
      // Include database metadata if available
      ...(dbRecord && {
        patientCaseId: dbRecord.patient_case_id,
        parentWorkflowId: dbRecord.parent_workflow_id,
        entityType: dbRecord.entity_type,
        entityId: dbRecord.entity_id,
        workflowName: dbRecord.workflow_name,
        parameters: dbRecord.parameters,
      }),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get child workflows for a parent workflow
 */
export async function getChildWorkflows(req: Request, res: Response) {
  try {
    const { workflowId } = req.params;

    const { data, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('parent_workflow_id', workflowId)
      .order('started_at', { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Send signal to workflow
 */
export async function sendWorkflowSignal(req: Request, res: Response) {
  try {
    const { workflowId } = req.params;
    const { signalName, signalArgs } = req.body;

    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    await handle.signal(signalName, ...signalArgs);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Pause workflow
 */
export async function pauseWorkflow(req: Request, res: Response) {
  try {
    const { workflowId } = req.params;

    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);

    // Send pause signal
    await handle.signal('pause');

    // Update database
    await supabase
      .from('workflow_executions')
      .update({ paused: true })
      .eq('workflow_id', workflowId);

    // Get child workflows
    const { data: children } = await supabase
      .from('workflow_executions')
      .select('workflow_id')
      .eq('parent_workflow_id', workflowId)
      .eq('status', 'running');

    // Pause all children
    if (children && children.length > 0) {
      for (const child of children) {
        try {
          const childHandle = client.workflow.getHandle(child.workflow_id);
          await childHandle.signal('pause');

          await supabase
            .from('workflow_executions')
            .update({ paused: true })
            .eq('workflow_id', child.workflow_id);
        } catch (error) {
          console.error(`Failed to pause child ${child.workflow_id}:`, error);
        }
      }
    }

    res.json({ success: true, childrenPaused: children?.length || 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Resume workflow
 */
export async function resumeWorkflow(req: Request, res: Response) {
  try {
    const { workflowId } = req.params;

    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);

    // Send resume signal
    await handle.signal('resume');

    // Update database
    await supabase
      .from('workflow_executions')
      .update({ paused: false })
      .eq('workflow_id', workflowId);

    // Get child workflows
    const { data: children } = await supabase
      .from('workflow_executions')
      .select('workflow_id')
      .eq('parent_workflow_id', workflowId)
      .eq('status', 'running');

    // Resume all children
    if (children && children.length > 0) {
      for (const child of children) {
        try {
          const childHandle = client.workflow.getHandle(child.workflow_id);
          await childHandle.signal('resume');

          await supabase
            .from('workflow_executions')
            .update({ paused: false })
            .eq('workflow_id', child.workflow_id);
        } catch (error) {
          console.error(`Failed to resume child ${child.workflow_id}:`, error);
        }
      }
    }

    res.json({ success: true, childrenResumed: children?.length || 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Stop/terminate workflow
 */
export async function stopWorkflow(req: Request, res: Response) {
  try {
    const { workflowId } = req.params;

    const client = await getTemporalClient();
    const handle = client.workflow.getHandle(workflowId);
    await handle.terminate('Stopped by user');

    // Update database
    await supabase
      .from('workflow_executions')
      .update({
        status: 'terminated',
        completed_at: new Date().toISOString(),
        error: 'Stopped by user'
      })
      .eq('workflow_id', workflowId);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Delete workflow execution record
 */
export async function deleteWorkflow(req: Request, res: Response) {
  try {
    const { executionId } = req.params;

    // Get the workflow execution to find workflow_id
    const { data: execution, error: fetchError } = await supabase
      .from('workflow_executions')
      .select('workflow_id, status')
      .eq('id', executionId)
      .single();

    if (fetchError) throw fetchError;

    // Terminate the Temporal workflow if it's still running
    if (execution && execution.workflow_id) {
      if (execution.status === 'running') {
        try {
          const client = await getTemporalClient();
          const handle = client.workflow.getHandle(execution.workflow_id);
          await handle.terminate('Deleted by user');
          console.log(`✅ Terminated workflow ${execution.workflow_id}`);
        } catch (error: any) {
          console.error(`⚠️ Failed to terminate workflow ${execution.workflow_id}:`, error.message);
          // Continue with deletion even if terminate fails (workflow might already be completed)
        }
      }
    }

    // Delete the database record
    const { error } = await supabase
      .from('workflow_executions')
      .delete()
      .eq('id', executionId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
