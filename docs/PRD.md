# BugReplay AI — Product Requirements Document (PRD)

## 1. Product Summary
- **Product Name:** BugReplay AI
- **Category:** AI-Powered Developer Productivity & Automated E2E Debugging SaaS
- **Core Value Proposition:** *"Turn production bugs into reproducible Playwright tests automatically."*
- **Primary Objective:** Build a production-quality B2B SaaS MVP that solves the "Cannot Reproduce" developer bottleneck, ready for paying developer subscribers ($29/month).

---

## 2. Problem Statement
When end-users or QA encounter bugs in web applications:
1. **Incomplete Bug Reports:** Developers receive vague tickets (*"the checkout button didn't work"*).
2. **Missing Context:** Developers cannot see the user's browser, viewport, or the exact sequence of clicks leading to the crash.
3. **Hidden Network Failures:** 4xx/500 API responses that triggered client-side state corruption are invisible unless actively logged.
4. **Time Waste:** Developers spend 3–5 hours playing detective trying to recreate the bug locally. 60% of tickets end up closed as *"Cannot Reproduce"* or *"Works on My Machine"*.

---

## 3. Target Personas
- **Indie Developers & SaaS Solo Founders:** Need to resolve bugs quickly without dedicated QA staff.
- **Frontend & Full-Stack Engineers:** Frustrated by non-reproducible Sentry/LogRocket errors that lack actionable reproduction steps.
- **QA Automation Engineers:** Want auto-generated Playwright tests from real customer failure paths to expand regression suites.
- **Software Agencies:** Need rapid client issue diagnostics and SLA compliance.

---

## 4. Key Functional Features

### 4.1. Client-Side Capture SDK (`bugreplay.js`)
- Standalone zero-dependency vanilla JS script (< 3.5KB).
- Fixed-capacity circular Ring Buffer of 15 events.
- Intercepts clicks with selector resolution (`data-testid` > `#id` > class hierarchy > tag).
- Monkey-patches `window.fetch` to capture HTTP status, duration, method, and error payloads (stripping auth headers/cookies).
- Captures `console.error` and `console.warn`.
- Catches `window.onerror` and `unhandledrejection`.
- Centralized PII sanitizer (redacts passwords, card numbers, CVVs, `data-private` fields).
- Embedded "Report Issue" widget (`BugReplay.showReportWidget()`).
- Transmits via `navigator.sendBeacon` or fallback `fetch(..., { keepalive: true })`.

### 4.2. Ingestion & Security Pipeline
- Endpoint: `POST /api/v1/ingest`.
- API Key authentication (`x-api-key`) with SHA-256 database hashing.
- Origin domain checking (`allowed_domains`).
- Monthly quota enforcement (Free: 50, Pro: 1,000, Team: 5,000).
- Zod payload validation and server-side secondary sanitization.
- Non-blocking ingestion: persists incident, increments usage, enqueues background AI synthesis job, and returns HTTP 202 Accepted.

### 4.3. Dual-Tier Playwright & AI Synthesis Engine
- Primary Tier: Google Gemini API (model configurable via `GEMINI_MODEL`, e.g., `gemini-2.0-flash`).
- Fallback Tier: Deterministic heuristic template synthesizer (100% offline-capable).
- Output:
  - Valid, executable `@playwright/test` reproduction script (`.spec.js`).
  - Network route mocking (`page.route()`) for failed API endpoints.
  - Chronological user interaction replay.
  - Plain-English root cause diagnosis.
  - Recommended code-level fix.

### 4.4. Local Reproduction CLI (`bugreplay`)
- Commands: `login`, `configure`, `incidents`, `run <incident-id>`.
- Downloads generated `.spec.js` and executes it locally using Playwright with execution logs.

### 4.5. Web Dashboard & Interactive Demo
- Linear/Vercel high-contrast dark theme.
- `/demo` Interactive Sandbox: Real-time trigger buttons (Broken Checkout, 500 API Call, Undefined State Crash) connected to actual SDK and ingestion.
- `/dashboard`: Incident stream, filter by status/project/date, live usage progress bar.
- `/incidents/:id`: Visual breadcrumb timeline, Playwright code block with 1-click copy & download, AI root cause box.
- `/projects`: Project management, API key rotation (raw key shown once), embed snippet generator.
- `/billing`: Subscription management, quota trackers, dev tier switcher.

---

## 5. Non-Functional Requirements
- **Performance:** SDK load time < 10ms, memory overhead < 100KB, ingestion response time < 50ms (HTTP 202).
- **Security:** Zero plaintext API keys or passwords, parameterized SQL queries, strict CORS, rate limiting.
- **Reliability:** SQLite in WAL mode with busy timeout of 5000ms. AI failures never destroy stored incidents.
- **Cost:** $0 baseline infrastructure overhead, operable entirely on free tiers.
