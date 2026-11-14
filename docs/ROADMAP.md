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

### v1.4 — Developer Ecosystem & Framework SDKs (Released)
- [x] **`@bugreplay/react` Official React SDK:** React 18 & 19 compatibility with `<BugReplayProvider>`, `<BugReplayErrorBoundary>` capturing React component stack traces, custom fallback cards, `useBugReplay()` hook, and `withBugReplay()` HOC.
- [x] **`@bugreplay/next` Official Next.js SDK:** Support for App Router and Pages Router, `<BugReplayNextScript>` non-blocking layout injection, `captureNextError()` extracting Next.js error digests and route context, and `withBugReplayApi()` server route wrapping.
- [x] **Core `@bugreplay/sdk` Modern ESM & TypeScript:** Modern ES module exports map, comprehensive `.d.ts` definitions, and SSR-safe execution across Node and edge runtimes.
- [x] **Monorepo Workspaces & Comprehensive Testing:** Integrated root workspaces with 100% test pass rate across 70 unit and integration tests.

### v1.5 — In-Dashboard Playwright Test Execution & Verification Engine (Released)
- [x] **Headless Chromium Cloud Test Runner (`TestRunnerService`):** Automatic sandbox provisioning in temporary directories executing synthesized Playwright tests with list reporter, timeouts, and process lifecycle cleanup.
- [x] **Verification State Machine & Schema Migration (`005_test_execution_engine`):** Adds `test_status` (`UNTESTED`, `RUNNING`, `REPRODUCED`, `PASSED`, `ERROR`), `test_duration_ms`, `test_logs`, and durable `test_runs` history table.
- [x] **API Test Execution & History Endpoints:** `POST /api/v1/incidents/:id/run-test`, `GET /api/v1/incidents/:id/test-runs`, and `GET /api/v1/incidents/:id/test-run/latest`.
- [x] **Interactive Dashboard Execution Console:** Real-time "Run Test in Cloud" button, animated execution spinners, verification badges, collapsible macOS-style dark terminal viewer with stdout/stderr, and historical runs selector.
- [x] **Real-Time SSE Sync:** Broadcasts `test_run.started` and `test_run.completed` to auto-refresh incident details and dashboard verification badges without page reloads.

### v1.6 — Multi-User Team Management & Role-Based Access Control (RBAC) (Released)
- [x] **Hierarchical RBAC Engine & Middleware:** 4-tier permission hierarchy (`OWNER` > `ADMIN` > `MEMBER` > `VIEWER`) with rank validation and route-level authorization via `requireProjectRole(minRole)`.
- [x] **Team Database Schema Migration (`006_team_management_rbac`):** Creates indexed `project_members` and `project_invitations` tables, auto-backfilling existing projects to assign creators as `OWNER`.
- [x] **Dual Invitation & Auto-Claim Architecture (`TeamsService`):** Instant project enrollment for existing users and cryptographic token-based invitations for pending users, automatically claimed upon user registration.
- [x] **Incident & Operation Permission Guards:** Restricts destructive actions (`deleteProject`, `rotateKey`) to `OWNER`/`ADMIN`, enforces incident triaging and test execution guards against read-only `VIEWER` seats.
- [x] **Full-Featured Team Management UI:** Interactive Team & RBAC modal on Projects dashboard with role badges (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`), email invitation dispatch, dynamic role promotion/demotion, member removal, pending invitation revocation, and role permission capability guide.
- [x] **100% Automated Monorepo Coverage:** 11 dedicated team management tests in `teams.test.js`.

### v1.7 — Enterprise Audit Logs & Compliance Trail (Current Release)
- [x] **Immutable Security Audit Store (`007_enterprise_audit_logs`):** Indexed audit logging table storing actor metadata, action types, target entity references, IP addresses, client user agents, and serialized metadata diffs.
- [x] **Comprehensive Event Instrumentation (`AuditService`):** Automatic fail-safe audit capture for all critical platform events: `PROJECT_CREATED`, `PROJECT_UPDATED`, `API_KEY_ROTATED`, `MEMBER_INVITED`, `MEMBER_ROLE_CHANGED`, `MEMBER_REMOVED`, `INVITATION_REVOKED`, `INCIDENT_STATUS_CHANGED`, `INCIDENT_DELETED`, `TEST_RUN_DISPATCHED`, and `PR_CREATED`.
- [x] **SOC 2 & ISO 27001 Compliance Exports:** Dedicated export engine supporting both RFC-4180 compliant CSV downloads and structured JSON export endpoints (`GET /api/v1/projects/:id/audit-logs/export`).
- [x] **Dynamic Querying & Action Discovery:** Paginated querying with action filtering, keyword search, date bounds, and distinct action type discovery (`GET /api/v1/projects/:id/audit-logs/actions`).
- [x] **Enterprise Audit Console UI:** Sleek modal on Projects dashboard with real-time event feed, colored action badges, actor role tags, IP network details, expandable syntax-highlighted JSON diff inspector, and 1-click CSV/JSON export.
- [x] **100-Test Monorepo Milestone:** 11 dedicated audit log integration tests in `server/tests/audit.test.js` bringing total passing tests across the monorepo to 100/100 tests.

---

## 3. Long-Term Vision (v2.0+)

### v2.0 — Enterprise Fleet & Hybrid Replay
- **DOM Canvas Replay (`rrweb` Lightweight Sync):** Side-by-side visual video replay of user mouse movement synchronized with the Playwright test execution timeline.
- **Distributed SQLite Replication (Litestream / LiteFS):** Multi-region read replica deployment replicating SQLite WAL changes to Cloudflare R2 / AWS S3 with sub-second failover.
- **Sentry & Datadog Two-Way Bi-directional Sync:** Ingest Sentry issue IDs and automatically attach synthesized Playwright reproduction tests into Sentry error pages.
- **Enterprise SSO & SAML:** Okta, Google Workspace, and Microsoft Azure AD authentication for enterprise developer seats.
