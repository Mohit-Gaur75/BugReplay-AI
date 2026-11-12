# BugReplay AI

> **From Production Crash to Passing Playwright Test in 5 Seconds.**  
> Automatically convert unhandled browser errors, user click paths, and failed network calls into runnable Playwright End-to-End tests (`.spec.js`) and AI root-cause diagnostics.

---

## The Problem
When users or QA encounter production bugs (*"The checkout button gave me an error and wouldn't submit"*), developers spend 3–5 hours playing detective:
- Which browser and OS?
- What was the exact sequence of clicks and inputs?
- Did a backend API call fail with a 500 or timeout?
- **60% of bug tickets end up closed as *"Cannot Reproduce"* or *"Works on My Machine"*.**

## The Solution
**BugReplay AI** captures the critical moments leading up to a production bug and turns them into code:
1. **Lightweight In-Browser SDK (`bugreplay.js`):** A 3KB zero-dependency script keeping a rolling ring buffer of the last 15 user actions (clicks, navigation, failed fetches, console errors) with automated PII masking for passwords and credit cards.
2. **Ingestion API:** Unhandled exceptions or user reports trigger an immediate telemetry dispatch to your secure backend.
3. **AI Test Synthesizer:** Analyzes the stack trace, click path, and network responses to generate a clean, executable **Playwright E2E Test (`.spec.js`)** that mocks failed network endpoints and replays user clicks.
4. **1-Click Local Reproduction:** Developers copy the generated test or run `npx bugreplay run <incident-id>` to reproduce the exact crash locally in 5 seconds.

---

## High-Level Architecture

```
[ Client Browser Application ]
       │
       ▼
 [ bugreplay.js (3KB SDK) ]
   ├── Ring Buffer (Last 15 Events)
   ├── DOM Click Interceptor
   ├── Network Fetch Proxy
   └── PII Stripper (Passwords/Cards)
       │
       ▼ (navigator.sendBeacon)
 [ BugReplay Ingestion API ] ──(x-api-key)──► [ SQLite (WAL Mode) ]
       │
       ▼
 [ Playwright Synthesis Engine ]
   ├── Primary: Google Gemini 2.0 Flash
   └── Fallback: Rule-Based Heuristic Synthesizer
       │
       ▼
 ┌──────────────────────────────────────────┐
 │           Developer Workflows            │
 ├────────────────────┬─────────────────────┤
 │ Web Dashboard      │ Local CLI           │
 │ (Visual Timeline,  │ npx bugreplay run   │
 │  Playwright Viewer)│ (5-sec local repro) │
 └────────────────────┴─────────────────────┘
```

---

## Key Features

- **Zero-Dependency 3KB SDK:** Non-blocking, drop-in snippet (`<script src=".../bugreplay.js" data-api-key="br_live_..."></script>`).
- **Rolling Ring Buffer:** Keeps memory bounded at $O(1)$; only the last 15 events preceding a crash are retained.
- **Zero-Leak PII Sanitizer:** Automatically scrubs passwords, credit cards (Luhn-compliant), CVVs, and `data-private` elements.
- **Deterministic & AI Synthesis:** High-speed Gemini 2.0 Flash synthesis with an offline-capable deterministic heuristic fallback.
- **Visual Breadcrumb Timeline:** Chronological step-by-step breakdown of user clicks, console logs, and network failures.
- **Playwright Test Generation:** Synthesizes clean `@playwright/test` scripts with `page.route()` API mocking and locator assertions.
- **Local CLI Runner:** `npx bugreplay run <id>` boots Playwright and executes the test locally.
- **Interactive Sandbox (`/demo`):** Pre-built sandbox to trigger real-world ecommerce and SaaS errors and watch them replay instantly.

---

## Zero-Cost Tech Stack

Built to operate with **$0 overhead** on free tiers:
- **Backend:** Node.js (v18+) + Express (ES Modules) + Helmet + CORS + Morgan + Zod.
- **Database:** SQLite with Write-Ahead Logging (`better-sqlite3`) — sub-millisecond queries, zero hosting bills.
- **Frontend:** React 19 + Vite + Tailwind CSS + Lucide Icons + Prism / Syntax Highlighting.
- **AI Synthesis:** Google Gemini 2.0 Flash API with deterministic fallback.
- **CLI:** Node.js CLI script for 1-command Playwright reproduction.

---

## Documentation Directory

Explore the complete technical and business documentation:

- [System Architecture](docs/ARCHITECTURE.md) — Comprehensive technical blueprint, data flows, and threat model.
- [API Specification](docs/API_SPECIFICATION.md) — Complete REST API contract for Ingestion, Auth, Projects, and Incidents.
- [Client SDK Specification](docs/SDK_SPECIFICATION.md) — Deep-dive into `bugreplay.js` mechanics and PII masking.
- [Playwright Synthesis Engine](docs/PLAYWRIGHT_SYNTHESIS_ENGINE.md) — Heuristic + AI synthesis algorithms and test structure.
- [Implementation Roadmap](docs/IMPLEMENTATION_ROADMAP.md) — Step-by-step development phases and verification checklists.
- [Business Plan & 30-Day GTM](docs/BUSINESS_PLAN_AND_GTM.md) — Pricing tiers, unit economics, and 30-day customer acquisition playbook.

---

## License
MIT License. Built for engineering teams that demand fast, reproducible bug resolution.
