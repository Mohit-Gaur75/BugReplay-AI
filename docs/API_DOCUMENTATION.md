# BugReplay AI — Complete API Documentation

**API Base URL:** `/api/v1`  
**Standard Response:** All JSON responses follow the standard format:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional informative message"
}
```
**Standard Error Format:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | RATE_LIMITED | INTERNAL_ERROR",
    "message": "Human readable error description",
    "details": []
  }
}
```

---

## 1. Authentication APIs

### 1.1. Register Account
- **Endpoint:** `POST /api/v1/auth/register`
- **Request Body:**
  ```json
  {
    "email": "developer@example.com",
    "password": "Password123!"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsIn...",
      "user": {
        "id": "usr_78a1bc23-45d6-4ef7-8901-234567abcdef",
        "email": "developer@example.com",
        "plan_tier": "FREE",
        "created_at": "2026-11-13T01:00:00.000Z"
      }
    }
  }
  ```

### 1.2. Login
- **Endpoint:** `POST /api/v1/auth/login`
- **Request Body:**
  ```json
  {
    "email": "developer@example.com",
    "password": "Password123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsIn...",
      "user": {
        "id": "usr_78a1bc23-45d6-4ef7-8901-234567abcdef",
        "email": "developer@example.com",
        "plan_tier": "FREE"
      }
    }
  }
  ```

### 1.3. Logout
- **Endpoint:** `POST /api/v1/auth/logout`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

### 1.4. Current User Session
- **Endpoint:** `GET /api/v1/auth/me`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "usr_78a1bc23-45d6-4ef7-8901-234567abcdef",
        "email": "developer@example.com",
        "plan_tier": "PRO"
      }
    }
  }
  ```

---

## 2. Project Management APIs

### 2.1. List Projects
- **Endpoint:** `GET /api/v1/projects`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "projects": [
        {
          "id": "prj_12345678-abcd-ef01-2345-6789abcdef01",
          "name": "Acme SaaS Web App",
          "api_key_prefix": "br_live_a1b2c3d4",
          "allowed_domains": "*",
          "incident_count": 14,
          "monthly_usage": 14,
          "created_at": "2026-11-13T01:05:00.000Z"
        }
      ]
    }
  }
  ```

### 2.2. Create Project
- **Endpoint:** `POST /api/v1/projects`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "name": "Checkout Service",
    "allowed_domains": "https://checkout.acme.com",
    "webhook_url": "https://hooks.slack.com/services/T00/B00/XXXX"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "project": {
        "id": "prj_23456789-bcde-f012-3456-789abcdef012",
        "name": "Checkout Service",
        "allowed_domains": "https://checkout.acme.com",
        "webhook_url": "https://hooks.slack.com/services/T00/B00/XXXX",
        "api_key": "br_live_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c",
        "warning": "Copy this API key now. It will not be shown again."
      }
    }
  }
  ```

### 2.3. Rotate Project API Key
- **Endpoint:** `POST /api/v1/projects/:id/rotate-key`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "new_api_key": "br_live_new_random_key_value_here",
      "warning": "Update your SDK integration snippet with this new key immediately."
    }
  }
  ```

### 2.4. Update Project
- **Endpoint:** `PATCH /api/v1/projects/:id`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "name": "Checkout Service V2",
    "allowed_domains": "https://app.acme.com,https://staging.acme.com",
    "webhook_url": "https://discord.com/api/webhooks/..."
  }
  ```

### 2.5. Test Webhook Alert
- **Endpoint:** `POST /api/v1/projects/:id/test-webhook`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "sent_at": "2026-11-13T08:50:00.000Z",
      "message": "Test webhook notification delivered successfully."
    }
  }
  ```

### 2.6. Delete Project
- **Endpoint:** `DELETE /api/v1/projects/:id`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Project and associated telemetry permanently deleted"
  }
  ```

---

## 3. Telemetry Ingestion API

### 3.1. Ingest Incident
- **Endpoint:** `POST /api/v1/ingest`
- **Headers:**
  - `x-api-key: br_live_...`
  - `Content-Type: application/json`
- **Request Body:**
  ```json
  {
    "errorMessage": "Cannot read property 'total' of undefined",
    "errorType": "TypeError",
    "errorStack": "TypeError: Cannot read property 'total' of undefined\n    at updateCart (cart.js:45)",
    "pageUrl": "http://localhost:5173/demo",
    "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    "viewport": "1440x900",
    "telemetry": [
      {
        "type": "click",
        "timestamp": 1710328491000,
        "tagName": "BUTTON",
        "id": "btn-checkout",
        "selector": "button#btn-checkout",
        "innerText": "Proceed to Checkout"
      },
      {
        "type": "network",
        "timestamp": 1710328491400,
        "method": "POST",
        "url": "/api/v1/cart/checkout",
        "status": 500,
        "durationMs": 140,
        "responseBody": { "error": "Gateway Timeout" }
      }
    ]
  }
  ```
- **Response (202 Accepted):**
  ```json
  {
    "success": true,
    "incidentId": "inc_98765432-10fe-dcba-9876-543210fedcba",
    "generationStatus": "PENDING",
    "message": "Incident ingested and queued for AI synthesis"
  }
  ```

---

## 4. Incidents APIs

### 4.1. List Incidents
- **Endpoint:** `GET /api/v1/incidents?projectId=...&status=OPEN&search=checkout&page=1&limit=20`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "incidents": [
        {
          "id": "inc_98765432-10fe-dcba-9876-543210fedcba",
          "project_id": "prj_12345678-abcd-ef01-2345-6789abcdef01",
          "project_name": "Acme SaaS Web App",
          "error_message": "Cannot read property 'total' of undefined",
          "error_type": "TypeError",
          "page_url": "http://localhost:5173/demo",
          "status": "OPEN",
          "generation_status": "COMPLETED",
          "created_at": "2026-11-13T01:10:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1
      }
    }
  }
  ```

### 4.2. Incident Details
- **Endpoint:** `GET /api/v1/incidents/:id`
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "incident": {
        "id": "inc_98765432-10fe-dcba-9876-543210fedcba",
        "project_id": "prj_12345678-abcd-ef01-2345-6789abcdef01",
        "error_message": "Cannot read property 'total' of undefined",
        "error_type": "TypeError",
        "error_stack": "...",
        "page_url": "http://localhost:5173/demo",
        "user_agent": "Mozilla/5.0...",
        "viewport": "1440x900",
        "telemetry": [ ... ],
        "generated_playwright_test": "import { test, expect } from '@playwright/test'; ...",
        "ai_root_cause_summary": "...",
        "suggested_fix": "...",
        "confidence": "HIGH",
        "status": "OPEN",
        "generation_status": "COMPLETED",
        "created_at": "2026-11-13T01:10:00.000Z"
      }
    }
  }
  ```

### 4.3. Update Incident Status
- **Endpoint:** `PATCH /api/v1/incidents/:id/status`
- **Request Body:**
  ```json
  {
    "status": "RESOLVED"
  }
  ```

### 4.4. Download Playwright Test Script
- **Endpoint:** `GET /api/v1/incidents/:id/test-file`
- **Response:**
  - Content-Type: `application/javascript`
  - Attachment: `bug-replay-inc_98765432.spec.js`

### 4.5. Regenerate AI Test
- **Endpoint:** `POST /api/v1/incidents/:id/regenerate`
- **Response (202 Accepted):**
  ```json
  {
    "success": true,
    "message": "AI synthesis re-enqueued"
  }
  ```

---

## 5. Billing & Health APIs

### 5.1. View Usage & Entitlements
- **Endpoint:** `GET /api/v1/billing/usage`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "plan_tier": "FREE",
      "limit": 50,
      "used": 14,
      "remaining": 36,
      "billing_period": "2026-11"
    }
  }
  ```

### 5.2. Health Check
- **Endpoint:** `GET /health`
- **Response (200 OK):**
  ```json
  {
    "status": "healthy",
    "uptime": 1284,
    "timestamp": "2026-11-13T01:15:00.000Z"
  }
  ```
