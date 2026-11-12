# BugReplay AI — System Architecture Specification

## 1. Architectural Philosophy

BugReplay AI is designed on three core engineering principles:
1. **Zero Client Performance Overhead:** The browser SDK must never degrade the host application's performance. It executes asynchronously, uses an $O(1)$ circular ring buffer capped at 15 items, and relies on non-blocking beacon transports (`navigator.sendBeacon`).
2. **Zero-Leak PII Privacy:** User passwords, credit cards, CVVs, and designated sensitive fields are sanitized in memory *before* being recorded in the ring buffer. Sensitive headers (such as `Authorization` and `Cookie`) are stripped from network logs.
3. **Deterministic Reliability:** AI provides intelligent root-cause diagnosis, but test generation must never fail if an external LLM is unreachable or out of quota. The backend guarantees 100% test synthesis through an intelligent deterministic fallback engine.

---

## 2. End-to-End System Architecture

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
│                 │  Rolling Ring Buffer     │ (Fixed Capacity: 15)      │
│                 └────────────┬─────────────┘                           │
│                              │ On Unhandled Exception / Manual Report   │
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
│   │ Project & Quota Gatekeeper (Validate API Key, Monthly Quota)  │    │
│   └──────────────────────────────┬────────────────────────────────┘    │
│                                  ▼                                     │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │ Playwright Synthesis Engine                                   │    │
│   │  ├── Route Mocking Generator (Fulfill 4xx/500 responses)      │    │
│   │  ├── Locator & Interaction Step Generator                     │    │
│   │  ├── Error Assertion Synthesizer                              │    │
│   │  └── Gemini 2.0 Flash / Heuristic Diagnostic Engine           │    │
│   └──────────────────────────────┬────────────────────────────────┘    │
│                                  ▼                                     │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │ SQLite Storage Engine (WAL Mode via better-sqlite3)           │    │
│   │  ├── users, projects, incidents, quotas                       │    │
│   └───────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Telemetry Event Schema

The client ring buffer captures events conforming to the following typed JSON structures:

### 3.1. Click Event
```json
{
  "type": "click",
  "timestamp": 1710328492000,
  "tagName": "BUTTON",
  "id": "checkout-submit",
  "className": "btn btn-primary px-4",
  "selector": "button#checkout-submit",
  "innerText": "Place Order ($49.00)",
  "xpath": "//button[@id='checkout-submit']",
  "coordinates": { "x": 420, "y": 890 }
}
```

### 3.2. Network Event (Fetch/XHR)
```json
{
  "type": "network",
  "timestamp": 1710328492500,
  "method": "POST",
  "url": "/api/v1/checkout",
  "status": 500,
  "durationMs": 245,
  "requestBody": {
    "itemCount": 2,
    "paymentToken": "[REDACTED_PII]"
  },
  "responseBody": {
    "error": "PaymentGatewayTimeout",
    "code": "PG_TIMEOUT_504"
  }
}
```

### 3.3. Console Event
```json
{
  "type": "console",
  "timestamp": 1710328492750,
  "level": "error",
  "message": "Failed to load resource: the server responded with a status of 500 (Internal Server Error)"
}
```

### 3.4. Navigation Event
```json
{
  "type": "navigation",
  "timestamp": 1710328485000,
  "from": "https://app.example.com/cart",
  "to": "https://app.example.com/checkout"
}
```

### 3.5. Unhandled Crash Event
```json
{
  "type": "crash",
  "timestamp": 1710328493000,
  "errorType": "TypeError",
  "message": "Cannot read properties of undefined (reading 'transactionId')",
  "stack": "TypeError: Cannot read properties of undefined (reading 'transactionId')\n    at handleCheckoutResponse (checkout.js:84:22)\n    at async onSubmit (checkout.js:112:9)",
  "pageUrl": "https://app.example.com/checkout",
  "viewport": "1440x900",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36..."
}
```

---

## 4. PII Scrubbing & Data Hygiene Engine

Data protection is enforced at the edge before storage:
1. **Attribute-Based Masking:**
   - Elements with `type="password"`, `type="hidden"` (if name contains secret tokens).
   - Elements with attributes `data-private`, `data-mask`, `data-testid="*sensitive*"` have input values replaced with `[REDACTED_PII]`.
   - Form fields with name or id matching: `/password|passwd|card|credit|cvv|cvc|ssn|secret|token|auth/i`.
2. **Text Regex Scrubbing:**
   - **Credit Card Numbers:** Matched against Luhn-valid 13-19 digit card patterns: `\b(?:\d[ -]*?){13,19}\b`.
   - **Email Addresses:** (Optional toggle, partially masked as `j***@domain.com`).
   - **Bearer Tokens:** Matches `Bearer [A-Za-z0-9\-._~+/]+=*`.
3. **HTTP Header Stripping:**
   - `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key` are automatically stripped from any network logging telemetry.

---

## 5. Storage Architecture (SQLite with WAL Mode)

BugReplay AI leverages SQLite via `better-sqlite3` configured with:
```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -64000; -- 64MB cache
```

### Advantages for Solo-Founder Zero-Cost Deployment:
- **No Database Hosting Fees:** Can be hosted on any persistent disk container (Render, Railway, Fly.io, VPS) with 0 database cloud cost.
- **Microsecond Latencies:** In-process C++ bindings eliminate network latency between backend and database.
- **High Concurrency:** WAL (Write-Ahead Logging) allows concurrent read transactions to execute without being blocked by write transactions.
- **Zero Configuration:** Database files are portable, backupable via standard file copying, and easily verifiable.

---

## 6. Threat Model & Security Controls

| Threat Vector | Mitigation Strategy |
| :--- | :--- |
| **Telemetry Ingestion Spam** | Ingestion endpoints are rate-limited (100 req/min per IP, 500 req/min per project). API keys are hashed in cache for lookup. |
| **Cross-Origin Telemetry Abuse** | The `projects` table maintains an `allowed_domains` field. Ingestion verifies the incoming `Origin` and `Referer` headers match project configurations. |
| **SQL Injection** | All SQL queries are strictly compiled using parameterized queries (`better-sqlite3` prepared statements). |
| **Cross-Site Scripting (XSS)** | React auto-escapes user telemetry rendered in the dashboard. Code snippets are rendered through specialized syntax highlighters without `dangerouslySetInnerHTML`. |
| **Authentication & Session Hijacking** | JWTs with expiration (7 days), signed with high-entropy HMAC-SHA256 secrets. Passwords hashed using `bcrypt` (10 rounds). |
