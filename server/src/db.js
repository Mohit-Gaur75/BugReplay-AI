import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'bugreplay.db');
const db = new Database(dbPath);

// Enable SQLite Write-Ahead Logging (WAL) for high concurrency and performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      plan_tier TEXT DEFAULT 'FREE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      allowed_domains TEXT DEFAULT '*',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

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
      status TEXT DEFAULT 'OPEN',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
    CREATE INDEX IF NOT EXISTS idx_projects_api_key ON projects(api_key);
    CREATE INDEX IF NOT EXISTS idx_incidents_project_id ON incidents(project_id);
    CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
  `);

  seedDefaultData();
}

// Seed demo user, project, and realistic starter incidents
function seedDefaultData() {
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@bugreplay.dev');
  if (existingUser) {
    return;
  }

  const userId = 'usr_demo_developer_2026';
  const projectId = 'prj_demo_acme_storefront';
  const apiKey = 'br_live_demo_1234567890abcdef';
  const passwordHash = bcrypt.hashSync('password123', 10);

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, plan_tier)
    VALUES (?, ?, ?, ?)
  `);
  insertUser.run(userId, 'demo@bugreplay.dev', passwordHash, 'PRO');

  const insertProject = db.prepare(`
    INSERT INTO projects (id, user_id, name, api_key, allowed_domains)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertProject.run(projectId, userId, 'Acme Storefront', apiKey, '*');

  // Seed sample incident 1: TypeError on Checkout
  const telemetry1 = [
    {
      type: 'navigation',
      timestamp: Date.now() - 3600000,
      from: 'http://localhost:5173/products',
      to: 'http://localhost:5173/demo'
    },
    {
      type: 'click',
      timestamp: Date.now() - 3550000,
      tagName: 'BUTTON',
      id: 'btn-add-item',
      className: 'bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors',
      selector: 'button#btn-add-item',
      innerText: 'Add Ceramic Coffee Mug ($24.00)'
    },
    {
      type: 'click',
      timestamp: Date.now() - 3500000,
      tagName: 'BUTTON',
      id: 'btn-broken-checkout',
      className: 'bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors',
      selector: 'button#btn-broken-checkout',
      innerText: 'Trigger Broken Checkout'
    },
    {
      type: 'network',
      timestamp: Date.now() - 3499000,
      method: 'POST',
      url: '/api/v1/checkout/validate',
      status: 200,
      durationMs: 120,
      responseBody: { valid: true }
    },
    {
      type: 'console',
      timestamp: Date.now() - 3498000,
      level: 'error',
      message: 'Uncaught TypeError: Cannot read properties of undefined (reading \'discountCode\')'
    }
  ];

  const playwrightTest1 = `import { test, expect } from '@playwright/test';

test.describe('BugReplay Reproduction: Broken Checkout TypeError', () => {
  test('replicates crash when triggering checkout without discount payload', async ({ page }) => {
    // 1. Mock network responses captured during session
    await page.route('**/api/v1/checkout/validate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true })
      });
    });

    // 2. Set viewport and navigate
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173/demo');

    // 3. Replay exact recorded user actions
    await page.locator('button#btn-add-item').click();
    await page.locator('button#btn-broken-checkout').click();

    // 4. Assert error state occurs in UI
    const errorBanner = page.locator('[data-testid="error-alert"], .error-toast');
    await expect(errorBanner.first()).toBeVisible({ timeout: 4000 });
    await expect(errorBanner.first()).toContainText(/Cannot read properties of undefined/i);
  });
});
`;

  const aiRootCause1 = `The checkout submission handler expects an active \`order.cart.discount\` object to be present in local client state. When a user checks out with a standard full-price item without entering a promotional code, \`discount\` is \`undefined\`, causing \`order.cart.discount.discountCode\` to trigger an uncaught TypeError. Fix by applying optional chaining: \`order?.cart?.discount?.discountCode ?? null\`.`;

  // Seed sample incident 2: 500 Payment Gateway Timeout
  const telemetry2 = [
    {
      type: 'navigation',
      timestamp: Date.now() - 7200000,
      from: 'http://localhost:5173/',
      to: 'http://localhost:5173/demo'
    },
    {
      type: 'click',
      timestamp: Date.now() - 7150000,
      tagName: 'BUTTON',
      id: 'btn-trigger-500',
      className: 'bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors',
      selector: 'button#btn-trigger-500',
      innerText: 'Trigger 500 Payment Gateway Timeout'
    },
    {
      type: 'network',
      timestamp: Date.now() - 7149000,
      method: 'POST',
      url: '/api/v1/payment/charge',
      status: 500,
      durationMs: 312,
      responseBody: {
        error: 'PaymentGatewayTimeout',
        code: 'GATEWAY_TIMEOUT_504',
        message: 'Downstream payment processor failed to respond within 3000ms'
      }
    },
    {
      type: 'console',
      timestamp: Date.now() - 7148500,
      level: 'error',
      message: 'Failed to process charge: 500 Internal Server Error'
    }
  ];

  const playwrightTest2 = `import { test, expect } from '@playwright/test';

test.describe('BugReplay Reproduction: 500 Payment Gateway Timeout', () => {
  test('handles payment gateway timeout gracefully', async ({ page }) => {
    // 1. Mock the failing payment API endpoint with captured 500 error
    await page.route('**/api/v1/payment/charge', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'PaymentGatewayTimeout',
          code: 'GATEWAY_TIMEOUT_504',
          message: 'Downstream payment processor failed to respond within 3000ms'
        })
      });
    });

    // 2. Navigate and click payment button
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('http://localhost:5173/demo');
    await page.locator('button#btn-trigger-500').click();

    // 3. Assert error dialog or banner renders failure notification
    const alertBox = page.locator('[role="alert"], [data-testid="error-alert"]');
    await expect(alertBox.first()).toBeVisible({ timeout: 4000 });
    await expect(alertBox.first()).toContainText(/PaymentGatewayTimeout|Downstream payment processor/i);
  });
});
`;

  const aiRootCause2 = `The frontend payment submission handler does not catch non-200 HTTP responses from \`/api/v1/payment/charge\`. When the gateway returns a 500 Internal Server Error, the unhandled promise rejection leaves the checkout UI in an infinite loading spinner state without presenting an actionable retry prompt to the user. Fix by wrapping the fetch call in a \`try/catch\` block and transitioning UI state to \`PAYMENT_ERROR\` with a retry button.`;

  const insertIncident = db.prepare(`
    INSERT INTO incidents (
      id, project_id, error_message, error_type, error_stack, page_url,
      user_agent, viewport, telemetry_json, generated_playwright_test,
      ai_root_cause_summary, status, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
  `);

  insertIncident.run(
    'inc_demo_broken_checkout_01',
    projectId,
    'TypeError: Cannot read properties of undefined (reading \'discountCode\')',
    'TypeError',
    `TypeError: Cannot read properties of undefined (reading 'discountCode')
    at calculateTotal (checkout.js:54:21)
    at handleCheckout (checkout.js:112:9)
    at HTMLButtonElement.dispatch (react-dom.js:3211:14)`,
    'http://localhost:5173/demo',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    '1440x900',
    JSON.stringify(telemetry1),
    playwrightTest1,
    aiRootCause1,
    'OPEN',
    '-1 hour'
  );

  insertIncident.run(
    'inc_demo_payment_timeout_02',
    projectId,
    'NetworkError: 500 Internal Server Error on POST /api/v1/payment/charge',
    'NetworkError',
    `Error: 500 Internal Server Error
    at processPayment (paymentService.js:89:15)
    at async onPayNow (checkout.js:145:7)`,
    'http://localhost:5173/demo',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    '1920x1080',
    JSON.stringify(telemetry2),
    playwrightTest2,
    aiRootCause2,
    'OPEN',
    '-2 hours'
  );
}

export default db;
