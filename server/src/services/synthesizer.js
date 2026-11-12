import { GoogleGenAI } from '@google/genai';

/**
 * Playwright Test Synthesizer & AI Root-Cause Diagnostic Engine
 * Generates robust, executable Playwright .spec.js test scripts and plain-English
 * root-cause diagnostics using Gemini 2.0 Flash with an automatic deterministic fallback.
 */

export async function synthesizeTest(incidentData) {
  const {
    errorMessage,
    errorType = 'Error',
    errorStack = '',
    pageUrl = 'http://localhost:5173/demo',
    viewport = '1440x900',
    telemetry = []
  } = incidentData;

  // 1. Attempt Gemini 2.0 Flash AI Synthesis if API key is present
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    try {
      const aiResult = await generateWithGemini(incidentData);
      if (aiResult && aiResult.playwrightTest && aiResult.rootCauseSummary) {
        return {
          playwrightTest: aiResult.playwrightTest,
          rootCauseSummary: aiResult.rootCauseSummary,
          synthesizerEngine: 'GEMINI_2_0_FLASH'
        };
      }
    } catch (aiError) {
      console.warn('[Synthesizer] Gemini AI call failed or timed out. Falling back to Deterministic Synthesizer.', aiError.message);
    }
  }

  // 2. Deterministic Heuristic Rule Synthesizer (Guaranteed 100% Reliability)
  const heuristicResult = generateWithHeuristics(incidentData);
  return {
    playwrightTest: heuristicResult.playwrightTest,
    rootCauseSummary: heuristicResult.rootCauseSummary,
    synthesizerEngine: 'DETERMINISTIC_HEURISTIC'
  };
}

/**
 * Gemini 2.0 Flash Generation
 */
async function generateWithGemini(incidentData) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompt = `
You are a Staff QA Automation Architect and Playwright specialist.
Convert this real-world production browser crash and session telemetry into a clean, modern, and runnable Playwright E2E test script (.spec.js) and an insightful root cause analysis.

CRASH DETAILS:
- Error Message: ${incidentData.errorMessage}
- Error Type: ${incidentData.errorType}
- Culprit Page URL: ${incidentData.pageUrl}
- Viewport: ${incidentData.viewport}
- Error Stack:
${incidentData.errorStack || 'No stack trace available'}

RECORDED USER & NETWORK TELEMETRY (Last 15 actions):
${JSON.stringify(incidentData.telemetry, null, 2)}

STRICT REQUIREMENTS:
1. Output MUST be valid JSON with exactly two fields: "playwrightTest" (string) and "rootCauseSummary" (string).
2. The "playwrightTest" MUST:
   - Use standard ES module syntax: import { test, expect } from '@playwright/test';
   - If any network requests failed with 4xx or 500 errors, mock them with page.route() fulfilling the captured response body and status code.
   - Set the page viewport to match the recorded viewport.
   - Replay the recorded user clicks in chronological order using robust Playwright locators (e.g. page.locator, page.getByRole).
   - Assert that the error state/toast/banner appears on the page.
3. The "rootCauseSummary" MUST:
   - Clearly explain why the bug occurred in 2-3 concise sentences.
   - Include an actionable developer code fix (e.g. optional chaining, null checks, error handling).

Respond ONLY with valid JSON.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  });

  const responseText = response.text || '';
  const parsed = JSON.parse(responseText);

  return {
    playwrightTest: parsed.playwrightTest,
    rootCauseSummary: parsed.rootCauseSummary
  };
}

/**
 * Deterministic Heuristic Synthesizer (Zero-Failure Fallback)
 */
function generateWithHeuristics(incidentData) {
  const {
    errorMessage,
    errorType = 'Error',
    pageUrl = 'http://localhost:5173/demo',
    viewport = '1440x900',
    telemetry = []
  } = incidentData;

  const [width, height] = (viewport.includes('x') ? viewport.split('x') : ['1440', '900']).map(n => parseInt(n, 10) || 1440);

  // Filter events
  const networkEvents = telemetry.filter(t => t.type === 'network');
  const failedNetworks = networkEvents.filter(t => (t.status >= 400 || t.status === 0));
  const clickEvents = telemetry.filter(t => t.type === 'click');

  // Build Route Mocking code
  const routeMocks = failedNetworks.map(net => {
    let urlPattern = '**' + (net.url.startsWith('http') ? new URL(net.url).pathname : net.url) + '*';
    const status = net.status || 500;
    const bodyStr = net.responseBody ? JSON.stringify(net.responseBody, null, 6) : JSON.stringify({ error: net.error || 'Server Internal Error' });

    return `    // Mock failed network endpoint: ${net.method} ${net.url}
    await page.route('${urlPattern}', async (route) => {
      await route.fulfill({
        status: ${status},
        contentType: 'application/json',
        body: JSON.stringify(${bodyStr})
      });
    });`;
  }).join('\n\n');

  // Build Click replaying steps
  const clickSteps = clickEvents.map((clk, index) => {
    let selector = clk.selector || (clk.id ? `#${clk.id}` : clk.tagName ? clk.tagName.toLowerCase() : 'button');
    let comment = clk.innerText && clk.innerText !== '[REDACTED_PII]' ? ` // Click: "${clk.innerText}"` : '';
    return `    // Step ${index + 1}: User clicked ${clk.tagName || 'element'}${comment}
    await page.locator('${selector.replace(/'/g, "\\'")}').click({ timeout: 5000 });`;
  }).join('\n');

  // Clean Test Description
  const sanitizedTitle = (errorMessage || 'Production Crash')
    .replace(/['"\n\r]/g, ' ')
    .slice(0, 80);

  // Assemble full Playwright .spec.js script
  const playwrightTest = `import { test, expect } from '@playwright/test';

test.describe('BugReplay Incident Reproduction: ${errorType}', () => {
  test('reproduces "${sanitizedTitle}"', async ({ page }) => {
${routeMocks ? routeMocks + '\n\n' : ''}    // 1. Configure viewport matching user's device
    await page.setViewportSize({ width: ${width || 1440}, height: ${height || 900} });

    // 2. Navigate to culprit URL
    await page.goto('${pageUrl.replace(/'/g, "\\'")}');

${clickSteps ? clickSteps + '\n\n' : ''}    // 3. Assert reproduction of the error state in the DOM
    const errorIndicator = page.locator(
      '[data-testid="error-alert"], [role="alert"], .error-toast, .text-rose-500, .text-red-500'
    );
    await expect(errorIndicator.first()).toBeVisible({ timeout: 6000 });
  });
});
`;

  // Synthesize concise Root Cause Summary
  let rootCauseSummary = '';
  if (failedNetworks.length > 0) {
    const primaryFail = failedNetworks[0];
    rootCauseSummary = `The application triggered an unhandled ${errorType} following a failed ${primaryFail.method} network request to "${primaryFail.url}" which returned HTTP ${primaryFail.status}. The client UI did not implement defensive fallback handling or catch block logic for this endpoint response. Recommendation: Wrap the network call in a try/catch handler, check response.ok, and display a user-friendly error notice instead of allowing the application state to collapse.`;
  } else if (errorMessage.toLowerCase().includes('cannot read properties of undefined') || errorMessage.toLowerCase().includes('null')) {
    rootCauseSummary = `An unhandled ${errorType} was thrown: "${errorMessage}". This typically indicates that an asynchronous payload or nested object property was accessed before being populated in client state. Recommendation: Use JavaScript optional chaining (e.g. data?.property) or provide defensive initial state defaults to safeguard against uninitialized data.`;
  } else {
    rootCauseSummary = `The client runtime encountered an uncaught ${errorType}: "${errorMessage}" while navigating ${pageUrl}. User action sequence involved ${clickEvents.length} recorded clicks leading directly to the exception. Recommendation: Inspect the error stack trace, validate input arguments, and ensure all promise chains have corresponding .catch() or try/catch handlers.`;
  }

  return {
    playwrightTest,
    rootCauseSummary
  };
}
