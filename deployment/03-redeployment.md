# Redeployment Guide

Quick guide for deploying code updates to your running production instance.

## When to Redeploy

Redeploy when you've made changes to:
- Backend code
- Worker code
- Frontend code
- Docker configuration
- Nginx configuration

## Quick Redeploy Process

### Step 1: Build Frontend (if changed)

```bash
# From your local project root
cd frontend
npm run build
cd ..
```

### Step 2: Rsync Code to EC2

```bash
# From your local project root
rsync -avz --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.temporal' \
  --exclude '*.log' \
  ./ ubuntu@your-domain.com:~/cms/

rsync -avz -e "ssh -i ../gnb-prompt.pem" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.temporal' \
    --exclude '*.log' \
    ./ ubuntu@cms.quickchron.com:~/cms/
```

### Step 3: Restart Services

SSH to EC2 and restart:

```bash
# SSH to EC2
ssh -i /path/to/your-key.pem ubuntu@your-domain.com

# Navigate to project
cd ~/cms

# Rebuild and restart services
docker-compose -f docker-compose.production.yml up -d --build
```

The `--build` flag rebuilds Docker images if code changed.

## Selective Restarts

### Only Backend Changed

```bash
# Rebuild and restart just backend
docker-compose -f docker-compose.production.yml up -d --build backend
```

### Only Worker Changed

```bash
# Rebuild and restart just worker
docker-compose -f docker-compose.production.yml up -d --build worker
```

### Only Frontend Changed

```bash
# Just restart nginx (frontend is static files)
docker-compose -f docker-compose.production.yml restart nginx
```

### Only .env.production Changed

```bash
# Restart affected service (doesn't need rebuild)
docker-compose -f docker-compose.production.yml restart backend worker
```

## Zero-Downtime Deployments

For zero-downtime updates:

### Backend/Worker

```bash
# Build new images first
docker-compose -f docker-compose.production.yml build backend worker

# Then restart (quick switch)
docker-compose -f docker-compose.production.yml up -d backend worker
```

### Frontend

Frontend is just static files served by nginx, so updates are instant when nginx restarts.

## Checking Deployment

### Verify Containers Running

```bash
docker ps
```

All 6 containers should show "Up" status.

### Check Logs

```bash
# Follow all logs
docker-compose -f docker-compose.production.yml logs -f

# Just backend
docker-compose -f docker-compose.production.yml logs -f backend

# Just worker
docker-compose -f docker-compose.production.yml logs -f worker

# Last 100 lines
docker-compose -f docker-compose.production.yml logs --tail=100
```

### Test Application

- **Frontend**: Visit https://your-domain.com
- **Backend API**: `curl https://your-domain.com/health`
- **Temporal UI**: Visit https://your-domain.com:8233

## Rollback

If deployment fails, you can quickly rollback:

### Option 1: Restart with Previous Images

```bash
# Stop current containers
docker-compose -f docker-compose.production.yml down

# Start with previous images (don't use --build)
docker-compose -f docker-compose.production.yml up -d
```

### Option 2: Rollback Code via Git

```bash
# On your local machine, revert to previous commit
git revert HEAD

# Or check out previous version
git checkout <previous-commit-hash>

# Then redeploy
npm run build --workspace=frontend
rsync -avz ... ubuntu@your-domain.com:~/cms/
ssh ubuntu@your-domain.com "cd ~/cms && docker-compose -f docker-compose.production.yml up -d --build"
```

## Common Issues

### Build Fails

```bash
# View build logs
docker-compose -f docker-compose.production.yml build

# Common fixes:
# 1. Check TypeScript compilation errors
# 2. Verify all dependencies in package.json
# 3. Ensure shared/ workspace builds first
```

### Container Crashes Immediately

```bash
# Check logs for error message
docker-compose -f docker-compose.production.yml logs backend

# Common causes:
# - Missing .env.production file
# - Invalid environment variable
# - Database connection failure
```

### Frontend Not Updating

```bash
# Clear browser cache or hard refresh (Cmd+Shift+R / Ctrl+Shift+R)

# Verify dist/ was uploaded
ssh ubuntu@your-domain.com "ls -la ~/cms/frontend/dist/"

# Restart nginx
docker-compose -f docker-compose.production.yml restart nginx
```

### Database/Temporal Issues

```bash
# Check Temporal health
docker-compose -f docker-compose.production.yml ps temporal

# Check PostgreSQL
docker-compose -f docker-compose.production.yml ps temporal-postgres

# Restart Temporal (keep data)
docker-compose -f docker-compose.production.yml restart temporal
```

## Maintenance Commands

### View All Containers

```bash
docker ps -a
```

### View Disk Usage

```bash
df -h
docker system df
```

### Clean Up Old Images

```bash
# Remove unused images
docker image prune -a

# Remove stopped containers
docker container prune

# Be careful - don't remove volumes (your data!)
```

### Update SSL Certificates

SSL certificates auto-renew via cron job. To manually renew:

```bash
sudo certbot renew
sudo cp /etc/letsencrypt/live/your-domain.com/*.pem ~/cms/ssl/
docker-compose -f ~/cms/docker-compose.production.yml restart nginx
```

## Performance Monitoring

### Check Resource Usage

```bash
# Container stats
docker stats

# System resources
htop  # or: top

# Disk space
df -h
```

### Database Size

```bash
# Connect to Temporal PostgreSQL
docker exec -it temporal-postgres psql -U temporal

# Check database size
\l+

# Exit
\q
```

## Backup Recommendations

### Temporal Database

```bash
# Backup PostgreSQL data
docker exec temporal-postgres pg_dump -U temporal temporal > temporal_backup_$(date +%Y%m%d).sql

# Restore if needed
docker exec -i temporal-postgres psql -U temporal temporal < temporal_backup_YYYYMMDD.sql
```

### Code Backups

Your code is in git, so just ensure you're pushing regularly to your remote repository.

## Next Steps

- Monitor application logs regularly
- Set up automated monitoring/alerts (optional)
- Review `04-webhook-notes.md` for webhook management
