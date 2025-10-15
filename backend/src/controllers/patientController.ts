import { Request, Response } from 'express';
import { supabase } from '../db';

/**
 * Get all patient cases with pagination
 */
export async function getAllPatientCases(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    // Get total count
    const { count, error: countError } = await supabase
      .from('patient_cases')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    // Get paginated data
    const { data, error } = await supabase
      .from('patient_cases')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get patient cases with workflows
 */
export async function getPatientCasesWithWorkflows(req: Request, res: Response) {
  try {
    const { data, error } = await supabase
      .from('workflow_executions')
      .select('patient_case_id')
      .order('started_at', { ascending: false });

    if (error) throw error;

    // Get unique patient case IDs
    const patientCaseIds = [...new Set(data.map(w => w.patient_case_id))];

    // Fetch patient cases
    const { data: cases, error: casesError } = await supabase
      .from('patient_cases')
      .select('*')
      .in('id', patientCaseIds)
      .order('created_at', { ascending: false });

    if (casesError) throw casesError;

    res.json(cases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get single patient case
 */
export async function getPatientCase(req: Request, res: Response) {
  try {
    const { data, error } = await supabase
      .from('patient_cases')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get workflows for a patient case
 */
export async function getPatientWorkflows(req: Request, res: Response) {
  try {
    const { data, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('patient_case_id', req.params.id)
      .order('started_at', { ascending: false });

    if (error) throw error;

    // Enrich workflows with provider names
    const enrichedWorkflows = await Promise.all(
      (data || []).map(async (workflow) => {
        if (workflow.entity_type === 'provider' && workflow.entity_id) {
          const { data: provider } = await supabase
            .from('providers')
            .select('full_name, name')
            .eq('id', workflow.entity_id)
            .maybeSingle();

          return {
            ...workflow,
            entity_name: provider?.full_name || provider?.name || null,
          };
        }
        return workflow;
      })
    );

    res.json(enrichedWorkflows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get communications for a patient case
 */
export async function getPatientCommunications(req: Request, res: Response) {
  try {
    const { data, error } = await supabase
      .from('communication_logs')
      .select('*')
      .eq('patient_case_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get providers for a patient case
 */
export async function getPatientProviders(req: Request, res: Response) {
  try {
    const { data, error } = await supabase
      .from('providers')
      .select('*')
      .eq('patient_case_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get transcripts for a patient case
 */
export async function getPatientTranscripts(req: Request, res: Response) {
  try {
    const { data, error } = await supabase
      .from('call_transcripts')
      .select('*')
      .eq('patient_case_id', req.params.id)
      .order('created_at', { ascending: false});

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get Claude analysis for a patient case
 */
export async function getPatientAnalysis(req: Request, res: Response) {
  try {
    const { data, error } = await supabase
      .from('claude_case_analysis')
      .select('*')
      .eq('patient_case_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get verification requests for a patient case
 */
export async function getPatientVerifications(req: Request, res: Response) {
  try {
    const { data, error } = await supabase
      .from('provider_verifications')
      .select(`
        *,
        provider:providers(id, full_name, name, organization),
        call_transcript:call_transcripts(transcript)
      `)
      .eq('patient_case_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Update patient case details
 */
export async function updatePatientDetails(req: Request, res: Response) {
  try {
    const { details } = req.body;

    const { data, error } = await supabase
      .from('patient_cases')
      .update({ details })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
