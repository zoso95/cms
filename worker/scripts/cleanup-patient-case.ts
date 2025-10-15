#!/usr/bin/env tsx
/**
 * Cleanup script for testing workflows
 *
 * Clears all workflow-related data for a specific patient case:
 * - Tasks
 * - Providers
 * - Provider verifications
 * - Communication logs
 * - Call transcripts
 * - Claude analysis
 * - ElevenLabs calls
 *
 * Usage: npm run cleanup-case 4062
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY environment variables');
  console.error('   Make sure your .env file is configured in the worker directory');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupPatientCase(patientCaseId: number) {
  console.log(`\n🧹 Cleaning up patient case ${patientCaseId}...\n`);

  // Delete tasks
  const { error: tasksError, count: tasksCount } = await supabase
    .from('case_tasks')
    .delete({ count: 'exact' })
    .eq('patient_case_id', patientCaseId);

  if (tasksError) {
    console.error('❌ Error deleting tasks:', tasksError);
  } else {
    console.log(`✅ Deleted ${tasksCount || 0} task(s)`);
  }

  // Delete provider verifications
  const { error: verificationsError, count: verificationsCount } = await supabase
    .from('provider_verifications')
    .delete({ count: 'exact' })
    .eq('patient_case_id', patientCaseId);

  if (verificationsError) {
    console.error('❌ Error deleting verifications:', verificationsError);
  } else {
    console.log(`✅ Deleted ${verificationsCount || 0} verification(s)`);
  }

  // Delete providers
  const { error: providersError, count: providersCount } = await supabase
    .from('providers')
    .delete({ count: 'exact' })
    .eq('patient_case_id', patientCaseId);

  if (providersError) {
    console.error('❌ Error deleting providers:', providersError);
  } else {
    console.log(`✅ Deleted ${providersCount || 0} provider(s)`);
  }

  // Delete Claude analysis
  const { error: analysisError, count: analysisCount } = await supabase
    .from('claude_case_analysis')
    .delete({ count: 'exact' })
    .eq('patient_case_id', patientCaseId);

  if (analysisError) {
    console.error('❌ Error deleting analysis:', analysisError);
  } else {
    console.log(`✅ Deleted ${analysisCount || 0} analysis record(s)`);
  }

  // Delete call transcripts
  const { error: transcriptsError, count: transcriptsCount } = await supabase
    .from('call_transcripts')
    .delete({ count: 'exact' })
    .eq('patient_case_id', patientCaseId);

  if (transcriptsError) {
    console.error('❌ Error deleting transcripts:', transcriptsError);
  } else {
    console.log(`✅ Deleted ${transcriptsCount || 0} transcript(s)`);
  }

  // Delete ElevenLabs calls
  const { error: callsError, count: callsCount } = await supabase
    .from('elevenlabs_calls')
    .delete({ count: 'exact' })
    .eq('patient_case_id', patientCaseId);

  if (callsError) {
    console.error('❌ Error deleting calls:', callsError);
  } else {
    console.log(`✅ Deleted ${callsCount || 0} call(s)`);
  }

  // Delete communication logs
  const { error: commsError, count: commsCount } = await supabase
    .from('communication_logs')
    .delete({ count: 'exact' })
    .eq('patient_case_id', patientCaseId);

  if (commsError) {
    console.error('❌ Error deleting communications:', commsError);
  } else {
    console.log(`✅ Deleted ${commsCount || 0} communication log(s)`);
  }

  console.log(`\n✨ Cleanup complete for patient case ${patientCaseId}\n`);
}

// Get patient case ID from command line
const patientCaseId = parseInt(process.argv[2], 10);

if (!patientCaseId || isNaN(patientCaseId)) {
  console.error('❌ Usage: npm run cleanup-case <patient_case_id>');
  console.error('   Example: npm run cleanup-case 4062');
  process.exit(1);
}

cleanupPatientCase(patientCaseId).catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
