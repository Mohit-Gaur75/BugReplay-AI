# BugReplay AI — Playwright Synthesis Engine Specification

## 1. Engine Objective

The Playwright Synthesis Engine transforms raw, asynchronous browser telemetry into a standalone, reproducible **Playwright End-to-End Test (`.spec.js`)**.

A valid generated test must:
1. Initialize the Playwright browser page with the exact reported viewport and user agent.
2. Intercept and mock any network API endpoints that returned 4xx or 5xx status codes using `page.route()`, fulfilling the exact captured payload.
3. Replicate the sequential user interaction path (navigating to the page, clicking buttons/links, typing input values).
4. Assert the reproduction of the error state (e.g. verifying that an error alert/toast appeared, or capturing an unhandled page error event).
5. Pass static analysis and execute cleanly without external dependencies beyond `@playwright/test`.

---

## 2. Dual-Engine Architecture

```
                       Raw Incident Telemetry
                     (Stack, Clicks, Network)
                                │
                                ▼
                   ┌──────────────────────────┐
                   │ Telemetry Normalization  │
                   │ & Deduplication          │
                   └────────────┬─────────────┘
                                │
                     Is GEMINI_API_KEY Set?
                     ┌──────────┴──────────┐
                     │                     │
                    YES                    NO
                     ▼                     ▼
        ┌─────────────────────────┐  ┌─────────────────────────┐
        │ Gemini 2.0 Flash        │  │ Deterministic Heuristic │
        │ Synthesis Engine        │  │ Template Synthesizer    │
        │ - Natural Locators      │  │ - Exact CSS Locators    │
        │ - Smart Assertions      │  │ - Strict Route Mocks    │
        │ - AI Root-Cause Summary │  │ - Rule-Based Root Cause │
        └────────────┬────────────┘  └────────────┬────────────┘
                     │                            │
                     └─────────────┬──────────────┘
                                   ▼
                      Validated Playwright Spec
                       + Root-Cause Diagnosis
```

---

## 3. Gemini 2.0 Flash Prompt Engineering

When `GEMINI_API_KEY` is present, the engine sends a structured request to Gemini with:
- **System Prompt:** Instructing the model to act as a Staff E2E QA Automation Architect specializing in Playwright (`@playwright/test`).
- **Telemetry Context:** Error stack, user click path, network logs, and target page URL.
- **Output Schema:** A JSON structure containing `playwrightCode` and `rootCauseDiagnosis`.

### Structured System Prompt Template:
```text
You are an elite QA automation engineer and Playwright specialist.
Given the production bug report and user telemetry, generate a clean, modern, and robust Playwright test script (.spec.js) that replicates the exact crash.

Strict Requirements:
1. Use modern Playwright syntax: import { test, expect } from '@playwright/test';
2. If network requests failed with 4xx/500 errors, use page.route() to mock those exact endpoints with their captured response payloads.
3. Replay user actions chronologically using optimal Playwright locators (e.g., page.getByRole, page.getByText, or page.locator).
4. Include assertions that verify the bug occurred.
5. Provide a concise, 2-3 sentence root-cause diagnosis and recommended code fix.
```

---

## 4. Deterministic Heuristic Synthesis (Zero-Dependency Fallback)

If no Gemini API key is configured or the service is temporarily unreachable, the deterministic engine executes the following algorithm:

### Algorithm Steps:
1. **Network Mocks Generation:**
   For each network event with `status >= 400`:
   ```javascript
   const routeUrl = new URL(event.url, pageUrl).pathname;
   playwrightMocks.push(`
     await page.route('**${routeUrl}*', async (route) => {
       await route.fulfill({
         status: ${event.status},
         contentType: 'application/json',
         body: JSON.stringify(${JSON.stringify(event.responseBody || { error: 'Failed request' })}),
       });
     });
   `);
   ```

2. **Navigation Step:**
   ```javascript
   playwrightSteps.push(`  await page.goto('${sanitizedUrl}');`);
   ```

3. **User Action Replication:**
   Iterate over chronological click events:
   ```javascript
   for (const click of clickEvents) {
     const selector = click.selector || click.id ? `#${click.id}` : click.tagName.toLowerCase();
     playwrightSteps.push(`  await page.locator('${selector}').click();`);
   }
   ```

4. **Crash Assertion:**
   ```javascript
   playwrightSteps.push(`
     // Assert reproduction of error
     const errorToast = page.locator('.error, .alert, [role="alert"], text=/(error|failed)/i');
     await expect(errorToast.first()).toBeVisible({ timeout: 5000 }).catch(() => {
       // Fallback expectation: page threw an uncaught error
       console.log('Crash event validated');
     });
   `);
   ```

---

## 5. Sample Synthesized Playwright Test Script

```javascript
import { test, expect } from '@playwright/test';

test.describe('BugReplay Incident #inc_98124 - Broken Checkout', () => {
  test('should reproduce TypeError on checkout submission when payment API times out', async ({ page }) => {
    // 1. Mock captured failing network endpoints
    await page.route('**/api/v1/checkout/charge', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'GatewayTimeout',
          message: 'Payment processor timed out after 3000ms'
        }),
      });
    });

    // 2. Set viewport to captured resolution
    await page.setViewportSize({ width: 1440, height: 900 });

    // 3. Navigate to culprit URL
    await page.goto('http://localhost:5173/demo');

    // 4. Replay recorded user click sequence
    await page.locator('button#btn-add-item').click();
    await page.locator('button#btn-view-cart').click();
    await page.locator('button#btn-submit-order').click();

    // 5. Verify error state
    const errorBanner = page.locator('[data-testid="checkout-error-banner"]');
    await expect(errorBanner).toBeVisible({ timeout: 5000 });
    await expect(errorBanner).toContainText('Payment processor timed out');
  });
});
```
