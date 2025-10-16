/**
 * Test script to call a provider's office
 *
 * Usage:
 *   npx ts-node test-provider-call.ts <patient-case-id> <provider-id>
 *
 * Example:
 *   npx ts-node test-provider-call.ts 4551 a7c38630-b379-4c24-832a-fd33b4dc0e02
 */

import { config } from 'dotenv';
import { supabase } from './src/db';
import { elevenlabs } from './src/services/elevenlabs';
import { normalizePhoneNumber } from './src/utils/phone';
import { buildProviderCallDynamicVariables } from './src/utils/dynamicVariables';

// Load environment variables
config();

async function testProviderCall() {
  const [patientCaseIdStr, providerId] = process.argv.slice(2);

  if (!patientCaseIdStr || !providerId) {
    console.error('Usage: npx ts-node test-provider-call.ts <patient-case-id> <provider-id>');
    console.error('');
    console.error('Example:');
    console.error('  npx ts-node test-provider-call.ts 4551 a7c38630-b379-4c24-832a-fd33b4dc0e02');
    process.exit(1);
  }

  const patientCaseId = parseInt(patientCaseIdStr);

  console.log(`\n🔍 Testing provider call`);
  console.log(`   Patient Case ID: ${patientCaseId}`);
  console.log(`   Provider ID: ${providerId}\n`);

  try {
    // 1. Get provider from database
    console.log('📋 Fetching provider details...');
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('*')
      .eq('id', providerId)
      .single();

    if (providerError || !provider) {
      throw new Error(`Provider not found: ${providerError?.message}`);
    }

    console.log(`✅ Found provider: ${provider.full_name || provider.name}`);
    console.log(`   Organization: ${provider.organization || 'N/A'}`);
    console.log(`   Phone: ${provider.phone_number || 'NONE'}`);

    if (!provider.phone_number) {
      console.error('\n❌ Provider has no phone number!');
      process.exit(1);
    }

    // 2. Get patient info
    console.log('\n📋 Fetching patient details...');
    const { data: patientCase, error: caseError } = await supabase
      .from('patient_cases')
      .select('*')
      .eq('id', patientCaseId)
      .single();

    if (caseError || !patientCase) {
      throw new Error(`Patient case not found: ${caseError?.message}`);
    }

    console.log(`✅ Found patient: ${patientCase.first_name} ${patientCase.last_name}`);

    // 3. Normalize phone number
    const normalizedPhone = normalizePhoneNumber(provider.phone_number);
    console.log(`\n📞 Normalized phone: ${provider.phone_number} → ${normalizedPhone}`);

    // 4. Get agent ID
    const agentId = process.env.ELEVENLABS_PROVIDER_AGENT_ID || process.env.ELEVENLABS_AGENT_ID;
    if (!agentId) {
      throw new Error('ELEVENLABS_PROVIDER_AGENT_ID or ELEVENLABS_AGENT_ID not configured');
    }
    console.log(`🤖 Using agent ID: ${agentId}`);

    // 5. Build dynamic variables
    console.log('\n🔧 Building dynamic variables...');
    const dynamicVariables = await buildProviderCallDynamicVariables(
      patientCaseId,
      providerId,
      'test-provider-call-script'
    );
    console.log(`✅ Built ${Object.keys(dynamicVariables).length} variables`);
    console.log(`   Patient: ${dynamicVariables.patient_full_name}`);
    console.log(`   Provider: ${dynamicVariables.provider_name}`);
    console.log(`   Organization: ${dynamicVariables.provider_organization}`);

    // 6. Place the call
    console.log('\n☎️  Placing call to provider...');
    const callResult = await elevenlabs.makeCall({
      toNumber: normalizedPhone,
      agentId,
      dynamicVariables,
    });

    if (!callResult.success) {
      console.error(`\n❌ Call failed: ${callResult.error}`);
      process.exit(1);
    }

    console.log(`\n✅ Call initiated successfully!`);
    console.log(`   Conversation ID: ${callResult.conversationId}`);
    console.log(`   Call SID: ${callResult.callSid || 'N/A'}`);
    console.log(`\n🎉 Test complete! The provider's office should be receiving the call now.`);

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

testProviderCall();
