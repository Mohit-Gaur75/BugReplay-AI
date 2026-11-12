# BugReplay AI — REST API Specification

**API Version:** `v1`  
**Base URL:** `/api/v1`  
**Standard Response Formats:** JSON (`application/json`) and Playwright Script (`application/javascript` or `text/plain`).

---

## 1. Authentication & Security Headers

### User Requests (Dashboard & CLI)
Protected endpoints require a standard Bearer token header:
```http
Authorization: Bearer <jwt_token>
```

### Ingestion Telemetry Requests (SDK)
Client ingestion uses project-scoped API keys:
```http
x-api-key: br_live_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d
```

---

## 2. Authentication Endpoints

### 2.1. Register Account
`POST /api/v1/auth/register`

**Request Body:**
```json
{
  "email": "developer@company.com",
  "password": "SecurePassword123!"
}
```

**Success Response (201 Created):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "usr_4f81b1d7-2c1b-4ef1-998a-7e3e9d8b74c2",
    "email": "developer@company.com",
    "plan_tier": "FREE",
    "created_at": "2026-11-13T00:50:00.000Z"
  }
}
```

### 2.2. Login
`POST /api/v1/auth/login`

**Request Body:**
```json
{
  "email": "developer@company.com",
  "password": "SecurePassword123!"
}
```

**Success Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "usr_4f81b1d7-2c1b-4ef1-998a-7e3e9d8b74c2",
    "email": "developer@company.com",
    "plan_tier": "FREE"
  }
}
```

### 2.3. Current User Context
`GET /api/v1/auth/me`  
*Requires Authorization Header.*

**Success Response (200 OK):**
```json
{
  "user": {
    "id": "usr_4f81b1d7-2c1b-4ef1-998a-7e3e9d8b74c2",
    "email": "developer@company.com",
    "plan_tier": "PRO",
    "created_at": "2026-11-13T00:50:00.000Z"
  }
}
```

---

## 3. Project Management Endpoints

### 3.1. List Projects
`GET /api/v1/projects`  
*Requires Authorization Header.*

**Success Response (200 OK):**
```json
{
  "projects": [
    {
      "id": "prj_91e3cb4a-8f92-4c6e-9821-419b48b71d9a",
      "name": "Acme SaaS Web App",
      "api_key": "br_live_d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3",
      "allowed_domains": "*",
      "incident_count": 14,
      "created_at": "2026-11-13T00:52:00.000Z"
    }
  ]
}
```

### 3.2. Create Project
`POST /api/v1/projects`  
*Requires Authorization Header.*

**Request Body:**
```json
{
  "name": "Checkout Microfrontend",
  "allowed_domains": "https://checkout.acme.com,https://staging-checkout.acme.com"
}
```

**Success Response (201 Created):**
```json
{
  "project": {
    "id": "prj_b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
    "name": "Checkout Microfrontend",
    "api_key": "br_live_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    "allowed_domains": "https://checkout.acme.com,https://staging-checkout.acme.com",
    "created_at": "2026-11-13T00:55:00.000Z"
  }
}
```

### 3.3. Update Subscription Tier
`PATCH /api/v1/projects/:id/plan`  
*Requires Authorization Header.*

**Request Body:**
```json
{
  "plan_tier": "PRO"
}
```

---

## 4. Telemetry Ingestion Endpoint

### 4.1. Ingest Incident Telemetry
`POST /api/v1/ingest`  
*Header:* `x-api-key: br_live_...`

**Request Body:**
```json
{
  "errorMessage": "Cannot read properties of undefined (reading 'total')",
  "errorType": "TypeError",
  "errorStack": "TypeError: Cannot read properties of undefined (reading 'total')\n    at updateCartUI (cart.js:42:19)",
  "pageUrl": "http://localhost:5173/demo",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
  "viewport": "1440x900",
  "telemetry": [
    {
      "type": "click",
      "timestamp": 1710328491000,
      "tagName": "BUTTON",
      "id": "add-to-cart",
      "selector": "button#add-to-cart",
      "innerText": "Add to Cart"
    },
    {
      "type": "network",
      "timestamp": 1710328491500,
      "method": "POST",
      "url": "/api/v1/cart/items",
      "status": 500,
      "durationMs": 180,
      "responseBody": {
        "error": "Database lock timeout"
      }
    }
  ]
}
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "incidentId": "inc_71c4fa92-5e32-416b-8012-78d10b982ef1",
  "testGenerated": true,
  "message": "Incident ingested and Playwright test synthesized successfully."
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid `x-api-key`.
- `403 Forbidden`: Origin domain not permitted by project `allowed_domains`.
- `429 Too Many Requests`: Monthly plan quota exceeded (e.g. 50 bugs limit on FREE tier).

---

## 5. Incidents Management Endpoints

### 5.1. List Incidents
`GET /api/v1/incidents?projectId=...&status=OPEN&search=checkout&page=1&limit=20`  
*Requires Authorization Header.*

**Success Response (200 OK):**
```json
{
  "incidents": [
    {
      "id": "inc_71c4fa92-5e32-416b-8012-78d10b982ef1",
      "project_id": "prj_91e3cb4a-8f92-4c6e-9821-419b48b71d9a",
      "project_name": "Acme SaaS Web App",
      "error_message": "Cannot read properties of undefined (reading 'total')",
      "error_type": "TypeError",
      "page_url": "http://localhost:5173/demo",
      "status": "OPEN",
      "created_at": "2026-11-13T00:56:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### 5.2. Get Incident Details
`GET /api/v1/incidents/:id`  
*Requires Authorization Header.*

**Success Response (200 OK):**
```json
{
  "incident": {
    "id": "inc_71c4fa92-5e32-416b-8012-78d10b982ef1",
    "project_id": "prj_91e3cb4a-8f92-4c6e-9821-419b48b71d9a",
    "error_message": "Cannot read properties of undefined (reading 'total')",
    "error_type": "TypeError",
    "error_stack": "TypeError: Cannot read properties of undefined (reading 'total')\n    at updateCartUI (cart.js:42:19)",
    "page_url": "http://localhost:5173/demo",
    "user_agent": "Mozilla/5.0...",
    "viewport": "1440x900",
    "telemetry": [ ... ],
    "generated_playwright_test": "import { test, expect } from '@playwright/test';\n\ntest('reproduce TypeError on checkout', async ({ page }) => {\n  // Route mock\n  await page.route('**/api/v1/cart/items', async route => {\n    await route.fulfill({\n      status: 500,\n      contentType: 'application/json',\n      body: JSON.stringify({ error: 'Database lock timeout' }),\n    });\n  });\n\n  await page.goto('http://localhost:5173/demo');\n  await page.locator('button#add-to-cart').click();\n  await expect(page.locator('.error-toast')).toBeVisible();\n});",
    "ai_root_cause_summary": "The checkout UI assumed the POST /api/v1/cart/items endpoint would always return a valid Cart response object. When the database timed out (HTTP 500), the response lacked a `total` field, causing an unhandled TypeError during state recomputation. Fix: add optional chaining (`cart?.total`) and handle HTTP 500 responses gracefully.",
    "status": "OPEN",
    "created_at": "2026-11-13T00:56:00.000Z"
  }
}
```

### 5.3. Update Incident Status
`PATCH /api/v1/incidents/:id/status`  
*Requires Authorization Header.*

**Request Body:**
```json
{
  "status": "RESOLVED"
}
```

### 5.4. Download Playwright Test File
`GET /api/v1/incidents/:id/test-file`

Returns:
- Content-Type: `application/javascript; charset=utf-8`
- Content-Disposition: `attachment; filename="bug-replay-inc_71c4fa92.spec.js"`
- Raw `.spec.js` Playwright test ready to execute.
