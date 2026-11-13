# BugReplay AI — Testing & Verification Strategy

## 1. Testing Philosophy

BugReplay AI enforces a **zero-mocking rule for database logic** by executing backend integration tests against an isolated SQLite test database.
- **Test Runner:** Native Node.js test runner (`node --test`).
- **HTTP Assertion Library:** Supertest.
- **Database Isolation:** Every test suite provisions a fresh, isolated temporary database (`server/tests/test.db`) or in-memory instance, ensuring zero contamination of development or production data.

---

## 2. Test Suites Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Automated Test Matrix                           │
├─────────────────────┬──────────────────┬───────────────────────────────┤
│ Module              │ File Location    │ Core Scenarios Tested         │
├─────────────────────┼──────────────────┼───────────────────────────────┤
│ Authentication      │ auth.test.js     │ • Successful user register    │
│                     │                  │ • Duplicate email rejection   │
│                     │                  │ • Valid login & JWT issue     │
│                     │                  │ • Invalid password rejection  │
│                     │                  │ • Protected route rejection   │
├─────────────────────┼──────────────────┼───────────────────────────────┤
│ Project Management  │ projects.test.js │ • Project creation & API key  │
│                     │                  │ • Key hashing verification    │
│                     │                  │ • Key rotation & old key drop │
│                     │                  │ • Cross-user isolation        │
├─────────────────────┼──────────────────┼───────────────────────────────┤
│ Telemetry Ingestion │ ingest.test.js   │ • Valid API key acceptance    │
│                     │                  │ • Invalid/missing key 401     │
│                     │                  │ • Allowed domains enforcement │
│                     │                  │ • Monthly quota rejection 429 │
│                     │                  │ • Job enqueue & HTTP 202      │
├─────────────────────┼──────────────────┼───────────────────────────────┤
│ Incident Management │ incidents.test.js│ • Listing with pagination     │
│                     │                  │ • Search by error & URL       │
│                     │                  │ • Status update (OPEN->RESOLV)│
│                     │                  │ • .spec.js file download      │
│                     │                  │ • Strict tenant isolation     │
├─────────────────────┼──────────────────┼───────────────────────────────┤
│ AI & Playwright     │ ai.test.js       │ • Structured schema validation│
│ Synthesis           │                  │ • Deterministic rule fallback │
│                     │                  │ • Playwright syntax validity  │
│                     │                  │ • Route mocking generation    │
├─────────────────────┼──────────────────┼───────────────────────────────┤
│ Client SDK          │ sdk.test.js      │ • Ring buffer capacity (15)   │
│                     │                  │ • Password/Card PII masking   │
│                     │                  │ • Fetch error interception    │
│                     │                  │ • Selector generation         │
├─────────────────────┼──────────────────┼───────────────────────────────┤
│ CLI Tool            │ cli.test.js      │ • Command parsing             │
│                     │                  │ • Incident spec download      │
│                     │                  │ • Playwright execution check  │
└─────────────────────┴──────────────────┴───────────────────────────────┘
```

---

## 3. Running Automated Tests

### Run Full Test Suite
```bash
npm test
```

### Run Server Integration Tests Only
```bash
npm run test:server
```

### Run SDK Unit Tests Only
```bash
npm run test:sdk
```

---

## 4. End-to-End Manual Verification Checklist

Before deploying any production release, the following manual verification must pass on `localhost`:
1. [ ] Start the backend on `http://localhost:5000` and frontend on `http://localhost:5173`.
2. [ ] Register a new developer account.
3. [ ] Create a project named "Sandbox App" and copy the generated API key.
4. [ ] Navigate to `/demo` and confirm the interactive sandbox loads.
5. [ ] Click "Trigger Broken Checkout" and verify the live telemetry indicator records clicks and 500 error.
6. [ ] Confirm the incident appears in `/dashboard` within 2 seconds.
7. [ ] Open the incident details page (`/incidents/:id`), verify the chronological timeline matches user clicks, and verify the generated Playwright test contains valid `page.route()` and `page.click()` steps.
8. [ ] Click "Download .spec.js" and verify the file downloads cleanly.
9. [ ] Run `npx bugreplay run <incident-id>` in the terminal and verify local test reproduction.
10. [ ] Mark the incident as `RESOLVED` and confirm badge updates across the UI.
