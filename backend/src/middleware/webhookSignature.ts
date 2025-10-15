import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

/**
 * Middleware to validate ElevenLabs webhook signature
 */
export function validateElevenLabsSignature(req: Request, res: Response, next: NextFunction) {
  try {
    console.log('🎯 ElevenLabs webhook received!');
    console.log('📋 Headers:', req.headers);

    // Validate ElevenLabs webhook signature
    const signature = req.headers['elevenlabs-signature'];
    if (!signature) {
      console.error('❌ Missing ElevenLabs-Signature header');
      return res.status(403).send('Missing signature header');
    }

    // Get webhook secret from environment
    const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;

    if (!secret) {
      console.error('❌ Missing ELEVENLABS_WEBHOOK_SECRET in environment');
      console.error('   Set ELEVENLABS_WEBHOOK_SECRET in .env');
      return res.status(500).send('Webhook secret not configured');
    }

    console.log('🔐 Using ElevenLabs webhook secret');

    // Parse signature header
    const headers = signature.toString().split(',');
    const timestampHeader = headers.find((e: string) => e.startsWith('t='));
    const sigHeader = headers.find((e: string) => e.startsWith('v0='));

    if (!timestampHeader || !sigHeader) {
      console.error('❌ Invalid signature header format');
      return res.status(403).send('Invalid signature header format');
    }

    const timestamp = timestampHeader.substring(2);
    const sig = sigHeader;

    // Validate timestamp (within 30 minutes)
    const reqTimestamp = parseInt(timestamp) * 1000;
    const tolerance = Date.now() - 30 * 60 * 1000;
    if (reqTimestamp < tolerance) {
      console.error('❌ Request expired');
      return res.status(403).send('Request expired');
    }

    // Validate signature
    const message = `${timestamp}.${req.body}`;
    const digest = 'v0=' + crypto.createHmac('sha256', secret).update(message).digest('hex');

    if (sig !== digest) {
      console.error('❌ Invalid signature');
      console.info('Expected:', digest);
      console.info('Received:', sig);
      return res.status(401).send('Request unauthorized');
    }

    console.log('✅ ElevenLabs webhook signature validated');

    // Parse the JSON body (since we received it as raw buffer)
    const webhookData = JSON.parse(req.body.toString());
    req.body = webhookData;

    next();
  } catch (error: any) {
    console.error('Error validating webhook signature:', error);
    res.status(500).json({ error: error.message });
  }
}
