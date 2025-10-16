import { config } from 'dotenv';
import { mailgunService } from './mailgun';

// Load environment variables
config();

export interface SignatureRequest {
  signerEmail: string;
  signerName: string;
  documentTitle: string;
  templateId?: string; // OpenSign template ID
  providerName?: string; // Provider name for context in email
  providerOrganization?: string; // Provider organization/practice name
  metadata?: Record<string, any>;
}

export interface SignatureResponse {
  success: boolean;
  requestId?: string; // Document ID for tracking
  signingUrl?: string;
  error?: string;
}

export interface SignatureStatus {
  requestId: string;
  status: 'pending' | 'signed' | 'declined' | 'expired';
  signedAt?: string;
  signedDocumentUrl?: string;
}

class OpenSignService {
  private baseUrl: string;
  private appId: string;
  private username: string;
  private password: string;
  private session?: {
    sessionToken: string;
    userInfo: any;
    extUserId: string;
    tenantId?: string;
  };

  constructor() {
    this.baseUrl = process.env.OPENSIGN_BASE_URL || 'http://localhost:8080';
    this.appId = process.env.OPENSIGN_APP_ID || 'opensign';
    this.username = process.env.OPENSIGN_USERNAME || '';
    this.password = process.env.OPENSIGN_PASSWORD || '';

    // For production OpenSign, the app ID might be different
    if (this.baseUrl.includes('opensignlabs.com') && !process.env.OPENSIGN_APP_ID) {
      this.appId = 'opensign';
    }

    if (!this.username || !this.password) {
      console.warn('⚠️ OpenSign not configured - set OPENSIGN_USERNAME and OPENSIGN_PASSWORD');
    } else {
      console.log('✅ OpenSign service initialized');
    }
  }

  /**
   * Get the correct Parse Server API path for OpenSign
   */
  private getApiPath(): string {
    // Production OpenSign uses /api/app while local uses /app
    const isProduction = this.baseUrl.includes('opensignlabs.com');
    return isProduction ? '/api/app' : '/app';
  }

  /**
   * Login to OpenSign and get session token
   */
  private async login(): Promise<boolean> {
    const apiPath = this.getApiPath();
    const loginUrl = `${this.baseUrl}${apiPath}/login`;

    console.log(`📝 [OPENSIGN] Logging in as ${this.username}...`);

    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'X-Parse-Application-Id': this.appId,
          'Content-Type': 'application/json',
          'X-Parse-Revocable-Session': '1'
        },
        body: JSON.stringify({
          username: this.username,
          password: this.password
        })
      });

      // Check content type to ensure we're getting JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error(`❌ [OPENSIGN] Got non-JSON response from ${loginUrl}`);
        console.error(`   Status: ${response.status}`);
        console.error(`   Response preview: ${text.substring(0, 200)}`);
        return false;
      }

      if (response.ok) {
        const result = await response.json() as any;
        this.session = {
          sessionToken: result.sessionToken,
          userInfo: result,
          extUserId: ''
        };
        console.log(`✅ [OPENSIGN] Login successful!`);

        // Get additional user details
        await this.getUserDetails();
        await this.getTenantInfo();

        return true;
      } else {
        const error = await response.json();
        console.error(`❌ [OPENSIGN] Login failed:`, error);
        return false;
      }
    } catch (error: any) {
      console.error(`❌ [OPENSIGN] Login error:`, error.message);
      return false;
    }
  }

  /**
   * Get OpenSign user details
   */
  private async getUserDetails(): Promise<void> {
    if (!this.session) return;

    try {
      const apiPath = this.getApiPath();
      const response = await fetch(`${this.baseUrl}${apiPath}/functions/getUserDetails`, {
        method: 'POST',
        headers: {
          'X-Parse-Application-Id': this.appId,
          'X-Parse-Session-Token': this.session.sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: this.session.userInfo.username
        })
      });

      if (response.ok) {
        const result = await response.json() as any;
        if (result.result && !result.result.error) {
          this.session.extUserId = result.result.objectId;
          console.log(`✅ [OPENSIGN] Extended user ID: ${this.session.extUserId}`);
        }
      }
    } catch (error: any) {
      console.error('❌ [OPENSIGN] Error getting user details:', error.message);
    }
  }

  /**
   * Get OpenSign tenant info
   */
  private async getTenantInfo(): Promise<void> {
    if (!this.session) return;

    try {
      const apiPath = this.getApiPath();
      const response = await fetch(`${this.baseUrl}${apiPath}/functions/gettenant`, {
        method: 'POST',
        headers: {
          'X-Parse-Application-Id': this.appId,
          'X-Parse-Session-Token': this.session.sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: this.session.userInfo.objectId
        })
      });

      if (response.ok) {
        const result = await response.json() as any;
        if (result.result && !result.result.error) {
          this.session.tenantId = result.result.objectId;
          console.log(`✅ [OPENSIGN] Tenant ID: ${this.session.tenantId}`);
        }
      }
    } catch (error: any) {
      console.error('❌ [OPENSIGN] Error getting tenant info:', error.message);
    }
  }

  /**
   * Get OpenSign templates
   */
  async getTemplates(): Promise<any[]> {
    if (!this.session) {
      await this.login();
    }
    if (!this.session) return [];

    try {
      const apiPath = this.getApiPath();
      const response = await fetch(`${this.baseUrl}${apiPath}/functions/getReport`, {
        method: 'POST',
        headers: {
          'X-Parse-Application-Id': this.appId,
          'sessiontoken': this.session.sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportId: '6TeaPr321t', // Manage templates report ID
          skip: 0,
          limit: 10
        })
      });

      if (response.ok) {
        const result = await response.json() as any;
        const templates = result.result?.data || result.result || [];
        console.log(`✅ [OPENSIGN] Found ${templates.length} templates`);
        return templates;
      } else {
        console.error('❌ [OPENSIGN] Failed to get templates:', await response.json());
        return [];
      }
    } catch (error: any) {
      console.error('❌ [OPENSIGN] Error getting templates:', error.message);
      return [];
    }
  }

  /**
   * Get OpenSign template details
   */
  private async getTemplate(templateId: string): Promise<any> {
    if (!this.session) return null;

    try {
      const apiPath = this.getApiPath();
      const response = await fetch(`${this.baseUrl}${apiPath}/functions/getTemplate`, {
        method: 'POST',
        headers: {
          'X-Parse-Application-Id': this.appId,
          'sessiontoken': this.session.sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: templateId
        })
      });

      if (response.ok) {
        const result = await response.json() as any;
        if (result.result && !result.result.error) {
          console.log(`✅ [OPENSIGN] Template: ${result.result.Name}`);
          return result.result;
        }
      }

      console.error('❌ [OPENSIGN] Failed to get template details');
      return null;
    } catch (error: any) {
      console.error('❌ [OPENSIGN] Error getting template details:', error.message);
      return null;
    }
  }

  /**
   * Find or create OpenSign contact
   */
  private async findOrCreateContact(signerEmail: string, signerName: string): Promise<any> {
    if (!this.session) return null;

    console.log(`🔍 [OPENSIGN] Looking for contact: ${signerEmail}`);

    try {
      // Search for existing contact
      const apiPath = this.getApiPath();
      const searchResponse = await fetch(
        `${this.baseUrl}${apiPath}/classes/contracts_Contactbook?where=${encodeURIComponent(JSON.stringify({ Email: signerEmail }))}`,
        {
          headers: {
            'X-Parse-Application-Id': this.appId,
            'X-Parse-Session-Token': this.session.sessionToken,
            'Content-Type': 'application/json'
          }
        }
      );

      if (searchResponse.ok) {
        const searchResult = await searchResponse.json() as any;
        if (searchResult.results && searchResult.results.length > 0) {
          const contact = searchResult.results[0];
          console.log(`✅ [OPENSIGN] Found existing contact: ${contact.Name} (ID: ${contact.objectId})`);
          return contact;
        }
      }

      // Create new contact
      console.log(`➕ [OPENSIGN] Creating new contact: ${signerEmail}`);

      const contactData: any = {
        Name: signerName,
        Email: signerEmail,
        Phone: '+1-555-0123',
        Company: 'Patient',
        JobTitle: 'Patient',
        UserId: {
          __type: 'Pointer',
          className: '_User',
          objectId: this.session.userInfo.objectId
        },
        CreatedBy: {
          __type: 'Pointer',
          className: '_User',
          objectId: this.session.userInfo.objectId
        }
      };

      if (this.session.tenantId) {
        contactData.TenantId = {
          __type: 'Pointer',
          className: 'partners_Tenant',
          objectId: this.session.tenantId
        };
      }

      const createResponse = await fetch(`${this.baseUrl}${this.getApiPath()}/classes/contracts_Contactbook`, {
        method: 'POST',
        headers: {
          'X-Parse-Application-Id': this.appId,
          'X-Parse-Session-Token': this.session.sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(contactData)
      });

      if (createResponse.ok) {
        const createResult = await createResponse.json() as any;
        console.log(`✅ [OPENSIGN] Contact created! ID: ${createResult.objectId}`);

        // Parse Server only returns objectId and createdAt, not the full object
        // So we need to return the full contact object with all fields
        return {
          objectId: createResult.objectId,
          Name: signerName,
          Email: signerEmail,
          Phone: '+1-555-0123',
          Company: 'Patient',
          JobTitle: 'Patient',
        };
      } else {
        console.error('❌ [OPENSIGN] Failed to create contact:', await createResponse.json());
        return null;
      }
    } catch (error: any) {
      console.error('❌ [OPENSIGN] Error managing contact:', error.message);
      return null;
    }
  }

  /**
   * Create OpenSign document and send for signing
   */
  async createSignatureRequest(request: SignatureRequest): Promise<SignatureResponse> {
    console.log(`📝 [OPENSIGN] Creating document: ${request.documentTitle}`);

    // Login if needed
    if (!this.session) {
      const loginSuccess = await this.login();
      if (!loginSuccess) {
        return {
          success: false,
          error: 'Failed to authenticate with OpenSign'
        };
      }
    }

    try {
      // Get template
      let template: any;
      if (request.templateId) {
        template = await this.getTemplate(request.templateId);
      } else {
        const templates = await this.getTemplates();
        if (templates.length === 0) {
          return {
            success: false,
            error: 'No templates available'
          };
        }
        template = await this.getTemplate(templates[0].objectId);
      }

      if (!template) {
        return {
          success: false,
          error: 'Template not found or invalid'
        };
      }

      // Create or find contact
      const contact = await this.findOrCreateContact(request.signerEmail, request.signerName);
      if (!contact) {
        return {
          success: false,
          error: 'Failed to create contact for signer'
        };
      }

      // Prepare placeholders with signer info
      const placeholders = template.Placeholders || [];
      const updatedPlaceholders = placeholders
        .filter((p: any) => p.Role !== 'prefill')
        .map((placeholder: any) => ({
          ...placeholder,
          signerPtr: {
            __type: 'Pointer',
            className: 'contracts_Contactbook',
            objectId: contact.objectId
          },
          signerObjId: contact.objectId,
          email: request.signerEmail
        }));

      // Create document
      const documentData = {
        Name: request.documentTitle || template.Name,
        URL: template.URL,
        SignedUrl: template.URL,
        Note: template.Note || '',
        Description: template.Description || '',
        Placeholders: updatedPlaceholders,
        ExtUserPtr: {
          __type: 'Pointer',
          className: 'contracts_Users',
          objectId: this.session!.extUserId
        },
        CreatedBy: {
          __type: 'Pointer',
          className: '_User',
          objectId: this.session!.userInfo.objectId
        },
        Signers: [{
          __type: 'Pointer',
          className: 'contracts_Contactbook',
          objectId: contact.objectId
        }],
        SendinOrder: template.SendinOrder || false,
        AutomaticReminders: template.AutomaticReminders || false,
        RemindOnceInEvery: template.RemindOnceInEvery || 5,
        TimeToCompleteDays: template.TimeToCompleteDays || 15,
        IsEnableOTP: template.IsEnableOTP || false,
        IsTourEnabled: template.IsTourEnabled || false,
        AllowModifications: template.AllowModifications || false,
        SentToOthers: true,
        TemplateId: {
          __type: 'Pointer',
          className: 'contracts_Template',
          objectId: template.objectId
        }
      };

      console.log(`📄 [OPENSIGN] Creating document from template: ${template.Name}`);

      const response = await fetch(`${this.baseUrl}${this.getApiPath()}/classes/contracts_Document`, {
        method: 'POST',
        headers: {
          'X-Parse-Application-Id': this.appId,
          'X-Parse-Session-Token': this.session!.sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(documentData)
      });

      if (response.ok) {
        const docResult = await response.json() as any;
        const docId = docResult.objectId;
        console.log(`✅ [OPENSIGN] Document created! ID: ${docId}`);

        // Send signing email
        await this.sendSigningEmail(docId, template, contact, request.signerEmail, request.providerName, request.providerOrganization);

        // Generate signing URL
        const signingUrl = this.generateSigningUrl(docId, request.signerEmail, contact.objectId);

        return {
          success: true,
          requestId: docId,
          signingUrl: signingUrl
        };
      } else {
        const error = await response.json() as any;
        console.error('❌ [OPENSIGN] Document creation failed:', error);
        return {
          success: false,
          error: `Document creation failed: ${error.error || error.message || 'Unknown error'}`
        };
      }
    } catch (error: any) {
      console.error('❌ [OPENSIGN] Error creating document:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate OpenSign signing URL
   */
  private generateSigningUrl(docId: string, signerEmail: string, signerObjectId: string): string {
    const signingString = `${docId}/${signerEmail}/${signerObjectId}`;
    const encodedData = Buffer.from(signingString).toString('base64');

    // For production OpenSign, use the same base URL
    if (this.baseUrl.includes('opensignlabs.com')) {
      return `${this.baseUrl}/login/${encodedData}`;
    }

    // For local development, use port 3001
    return `${this.baseUrl.replace(':8080', ':3001')}/login/${encodedData}`;
  }

  /**
   * Send OpenSign signing email via Mailgun
   */
  private async sendSigningEmail(docId: string, template: any, contact: any, signerEmail: string, providerName?: string, providerOrganization?: string): Promise<boolean> {
    if (!this.session) return false;

    console.log(`📧 [MAILGUN] Sending signing email for document ${docId}...`);

    try {
      const signingUrl = this.generateSigningUrl(docId, signerEmail, contact.objectId);

      // Build the provider context message
      let providerContext = '';
      if (providerName || providerOrganization) {
        const providerDisplay = providerOrganization
          ? `<strong>${providerName}</strong> at <strong>${providerOrganization}</strong>`
          : `<strong>${providerName}</strong>`;
        providerContext = `<p>We need your authorization to request medical records from ${providerDisplay}.</p>`;
      }

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">Medical Records Authorization Request</h2>

          <p>Hi ${contact.Name},</p>

          <p>We're glad you chose Check My Charts. We want to help you get your medical records so we can evaluate your case better.</p>

          ${providerContext}

          <p>${this.session.userInfo.username} has requested you to review and sign <strong>"${template.Name}"</strong>.</p>

          <p>Your signature is crucial to proceed with the next steps as it signifies your agreement and authorization to release your medical records.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href='${signingUrl}'
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;"
               rel='noopener noreferrer' target='_blank'>
              📝 Sign Document
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            If the button above doesn't work, you can copy and paste this link into your browser:<br>
            <a href='${signingUrl}' style="color: #007bff;">${signingUrl}</a>
          </p>

          <p>If you have any questions or need further clarification regarding the document or the signing process, please reply to this email.</p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">

          <p style="color: #666; font-size: 12px;">
            Document ID: ${docId}<br>
            This is an automated message from the Afterimage system.
          </p>
        </div>
      `;

      // Create plain text version
      let providerTextContext = '';
      if (providerName || providerOrganization) {
        const providerDisplay = providerOrganization
          ? `${providerName} at ${providerOrganization}`
          : providerName;
        providerTextContext = `We need your authorization to request medical records from ${providerDisplay}.\n\n`;
      }

      const textBody = `
Medical Records Authorization Request

Hi ${contact.Name},

We're glad you chose Check My Charts. We want to help you get your medical records so we can evaluate your case better.

${providerTextContext}${this.session.userInfo.username} has requested you to review and sign "${template.Name}".

Your signature is crucial to proceed with the next steps as it signifies your agreement and authorization to release your medical records.

Please click here to sign: ${signingUrl}

If you have any questions, please reply to this email.

Document ID: ${docId}
      `.trim();

      // Send via Mailgun
      const result = await mailgunService.sendEmail({
        to: signerEmail,
        subject: `Please sign: ${template.Name}`,
        html: htmlBody,
        text: textBody,
        replyTo: process.env.MAILGUN_FROM_EMAIL,
        tags: ['opensign', 'signature-request'],
        metadata: {
          documentId: docId,
          templateName: template.Name,
          signerName: contact.Name,
          source: 'opensign'
        }
      });

      if (result.success) {
        console.log(`✅ [MAILGUN] Signing email sent successfully! Message ID: ${result.messageId}`);
        return true;
      } else {
        console.error('❌ [MAILGUN] Failed to send signing email:', result.error);
        return false;
      }

    } catch (error: any) {
      console.error('❌ [MAILGUN] Error sending signing email:', error.message);
      return false;
    }
  }

  /**
   * Get signature status by polling OpenSign
   */
  async getSignatureStatus(documentId: string): Promise<SignatureStatus | null> {
    if (!this.session) {
      await this.login();
    }
    if (!this.session) return null;

    try {
      // Use the polling-based completion check which uses report IDs
      return await this.checkDocumentCompletion(documentId);
    } catch (error: any) {
      console.error('❌ [OPENSIGN] Error getting signature status:', error.message);
      return null;
    }
  }

  /**
   * Check if a specific document is in the completed documents list
   */
  private async checkDocumentCompletion(documentId: string): Promise<SignatureStatus | null> {
    try {
      const completedDocs = await this.getCompletedDocuments();

      const completedDoc = completedDocs.find(doc => doc.objectId === documentId);

      if (completedDoc) {
        console.log(`✅ [OPENSIGN] Document ${documentId} is COMPLETED!`);
        return {
          requestId: documentId,
          status: 'signed',
          signedAt: completedDoc.updatedAt,
          signedDocumentUrl: completedDoc.SignedUrl || completedDoc.URL
        };
      }

      // If not in completed, check if it's declined
      const declinedDocs = await this.getDocumentsByStatus('declined');
      const declinedDoc = declinedDocs.find(doc => doc.objectId === documentId);

      if (declinedDoc) {
        console.log(`❌ [OPENSIGN] Document ${documentId} was DECLINED`);
        return {
          requestId: documentId,
          status: 'declined'
        };
      }

      // Otherwise it's still pending
      console.log(`⏳ [OPENSIGN] Document ${documentId} is still pending`);
      return {
        requestId: documentId,
        status: 'pending'
      };
    } catch (error: any) {
      console.error('❌ [OPENSIGN] Error checking document completion:', error.message);
      return null;
    }
  }

  /**
   * Get recent completed documents from OpenSign
   */
  private async getCompletedDocuments(limit: number = 50): Promise<any[]> {
    if (!this.session) {
      await this.login();
    }
    if (!this.session) return [];

    try {
      // Use the hardcoded report ID from OpenSign source for completed documents
      const COMPLETED_REPORT_ID = 'kQUoW4hUXz';

      const apiPath = this.getApiPath();
      const response = await fetch(`${this.baseUrl}${apiPath}/functions/getReport`, {
        method: 'POST',
        headers: {
          'X-Parse-Application-Id': this.appId,
          'X-Parse-Session-Token': this.session.sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportId: COMPLETED_REPORT_ID,
          limit: limit,
          skip: 0
        })
      });

      if (response.ok) {
        const result = await response.json() as any;
        const docs = result.result || [];
        return docs;
      } else {
        console.error('❌ [OPENSIGN] Failed to get completed documents:', await response.json());
        return [];
      }
    } catch (error: any) {
      console.error('❌ [OPENSIGN] Error getting completed documents:', error.message);
      return [];
    }
  }

  /**
   * Get documents by status using OpenSign report IDs
   */
  private async getDocumentsByStatus(status: 'completed' | 'in_progress' | 'draft' | 'declined'): Promise<any[]> {
    if (!this.session) {
      await this.login();
    }
    if (!this.session) return [];

    // Report IDs from OpenSign source code
    const reportIds: Record<string, string> = {
      'completed': 'kQUoW4hUXz',
      'in_progress': '1MwEuxLEkF',
      'draft': 'ByHuevtCFY',
      'declined': 'UPr2Fm5WY3'
    };

    const reportId = reportIds[status];
    if (!reportId) return [];

    try {
      const apiPath = this.getApiPath();
      const response = await fetch(`${this.baseUrl}${apiPath}/functions/getReport`, {
        method: 'POST',
        headers: {
          'X-Parse-Application-Id': this.appId,
          'X-Parse-Session-Token': this.session.sessionToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportId: reportId,
          limit: 50,
          skip: 0
        })
      });

      if (response.ok) {
        const result = await response.json() as any;
        return result.result || [];
      }
      return [];
    } catch (error: any) {
      console.error(`❌ [OPENSIGN] Error getting ${status} documents:`, error.message);
      return [];
    }
  }

  /**
   * Download signed PDF directly from OpenSign
   */
  async downloadSignedDocument(documentId: string): Promise<Buffer | null> {
    if (!this.session) {
      await this.login();
    }
    if (!this.session) return null;

    try {
      const apiPath = this.getApiPath();

      // Get the document object to find the file reference
      const docResponse = await fetch(`${this.baseUrl}${apiPath}/classes/contracts_Document/${documentId}`, {
        method: 'GET',
        headers: {
          'X-Parse-Application-Id': this.appId,
          'X-Parse-Session-Token': this.session.sessionToken,
          'Content-Type': 'application/json'
        }
      });

      if (!docResponse.ok) {
        console.error(`❌ [OPENSIGN] Failed to get document object:`, await docResponse.text());
        return null;
      }

      const doc = await docResponse.json() as any;

      // The SignedUrl field should point to the file
      if (doc.SignedUrl || doc.URL) {
        const fileUrl = doc.SignedUrl || doc.URL;
        console.log(`📄 [OPENSIGN] Downloading file from: ${fileUrl}`);

        // Download from that URL
        const fileResponse = await fetch(fileUrl);
        if (fileResponse.ok) {
          const arrayBuffer = await fileResponse.arrayBuffer();
          return Buffer.from(arrayBuffer);
        } else {
          console.error(`❌ [OPENSIGN] Failed to download file: ${fileResponse.statusText}`);
          return null;
        }
      } else {
        console.error(`❌ [OPENSIGN] No SignedUrl or URL found in document object`);
        return null;
      }
    } catch (error: any) {
      console.error('❌ [OPENSIGN] Error downloading PDF:', error.message);
      return null;
    }
  }
}

// Export singleton instance
export const openSignService = new OpenSignService();
