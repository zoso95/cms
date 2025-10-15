import { Router } from 'express';
import * as webhookController from '../controllers/webhookController';

const router = Router();

// NOTE: ElevenLabs webhook is registered in index.ts BEFORE express.json()
// to preserve raw body for signature validation

// HumbleFax webhook
router.post('/humblefax', webhookController.handleHumbleFaxWebhook);

// Twilio webhooks
router.post('/twilio/sms', webhookController.handleTwilioSmsWebhook);
router.post('/twilio/voice', webhookController.handleTwilioVoiceWebhook);
router.post('/twilio/transcription', webhookController.handleTwilioTranscriptionWebhook);

export default router;
