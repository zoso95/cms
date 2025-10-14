import { mailgunService } from '../services/mailgun';
import { openSignService } from '../services/opensign';

async function testMailgun() {
  console.log('\n========================================');
  console.log('Testing Mailgun Service');
  console.log('========================================\n');

  const result = await mailgunService.sendEmail({
    to: 'geoffrey@afterimagelabs.com',
    subject: 'Test Email from Afterimage',
    text: 'This is a test email to verify Mailgun integration.',
    html: '<p>This is a <strong>test email</strong> to verify Mailgun integration.</p>',
    tags: ['test', 'esign-test']
  });

  if (result.success) {
    console.log('✅ Mailgun test PASSED');
    console.log(`   Message ID: ${result.messageId}`);
  } else {
    console.error('❌ Mailgun test FAILED');
    console.error(`   Error: ${result.error}`);
  }

  return result.success;
}

async function testOpenSign() {
  console.log('\n========================================');
  console.log('Testing OpenSign Service');
  console.log('========================================\n');

  // Test 1: Get templates
  console.log('Test 1: Fetching OpenSign templates...');
  const templates = await openSignService.getTemplates();

  if (templates.length > 0) {
    console.log(`✅ Found ${templates.length} template(s)`);
    templates.forEach((template, index) => {
      console.log(`   ${index + 1}. ${template.Name} (ID: ${template.objectId})`);
    });
  } else {
    console.log('⚠️  No templates found. Please create a template in OpenSign first.');
    return false;
  }

  // Test 2: Create a signature request
  console.log('\nTest 2: Creating signature request...');
  const signatureResult = await openSignService.createSignatureRequest({
    signerEmail: 'geoffrey@afterimagelabs.com',
    signerName: 'Test User',
    documentTitle: 'Test Medical Records Release',
    templateId: templates[0].objectId // Use first template
  });

  if (signatureResult.success) {
    console.log('✅ Signature request created successfully');
    console.log(`   Request ID: ${signatureResult.requestId}`);
    console.log(`   Signing URL: ${signatureResult.signingUrl}`);

    // Test 3: Check signature status
    console.log('\nTest 3: Checking signature status...');
    if (signatureResult.requestId) {
      const status = await openSignService.getSignatureStatus(signatureResult.requestId);
      if (status) {
        console.log('✅ Status check successful');
        console.log(`   Status: ${status.status}`);
        console.log(`   Request ID: ${status.requestId}`);
      } else {
        console.error('❌ Failed to get signature status');
        return false;
      }
    }

    return true;
  } else {
    console.error('❌ Failed to create signature request');
    console.error(`   Error: ${signatureResult.error}`);
    return false;
  }
}

async function testSignedDocument() {
  console.log('\n========================================');
  console.log('Testing Signed Document Status');
  console.log('========================================\n');

  const documentId = 'AluKkTUmpm';

  console.log(`Checking status of document: ${documentId}`);
  const status = await openSignService.getSignatureStatus(documentId);

  if (status) {
    console.log('✅ Status check successful');
    console.log(`   Document ID: ${status.requestId}`);
    console.log(`   Status: ${status.status}`);
    if (status.signedAt) {
      console.log(`   Signed At: ${new Date(status.signedAt).toLocaleString()}`);
    }
    if (status.signedDocumentUrl) {
      console.log(`   Signed Document URL: ${status.signedDocumentUrl}`);
    }
    return true;
  } else {
    console.error('❌ Failed to get document status');
    return false;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║  E-Signature Services Test Suite      ║');
  console.log('╚════════════════════════════════════════╝');

  try {
    // Test Mailgun
    //const mailgunSuccess = await testMailgun();

    // Test specific signed document
    const signedDocSuccess = await testSignedDocument();

    // Test OpenSign full flow
    //const openSignSuccess = await testOpenSign();

    // Summary
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================');
    //console.log(`Mailgun:         ${mailgunSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Signed Document: ${signedDocSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    //console.log(`OpenSign:        ${openSignSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('========================================\n');

    //process.exit(mailgunSuccess && signedDocSuccess && openSignSuccess ? 0 : 1);
    process.exit(signedDocSuccess ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ Test suite failed with error:');
    console.error(error);
    process.exit(1);
  }
}

main();
