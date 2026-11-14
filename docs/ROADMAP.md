# BugReplay AI — Product & Technical Roadmap

## 1. MVP Scope (Current Release — v1.0)
The current implementation encompasses:
- [x] In-browser 3KB zero-dependency capture SDK (`bugreplay.js`) with 15-event ring buffer.
- [x] Automated PII masking for passwords, credit cards, CVVs, and `data-private` elements.
- [x] Express.js backend with SQLite WAL storage and SHA-256 API key hashing.
- [x] Dual-tier Playwright test synthesis engine (Gemini 2.0 Flash + deterministic heuristic fallback).
- [x] Asynchronous background synthesis worker with durable SQLite `jobs` queue.
- [x] React 19 Developer Dashboard with Linear/Vercel dark-first design.
- [x] Chronological breadcrumb visual timeline and Playwright code viewer with 1-click copy/download.
- [x] Interactive `/demo` sandbox page with 3 realistic error scenarios.
- [x] Local reproduction CLI (`npx bugreplay run <incident-id>`).
- [x] Plan tier quota enforcement (Free: 50, Pro: 1,000, Team: 5,000).
- [x] Complete automated integration test suite (`node --test`).

---

## 2. Near-Term Milestones (v1.1 - v1.2)

### v1.1 — Team Collaboration & Multi-Framework Export (Released)
- [x] **Slack & Discord Webhook Alerts:** Real-time notifications when a new production incident is captured, complete with AI root cause summary and 1-click Playwright test copy.
- [x] **GitHub Issues 1-Click Export:** Automatically generates formatted Markdown issue reports containing the error stack, AI diagnosis, suggested fix, and reproduction tests with direct link to GitHub.
- [x] **Multi-Framework Test Export (Cypress & Puppeteer):** Interactive framework switcher tab in dashboard allowing instant conversion and download of tests as Playwright (`.spec.js`), Cypress (`.cy.js`), or Puppeteer (`.js`).
- [x] **Enhanced Network Payload Capture:** Configurable allowlist (`data-capture-body-urls` / `captureBodyUrls`) for request/response bodies with automated PII & credit-card redaction, improving route mocking fidelity for complex GraphQL and REST APIs.

### v1.2 — Developer Tools & Synthesis Acceleration (Released)
- [x] **1-Click cURL Reproduction:** Instant cURL command generator with captured headers, method, and allowlisted payload data.
- [x] **Component Test Synthesis (React Testing Library):** Converts Playwright telemetry into `@testing-library/react` + `vitest` unit tests with mocked global `fetch`.
- [x] **Unified Git Patch (`fix.patch`) Generator:** Exports a standardized Git patch with test reproduction suite ready for `git apply fix.patch`.
- [x] **Automated Fix PR Generator:** Direct GitHub Pull Request creation via GitHub REST API pushing synthesized `.spec.js` test suites and opening PRs directly in the user's repository.

### v1.3 — Advanced Backend & Enterprise Reliability (Released)
- [x] **Canonical Incident Fingerprinting & Deduplication:** Normalized SHA-256 error hashes scrubbing transient UUIDs, timestamps, and line numbers to group recurring production crashes, prevent telemetry storms, and track `occurrence_count`.
- [x] **Resilient Circuit Breaker for External AI APIs:** 3-state state machine (Closed, Open, Half-Open) providing sub-millisecond fail-fast to deterministic heuristic synthesis when external LLMs experience rate limits or outages.
- [x] **Distributed Worker Job Leasing:** Atomic worker lease locks (`status='PROCESSING'`, `locked_by`, `locked_at`) with automatic stale worker reclamation (>60s) and exponential backoff retry scheduling.
- [x] **Prometheus / OpenMetrics Telemetry Exporter (`GET /metrics`):** Production metrics tracking HTTP request counts, latency histograms, queue backlog depth, memory RSS, and active SSE subscribers.
- [x] **Cloud & Kubernetes Probes (`/health/live`, `/health/ready`):** Deep subsystem readiness checks validating SQLite write transactions, queue saturation, and circuit health.
- [x] **Real-Time Server-Sent Events (SSE) Stream (`/api/v1/incidents/stream`):** Instant browser updates for newly ingested incidents, recurring occurrences, and completed Playwright scripts without client polling.
- [x] **Sliding-Window Rate Limiting & Correlation IDs:** Multi-tier rate limiting with RFC-compliant headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) and `X-Request-Id` tracing.

### v1.4 — Developer Ecosystem & Framework SDKs (Current Release)
- [x] **`@bugreplay/react` Official React SDK:** React 18 & 19 compatibility with `<BugReplayProvider>`, `<BugReplayErrorBoundary>` capturing React component stack traces, custom fallback cards, `useBugReplay()` hook, and `withBugReplay()` HOC.
- [x] **`@bugreplay/next` Official Next.js SDK:** Support for App Router and Pages Router, `<BugReplayNextScript>` non-blocking layout injection, `captureNextError()` extracting Next.js error digests and route context, and `withBugReplayApi()` server route wrapping.
- [x] **Core `@bugreplay/sdk` Modern ESM & TypeScript:** Modern ES module exports map, comprehensive `.d.ts` definitions, and SSR-safe execution across Node and edge runtimes.
- [x] **Monorepo Workspaces & Comprehensive Testing:** Integrated root workspaces with 100% test pass rate across 70 unit and integration tests.

---

## 3. Long-Term Vision (v2.0+)

### v2.0 — Enterprise Fleet & Hybrid Replay
- **DOM Canvas Replay (`rrweb` Lightweight Sync):** Side-by-side visual video replay of user mouse movement synchronized with the Playwright test execution timeline.
- **Distributed SQLite Replication (Litestream / LiteFS):** Multi-region read replica deployment replicating SQLite WAL changes to Cloudflare R2 / AWS S3 with sub-second failover.
- **Sentry & Datadog Two-Way Bi-directional Sync:** Ingest Sentry issue IDs and automatically attach synthesized Playwright reproduction tests into Sentry error pages.
- **Enterprise SSO & SAML:** Okta, Google Workspace, and Microsoft Azure AD authentication for enterprise developer seats.
