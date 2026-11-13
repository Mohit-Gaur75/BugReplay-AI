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
