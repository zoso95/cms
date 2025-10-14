import { config } from 'dotenv';
import { elevenlabs } from './services/elevenlabs';

// Load environment variables
config();

async function testConversationStatus() {
  const conversationIds = [
    {
      id: 'conv_8601k7fe631kekba0fty11nev2hd',
      expected: 'no answer',
    },
    {
      id: 'conv_5101k7fgxyzke38s2vpw7fe9csws',
      expected: 'failed - didn\'t talk to human',
    },
    {
      id: 'conv_0201k7fe7xjwep5rs3x4ra44nf3s',
      expected: 'successful',
    },
  ];

  console.log('🧪 Testing ElevenLabs getConversationStatus...\n');

  for (const conv of conversationIds) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📞 Testing: ${conv.id}`);
    console.log(`   Expected: ${conv.expected}`);
    console.log(`${'='.repeat(80)}\n`);

    try {
      const status = await elevenlabs.getConversationStatus(conv.id);

      console.log('✅ Result:');
      console.log(`   Status: ${status.status}`);
      console.log(`   Talked to Human: ${status.talkedToHuman}`);
      console.log(`   Failure Reason: ${status.failureReason || 'N/A'}`);

      if (status.transcript) {
        console.log(`   Has Transcript: Yes (${status.transcript.length} exchanges)`);
      } else {
        console.log(`   Has Transcript: No`);
      }

      if (status.analysis) {
        console.log('\n📊 Analysis:');
        console.log(`   Call Successful: ${status.analysis.call_successful}`);
        console.log(`   Summary: ${status.analysis.transcript_summary || 'N/A'}`);

        if (status.analysis.evaluation_criteria_results) {
          console.log('\n🎯 Evaluation Criteria:');
          console.log(JSON.stringify(status.analysis.evaluation_criteria_results, null, 2));
        }
      }

    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('🏁 Testing complete!');
  console.log(`${'='.repeat(80)}\n`);
}

testConversationStatus().catch(console.error);
