// OpenPhone SMS client
// Based on OpenPhone API: https://www.openphone.com/docs/api

interface SMSMessage {
  content: string;
  from: string;
  to: string[];
}

let openphoneInstance: OpenPhoneClient | null = null;

export class OpenPhoneClient {
  private apiKey: string;
  private apiUrl: string;
  private defaultFromNumber: string;

  constructor(apiKey: string, defaultFromNumber: string) {
    this.apiKey = apiKey;
    this.defaultFromNumber = defaultFromNumber;
    this.apiUrl = 'https://api.openphone.com/v1/messages';
  }

  /**
   * Send SMS via OpenPhone API
   * @returns OpenPhone message ID
   * @throws Error if SMS fails to send
   */
  async sendSMS(message: SMSMessage): Promise<string> {
    console.log(`📱 [OPENPHONE] Sending SMS to ${message.to.join(', ')}`);
    console.log(`📱 [OPENPHONE] Content: ${message.content.substring(0, 100)}...`);

    if (!this.apiKey) {
      throw new Error('OpenPhone API key not configured');
    }

    if (!message.from && !this.defaultFromNumber) {
      throw new Error('No from number specified and no default configured');
    }

    const requestPayload = {
      content: message.content,
      from: message.from || this.defaultFromNumber,
      to: message.to,
    };

    console.log(`📱 [OPENPHONE] Request payload:`, requestPayload);

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    const responseData = await response.json() as any;

    if (!response.ok) {
      console.error('❌ [OPENPHONE] API error:', response.status, responseData);
      throw new Error(
        `OpenPhone API error: ${response.status} - ${responseData.message || 'Unknown error'}`
      );
    }

    console.log(`✅ [OPENPHONE] SMS sent successfully:`, responseData);

    const messageId = responseData.data?.id || responseData.id || responseData.messageId;

    if (!messageId) {
      throw new Error('OpenPhone API did not return a message ID');
    }

    return messageId;
  }

  /**
   * Send SMS to a single recipient (convenience method)
   * @returns OpenPhone message ID
   * @throws Error if SMS fails to send
   */
  async sendSMSToNumber(phoneNumber: string, content: string, fromNumber?: string): Promise<string> {
    return this.sendSMS({
      content,
      from: fromNumber || this.defaultFromNumber || '',
      to: [phoneNumber],
    });
  }
}

// Lazy-loaded singleton using Proxy
export const openphone = new Proxy({} as OpenPhoneClient, {
  get(target, prop) {
    if (!openphoneInstance) {
      const apiKey = process.env.OPENPHONE_API_KEY;
      const fromNumber = process.env.OPENPHONE_FROM_NUMBER;

      if (!apiKey || !fromNumber) {
        throw new Error('OPENPHONE_API_KEY and OPENPHONE_FROM_NUMBER must be set in environment variables');
      }

      openphoneInstance = new OpenPhoneClient(apiKey, fromNumber);
    }
    return (openphoneInstance as any)[prop];
  },
});
