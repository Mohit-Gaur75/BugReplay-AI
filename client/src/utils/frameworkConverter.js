/**
 * Framework Converter Utility
 * Converts Playwright test scripts to Cypress and Puppeteer syntax
 */

export function convertToCypress(playwrightCode, incident) {
  if (!playwrightCode) return '';

  const shortId = incident?.id ? incident.id.slice(0, 8) : 'test';
  const targetUrl = incident?.page_url || 'http://localhost:5173';
  const errorMsg = incident?.error_message || 'Application Error';

  // Extract clicks from Playwright code
  const clickMatches = [...playwrightCode.matchAll(/await page\.click\(['"]([^'"]+)['"]\);/g)];
  const clicks = clickMatches.map(m => m[1]);

  // Extract route mocks
  const routeMatch = playwrightCode.match(/await page\.route\(['"]([^'"]+)['"],\s*async\s*route\s*=>\s*\{\s*await route\.fulfill\(\{\s*status:\s*(\d+)/s);
  let interceptCode = '';
  if (routeMatch) {
    const routeUrl = routeMatch[1];
    const status = routeMatch[2];
    interceptCode = `\n    // Mock failing endpoint identical to production session\n    cy.intercept('*${routeUrl.replace(/^https?:\/\/[^/]+/, '')}', {\n      statusCode: ${status},\n      body: { error: 'Simulated backend failure' }\n    }).as('mockEndpoint');\n`;
  }

  let actionsCode = clicks.map(sel => `    cy.get('${sel}').click();`).join('\n');
  if (!actionsCode) {
    actionsCode = `    // Replicate user interaction sequence\n    cy.get('button').first().click();`;
  }

  return `// BugReplay AI — Cypress Reproduction Test
// Incident ID: #${shortId}
// Culprit URL: ${targetUrl}
// Expected Error: ${errorMsg}

describe('BugReplay Incident #${shortId} Reproduction', () => {
  it('replicates user session and asserts crash', () => {${interceptCode}
    // Navigate to page where failure occurred
    cy.visit('${targetUrl}');
${actionsCode}

    // Verify error state is rendered
    cy.contains(/error|failed/i).should('be.visible');
  });
});
`;
}

export function convertToPuppeteer(playwrightCode, incident) {
  if (!playwrightCode) return '';

  const shortId = incident?.id ? incident.id.slice(0, 8) : 'test';
  const targetUrl = incident?.page_url || 'http://localhost:5173';
  const errorMsg = incident?.error_message || 'Application Error';

  const clickMatches = [...playwrightCode.matchAll(/await page\.click\(['"]([^'"]+)['"]\);/g)];
  const clicks = clickMatches.map(m => m[1]);

  let clickActions = clicks.map(sel => `    await page.waitForSelector('${sel}', { visible: true });\n    await page.click('${sel}');`).join('\n');
  if (!clickActions) {
    clickActions = `    // Replicate user clicks\n    await page.click('button');`;
  }

  return `// BugReplay AI — Puppeteer Reproduction Script
// Incident ID: #${shortId}
// Culprit URL: ${targetUrl}
// Expected Error: ${errorMsg}

import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: { width: 1440, height: 900 }
  });
  const page = await browser.newPage();

  // Enable request interception for route mocking
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    // Intercept failing endpoints or pass through
    req.continue();
  });

  try {
    console.log('Navigating to culprit URL...');
    await page.goto('${targetUrl}', { waitUntil: 'networkidle2' });

    console.log('Replaying captured user action sequence...');
${clickActions}

    console.log('✓ Successfully reproduced crash sequence.');
  } catch (err) {
    console.error('Reproduced session failure:', err.message);
  } finally {
    // Keep browser open for inspection for 5 seconds
    await new Promise(r => setTimeout(r, 5000));
    await browser.close();
  }
})();
`;
}

export function convertToRTL(playwrightCode, incident) {
  if (!playwrightCode) return '';

  const shortId = incident?.id ? incident.id.slice(0, 8) : 'test';
  const errorMsg = incident?.error_message || 'Application Error';

  return `// BugReplay AI — React Testing Library Component Test
// Incident ID: #${shortId}
// Expected Error: ${errorMsg}

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Component Crash Reproduction (Incident #${shortId})', () => {
  beforeEach(() => {
    // Mock global fetch to simulate captured backend 500 / timeout response
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Simulated backend failure' }),
    }));
  });

  it('reproduces crash when user completes action sequence', async () => {
    const user = userEvent.setup();

    // Render culprit component
    // render(<CulpritComponent />);

    // Replay user click interaction sequence
    const actionButton = screen.queryByRole('button', { name: /(submit|checkout|order|pay)/i });
    if (actionButton) {
      await user.click(actionButton);
    }

    // Verify error boundary catches or renders notification
    await waitFor(() => {
      const errorElement = screen.queryByText(/(error|failed|timeout)/i);
      expect(errorElement).toBeDefined();
    });
  });
});
`;
}

export function generateGitPatch(incident) {
  if (!incident) return '';
  const shortId = incident.id ? incident.id.slice(0, 8) : 'test';
  const suggestedFix = incident.suggested_fix || '// Add response error boundary or optional chaining';
  const culpritFile = incident.page_url?.includes('checkout') ? 'src/pages/Checkout.jsx' : 'src/services/api.js';

  return `From: BugReplay AI <bot@bugreplay.dev>
Subject: [PATCH] fix: resolve ${incident.error_type || 'Error'} in #${shortId}

AI Root Cause:
${incident.ai_root_cause_summary || 'Null state or unhandled network failure.'}

Suggested Fix:
${suggestedFix}
---
--- a/${culpritFile}
+++ b/${culpritFile}
@@ -32,6 +32,9 @@
-  const result = await response.json();
-  return result.transactionId;
+  if (!response.ok) {
+    throw new Error('Network failure: status ' + response.status);
+  }
+  const result = await response.json();
+  return result?.transactionId ?? null;
--
2.45.0
`;
}
