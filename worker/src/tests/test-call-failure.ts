import { config } from 'dotenv';
import { supabase } from '../db';

config();

/**
 * Test script to trigger a call initiation failure
 * Uses a non-existent phone number to test the failure webhook handler
 */
async function testCallFailure() {
  console.log('🧪 Testing call initiation failure...\n');

  try {
    // Create a test patient case with a non-existent phone number
    // Using +15555555555 which has valid format but doesn't exist
    const { data: patientCase, error: caseError } = await supabase
      .from('patient_cases')
      .insert({
        first_name: 'Test',
        last_name: 'CallFailure',
        email: 'test-call-failure@example.com',
        phone: '+15555555555', // Properly formatted but non-existent number
        status: 'new',
      })
      .select()
      .single();

    if (caseError) {
      throw caseError;
    }

    console.log(`✅ Created test patient case #${patientCase.id}`);
    console.log(`   Phone: ${patientCase.phone}`);
    console.log(`   Name: ${patientCase.first_name} ${patientCase.last_name}\n`);

    // Trigger the workflow via backend API
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    console.log(`📞 Triggering testCallWorkflow via ${backendUrl}...\n`);

    const response = await fetch(`${backendUrl}/api/workflows/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        patientCaseId: patientCase.id,
        workflowName: 'testCallWorkflow',
        parameters: {},
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to start workflow: ${error}`);
    }

    const result = await response.json() as any;
    console.log(`✅ Workflow started!`);
    console.log(`   Workflow ID: ${result.workflowId}`);
    console.log(`   Run ID: ${result.runId}`);
    console.log(`\n📋 Expected behavior:`);
    console.log(`   1. Call will be initiated to ${patientCase.phone}`);
    console.log(`   2. ElevenLabs/Twilio will reject the call (non-existent number)`);
    console.log(`   3. ElevenLabs will send call_initiation_failure webhook`);
    console.log(`   4. Webhook should update call record status to 'failed'`);
    console.log(`   5. Webhook should send signal to workflow`);
    console.log(`\n🔍 Watch the backend logs for webhook activity...`);
    console.log(`   You should see:`);
    console.log(`   - "❌ Call initiation failure for conversation: ..."`);
    console.log(`   - "   Failure reason: [error from ElevenLabs/Twilio]"`);
    console.log(`   - "✅ Marked call ... as failed (...)"`);
    console.log(`\n⏳ Waiting for webhook... (this may take a few seconds)`);

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Run the test
testCallFailure()
  .then(() => {
    console.log('\n✅ Test setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
