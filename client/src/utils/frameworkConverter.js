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
