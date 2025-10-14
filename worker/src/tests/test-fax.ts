import { humbleFaxService } from '../services/humblefax';

async function testSendFax() {
  console.log('\n========================================');
  console.log('Testing HumbleFax Service - Send Fax');
  console.log('========================================\n');

  // Create a simple test document (minimal PDF-like content)
  // This is a very basic text file - in production you'd use a real PDF
  const testDocument = Buffer.from(`
Medical Records Request Test

This is a test fax sent from the HumbleFax integration.

Date: ${new Date().toLocaleString()}

If you receive this, the fax integration is working correctly!

--
Havencrest Health
Test Fax System
  `.trim());

  console.log('Sending test fax to (917) 267 - 5192...');

  const result = await humbleFaxService.sendFax({
    recipients: ['(917) 267 - 5192'], // Test with formatted number
    files: [{
      filename: 'test-fax.txt',
      data: testDocument
    }],
    includeCoversheet: true,
    subject: 'Test Fax from Havencrest Health',
    message: 'This is a test fax to verify the HumbleFax integration is working correctly.',
    toName: 'Test Recipient',
    fromName: 'Havencrest Health Test System'
  });

  if (result.success) {
    console.log('✅ Fax sent successfully!');
    console.log(`   Fax ID: ${result.faxId}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Pages: ${result.pages || 'Processing'}`);

    // Wait a bit and check status
    console.log('\nWaiting 10 seconds before checking status...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    if (result.faxId) {
      console.log('\nChecking fax status...');
      const status = await humbleFaxService.getFaxStatus(result.faxId);

      if (status.success) {
        console.log('✅ Status check successful');
        console.log(`   Fax ID: ${status.faxId}`);
        console.log(`   Status: ${status.status}`);
        console.log(`   Successes: ${status.numSuccesses || 0}`);
        console.log(`   Failures: ${status.numFailures || 0}`);
        console.log(`   In Progress: ${status.numInProgress || 0}`);
      } else {
        console.error('❌ Status check failed');
        console.error(`   Error: ${status.error}`);
      }
    }

    return true;
  } else {
    console.error('❌ Fax send failed');
    console.error(`   Error: ${result.error}`);
    return false;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  HumbleFax Service Test Suite         ║');
  console.log('╚════════════════════════════════════════╝');

  try {
    const faxSuccess = await testSendFax();

    // Summary
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================');
    console.log(`Send Fax: ${faxSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('========================================\n');

    process.exit(faxSuccess ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ Test suite failed with error:');
    console.error(error);
    process.exit(1);
  }
}

main();
