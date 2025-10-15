import { config } from 'dotenv';

// Load environment variables
config();

export interface EmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: string[];
  metadata?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    data: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

class MailgunService {
  private apiKey: string;
  private domain: string;
  private fromEmail: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.MAILGUN_API_KEY || '';
    this.domain = process.env.MAILGUN_DOMAIN || '';
    this.fromEmail = process.env.MAILGUN_FROM_EMAIL || 'noreply@example.com';
    this.baseUrl = `https://api.mailgun.net/v3/${this.domain}`;

    if (!this.apiKey || !this.domain) {
      console.warn('⚠️ Mailgun not configured - set MAILGUN_API_KEY and MAILGUN_DOMAIN');
    } else {
      console.log(`✅ Mailgun service initialized with domain: ${this.domain}`);
    }
  }

  /**
   * Send an email via Mailgun
   */
  async sendEmail(request: EmailRequest): Promise<EmailResponse> {
    try {
      if (!this.apiKey || !this.domain) {
        throw new Error('Mailgun not configured');
      }

      // Prepare form data for Mailgun API
      const formData = new FormData();
      formData.append('from', request.from || this.fromEmail);
      formData.append('subject', request.subject);

      // Handle recipients
      if (Array.isArray(request.to)) {
        request.to.forEach(email => formData.append('to', email));
      } else {
        formData.append('to', request.to);
      }

      // Optional fields
      if (request.html) formData.append('html', request.html);
      if (request.text) formData.append('text', request.text);
      if (request.replyTo) formData.append('h:Reply-To', request.replyTo);

      // CC/BCC
      if (request.cc) {
        if (Array.isArray(request.cc)) {
          request.cc.forEach(email => formData.append('cc', email));
        } else {
          formData.append('cc', request.cc);
        }
      }
      if (request.bcc) {
        if (Array.isArray(request.bcc)) {
          request.bcc.forEach(email => formData.append('bcc', email));
        } else {
          formData.append('bcc', request.bcc);
        }
      }

      // Tags
      if (request.tags) {
        request.tags.forEach(tag => formData.append('o:tag', tag));
      }

      // Custom variables (metadata)
      if (request.metadata) {
        Object.entries(request.metadata).forEach(([key, value]) => {
          formData.append(`v:${key}`, JSON.stringify(value));
        });
      }

      // Attachments
      if (request.attachments) {
        request.attachments.forEach((attachment, index) => {
          // Convert Buffer to Uint8Array for Blob constructor
          const data = typeof attachment.data === 'string'
            ? attachment.data
            : new Uint8Array(attachment.data);
          const blob = new Blob([data], { type: attachment.contentType || 'application/octet-stream' });
          formData.append('attachment', blob, attachment.filename);
        });
      }

      // Send via Mailgun API
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`,
        },
        body: formData,
      });

      if (response.ok) {
        const result = await response.json() as any;
        console.log(`✅ [MAILGUN] Email sent successfully! Message ID: ${result.id}`);
        return {
          success: true,
          messageId: result.id,
        };
      } else {
        const error = await response.json() as any;
        console.error('❌ [MAILGUN] Failed to send email:', error);
        return {
          success: false,
          error: error.message || 'Failed to send email',
        };
      }
    } catch (error: any) {
      console.error('❌ [MAILGUN] Error sending email:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Export singleton instance
export const mailgunService = new MailgunService();
