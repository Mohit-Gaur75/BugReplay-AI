# BugReplay AI — Granular Implementation Roadmap & Architecture Plan

## 1. Complete Project File Tree

```
BugReplay AI/
├── README.md
├── package.json                   # Root scripts (run-all, dev, build, test)
├── docs/
│   ├── ARCHITECTURE.md            # In-depth architectural blueprint
│   ├── API_SPECIFICATION.md       # Complete REST API reference
│   ├── SDK_SPECIFICATION.md       # In-browser SDK technical spec
│   ├── PLAYWRIGHT_SYNTHESIS_ENGINE.md # Test generation mechanics
│   ├── BUSINESS_PLAN_AND_GTM.md   # SaaS unit economics & GTM playbook
│   └── IMPLEMENTATION_ROADMAP.md  # This document
├── public/
│   └── bugreplay.js               # Standalone 3KB zero-dependency SDK
├── server/
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── index.js               # Express application entrypoint
│   │   ├── db.js                  # better-sqlite3 with WAL mode & seed data
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT verification middleware
│   │   │   ├── apiKey.js          # Ingestion x-api-key validator & quota check
│   │   │   └── errorHandler.js    # Centralized HTTP error handling
│   │   ├── routes/
│   │   │   ├── auth.js            # Login, register, me
│   │   │   ├── projects.js        # CRUD for projects & plan tier updates
│   │   │   ├── ingest.js          # Incident ingestion & synthesis pipeline
│   │   │   └── incidents.js       # Incident feeds, details, status, .spec.js download
│   │   └── services/
│   │       ├── synthesizer.js     # Hybrid Playwright synthesis (AI + Heuristic)
│   │       └── piiScrubber.js     # Server-side secondary safety scrubber
│   └── tests/
│       ├── auth.test.js           # Authentication & JWT test suite
│       ├── ingest.test.js         # API key validation, quota & ingestion
│       └── synthesizer.test.js    # Playwright test generation tests
├── client/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                # Router & Theme container
│       ├── index.css
│       ├── context/
│       │   └── AuthContext.jsx    # Auth state & token storage
│       ├── components/
│       │   ├── Navbar.jsx         # Clean header with project selector
│       │   ├── CodeBlock.jsx      # Syntax-highlighted Playwright test viewer
│       │   ├── Timeline.jsx       # Chronological visual breadcrumbs
│       │   └── StatusBadge.jsx    # Incident status pill
│       └── pages/
│           ├── Dashboard.jsx      # Live incident feed & metric counters
│           ├── IncidentDetail.jsx # Visual timeline, Playwright script, AI fix box
│           ├── DemoSandbox.jsx    # Interactive bug trigger testbed (/demo)
│           ├── Settings.jsx       # Embed snippet, API keys, subscription plans
│           ├── Login.jsx          # Auth screen
│           └── Register.jsx       # Registration screen
└── cli/
    ├── package.json
    └── bin/
        └── bugreplay.js           # `npx bugreplay run <incident-id>` command
```

---

## 2. Granular Implementation Phases

### Phase 1: Database & Foundation
* **Tasks:**
  - Create `server/package.json` with dependencies: `express`, `better-sqlite3`, `dotenv`, `cors`, `helmet`, `morgan`, `zod`, `jsonwebtoken`, `bcryptjs`, `@google/genai`.
  - Configure `server/src/db.js` with SQLite in WAL mode.
  - Automatically apply table migrations: `users`, `projects`, `incidents`.
  - Auto-seed default demo account:
    - User: `demo@bugreplay.dev` / `password123`
    - Project: `Acme Storefront` (API Key: `br_live_demo_1234567890abcdef`)
    - Seed realistic initial incidents (Checkout TypeError, 500 API Crash, Unhandled Rejection).

### Phase 2: Client Capture SDK (`public/bugreplay.js`)
* **Tasks:**
  - Implement zero-dependency `public/bugreplay.js`.
  - Circular Ring Buffer of capacity 15.
  - Global `document.addEventListener('click')` with selector generation (`data-testid`, `#id`, class hierarchy).
  - Monkey-patch `window.fetch` capturing URL, method, status, duration, and error response bodies.
  - Intercept `console.error` and `console.warn`.
  - Global `window.onerror` and `window.onunhandledrejection`.
  - Zero-leak PII masking (passwords, cards, CVVs, data-private attributes).
  - Dual transport: `navigator.sendBeacon` with fallback `fetch(..., { keepalive: true })`.

### Phase 3: Ingestion API & Playwright Synthesis Engine
* **Tasks:**
  - Build `POST /api/v1/ingest`:
    - Validates `x-api-key` against `projects` table.
    - Enforces monthly quota limits (50 bugs/mo on FREE tier, 1,000 on PRO).
    - Checks `allowed_domains` if configured.
  - Build `server/src/services/synthesizer.js`:
    - Deterministic heuristic synthesizer: generates `@playwright/test` code mocking failed network endpoints via `page.route()`, simulating navigation and clicks, and asserting error conditions.
    - Gemini 2.0 Flash synthesizer: when `GEMINI_API_KEY` is present, prompt model for enhanced locators, realistic assertions, and concise root-cause diagnosis.
    - Fallback orchestration: guarantees 100% test generation even when offline.
  - Build incident retrieval endpoints:
    - `GET /api/v1/incidents` (with search and status filters).
    - `GET /api/v1/incidents/:id` (detailed record with timeline and Playwright code).
    - `PATCH /api/v1/incidents/:id/status` (toggle between OPEN and RESOLVED).
    - `GET /api/v1/incidents/:id/test-file` (download `.spec.js` file directly).

### Phase 4: Modern React Dashboard & Interactive Demo
* **Tasks:**
  - Scaffold React 19 + Vite app in `client/` with Tailwind CSS and Lucide Icons.
  - Build `/demo` Interactive Sandbox:
    - Pre-loads `bugreplay.js` with the demo project API key.
    - Interactive buttons: "Simulate Broken Checkout", "Simulate 500 Payment Gateway Timeout", "Simulate Null State Crash".
    - Instant live link to view the generated incident in the dashboard!
  - Build `/dashboard`:
    - Incident stream with severity tags, timestamps, culprit URLs, browser tags, and status pills.
    - Filter tabs (All, Open, Resolved) and search bar.
  - Build `/incidents/:id`:
    - Visual Breadcrumb Timeline (Step 1: Click, Step 2: Network 500, Step 3: Unhandled Crash).
    - Syntax-highlighted Playwright code viewer with 1-click "Copy Playwright Test" and "Download `.spec.js`".
    - AI Root Cause & Fix Recommendation card.
    - Terminal command helper: `npx bugreplay run <incident-id>`.
  - Build `/settings`:
    - Copyable embed `<script>` tag.
    - API key management.
    - Subscription tier toggle (Free, Pro, Team).

### Phase 5: Local CLI Tool (`cli/`)
* **Tasks:**
  - Build `cli/bin/bugreplay.js`.
  - Command: `npx bugreplay run <incident-id> --server=http://localhost:3001 --key=...`.
  - Downloads the generated `.spec.js` file and executes `npx playwright test`.

### Phase 6: Automated Integration Tests & Build Verification
* **Tasks:**
  - Write Node native integration test suite in `server/tests/`.
  - Verify auth registration, login, token authentication.
  - Verify project creation and API key generation.
  - Verify ingestion API with valid and invalid API keys.
  - Verify Playwright test synthesizer output.
  - Verify production client build (`npm run build`).

---

## 3. Verification & Acceptance Criteria

| Component | Target Behavior | Verification Metric |
| :--- | :--- | :--- |
| **SDK** | Rolling buffer maintains last 15 actions | Unit test + browser verification |
| **SDK** | PII masked for passwords/cards | Passwords and credit cards stored as `[REDACTED_PII]` |
| **Ingestion** | Ingests telemetry via `x-api-key` | Responds `201 Created` with generated test |
| **Synthesis** | Generates executable Playwright test | Playwright script contains `import { test }`, `page.route`, `page.click` |
| **Database** | Persistent SQLite with WAL mode | All tables initialized with Foreign Keys active |
| **Frontend** | React 19 + Tailwind UI | Zero build errors on `npm run build` |
| **CLI** | Local reproduction command | `npx bugreplay run <id>` outputs test execution steps |
| **Tests** | Automated integration tests | `node --test` passes with 100% success |
