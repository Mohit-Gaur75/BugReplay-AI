# =========================================================================
# BugReplay AI — Multi-Stage Production Dockerfile (Monorepo Compatible)
# =========================================================================

# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder
WORKDIR /app

# Install native compilation toolchain required by better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy root manifest and workspace package definitions
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY sdk/package*.json ./sdk/
COPY cli/package*.json ./cli/

# Install full dependency tree using root package-lock.json
RUN npm ci

# Copy application source code
COPY . .

# Compile canonical browser SDK and React 19 frontend
RUN npm run build --workspace=sdk
RUN npm run build --workspace=client

# Prune devDependencies to keep container lean
RUN npm prune --omit=dev

# Stage 2: Production Runtime
FROM node:20-alpine
WORKDIR /app

# Ensure curl / wget are available for container healthchecks
RUN apk add --no-cache wget

ENV NODE_ENV=production
ENV PORT=5000

# Copy runtime node_modules, root manifest, and server code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server ./server

# Copy compiled frontend SPA and SDK into server's public directory
COPY --from=builder /app/client/dist ./server/public/dashboard
COPY --from=builder /app/server/public/bugreplay.js ./server/public/bugreplay.js

# Ensure persistent SQLite data directory exists
RUN mkdir -p /app/server/data

VOLUME ["/app/server/data"]
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "server/src/server.js"]
