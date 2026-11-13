# BugReplay AI — System Architecture Specification

## 1. System Topology & Architectural Philosophy

BugReplay AI is built as a **modular monolith** with clean logical separation between:
- **Client Capture SDK (`sdk/`)**: Zero-dependency browser package.
- **Backend API & Ingestion Engine (`server/`)**: Express.js with ES Modules, SQLite WAL storage, and durable background job queue.
- **Frontend Dashboard (`client/`)**: React 19 + Vite + Tailwind CSS high-contrast UI.
- **Local Reproduction CLI (`cli/`)**: Developer terminal companion tool.

### Architecture Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Client Browser Context                          │
│                                                                        │
│   DOM Interactions    Fetch/XHR Requests      Console Logs / Errors    │
│         │                    │                          │              │
│         ▼                    ▼                          ▼              │
│   ┌─────────────┐     ┌──────────────┐          ┌───────────────┐      │
│   │ Click Trap  │     │ Fetch Monkey │          │ Console Trap  │      │
│   └──────┬──────┘     └──────┬───────┘          └───────┬───────┘      │
│          │                   │                          │              │
│          └───────────────────┼──────────────────────────┘              │
│                              ▼                                         │
│                 ┌──────────────────────────┐                           │
│                 │  PII Sanitization Layer  │                           │
│                 └────────────┬─────────────┘                           │
│                              ▼                                         │
│                 ┌──────────────────────────┐                           │
│                 │  Rolling Ring Buffer     │ (Capacity: 15 Events)     │
│                 └────────────┬─────────────┘                           │
│                              │ On Unhandled Error / Manual Report      │
│                              ▼                                         │
│                 ┌──────────────────────────┐                           │
│                 │ Telemetry Dispatcher     │                           │
│                 │ (sendBeacon / KeepAlive) │                           │
│                 └────────────┬─────────────┘                           │
└──────────────────────────────┼─────────────────────────────────────────┘
                               │ POST /api/v1/ingest
                               │ Header: x-api-key: br_live_...
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        BugReplay Backend Engine                        │
│                                                                        │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │ HTTP Ingress (Express + Helmet + CORS + Rate Limiter)         │    │
│   └──────────────────────────────┬────────────────────────────────┘    │
│                                  ▼                                     │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │ API Key Hash Validator (SHA-256 against projects.api_key_hash)│    │
│   │ Allowed Domains & Quota Gatekeeper                            │    │
│   └──────────────────────────────┬────────────────────────────────┘    │
│                                  ▼                                     │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │ Persistent Storage (better-sqlite3 in WAL mode)               │    │
│   │  • Insert Incident (generation_status: 'PENDING')             │    │
│   │  • Increment Usage Record (Transactionally)                   │    │
│   │  • Enqueue Job into 'jobs' table                              │    │
│   │  • Respond HTTP 202 Accepted immediately                      │    │
│   └──────────────────────────────┬────────────────────────────────┘    │
│                                  ▼                                     │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │ Durable Background AI Job Worker                              │    │
│   │  • Polls jobs table with retry & exponential backoff          │    │
│   │  • Primary: Gemini API with structured JSON output            │    │
│   │  • Fallback: Deterministic Heuristic Synthesizer (offline)    │    │
│   │  • Updates incident with Playwright test & AI Root Cause      │    │
│   └───────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Telemetry Ingestion & PII Masking Pipeline

### Client-Side PII Masking
1. **Target Attributes:** Form controls with `type="password"`, `name="card"`, `name="cvv"`, `name="ssn"`, `data-private`, or `data-mask` are immediately replaced with `[REDACTED_PII]`.
2. **Card Pattern Matching:** Luhn-valid 13-19 digit card patterns in text or network bodies are masked with `••••-••••-••••-••••`.
3. **Sensitive Header Stripping:** `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key` are deleted before network entries are stored.
4. **URL Sanitization:** Query parameters matching `token`, `secret`, `key`, `auth`, `password` are redacted.

### Server-Side Secondary Scrubbing
All incoming telemetry is validated using Zod schemas and subjected to a secondary server-side regex scrubber before database insertion.

---

## 3. Storage Layer: SQLite with WAL Mode

BugReplay AI uses `better-sqlite3` configured with:
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -64000;
```

### High-Concurrency & Zero-Cost Benefits:
- **No Hosting Cost:** Stored on local disk or persistent container volume ($0/month).
- **WAL Concurrency:** Readers do not block writers, and writers do not block readers.
- **Fast Transactions:** In-process C++ bindings execute in microseconds without TCP/network overhead.
- **Busy Timeout:** 5,000ms timeout prevents `SQLITE_BUSY` errors during concurrent bursts.

---

## 4. Asynchronous Synthesis Engine & Job Queue

To ensure the Ingestion API maintains sub-50ms response times:
1. `POST /api/v1/ingest` persists the raw incident and inserts a record into the `jobs` table:
   ```json
   { "type": "AI_SYNTHESIS", "payload": { "incidentId": "UUID" }, "status": "PENDING" }
   ```
2. The endpoint responds immediately with `HTTP 202 Accepted`.
3. A background job runner polls the `jobs` table, processes synthesis, and updates `generation_status` to `COMPLETED` (or `FAILED` if retries exceed 3).
4. **Failure Resiliency:** A failure in the AI module will **never** delete or corrupt the stored incident record.

---

## 5. Security Threat Model

| Threat | Mitigation |
| :--- | :--- |
| **API Key Theft from Database** | Raw keys (`br_live_...`) are never stored. Only their SHA-256 hash is persisted in the database. |
| **Ingestion Abuse / Flooding** | Per-IP rate limiting (100 req/min), per-project rate limiting (500 req/min), and strict monthly plan quotas. |
| **Cross-Origin Telemetry Hijacking** | Projects specify `allowed_domains` which are verified against incoming `Origin` and `Referer` headers. |
| **SQL Injection** | 100% parameterized queries using `better-sqlite3` prepared statements. |
| **Cross-User Data Leakage** | All database queries on projects, incidents, and settings enforce `WHERE user_id = ?` or `WHERE project_id IN (SELECT id FROM projects WHERE user_id = ?)`. |
| **Untrusted Code Execution** | AI-generated Playwright scripts are stored as text and executed only by the developer on their local machine via the CLI. The backend never executes generated test code. |
