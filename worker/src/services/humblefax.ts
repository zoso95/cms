import { config } from 'dotenv';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Load environment variables
config();

export interface FaxRequest {
  recipients: string[]; // Fax numbers (will be cleaned to digits only and sent as integer array)
  files: Array<{
    filename: string;
    data: Buffer;
  }>;
  includeCoversheet?: boolean;
  subject?: string;
  message?: string;
  toName?: string;
  companyInfo?: string;
  fromName?: string;
  uuid?: string;
}

export interface FaxResponse {
  success: boolean;
  faxId?: string;
  status?: string;
  pages?: number;
  error?: string;
  data?: any;
}

export interface FaxStatus {
  success: boolean;
  faxId: string;
  status: string; // HumbleFax statuses: 'success', 'failure', 'in_progress'
  numSuccesses?: number;
  numFailures?: number;
  numInProgress?: number;
  error?: string;
  data?: any;
}

class HumbleFaxService {
  private apiUrl = 'https://api.humblefax.com';
  private accessKey: string;
  private secretKey: string;

  constructor() {
    this.accessKey = process.env.HUMBLEFAX_ACCESS_KEY || '';
    this.secretKey = process.env.HUMBLEFAX_SECRET_KEY || '';

    if (!this.accessKey || !this.secretKey) {
      console.warn('⚠️ HumbleFax not configured - set HUMBLEFAX_ACCESS_KEY and HUMBLEFAX_SECRET_KEY');
    } else {
      console.log('✅ HumbleFax service initialized');
    }
  }

  /**
   * Send a fax via HumbleFax API
   * Note: HumbleFax handles retries automatically. If this returns a failure, the fax number is likely invalid.
   */
  async sendFax(request: FaxRequest): Promise<FaxResponse> {
    console.log(`📠 [HUMBLEFAX] Sending fax to ${request.recipients.length} recipient(s)`);

    if (!this.accessKey || !this.secretKey) {
      console.error('❌ [HUMBLEFAX] API credentials not configured');
      return {
        success: false,
        error: 'HumbleFax API credentials not configured'
      };
    }

    try {
      // Clean phone numbers to digits only and add country code if missing
      const recipientNumbers = request.recipients.map(num => {
        let cleaned = num.replace(/[^\d]/g, '');
        // Add US country code (1) if number is 10 digits
        if (cleaned.length === 10) {
          cleaned = '1' + cleaned;
        }
        return parseInt(cleaned, 10);
      });
      console.log(`📠 [HUMBLEFAX] Recipients: ${recipientNumbers.join(', ')}`);
      console.log(`📄 [HUMBLEFAX] Documents: ${request.files.map(f => f.filename).join(', ')}`);

      // Prepare the jsonData for HumbleFax API
      const jsonData: any = {
        recipients: recipientNumbers,
        includeCoversheet: request.includeCoversheet !== false, // Default to true
      };

      // Add optional fields
      if (request.subject) jsonData.subject = request.subject;
      if (request.message) jsonData.message = request.message;
      if (request.toName) jsonData.toName = request.toName;
      if (request.companyInfo) jsonData.companyInfo = request.companyInfo;
      if (request.fromName) jsonData.fromName = request.fromName;
      if (request.uuid) jsonData.uuid = request.uuid;

      console.log(`📠 [HUMBLEFAX] Sending with data:`, jsonData);

      // Prepare FormData
      const formData = new FormData();
      formData.append('jsonData', JSON.stringify(jsonData));

      // Add document files
      for (const file of request.files) {
        formData.append(file.filename, file.data, {
          filename: file.filename,
          contentType: 'application/pdf'
        });
      }

      // Make the API call
      const response = await fetch(`${this.apiUrl}/quickSendFax`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.accessKey}:${this.secretKey}`).toString('base64')}`,
          ...formData.getHeaders()
        },
        body: formData
      });

      const result = await response.json() as any;

      if (response.ok && (result.data?.fax?.id || result.data?.sentFax?.id)) {
        // Handle both possible response formats
        const fax = result.data.fax || result.data.sentFax;
        const faxId = fax.id.toString();
        console.log(`✅ [HUMBLEFAX] Fax queued successfully with ID: ${faxId}`);
        console.log(`📊 [HUMBLEFAX] Status: ${fax.status}`);
        console.log(`📄 [HUMBLEFAX] Pages: ${fax.numPages || 'Processing'}`);

        return {
          success: true,
          faxId: faxId,
          status: Array.isArray(fax.status) ? fax.status[0] : fax.status,
          pages: fax.numPages,
          data: result
        };
      } else {
        console.error(`❌ [HUMBLEFAX] API error:`, result);
        return {
          success: false,
          error: result.error || result.message || 'Unknown API error'
        };
      }
    } catch (error: any) {
      console.error('❌ [HUMBLEFAX] Fax send failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get fax status from HumbleFax API
   */
  async getFaxStatus(faxId: string): Promise<FaxStatus> {
    console.log(`📠 [HUMBLEFAX] Checking status for fax: ${faxId}`);

    if (!this.accessKey || !this.secretKey) {
      return {
        success: false,
        faxId,
        status: 'failed',
        error: 'HumbleFax credentials not configured'
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/sentFax/${faxId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.accessKey}:${this.secretKey}`).toString('base64')}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [HUMBLEFAX] Status check failed: ${response.status} ${response.statusText}`);
        console.error(`❌ [HUMBLEFAX] Response: ${errorText}`);

        return {
          success: false,
          faxId,
          status: 'failed',
          error: `HumbleFax API error: ${response.status} ${response.statusText}`
        };
      }

      const apiResponse = await response.json() as any;
      console.log(`📊 [HUMBLEFAX] Status response:`, apiResponse);

      // Extract fax data from nested response
      const faxData = apiResponse.data?.sentFax;
      if (!faxData) {
        console.error(`❌ [HUMBLEFAX] Invalid response format - no sentFax data`);
        return {
          success: false,
          faxId,
          status: 'failed',
          error: 'Invalid response format from HumbleFax API'
        };
      }

      const status = faxData.status;
      const numSuccesses = faxData.numSuccesses || 0;
      const numFailures = faxData.numFailures || 0;
      const numInProgress = faxData.numInProgress || 0;

      console.log(`📊 [HUMBLEFAX] Fax ${faxId}: status="${status}", successes=${numSuccesses}, failures=${numFailures}, inProgress=${numInProgress}`);

      // Map HumbleFax status to standard values
      let mappedStatus = status;
      if (status === 'success' && numSuccesses > 0) {
        mappedStatus = 'successful';
      } else if (status === 'failure' || (numFailures > 0 && numSuccesses === 0 && numInProgress === 0)) {
        mappedStatus = 'failed';
      } else if (numInProgress > 0) {
        mappedStatus = 'in_progress';
      }

      return {
        success: true,
        faxId,
        status: mappedStatus,
        numSuccesses,
        numFailures,
        numInProgress,
        data: {
          fax: faxData,
          originalStatus: status
        }
      };
    } catch (error: any) {
      console.error(`❌ [HUMBLEFAX] Status check error:`, error);
      return {
        success: false,
        faxId,
        status: 'failed',
        error: `Failed to check fax status: ${error.message}`
      };
    }
  }
}

// Export singleton instance
export const humbleFaxService = new HumbleFaxService();
