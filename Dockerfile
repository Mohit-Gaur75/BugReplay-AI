# =========================================================================
# BugReplay AI — Multi-Stage Production Dockerfile
# =========================================================================

# Stage 1: Build Frontend Assets
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build Canonical Browser SDK
FROM node:20-alpine AS sdk-builder
WORKDIR /app/sdk
COPY sdk/package*.json ./
RUN npm ci
COPY sdk/ ./
RUN npm run build

# Stage 3: Production Runtime
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Install dependencies for server
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server application code
COPY server/ ./server/

# Copy compiled frontend and canonical SDK into server's public directory
COPY --from=client-builder /app/client/dist ./server/public/dashboard
COPY --from=sdk-builder /app/server/public/bugreplay.js ./server/public/bugreplay.js

# Setup persistent volume for SQLite database
VOLUME ["/app/server/data"]
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

CMD ["node", "server/src/server.js"]
