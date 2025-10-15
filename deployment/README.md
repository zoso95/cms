# Deployment Documentation

Complete guide for deploying Afterimage CMS to AWS EC2.

## Architecture

Single EC2 instance running:
- **Temporal Server** + PostgreSQL (workflow orchestration)
- **Temporal UI** (workflow monitoring)
- **Backend API** (Express + Socket.io)
- **Worker** (Temporal worker executing workflows)
- **Frontend** (React SPA)
- **Nginx** (SSL termination, reverse proxy, static file serving)

All services run in Docker containers orchestrated by Docker Compose.

## Quick Start

For your first deployment, follow these guides in order:

1. **`01-ec2-and-dns-setup.md`** - Set up AWS EC2 and configure DNS
2. **`02-initial-deployment.md`** - Deploy your application
3. **`03-redeployment.md`** - Update code after changes
4. **`04-webhook-notes.md`** - Manage external webhooks

## Deployment Order

```
1. Launch EC2 instance
2. Allocate & attach Elastic IP
3. Configure Cloudflare DNS (point to Elastic IP)
4. Wait for DNS propagation (5-60 min)
5. Configure external webhooks (ElevenLabs, Supabase)
6. Create .env.production files locally
7. Run ec2-initial-setup.sh on EC2 (installs Docker, gets SSL)
8. Build frontend locally
9. Rsync code to EC2
10. Start services with docker-compose
```

## File Structure

```
deployment/
├── README.md                    # This file
├── 01-ec2-and-dns-setup.md      # AWS & DNS configuration
├── 02-initial-deployment.md     # First deployment walkthrough
├── 03-redeployment.md           # Code update procedures
├── 04-webhook-notes.md          # Webhook management
└── ec2-initial-setup.sh         # EC2 setup automation script
```

## Requirements

### Local Machine
- Node.js 20+
- SSH key for EC2 access
- rsync installed

### AWS
- EC2 instance (Ubuntu 22.04, t3.large minimum)
- Elastic IP
- Security group: ports 22, 80, 443, 8233 open

### External Services
- Domain with DNS managed by Cloudflare (or any DNS provider)
- Supabase project
- ElevenLabs account
- Various API keys (see `.env.example` files)

## Environment Variables

Three `.env.production` files needed:

### `backend/.env.production`
- Supabase credentials
- Temporal connection (use `temporal:7233` for Docker)
- Frontend URL for CORS
- ElevenLabs webhook secret

### `worker/.env.production`
- Supabase credentials
- Temporal connection (use `temporal:7233` for Docker)
- Backend URL (use `http://backend:3001` for Docker)
- All API keys (ElevenLabs, Anthropic, OpenPhone, HumbleFax, etc.)

### `frontend/.env.production`
- Supabase public keys
- Backend URL (`https://your-domain.com`)
- Temporal UI URL (`https://your-domain.com:8233`)

**Important**: Never commit `.env.production` files to git!

## Common Commands

### Deployment

```bash
# Initial deploy (first time)
follow 02-initial-deployment.md

# Redeploy code updates
cd frontend && npm run build && cd ..
rsync -avz --exclude 'node_modules' --exclude '.git' ./ ubuntu@your-domain.com:~/cms/
ssh ubuntu@your-domain.com "cd ~/cms && docker-compose -f docker-compose.production.yml up -d --build"
```

### Monitoring

```bash
# Check container status
docker ps

# View logs
docker-compose -f docker-compose.production.yml logs -f

# View specific service logs
docker-compose -f docker-compose.production.yml logs -f backend
```

### Maintenance

```bash
# Restart services
docker-compose -f docker-compose.production.yml restart

# Restart specific service
docker-compose -f docker-compose.production.yml restart backend

# Stop all services
docker-compose -f docker-compose.production.yml down

# Start all services
docker-compose -f docker-compose.production.yml up -d
```

## URLs

After deployment, your services are available at:

- **Frontend**: https://your-domain.com
- **Backend API**: https://your-domain.com/api/*
- **Health Check**: https://your-domain.com/health
- **Temporal UI**: https://your-domain.com:8233
- **WebSocket**: wss://your-domain.com/socket.io/

## SSL Certificates

SSL certificates are automatically obtained from Let's Encrypt during initial setup.

- Certificates stored in: `/etc/letsencrypt/live/your-domain.com/`
- Copied to: `~/cms/ssl/`
- Auto-renewal: 1st of each month via cron

Manual renewal:
```bash
sudo certbot renew
sudo cp /etc/letsencrypt/live/your-domain.com/*.pem ~/cms/ssl/
docker-compose -f ~/cms/docker-compose.production.yml restart nginx
```

## Security Considerations

### Firewall
- Only ports 22, 80, 443, 8233 should be open
- Consider restricting SSH (port 22) to your IP only

### Secrets Management
- Never commit `.env.production` files to git
- Store backup of secrets in secure location (password manager, AWS Secrets Manager, etc.)
- Rotate API keys periodically

### HTTPS
- All traffic is encrypted via HTTPS
- HTTP automatically redirects to HTTPS
- WebSocket connections use WSS (secure)

## Backup Strategy

### Database (Temporal PostgreSQL)
```bash
# Backup
docker exec temporal-postgres pg_dump -U temporal temporal > backup.sql

# Restore
docker exec -i temporal-postgres psql -U temporal temporal < backup.sql
```

### Code
- Code is backed up in git repository
- `.env.production` files should be backed up separately (not in git!)

### Volumes
Docker volumes persist data:
- `temporal-postgres-data`: Temporal's workflow history and state

## Troubleshooting

### Services won't start
1. Check logs: `docker-compose -f docker-compose.production.yml logs`
2. Verify `.env.production` files exist and have correct values
3. Ensure ports aren't already in use: `sudo netstat -tulpn | grep -E ':(80|443|3001|7233|8233)'`

### SSL issues
1. Verify DNS points to correct IP: `dig your-domain.com`
2. Ensure Cloudflare proxy is OFF (gray cloud, not orange)
3. Check certbot logs: `sudo tail -f /var/log/letsencrypt/letsencrypt.log`

### Temporal connection issues
1. Temporal takes 1-2 minutes to initialize on first start
2. Check health: `docker-compose -f docker-compose.production.yml ps temporal`
3. Verify PostgreSQL is healthy: `docker-compose -f docker-compose.production.yml ps temporal-postgres`

### Webhook failures
See `04-webhook-notes.md` for detailed webhook troubleshooting.

## Performance

### Resource Usage
- **Minimum**: t3.large (2 vCPU, 8GB RAM)
- **Recommended**: t3.xlarge (4 vCPU, 16GB RAM) for production load
- **Storage**: 30GB+ SSD

### Scaling
Current setup is single-server. For high availability:
- Move Temporal to dedicated instance or Temporal Cloud
- Use RDS for PostgreSQL
- Load balance multiple backend/worker instances
- Use CloudFront for frontend CDN

## Support Resources

- [Temporal Documentation](https://docs.temporal.io/)
- [Docker Documentation](https://docs.docker.com/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt](https://letsencrypt.org/docs/)
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)

## Next Steps

1. Set up monitoring (CloudWatch, Datadog, etc.) - optional
2. Configure automated backups - optional
3. Set up log aggregation - optional
4. Create deployment automation (GitHub Actions) - optional

## Questions?

Refer to the specific guides for detailed information:
- EC2/DNS issues → `01-ec2-and-dns-setup.md`
- Deployment problems → `02-initial-deployment.md`
- Update procedures → `03-redeployment.md`
- Webhook issues → `04-webhook-notes.md`
