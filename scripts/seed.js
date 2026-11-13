import crypto from 'crypto';
import { initDb, closeDb } from '../server/src/db/db.js';
import { runMigrations } from '../server/src/db/migrations.js';
import { hashPassword, hashApiKey } from '../server/src/utils/crypto.js';

async function seed() {
  console.log('🌱 Seeding BugReplay AI development database...');

  const db = initDb();
  runMigrations(db);

  // 1. Seed Demo User
  const demoEmail = 'demo@bugreplay.dev';
  const rawPassword = 'password123';
  const passwordHash = await hashPassword(rawPassword);

  let user = db.prepare('SELECT id FROM users WHERE email = ?').get(demoEmail);

  if (!user) {
    const userId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, plan_tier)
      VALUES (?, ?, ?, 'PRO')
    `).run(userId, demoEmail, passwordHash);

    db.prepare(`
      INSERT INTO subscriptions (id, user_id, plan_tier, status)
      VALUES (?, ?, 'PRO', 'ACTIVE')
    `).run(crypto.randomUUID(), userId);

    user = { id: userId };
    console.log(`✓ Created demo user: ${demoEmail} / ${rawPassword} (PRO Tier)`);
  } else {
    console.log(`ℹ Demo user already exists (${demoEmail})`);
  }

  // 2. Seed Demo Project
  const rawDemoApiKey = 'br_live_demo_1234567890abcdef1234567890abcdef';
  const keyHash = hashApiKey(rawDemoApiKey);
  const keyPrefix = rawDemoApiKey.slice(0, 16) + '...';

  let project = db.prepare('SELECT id FROM projects WHERE user_id = ?').get(user.id);

  if (!project) {
    const projectId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO projects (id, user_id, name, api_key_hash, api_key_prefix, allowed_domains)
      VALUES (?, ?, 'Acme Storefront Production', ?, ?, '*')
    `).run(projectId, user.id, keyHash, keyPrefix);

    project = { id: projectId };
    console.log(`✓ Created demo project: Acme Storefront Production`);
    console.log(`🔑 Demo API Key: ${rawDemoApiKey}`);
  }

  // 3. Seed Realistic Sample Incidents
  const existingIncidents = db.prepare('SELECT COUNT(*) as count FROM incidents WHERE project_id = ?').get(project.id);

  if (existingIncidents.count === 0) {
    console.log('Creating sample realistic incidents...');

    // Incident 1: Broken Checkout (Payment Gateway Timeout 504)
    const inc1Id = crypto.randomUUID();
    const telemetry1 = [
      {
        type: 'click',
        tagName: 'BUTTON',
        id: 'btn-add-cart',
        selector: 'button#btn-add-cart',
        innerText: 'Add to Cart ($49.00)',
        timestamp: Date.now() - 12000,
      },
      {
        type: 'click',
        tagName: 'A',
        id: 'nav-cart-link',
        selector: 'a#nav-cart-link',
        innerText: 'View Cart (1 item)',
        timestamp: Date.now() - 8000,
      },
      {
        type: 'click',
        tagName: 'BUTTON',
        id: 'btn-submit-order',
        selector: 'button#btn-submit-order',
        innerText: 'Place Order ($49.00)',
        timestamp: Date.now() - 3000,
      },
      {
        type: 'network',
        method: 'POST',
        url: 'https://store.acme.com/api/v1/checkout/charge',
        status: 504,
        durationMs: 3120,
        responseBody: { error: 'GatewayTimeout', message: 'Payment gateway timed out after 3000ms' },
        timestamp: Date.now() - 1000,
      },
    ];

    const test1 = `import { test, expect } from '@playwright/test';

test.describe('BugReplay Incident #inc_98124: TypeError', () => {
  test('should reproduce: Cannot read properties of undefined (reading transactionId)', async ({ page }) => {
    // 1. Configure viewport
    await page.setViewportSize({ width: 1440, height: 900 });

    // Mock failed POST endpoint
    await page.route('**/api/v1/checkout/charge*', async (route) => {
      await route.fulfill({
        status: 504,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'GatewayTimeout', message: 'Payment gateway timed out after 3000ms' }),
      });
    });

    // 2. Navigate to culprit page
    await page.goto('http://localhost:5173/demo');

    // Step 1: Click Add to Cart
    await page.locator('button#btn-add-cart').click();

    // Step 2: Navigate to cart
    await page.locator('a#nav-cart-link').click();

    // Step 3: Click Place Order
    await page.locator('button#btn-submit-order').click();

    // 3. Assert error state reproduction
    const errorIndicator = page.locator('.error, .alert, [role="alert"], text=/(error|failed|timeout)/i');
    await expect(errorIndicator.first()).toBeVisible({ timeout: 5000 });
  });
});
`;

    db.prepare(`
      INSERT INTO incidents (
        id, project_id, error_message, error_type, error_stack, page_url, user_agent, viewport,
        telemetry_json, generated_playwright_test, ai_root_cause_summary, suggested_fix,
        confidence, status, generation_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'HIGH', 'OPEN', 'COMPLETED')
    `).run(
      inc1Id,
      project.id,
      "Cannot read properties of undefined (reading 'transactionId')",
      'TypeError',
      "TypeError: Cannot read properties of undefined (reading 'transactionId')\n    at handleCheckoutResponse (checkout.js:84:22)\n    at async onSubmit (checkout.js:112:9)",
      'https://store.acme.com/checkout',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      '1440x900',
      JSON.stringify(telemetry1),
      test1,
      'The checkout handler assumed POST /api/v1/checkout/charge always returns a 200 JSON object containing transactionId. When Stripe timed out with HTTP 504, the response lacked transactionId, throwing an unhandled TypeError.',
      'Add a check for response.ok and optional chaining: const txId = data?.transactionId. Display a user-friendly error toast when response.ok is false.'
    );

    // Increment usage record
    const period = new Date().toISOString().slice(0, 7);
    db.prepare(`
      INSERT INTO usage_records (id, project_id, billing_period, incident_count)
      VALUES (?, ?, ?, 3)
      ON CONFLICT(project_id, billing_period) DO UPDATE SET incident_count = incident_count + 3
    `).run(crypto.randomUUID(), project.id, period);

    console.log('✓ Sample incidents created successfully.');
  }

  closeDb();
  console.log('\n======================================================');
  console.log('🌱 Database seeded successfully!');
  console.log('👤 Login: demo@bugreplay.dev');
  console.log('🔑 Password: password123');
  console.log('======================================================\n');
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
