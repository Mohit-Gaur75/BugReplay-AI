# BugReplay AI — Engineering Assumptions & Design Decisions

This document records all explicit engineering assumptions and architectural trade-offs made during the design and development of BugReplay AI.

---

## 1. Database Architecture: SQLite with Write-Ahead Logging (WAL)
- **Assumption:** A high-performance, single-instance SQLite database running in WAL mode with a 5000ms busy timeout can comfortably support early-to-mid stage B2B workloads (up to 100,000 incidents/month and ~50 concurrent requests).
- **Rationale:** Eliminates recurring cloud database hosting fees ($0/month baseline overhead), provides sub-millisecond query performance via in-process bindings, and simplifies local development and self-hosting.
- **Scaling Path:** If traffic scales beyond single-node write capacity, the storage interface is structured to swap to PostgreSQL without modifying business logic.

---

## 2. In-Memory Ring Buffer Capacity (15 Events)
- **Assumption:** A fixed rolling buffer of 15 events (clicks, navigations, console logs, failed network requests) is sufficient to capture >95% of causal bug chains in modern single-page applications.
- **Rationale:** Keeps SDK memory footprint strictly bounded ($O(1)$) and ingestion payload size under 15KB. Prevents performance degradation on low-end client devices.

---

## 3. Cryptographic API Key Management
- **Assumption:** Storing only the SHA-256 hash of project API keys (`br_live_...`) in the database provides maximum security against database exfiltration.
- **Rationale:** Similar to password hashing, if the database file is compromised, attackers cannot forge incident telemetry. Developers are shown the full API key only once upon project creation or rotation.

---

## 4. Asynchronous AI Generation via SQLite Job Queue
- **Assumption:** Ingestion requests (`POST /api/v1/ingest`) must never block waiting for external LLM API calls.
- **Rationale:** Large Language Model API calls take between 1,000ms to 4,000ms. Ingestion must respond in < 50ms with `HTTP 202 Accepted`. A durable SQLite `jobs` table handles background synthesis with automatic retries and exponential backoff.

---

## 5. Dual-Tier Synthesizer (Gemini 2.0 Flash + Heuristic Fallback)
- **Assumption:** An application should never fail to generate a reproduction test simply because an external AI API key is missing, invalid, or out of quota.
- **Rationale:** BugReplay AI guarantees 100% test generation uptime by implementing a deterministic heuristic synthesizer that maps captured DOM selectors, network mocks, and click paths into valid `@playwright/test` scripts even in 100% offline environments.

---

## 6. Zero Server-Side Code Execution
- **Assumption:** Running AI-synthesized Playwright tests on the backend introduces severe remote code execution (RCE) and security vulnerabilities.
- **Rationale:** BugReplay AI treats all generated tests as source code artifacts. Tests are executed exclusively on the developer's local machine via `npx bugreplay run <incident-id>` after developer inspection.

---

## 7. Monetization & Payment Provider Abstraction
- **Assumption:** Early-stage developer testing requires seamless plan switching without charging real credit cards, while the production codebase must be structured for payment gateways (Stripe / Razorpay).
- **Rationale:** Plan entitlements (Free: 50 bugs, Pro: 1,000 bugs, Team: 5,000 bugs) are strictly enforced in the database. A development simulation toggle allows instant plan upgrades during testing, cleanly separated from production webhook handlers.

---

## 8. Monorepo Organization & npm Workspaces
- **Assumption:** Organizing frontend (`client/`), backend (`server/`), capture script (`sdk/`), and terminal runner (`cli/`) inside an npm workspace monorepo provides optimal developer velocity and version synchronization.
- **Rationale:** Allows single-command dependency installation (`npm install`) and unified testing (`npm test`).
