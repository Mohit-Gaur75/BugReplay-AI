# BugReplay AI — Security, Privacy & Compliance Policy

## 1. Security Architecture Overview

BugReplay AI is designed with **defense-in-depth** across client capture, network transport, API ingress, and persistent storage.

```
[ Browser Client SDK ] ──► PII Redaction & Auth Header Stripping
           │
           ▼ (HTTPS / TLS 1.3)
[ Ingress Security ] ────► Helmet Headers, CORS Allowlist, Rate Limiting
           │
           ▼
[ API Authentication ] ──► SHA-256 Hashed Project Keys & bcrypt JWTs
           │
           ▼
[ Storage Engine ] ──────► Parameterized SQLite Queries (Zero SQLi)
           │
           ▼
[ AI Synthesis ] ────────► Isolated Sandboxed Generation (Zero Server Execution)
```

---

## 2. API Key Management & Cryptographic Hashing

1. **Format:** `br_live_<32_random_bytes>` (cryptographically generated using `crypto.randomBytes(32)`).
2. **Never Stored in Plaintext:** Only the SHA-256 hash `SHA256(raw_key)` is stored in the `projects` table.
3. **Single Exposure:** The full plaintext API key is displayed **exactly once** upon initial project creation or explicit rotation.
4. **Key Verification:** Incoming `x-api-key` headers are hashed and matched against the database using constant-time string comparison (`crypto.timingSafeEqual`) to prevent timing attacks.

---

## 3. Data Protection & PII Sanitization

### Client-Side Masking
- The SDK automatically replaces values from inputs of type `password`, `card`, `cvv`, or tagged with `data-private` or `data-mask` with `[REDACTED_PII]`.
- Regex filters scan for Luhn-valid 13-19 digit credit card numbers and replace them with `••••-••••-••••-••••`.
- Network telemetry automatically strips `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie`, and `X-Api-Key` headers.

### Limitations of Client-Side Masking
> [!WARNING]
> Client-side regex and DOM attribute masking provide strong baseline protection, but developers should not place unencrypted medical records or unmasked government identifiers in unannotated DOM elements. Always apply `data-private` to custom sensitive containers.

### Server-Side Secondary Scrubbing
All incoming telemetry passes through a secondary server-side sanitizer before persistence to guard against manipulated client payloads.

---

## 4. API Ingress & Rate Limiting Controls

- **CORS Policies:** Configurable per project via `allowed_domains`. Pre-flight `OPTIONS` requests are strictly validated against registered domains.
- **Rate Limiting:**
  - Ingestion: Capped at 100 requests/minute per client IP and 500 requests/minute per project API key.
  - Authentication (`/login`, `/register`): Capped at 10 requests/minute per IP to defeat brute-force credential stuffing.
- **Payload Size Limits:** Max 100KB per ingestion payload. Oversized payloads return `413 Payload Too Large`.

---

## 5. Safe Execution Policy (Zero Server-Side Code Execution)

**Critical Security Guarantee:**
- The backend engine **NEVER** executes AI-generated Playwright code on the server.
- Generated tests are stored purely as text files and provided to the developer to inspect and run on their local machine via `npx bugreplay run <incident-id>`.
- The CLI prompts the developer and provides full transparency into the generated script before execution.

---

## 6. Telemetry Retention & Data Lifecycle

| Plan Tier | Retention Period | Purge Mechanism |
| :--- | :--- | :--- |
| **FREE** | 7 Days | Automated rolling purge |
| **PRO** | 30 Days | Automated rolling purge |
| **TEAM** | 90 Days | Automated rolling purge |

Users can trigger immediate permanent deletion of an incident or an entire project at any time via the API or dashboard.
