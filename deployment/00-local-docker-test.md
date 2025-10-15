# Local Docker Testing

Test your Docker setup locally before deploying to EC2.

## Quick Start

```bash
# 1. Ensure your .env files are configured
# backend/.env and worker/.env should already exist

# 2. Update .env files to use Docker service names
# Edit backend/.env:
#   TEMPORAL_ADDRESS=temporal:7233
#   FRONTEND_URL=http://localhost:3000

# Edit worker/.env:
#   TEMPORAL_ADDRESS=temporal:7233
#   BACKEND_URL=http://backend:3001

# 3. Build frontend
cd frontend
npm run build
cd ..

# 4. Start all services
docker-compose -f docker-compose.local.yml up

# 5. Test in another terminal
curl http://localhost:3001/health
```

## What Gets Started

- **temporal-postgres** (port 5432) - Temporal's database
- **temporal** (port 7233) - Temporal server
- **temporal-ui** (port 8233) - Temporal web UI
- **backend** (port 3001) - Your Express API + Socket.io
- **worker** - Your Temporal worker

**Note**: Frontend is NOT in Docker - serve it separately or access backend directly.

## Testing

### Check All Containers Running

```bash
docker ps

# Should see 5 containers with "Up" status
```

### Test Backend

```bash
# Health check
curl http://localhost:3001/health

# Should return: {"status":"ok"}
```

### Test Temporal UI

Open browser: http://localhost:8233

### Test Frontend (if running separately)

If running frontend locally (`npm run dev`):
- Visit http://localhost:3000
- Should connect to Dockerized backend at localhost:3001

### Check Logs

```bash
# All services
docker-compose -f docker-compose.local.yml logs -f

# Specific service
docker-compose -f docker-compose.local.yml logs -f backend
docker-compose -f docker-compose.local.yml logs -f worker
docker-compose -f docker-compose.local.yml logs -f temporal
```

## Environment Variables

### Required Changes to Local .env Files

**`backend/.env`** - Change these for Docker:
```bash
# Use Docker service name (not localhost)
TEMPORAL_ADDRESS=temporal:7233

# Keep localhost for CORS (frontend runs outside Docker)
FRONTEND_URL=http://localhost:3000
```

**`worker/.env`** - Change these for Docker:
```bash
# Use Docker service names
TEMPORAL_ADDRESS=temporal:7233
BACKEND_URL=http://backend:3001
```

**Note**: After testing, you may want to change these back to `localhost:7233` for local development without Docker.

## Common Issues

### Temporal Takes Time to Start

**First startup takes 1-2 minutes** while Temporal initializes the database.

Watch logs: `docker-compose -f docker-compose.local.yml logs -f temporal`

Look for: `"Membership changed"` - means it's ready.

### Port Already in Use

If you have services running locally:

```bash
# Stop local Temporal
pkill -f temporal

# Stop local backend
# (stop your npm run dev:backend process)

# Or change ports in docker-compose.local.yml
```

### Backend/Worker Can't Connect to Temporal

Check that `TEMPORAL_ADDRESS=temporal:7233` in your .env files (not `localhost:7233`).

### Build Errors

```bash
# View build output
docker-compose -f docker-compose.local.yml build

# Common fixes:
# - Ensure all dependencies in package.json
# - Check TypeScript compilation
# - Verify shared/ builds before backend/worker
```

### Frontend Can't Connect to Backend

Frontend runs outside Docker, so it connects to `localhost:3001`.

Ensure `FRONTEND_URL=http://localhost:3000` in `backend/.env` for CORS.

## Useful Commands

### Start Services

```bash
# Start in foreground (see logs)
docker-compose -f docker-compose.local.yml up

# Start in background
docker-compose -f docker-compose.local.yml up -d

# Rebuild and start
docker-compose -f docker-compose.local.yml up --build
```

### Stop Services

```bash
# Stop (keeps volumes)
docker-compose -f docker-compose.local.yml down

# Stop and remove volumes (deletes Temporal data!)
docker-compose -f docker-compose.local.yml down -v
```

### Restart Individual Service

```bash
# Restart backend
docker-compose -f docker-compose.local.yml restart backend

# Rebuild and restart backend
docker-compose -f docker-compose.local.yml up -d --build backend
```

### Check Resource Usage

```bash
docker stats
```

### Clean Up

```bash
# Stop and remove everything
docker-compose -f docker-compose.local.yml down -v

# Remove dangling images
docker image prune

# Nuclear option (removes ALL unused Docker resources)
docker system prune -a
```

## Development Workflow

### Option 1: Hybrid (Recommended for Development)

Run backend/worker locally, use Docker only for Temporal:

```bash
# Start just Temporal in Docker
docker-compose -f docker-compose.local.yml up temporal temporal-ui temporal-postgres

# In separate terminals, run locally:
npm run dev:backend
npm run dev:worker
npm run dev:frontend
```

Benefits:
- Hot-reloading works
- Faster iteration
- Easier debugging

### Option 2: Full Docker

Run everything in Docker (slower iteration but closer to production):

```bash
# Start all services
docker-compose -f docker-compose.local.yml up

# Run frontend separately (or add to docker-compose)
npm run dev:frontend
```

## Success Criteria

Your Docker setup is working if:
- [ ] All 5 containers start and stay running
- [ ] Backend health check returns 200: `curl http://localhost:3001/health`
- [ ] Temporal UI loads: http://localhost:8233
- [ ] No errors in logs: `docker-compose -f docker-compose.local.yml logs`
- [ ] Worker connects to Temporal (check worker logs)
- [ ] Backend connects to Temporal (check backend logs)

## Next Steps

Once local Docker testing succeeds:
1. **Revert .env changes** (back to `localhost:7233` for local dev)
2. Commit your code changes (not .env files!)
3. Ready to deploy! Follow:
   - `01-ec2-and-dns-setup.md`
   - `02-initial-deployment.md`

## Troubleshooting

### Reset Everything

If things are broken, reset:

```bash
# Stop and remove everything
docker-compose -f docker-compose.local.yml down -v

# Remove images
docker-compose -f docker-compose.local.yml down --rmi all

# Start fresh
docker-compose -f docker-compose.local.yml up --build
```

### Temporal Database Issues

```bash
# Check PostgreSQL logs
docker-compose -f docker-compose.local.yml logs temporal-postgres

# Reset Temporal database (WARNING: deletes all workflow data)
docker-compose -f docker-compose.local.yml down -v
docker-compose -f docker-compose.local.yml up
```

### View Temporal Workflows

Visit http://localhost:8233 to see:
- Running workflows
- Workflow history
- Task queues
- Namespaces

## Local vs Production Differences

| Component | Local | Production |
|-----------|-------|------------|
| Temporal Address | `temporal:7233` | `temporal:7233` |
| Backend URL | `http://backend:3001` | `http://backend:3001` |
| Frontend URL | `http://localhost:3000` | `https://your-domain.com` |
| SSL/Nginx | None | Yes |
| Volumes | Named volumes | Named volumes |
| Env Files | `.env` | `.env.production` |

Local testing uses the same Docker images and network setup as production, just without nginx/SSL.
