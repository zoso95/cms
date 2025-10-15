# Multi-stage build for worker
# Using Debian-based image instead of Alpine for compatibility with Temporal's native modules
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY worker/package*.json ./worker/
COPY shared/package*.json ./shared/

# Install dependencies
RUN npm ci --workspaces --workspace=worker --workspace=shared

# Copy source files
COPY worker/ ./worker/
COPY shared/ ./shared/
COPY tsconfig.json ./

# Build worker and shared
RUN npm run build --workspace=shared
RUN npm run build --workspace=worker

# Production stage
# Using Debian-based image for glibc compatibility with @temporalio/core-bridge
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY worker/package*.json ./worker/
COPY shared/package*.json ./shared/

# Install production dependencies only
RUN npm ci --workspaces --workspace=worker --workspace=shared --omit=dev

# Copy built files from builder
COPY --from=builder /app/worker/dist ./worker/dist
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/

# Mount .env.production at runtime (via docker-compose volume)
# The dotenv.config() call will load /app/worker/.env

WORKDIR /app/worker

CMD ["node", "dist/worker.js"]
