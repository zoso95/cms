# Initial Deployment

This guide walks you through the complete first deployment of your CMS to AWS EC2.

## Prerequisites

- EC2 instance running with Elastic IP
- DNS configured and propagated (from `01-ec2-and-dns-setup.md`)
- SSH access to your EC2 instance
- Your domain name (e.g., `cms.yourdomain.com`)

## Step 1: Configure Webhooks

Before deploying, configure webhooks so you can add the secrets to `.env.production`.

### ElevenLabs Webhook

1. Log into [ElevenLabs Dashboard](https://elevenlabs.io)
2. Go to your Agent/Conversational AI settings
3. Add webhook URL: `https://your-domain.com/api/webhooks/elevenlabs/conversation`
4. Copy the generated webhook secret (starts with `wsec_...`)
5. Save this secret - you'll add it to `.env.production` in the next step

### HumbleFax Webhook (if applicable)

Add webhook endpoint to new domain

### Supabase Auth Redirect URLs

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

This allows magic link authentication to work on your production domain.

## Step 2: Create `.env.production` Files

Create production environment files **on your local machine** before deploying.

### `backend/.env.production`

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-service-role-key

# Temporal (Docker container names)
TEMPORAL_ADDRESS=temporal:7233
TEMPORAL_NAMESPACE=default

# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-domain.com

# ElevenLabs Webhook Secret (from Step 1)
ELEVENLABS_WEBHOOK_SECRET=wsec_your_production_secret_here
```

### `worker/.env.production`

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-service-role-key

# Temporal (Docker container names)
TEMPORAL_ADDRESS=temporal:7233
TEMPORAL_NAMESPACE=default

# Backend URL (Docker container name)
BACKEND_URL=http://backend:3001

# Twilio
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-number

# OpenPhone
OPENPHONE_API_KEY=your-openphone-key
OPENPHONE_FROM_NUMBER=your-openphone-number
OPENPHONE_PHONE_NUMBER_ID=your-openphone-id

# ElevenLabs
ELEVENLABS_API_KEY=your-elevenlabs-key
ELEVENLABS_AGENT_ID=your-agent-id
ELEVENLABS_PHONE_NUMBER_ID=your-phone-id

# Anthropic Claude
ANTHROPIC_API_KEY=your-anthropic-key
CLAUDE_MODEL=claude-sonnet-4-20250514

# OpenSign
OPENSIGN_USERNAME=your-email@your-domain.com
OPENSIGN_PASSWORD=your-opensign-password
OPENSIGN_BASE_URL=https://app.opensignlabs.com
OPENSIGN_APP_ID=

# HumbleFax
HUMBLEFAX_ACCESS_KEY=your-humblefax-access-key
HUMBLEFAX_SECRET_KEY=your-humblefax-secret-key

# Mailgun
MAILGUN_API_KEY=your-mailgun-key
MAILGUN_SANDBOX_SENDING_KEY=your-sandbox-key
MAILGUN_DOMAIN=your-domain.com
MAILGUN_FROM_EMAIL=records@your-domain.com
MAILGUN_WEBHOOK_SIGNING_KEY=your-webhook-key
```

### `frontend/.env.production`

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Auth Redirect
VITE_AUTH_REDIRECT_URL=https://your-domain.com

# Backend & WebSocket URL
VITE_BACKEND_URL=https://your-domain.com

# Temporal UI URL
VITE_TEMPORAL_UI_URL=https://your-domain.com:8233
```

**Important**: Don't commit these files to git! They're in `.gitignore`.

## Step 3: Upload Setup Script to EC2

```bash
# From your local project root
scp -i /path/to/your-key.pem deployment/ec2-initial-setup.sh ubuntu@your-domain.com:~/
```

## Step 4: Run EC2 Setup Script

SSH into your EC2 instance and run the setup script:

```bash
# SSH to EC2
ssh -i /path/to/your-key.pem ubuntu@your-domain.com

# Run setup script
bash ec2-initial-setup.sh your-domain.com your-email@example.com
```

This script will:
- Update system packages
- Install Docker and Docker Compose
- Install Certbot for SSL certificates
- Obtain SSL certificates from Let's Encrypt
- Configure automatic certificate renewal
- Set up firewall rules
- Install Node.js

**This takes about 5-10 minutes.**

After completion, **log out and back in** for Docker group membership to take effect:

```bash
exit
ssh -i /path/to/your-key.pem ubuntu@your-domain.com
```

## Step 5: Build Frontend Locally

Build the frontend on your local machine with production environment variables:

```bash
# From your local project root
cd frontend

# Build with production env vars
npm run build

# This creates frontend/dist/ directory
```

## Step 6: Deploy Code to EC2

Use rsync to upload your code (excluding node_modules):

```bash
# From your local project root
rsync -avz --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.temporal' \
  --exclude '*.log' \
  ./ ubuntu@your-domain.com:~/cms/
```

This uploads:
- All source code
- `.env.production` files (backend, worker, frontend)
- Built frontend (`frontend/dist/`)
- Docker configs (`docker-compose.production.yml`, Dockerfiles, `nginx.conf`)

## Step 7: Start Services

SSH back to EC2 and start all services:

```bash
# SSH to EC2
ssh -i /path/to/your-key.pem ubuntu@your-domain.com

# Navigate to project
cd ~/cms

# Start all services
docker-compose -f docker-compose.production.yml up -d

# This starts:
# - PostgreSQL (for Temporal)
# - Temporal Server
# - Temporal UI
# - Backend API
# - Worker
# - Nginx
```

**First startup takes 2-3 minutes** as Temporal initializes its database.

## Step 8: Verify Deployment

### Check Container Status

```bash
docker ps
```

You should see 6 containers running:
- `temporal-postgres`
- `temporal`
- `temporal-ui`
- `backend`
- `worker`
- `nginx`

### Check Logs

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f backend
```

### Test Endpoints

```bash
# Frontend (should show HTML)
curl https://your-domain.com

# Backend health check
curl https://your-domain.com/health

# Temporal UI
curl https://your-domain.com:8233
```

### Access in Browser

- **Frontend**: https://your-domain.com
- **Temporal UI**: https://your-domain.com:8233

## Troubleshooting

### Containers not starting

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs

# Restart specific service
docker-compose -f docker-compose.production.yml restart backend
```

### SSL certificate errors

- Ensure DNS is properly configured (gray cloud in Cloudflare)
- Check that ports 80/443 are open in EC2 security group
- Verify domain resolves to correct IP: `dig your-domain.com`

### Backend can't connect to Temporal

- Temporal takes 1-2 minutes to initialize on first start
- Check Temporal logs: `docker-compose -f docker-compose.production.yml logs temporal`
- Verify health: `docker-compose -f docker-compose.production.yml ps temporal`

### Frontend shows blank page

- Check nginx logs: `docker-compose -f docker-compose.production.yml logs nginx`
- Verify frontend/dist/ exists and was uploaded
- Check browser console for errors

### WebSocket connection fails

- Ensure CORS is configured correctly in backend
- Verify `FRONTEND_URL` in `backend/.env.production`
- Check nginx config allows WebSocket upgrades

## Next Steps

Your application is now live!

- See `03-redeployment.md` for updating code
- See `04-webhook-notes.md` for webhook management
- Monitor logs: `docker-compose -f docker-compose.production.yml logs -f`
