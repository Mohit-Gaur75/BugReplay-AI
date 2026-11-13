# BugReplay AI — Production Deployment Guide

## 1. Hosting Architecture & Prerequisites

BugReplay AI uses a persistent **SQLite database in WAL mode**.
- **Crucial Requirement:** The deployment platform **must support persistent volume mounts**.
- **Recommended Free/Low-Cost Hosts:**
  - **Fly.io:** Supports persistent storage volumes (`flyctl volumes create`).
  - **Railway / Render:** Supports persistent disk attachments.
  - **Hetzner / DigitalOcean VPS:** Traditional single VM with local SSD storage.
- **Do Not Deploy To:** Pure serverless stateless containers (e.g. AWS Lambda, Vercel Serverless) without a remote database bridge, as local SQLite files are lost on container recycle.

---

## 2. Docker & Containerization

### Multi-Stage Dockerfile Strategy
```dockerfile
# Stage 1: Build Frontend Assets
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Build Canonical SDK
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
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/
COPY --from=client-builder /app/client/dist ./server/public/dashboard
COPY --from=sdk-builder /app/sdk/dist/bugreplay.js ./server/public/bugreplay.js

VOLUME ["/app/server/data"]
EXPOSE 5000

CMD ["node", "server/src/server.js"]
```

### Docker Compose Configuration
```yaml
version: '3.8'

services:
  bugreplay:
    build: .
    ports:
      - "5000:5000"
    environment:
      - PORT=5000
      - NODE_ENV=production
      - JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars
      - GEMINI_API_KEY=your_gemini_api_key_here
      - GEMINI_MODEL=gemini-2.0-flash
      - DB_PATH=/app/server/data/bugreplay.db
    volumes:
      - bugreplay-data:/app/server/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  bugreplay-data:
```

---

## 3. Environment Variables Reference

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | No | `5000` | Port for the Express server to listen on. |
| `NODE_ENV` | No | `development` | `development` or `production`. |
| `JWT_SECRET` | **Yes** | — | High-entropy string used to sign user auth tokens. |
| `GEMINI_API_KEY` | Optional | — | Google Gemini API key for AI root cause and Playwright synthesis. If unset, deterministic fallback is used. |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | Gemini model name (`gemini-2.0-flash` or `gemini-1.5-flash`). |
| `DB_PATH` | No | `./data/bugreplay.db` | Filesystem path to the SQLite database. |
| `CORS_ORIGINS` | No | `*` | Comma-separated list of allowed origins. |

---

## 4. SQLite Operational Best Practices

### Multi-Instance Limitations
SQLite supports multiple concurrent readers via WAL mode, but only **one writer** at any given moment.
- In production, scale vertically on a single container/VM, or use Litestream to replicate SQLite changes to S3/Cloudflare R2.
- Never mount SQLite across network NFS or SMB shares without locking support.

### Safe Hot Backups
SQLite supports live zero-downtime backups using the `VACUUM INTO` command:
```bash
sqlite3 server/data/bugreplay.db "VACUUM INTO 'server/data/backups/backup-$(date +%Y%m%d%H%M%S).db'"
```

---

## 5. Health Checks & Graceful Shutdown

- **Health Endpoint:** `GET /health` returns HTTP 200 with uptime and database connection status.
- **Graceful Shutdown:** The server listens for `SIGTERM` and `SIGINT`, closes HTTP listeners, stops the background job worker, and flushes SQLite WAL buffers to disk via `db.close()`.
