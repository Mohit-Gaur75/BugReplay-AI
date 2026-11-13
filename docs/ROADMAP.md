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

### v1.1 — Team Collaboration & Alerting (Q1 2027)
- **Slack & Discord Webhook Alerts:** Real-time notifications when a new production incident is captured, complete with AI root cause summary and 1-click Playwright test copy.
- **GitHub Issues Integration:** Automatically create a GitHub issue containing the generated `.spec.js` file and reproduction steps with a single click.
- **Enhanced Network Payload Capture:** Configurable allowlist for non-sensitive request/response bodies to improve route mocking fidelity for complex GraphQL and REST schemas.

### v1.2 — Multi-Framework Test Synthesis (Q2 2027)
- **Cypress & Puppeteer Export:** Support toggling test output between `@playwright/test`, `cypress`, and `puppeteer`.
- **Component Test Synthesis:** Generate React Testing Library (`@testing-library/react`) unit tests directly from captured frontend component state failures.
- **Automated Fix PR Generator:** Leverage Gemini to automatically generate a GitHub Pull Request with the proposed code fix diff.

---

## 3. Long-Term Vision (v2.0+)

### v2.0 — Enterprise Fleet & Hybrid Replay
- **DOM Canvas Replay (`rrweb` Lightweight Sync):** Side-by-side visual video replay of user mouse movement synchronized with the Playwright test execution timeline.
- **Distributed SQLite Replication (Litestream / LiteFS):** Multi-region read replica deployment replicating SQLite WAL changes to Cloudflare R2 / AWS S3 with sub-second failover.
- **Sentry & Datadog Two-Way Bi-directional Sync:** Ingest Sentry issue IDs and automatically attach synthesized Playwright reproduction tests into Sentry error pages.
- **Enterprise SSO & SAML:** Okta, Google Workspace, and Microsoft Azure AD authentication for enterprise developer seats.
