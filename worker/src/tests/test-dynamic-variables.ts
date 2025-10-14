import { config } from 'dotenv';
import { buildDynamicVariables } from '../utils/dynamicVariables';

config();

/**
 * Test script to see what dynamic variables are generated for a patient case
 */
async function testDynamicVariables() {
  // Use the patient case from your most recent test (or change this)
  const patientCaseId = 4062; // Your test patient with the real phone number
  const workflowId = '1760399033865';

  console.log(`\n🧪 Testing dynamic variables for patient case ${patientCaseId}\n`);

  try {
    const variables = await buildDynamicVariables(patientCaseId, workflowId);

    console.log('📊 Generated Dynamic Variables:\n');

    // Show all variables except context (which is huge)
    const simpleVars = Object.entries(variables).filter(([key]) => key !== 'context');

    simpleVars.forEach(([key, value]) => {
      const valueType = typeof value;
      const displayValue = valueType === 'string' && (value as string).length > 100
        ? `${(value as string).substring(0, 100)}...`
        : value;
      console.log(`${key} = ${JSON.stringify(displayValue)} (${valueType})`);
    });

    console.log(`\nTotal: ${simpleVars.length} simple variables + 1 context variable`);

    // Show context metadata
    if (variables.context) {
      const context = JSON.parse(variables.context as string);
      console.log('\n📦 Context object includes:');
      console.log(`  - patient_case: ${Object.keys(context.patient_case).length} fields`);
      console.log(`  - communications: ${context.communications.length} records`);
      console.log(`  - providers: ${context.providers.length} records`);
      console.log(`  - transcripts: ${context.transcripts.length} records`);
      console.log(`  - workflow_execution: ${context.workflow_execution ? 'yes' : 'no'}`);
      console.log(`  - metadata: ${Object.keys(context.metadata).length} fields`);

      console.log('\n📄 Context preview (first 500 chars):');
      console.log('-'.repeat(80));
      console.log((variables.context as string).substring(0, 500) + '...');
      console.log('-'.repeat(80));
    }

    console.log('\n✅ Dynamic variables test complete!');
    console.log(`\n💡 In ElevenLabs agent prompts, you can now use:`);
    console.log(`   - {{patient_first_name}} {{patient_last_name}}`);
    console.log(`   - {{patient_email}}`);
    console.log(`   - {{sms_count}} previous SMS messages`);
    console.log(`   - {{call_count}} previous call attempts`);
    console.log(`   - {{has_providers}} to check if providers are known`);
    console.log(`   - Parse {{context}} for detailed information`);

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

testDynamicVariables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
