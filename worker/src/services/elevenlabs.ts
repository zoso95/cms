export interface ElevenLabsCallParams {
  toNumber: string;
  agentId: string;
  dynamicVariables?: Record<string, any>;
}

export interface ElevenLabsCallResult {
  success: boolean;
  conversationId?: string;
  callSid?: string;
  error?: string;
}

export interface ConversationStatus {
  conversationId: string;
  status: 'pending' | 'completed' | 'failed';
  talkedToHuman?: boolean;
  failureReason?: string;
  transcript?: any;
  analysis?: any;
}

export class ElevenLabsClient {
  private apiKey: string;
  private phoneNumberId: string;

  constructor(apiKey?: string, phoneNumberId?: string) {
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY!;
    this.phoneNumberId = phoneNumberId || process.env.ELEVENLABS_PHONE_NUMBER_ID!;

    if (!this.apiKey) {
      throw new Error('ELEVENLABS_API_KEY is required');
    }
    if (!this.phoneNumberId) {
      throw new Error('ELEVENLABS_PHONE_NUMBER_ID is required');
    }
  }

  async makeCall(params: ElevenLabsCallParams): Promise<ElevenLabsCallResult> {
    try {
      const requestBody: any = {
        agent_id: params.agentId,
        agent_phone_number_id: this.phoneNumberId,
        to_number: params.toNumber,
      };

      if (params.dynamicVariables && Object.keys(params.dynamicVariables).length > 0) {
        requestBody.conversation_initiation_client_data = {
          dynamic_variables: params.dynamicVariables,
        };
      }

      const response = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = (await response.json()) as any;

      if (response.ok && result.success) {
        return {
          success: true,
          conversationId: result.conversation_id,
          callSid: result.callSid,
        };
      } else {
        return {
          success: false,
          error: result.detail || result.message || 'Unknown error',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getConversationStatus(conversationId: string): Promise<ConversationStatus> {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const data = (await response.json()) as any;

      // Determine status based on response
      let status: 'pending' | 'completed' | 'failed' = 'pending';
      let talkedToHuman: boolean | undefined;
      let failureReason: string | undefined;

      if (data.status === 'done' || data.transcript) {
        status = 'completed';
        // Check if human was reached from evaluation criteria
        // ElevenLabs returns: { talked_to_a_human: { result: "success" | "failure", ... } }
        const evaluationResults = data.analysis?.evaluation_criteria_results || {};
        const humanContactResult = evaluationResults.talked_to_a_human?.result;
        talkedToHuman = humanContactResult === 'success';
      } else if (data.status === 'failed') {
        status = 'failed';
        failureReason = data.error || 'Unknown error';
      }

      return {
        conversationId,
        status,
        talkedToHuman,
        failureReason,
        transcript: data.transcript,
        analysis: data.analysis,
      };
    } catch (error: any) {
      // If we can't reach the API, return pending status
      return {
        conversationId,
        status: 'pending',
      };
    }
  }
}

// Lazy-loading singleton
let elevenLabsInstance: ElevenLabsClient | null = null;

export const elevenlabs = new Proxy({} as ElevenLabsClient, {
  get(target, prop) {
    if (!elevenLabsInstance) {
      elevenLabsInstance = new ElevenLabsClient(
        process.env.ELEVENLABS_API_KEY,
        process.env.ELEVENLABS_PHONE_NUMBER_ID
      );
    }
    return (elevenLabsInstance as any)[prop];
  },
});
