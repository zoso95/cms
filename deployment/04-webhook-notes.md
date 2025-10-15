# Webhook Configuration Notes

This document covers webhook management for external services.

## Overview

Your application uses webhooks for:
- **ElevenLabs**: Conversational AI call events
- **HumbleFax** (optional): Fax delivery status updates
- **Supabase**: Auth redirect URLs

## ElevenLabs Webhook

### Setup (Done During Initial Deployment)

The ElevenLabs webhook was configured in Step 1 of `02-initial-deployment.md`.

**Webhook URL**: `https://your-domain.com/api/webhooks/elevenlabs/conversation`

### When to Update

Update if:
- Domain changes
- SSL certificate issues
- Testing with ngrok locally

### How to Update

1. Log into [ElevenLabs Dashboard](https://elevenlabs.io)
2. Go to your Agent → Settings → Webhooks
3. Update webhook URL
4. Copy new webhook secret
5. Update `backend/.env.production` with new secret:
   ```bash
   ELEVENLABS_WEBHOOK_SECRET=wsec_new_secret_here
   ```
6. Restart backend:
   ```bash
   docker-compose -f docker-compose.production.yml restart backend
   ```

### Troubleshooting

**Webhook signature validation failing:**
- Check that `ELEVENLABS_WEBHOOK_SECRET` in `.env.production` matches ElevenLabs dashboard
- Verify webhook URL is exactly: `https://your-domain.com/api/webhooks/elevenlabs/conversation`
- Check backend logs: `docker-compose -f docker-compose.production.yml logs backend | grep elevenlabs`

**Webhook not receiving events:**
- Verify port 443 is open in EC2 security group
- Check nginx logs: `docker-compose -f docker-compose.production.yml logs nginx`
- Test manually: `curl -X POST https://your-domain.com/api/webhooks/elevenlabs/conversation`

## HumbleFax Webhook (Optional)

HumbleFax supports webhooks for fax delivery status updates.

### Setup

1. Log into [HumbleFax Dashboard](https://humblefax.com)
2. Go to Settings → Webhooks
3. Add webhook URL: `https://your-domain.com/api/webhooks/humblefax`
4. Save

**Note**: Currently, the application polls HumbleFax API for status updates instead of using webhooks. Webhook support can be added if needed.

## Supabase Auth Redirect URLs

**Important**: Add your production domain to Supabase allowed redirect URLs.

### Setup

1. Log into [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Authentication** → **URL Configuration**
4. Add to "Redirect URLs":
   ```
   https://your-domain.com
   https://your-domain.com/*
   http://localhost:3000  (keep for local dev)
   ```
5. Click **Save**

### Why This Matters

Supabase magic link authentication will fail if the redirect URL isn't whitelisted. Users will see an error after clicking email links.

### Testing

After setup, test magic link auth:
1. Go to https://your-domain.com
2. Enter email and request magic link
3. Click link in email
4. Should redirect to `https://your-domain.com` and log in successfully

## Local Development vs Production

### Local Dev (ngrok)

For local testing with ngrok:

1. Start ngrok: `ngrok http 3001`
2. Update ElevenLabs webhook to ngrok URL
3. Update `backend/.env`:
   ```bash
   ELEVENLABS_WEBHOOK_SECRET=wsec_ngrok_secret_here
   ```
4. Add ngrok URL to Supabase redirects (temporary)

### Production

Production uses your permanent domain:
- ElevenLabs: `https://your-domain.com/api/webhooks/elevenlabs/conversation`
- Supabase: `https://your-domain.com`

## Webhook Security

### ElevenLabs

- Uses HMAC SHA256 signature verification
- Timestamp validation (30-minute window)
- Implemented in `backend/src/middleware/webhookSignature.ts`

### Best Practices

- **Never expose webhook secrets** in logs or error messages
- **Validate signatures** before processing webhook data
- **Use HTTPS only** for production webhooks
- **Monitor webhook failures** in logs
- **Set up alerts** for repeated webhook failures (optional)

## Monitoring Webhooks

### Check Recent Webhook Calls

```bash
# Backend logs show webhook activity
docker-compose -f docker-compose.production.yml logs backend | grep webhook

# Look for:
# ✅ ElevenLabs webhook signature validated
# ❌ Invalid signature
# ❌ Missing signature header
```

### Database Records

Webhook events are stored in `webhook_events` table in Supabase:

```sql
SELECT * FROM webhook_events
ORDER BY created_at DESC
LIMIT 10;
```

## Adding New Webhooks

To add a new webhook endpoint:

1. **Create controller** in `backend/src/controllers/webhookController.ts`
2. **Add route** in `backend/src/routes/webhooks.ts`
3. **Add signature validation** if needed (middleware)
4. **Update this doc** with configuration steps

Example:

```typescript
// backend/src/routes/webhooks.ts
router.post('/newservice', validateSignature, webhookController.handleNewService);
```

## Troubleshooting Checklist

Webhook not working? Check:

- [ ] Webhook URL is correct in external service dashboard
- [ ] Webhook secret matches `.env.production`
- [ ] Port 443 open in EC2 security group
- [ ] SSL certificate is valid (check browser)
- [ ] Nginx is running and proxying correctly
- [ ] Backend container is running
- [ ] Backend logs show webhook received
- [ ] No CORS errors (check browser console if applicable)

## Support

For webhook issues:
- ElevenLabs: https://elevenlabs.io/docs
- HumbleFax: https://humblefax.com/docs
- Supabase: https://supabase.com/docs/guides/auth
