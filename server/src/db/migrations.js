import { getDb } from './db.js';
import crypto from 'crypto';

const migrationsList = [
  {
    name: '001_initial_schema',
    up: (db) => {
      // 1. Users table
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          plan_tier TEXT DEFAULT 'FREE',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `);

      // 2. Projects table
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          api_key_hash TEXT UNIQUE NOT NULL,
          api_key_prefix TEXT NOT NULL,
          allowed_domains TEXT DEFAULT '*',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
        CREATE INDEX IF NOT EXISTS idx_projects_api_key_hash ON projects(api_key_hash);
      `);

      // 3. Incidents table
      db.exec(`
        CREATE TABLE IF NOT EXISTS incidents (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          error_message TEXT NOT NULL,
          error_type TEXT,
          error_stack TEXT,
          page_url TEXT NOT NULL,
          user_agent TEXT,
          viewport TEXT,
          telemetry_json TEXT NOT NULL,
          generated_playwright_test TEXT,
          ai_root_cause_summary TEXT,
          suggested_fix TEXT,
          confidence TEXT DEFAULT 'MEDIUM',
          status TEXT DEFAULT 'OPEN',
          generation_status TEXT DEFAULT 'PENDING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_incidents_project_id ON incidents(project_id);
        CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
        CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
      `);

      // 4. Usage Records table (monthly quota tracking)
      db.exec(`
        CREATE TABLE IF NOT EXISTS usage_records (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          billing_period TEXT NOT NULL,
          incident_count INTEGER DEFAULT 0,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          UNIQUE(project_id, billing_period)
        );
        CREATE INDEX IF NOT EXISTS idx_usage_records_lookup ON usage_records(project_id, billing_period);
      `);

      // 5. Subscriptions table
      db.exec(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id TEXT PRIMARY KEY,
          user_id TEXT UNIQUE NOT NULL,
          plan_tier TEXT DEFAULT 'FREE',
          status TEXT DEFAULT 'ACTIVE',
          provider_reference TEXT,
          current_period_end DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
      `);

      // 6. Audit Logs table
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          action TEXT NOT NULL,
          ip_address TEXT,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      `);

      // 7. Background Jobs table (Durable SQLite Queue)
      db.exec(`
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT DEFAULT 'PENDING',
          retries INTEGER DEFAULT 0,
          error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at);
      `);
    }
  },
  {
    name: '002_add_webhook_url_to_projects',
    up: (db) => {
      // Add webhook_url column to projects table if not exists
      const columns = db.prepare("PRAGMA table_info('projects')").all().map((c) => c.name);
      if (!columns.includes('webhook_url')) {
        db.exec(`ALTER TABLE projects ADD COLUMN webhook_url TEXT DEFAULT NULL;`);
      }
    }
  },
  {
    name: '003_add_github_to_projects',
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info('projects')").all().map((c) => c.name);
      if (!columns.includes('github_repo')) {
        db.exec(`ALTER TABLE projects ADD COLUMN github_repo TEXT DEFAULT NULL;`);
      }
      if (!columns.includes('github_token')) {
        db.exec(`ALTER TABLE projects ADD COLUMN github_token TEXT DEFAULT NULL;`);
      }
    }
  },
  {
    name: '004_advanced_backend_features',
    up: (db) => {
      // 1. Incidents table: fingerprinting, occurrence count & last seen
      const incidentCols = db.prepare("PRAGMA table_info('incidents')").all().map((c) => c.name);
      if (!incidentCols.includes('fingerprint')) {
        db.exec(`ALTER TABLE incidents ADD COLUMN fingerprint TEXT DEFAULT NULL;`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_incidents_fingerprint ON incidents(project_id, fingerprint);`);
      }
      if (!incidentCols.includes('occurrence_count')) {
        db.exec(`ALTER TABLE incidents ADD COLUMN occurrence_count INTEGER DEFAULT 1;`);
      }
      if (!incidentCols.includes('last_seen_at')) {
        db.exec(`ALTER TABLE incidents ADD COLUMN last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP;`);
      }

      // 2. Jobs table: distributed worker leasing & exponential retry scheduling
      const jobCols = db.prepare("PRAGMA table_info('jobs')").all().map((c) => c.name);
      if (!jobCols.includes('locked_at')) {
        db.exec(`ALTER TABLE jobs ADD COLUMN locked_at DATETIME DEFAULT NULL;`);
      }
      if (!jobCols.includes('locked_by')) {
        db.exec(`ALTER TABLE jobs ADD COLUMN locked_by TEXT DEFAULT NULL;`);
      }
      if (!jobCols.includes('scheduled_at')) {
        db.exec(`ALTER TABLE jobs ADD COLUMN scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP;`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_jobs_scheduling ON jobs(status, scheduled_at);`);
      }
    }
  },
  {
    name: '005_test_execution_engine',
    up: (db) => {
      // 1. Incidents table: test execution status, duration, and latest output
      const incidentCols = db.prepare("PRAGMA table_info('incidents')").all().map((c) => c.name);
      if (!incidentCols.includes('test_status')) {
        db.exec(`ALTER TABLE incidents ADD COLUMN test_status TEXT DEFAULT 'UNTESTED';`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_incidents_test_status ON incidents(test_status);`);
      }
      if (!incidentCols.includes('test_last_run_at')) {
        db.exec(`ALTER TABLE incidents ADD COLUMN test_last_run_at DATETIME DEFAULT NULL;`);
      }
      if (!incidentCols.includes('test_duration_ms')) {
        db.exec(`ALTER TABLE incidents ADD COLUMN test_duration_ms INTEGER DEFAULT NULL;`);
      }
      if (!incidentCols.includes('test_logs')) {
        db.exec(`ALTER TABLE incidents ADD COLUMN test_logs TEXT DEFAULT NULL;`);
      }

      // 2. Test Runs history table
      db.exec(`
        CREATE TABLE IF NOT EXISTS test_runs (
          id TEXT PRIMARY KEY,
          incident_id TEXT NOT NULL,
          status TEXT DEFAULT 'QUEUED',
          exit_code INTEGER DEFAULT NULL,
          logs TEXT DEFAULT '',
          duration_ms INTEGER DEFAULT 0,
          error_details TEXT DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_test_runs_incident ON test_runs(incident_id, created_at);
      `);
    }
  },
  {
    name: '006_team_management_rbac',
    up: (db) => {
      // 1. Project Members table
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_members (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'MEMBER',
          invited_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(project_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
      `);

      // 2. Project Invitations table
      db.exec(`
        CREATE TABLE IF NOT EXISTS project_invitations (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          email TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'MEMBER',
          token TEXT UNIQUE NOT NULL,
          invited_by TEXT NOT NULL,
          status TEXT DEFAULT 'PENDING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_project_invitations_lookup ON project_invitations(project_id, email, status);
        CREATE INDEX IF NOT EXISTS idx_project_invitations_token ON project_invitations(token);
      `);

      // 3. Backfill existing projects: ensure creator is OWNER
      const existingProjects = db.prepare('SELECT id, user_id, created_at FROM projects').all();
      const insertMember = db.prepare(`
        INSERT OR IGNORE INTO project_members (id, project_id, user_id, role, created_at)
        VALUES (?, ?, ?, 'OWNER', ?)
      `);

      for (const p of existingProjects) {
        insertMember.run(crypto.randomUUID(), p.id, p.user_id, p.created_at);
      }
    }
  },
  {
    name: '007_enterprise_audit_logs',
    up: (db) => {
      // Safely upgrade audit_logs table with enterprise columns
      const cols = db.prepare("PRAGMA table_info('audit_logs')").all().map((c) => c.name);

      if (!cols.includes('project_id')) {
        db.exec(`ALTER TABLE audit_logs ADD COLUMN project_id TEXT DEFAULT NULL;`);
      }
      if (!cols.includes('actor_id')) {
        db.exec(`ALTER TABLE audit_logs ADD COLUMN actor_id TEXT DEFAULT NULL;`);
      }
      if (!cols.includes('actor_email')) {
        db.exec(`ALTER TABLE audit_logs ADD COLUMN actor_email TEXT DEFAULT NULL;`);
      }
      if (!cols.includes('actor_role')) {
        db.exec(`ALTER TABLE audit_logs ADD COLUMN actor_role TEXT DEFAULT NULL;`);
      }
      if (!cols.includes('target_type')) {
        db.exec(`ALTER TABLE audit_logs ADD COLUMN target_type TEXT DEFAULT NULL;`);
      }
      if (!cols.includes('target_id')) {
        db.exec(`ALTER TABLE audit_logs ADD COLUMN target_id TEXT DEFAULT NULL;`);
      }
      if (!cols.includes('target_name')) {
        db.exec(`ALTER TABLE audit_logs ADD COLUMN target_name TEXT DEFAULT NULL;`);
      }
      if (!cols.includes('user_agent')) {
        db.exec(`ALTER TABLE audit_logs ADD COLUMN user_agent TEXT DEFAULT NULL;`);
      }

      // Backfill actor_id from user_id if present
      if (cols.includes('user_id')) {
        db.exec(`UPDATE audit_logs SET actor_id = user_id WHERE actor_id IS NULL AND user_id IS NOT NULL;`);
      }

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_project_created ON audit_logs(project_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
      `);
    }
  },
  {
    name: '008_device_network_health',
    up: (db) => {
      const cols = db.prepare("PRAGMA table_info('incidents')").all().map((c) => c.name);
      if (!cols.includes('device_health_json')) {
        db.exec(`ALTER TABLE incidents ADD COLUMN device_health_json TEXT DEFAULT NULL;`);
      }
    }
  }
];

export function runMigrations(customDb = null) {
  const db = customDb || getDb();

  // Ensure migrations tracking table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedRows = db.prepare('SELECT name FROM migrations').all();
  const appliedNames = new Set(appliedRows.map((r) => r.name));

  const applyTx = db.transaction((migration) => {
    migration.up(db);
    db.prepare('INSERT INTO migrations (id, name) VALUES (?, ?)').run(
      crypto.randomUUID(),
      migration.name
    );
  });

  for (const migration of migrationsList) {
    if (!appliedNames.has(migration.name)) {
      console.log(`Applying database migration: ${migration.name}...`);
      applyTx(migration);
      console.log(`✓ Migration ${migration.name} applied successfully.`);
    }
  }
}
