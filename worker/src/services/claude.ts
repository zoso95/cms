import Anthropic from '@anthropic-ai/sdk';
import { getAnalyzeCaseMeritsPrompt } from '../prompts/analyzeCaseMerits';
import { getExtractProvidersPrompt } from '../prompts/extractProviders';
import { config } from 'dotenv';

// Load environment variables (ensure they're loaded before initializing client)
config();

// Initialize Claude client
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  content: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Send a message to Claude and get a response
 */
export async function sendMessage(
  messages: ClaudeMessage[],
  options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    system?: string;
  } = {}
): Promise<ClaudeResponse> {
  const {
    model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    maxTokens = 4096,
    temperature = 1.0,
    system,
  } = options;

  console.log(`[Claude] Sending message to ${model}`);
  console.log(`[Claude] Messages: ${messages.length}, Max tokens: ${maxTokens}`);

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    ...(system && { system }),
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const textContent = response.content.find((c): c is Anthropic.TextBlock => c.type === 'text');
  if (!textContent) {
    throw new Error('No text content in Claude response');
  }

  console.log(`[Claude] Response received, tokens used: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);

  return {
    content: textContent.text,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

/**
 * Analyze a transcript for case merits
 */
export async function analyzeCaseMerits(
  transcript: string,
  existingVariables: any = {}
): Promise<any> {
  const prompt = getAnalyzeCaseMeritsPrompt(transcript, existingVariables);

  const response = await sendMessage(
    [{ role: 'user', content: prompt }],
    {
      maxTokens: 8000,
      temperature: 0.3,
    }
  );

  // Parse JSON response (strip markdown code blocks if present)
  try {
    let jsonContent = response.content.trim();

    // Remove markdown code blocks if present
    if (jsonContent.startsWith('```')) {
      // Remove opening ```json or ``` and closing ```
      jsonContent = jsonContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(jsonContent);

    // Calculate quality score as mean of the four core scale scores
    const coreScales = parsed.coreScales;
    const qualityScore = (
      coreScales.economicHarm.score +
      coreScales.painAndSuffering.score +
      coreScales.causationStrength.score +
      coreScales.standardOfCareDeviation.score
    ) / 4;

    // Round to 1 decimal place
    parsed.qualityScore = Math.round(qualityScore * 10) / 10;

    console.log(`[Claude] Calculated quality score: ${parsed.qualityScore} (from core scales: ${coreScales.economicHarm.score}, ${coreScales.painAndSuffering.score}, ${coreScales.causationStrength.score}, ${coreScales.standardOfCareDeviation.score})`);

    return parsed;
  } catch (error) {
    console.error('[Claude] Failed to parse case merits response:', error);
    console.error('[Claude] Raw response:', response.content);
    throw new Error('Failed to parse case merits analysis from Claude');
  }
}

/**
 * Extract provider information from transcript
 */
export async function extractProviders(transcript: string): Promise<any[]> {
  const prompt = getExtractProvidersPrompt(transcript);

  const response = await sendMessage(
    [{ role: 'user', content: prompt }],
    {
      maxTokens: 4096,
      temperature: 0.3,
    }
  );

  // Parse JSON response (strip markdown code blocks if present)
  try {
    let jsonContent = response.content.trim();

    // Remove markdown code blocks if present
    if (jsonContent.startsWith('```')) {
      // Remove opening ```json or ``` and closing ```
      jsonContent = jsonContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    }

    const parsed = JSON.parse(jsonContent);
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }
    return parsed;
  } catch (error) {
    console.error('[Claude] Failed to parse providers response:', error);
    console.error('[Claude] Raw response:', response.content);
    throw new Error('Failed to parse provider extraction from Claude');
  }
}

export const claude = {
  sendMessage,
  analyzeCaseMerits,
  extractProviders,
};
