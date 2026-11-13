# BugReplay AI — Database Schema Specification

## 1. Engine & Configuration

- **Database:** SQLite 3 (via `better-sqlite3`)
- **Journal Mode:** Write-Ahead Logging (`WAL`)
- **Foreign Keys:** Enabled (`PRAGMA foreign_keys = ON;`)
- **Busy Timeout:** 5000ms (`PRAGMA busy_timeout = 5000;`)
- **Synchronous:** Normal (`PRAGMA synchronous = NORMAL;`)
- **Storage Location:** Persistent volume / local file at `server/data/bugreplay.db`

---

## 2. Table Definitions

### 2.1. `users`
Stores registered developer accounts.
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                       -- UUID v4
  email TEXT UNIQUE NOT NULL,                -- User email address (lowercased)
  password_hash TEXT NOT NULL,               -- bcrypt hashed password (10 rounds)
  plan_tier TEXT DEFAULT 'FREE',             -- 'FREE' | 'PRO' | 'TEAM'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### 2.2. `projects`
Stores developer projects and hashed API keys.
```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,                       -- UUID v4
  user_id TEXT NOT NULL,                     -- Foreign key -> users.id
  name TEXT NOT NULL,                        -- Project name
  api_key_hash TEXT UNIQUE NOT NULL,         -- SHA-256 hash of API key
  api_key_prefix TEXT NOT NULL,              -- First 8 characters (e.g. 'br_live_')
  allowed_domains TEXT DEFAULT '*',          -- Comma-separated domains or '*'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_api_key_hash ON projects(api_key_hash);
```

### 2.3. `incidents`
Stores ingested error events, user telemetry, and synthesized Playwright tests.
```sql
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,                       -- UUID v4
  project_id TEXT NOT NULL,                  -- Foreign key -> projects.id
  error_message TEXT NOT NULL,               -- Uncaught error message
  error_type TEXT,                           -- e.g. 'TypeError', 'NetworkError'
  error_stack TEXT,                          -- JavaScript stack trace
  page_url TEXT NOT NULL,                    -- URL where crash occurred
  user_agent TEXT,                           -- Browser user agent
  viewport TEXT,                             -- Viewport size (e.g. '1440x900')
  telemetry_json TEXT NOT NULL,              -- JSON string of ring buffer events
  generated_playwright_test TEXT,            -- Synthesized .spec.js script
  ai_root_cause_summary TEXT,                -- Plain English root-cause explanation
  suggested_fix TEXT,                        -- Recommended code diff / solution
  confidence TEXT DEFAULT 'MEDIUM',          -- 'LOW' | 'MEDIUM' | 'HIGH' | 'RULE_BASED'
  status TEXT DEFAULT 'OPEN',                -- 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'IGNORED'
  generation_status TEXT DEFAULT 'PENDING',  -- 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_incidents_project_id ON incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
```

### 2.4. `usage_records`
Tracks monthly incident volume per project for quota enforcement.
```sql
CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,                       -- UUID v4
  project_id TEXT NOT NULL,                  -- Foreign key -> projects.id
  billing_period TEXT NOT NULL,              -- Format 'YYYY-MM'
  incident_count INTEGER DEFAULT 0,          -- Total incidents ingested
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, billing_period)
);
CREATE INDEX IF NOT EXISTS idx_usage_records_lookup ON usage_records(project_id, billing_period);
```

### 2.5. `subscriptions`
Tracks customer plan entitlements and payment references.
```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,                       -- UUID v4
  user_id TEXT UNIQUE NOT NULL,              -- Foreign key -> users.id
  plan_tier TEXT DEFAULT 'FREE',             -- 'FREE' | 'PRO' | 'TEAM'
  status TEXT DEFAULT 'ACTIVE',              -- 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
  provider_reference TEXT,                   -- Stripe / Razorpay customer or subscription ID
  current_period_end DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
```

### 2.6. `audit_logs`
Tracks security-sensitive events (key rotations, deletions, tier switches).
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,                       -- UUID v4
  user_id TEXT NOT NULL,                     -- Foreign key -> users.id
  action TEXT NOT NULL,                      -- e.g. 'API_KEY_ROTATED', 'PROJECT_DELETED'
  ip_address TEXT,                           -- Client IP address
  details TEXT,                              -- JSON formatted metadata
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
```

### 2.7. `jobs`
Durable background job queue for asynchronous AI synthesis.
```sql
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,                       -- UUID v4
  type TEXT NOT NULL,                        -- 'AI_SYNTHESIS'
  payload TEXT NOT NULL,                     -- JSON payload { incidentId }
  status TEXT DEFAULT 'PENDING',             -- 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  retries INTEGER DEFAULT 0,                 -- Retry count (max 3)
  error TEXT,                                -- Last failure message
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);
```

### 2.8. `migrations`
Tracks applied database migrations.
```sql
CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```
