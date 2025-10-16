# Multi-stage build for backend
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/
COPY worker/package*.json ./worker/

# Install dependencies (including worker for its registry)
RUN npm ci --workspaces --workspace=backend --workspace=shared --workspace=worker

# Copy source files
COPY backend/ ./backend/
COPY shared/ ./shared/
COPY worker/ ./worker/
COPY tsconfig.json ./

# Build shared, worker (for registry), and backend
RUN npm run build --workspace=shared
RUN npm run build --workspace=worker
RUN npm run build --workspace=backend

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy all package files (backend needs access to worker registry)
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/
COPY worker/package*.json ./worker/

# Install production dependencies for all workspaces at once
RUN npm ci --workspaces --workspace=backend --workspace=shared --workspace=worker --omit=dev

# Copy built files from builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/worker/dist ./worker/dist

# Copy worker source files (needed for getWorkflowSource endpoint)
COPY worker/src ./worker/src

# Mount .env.production at runtime (via docker-compose volume)
# The dotenv.config() call will load /app/backend/.env

WORKDIR /app/backend

# Set timezone to America/New_York (EST/EDT)
ENV TZ=America/New_York

EXPOSE 3001

CMD ["node", "dist/index.js"]
