# BugReplay AI — Client SDK Integration Guide (`bugreplay.js`)

## 1. Quick Start

### 1.1. HTML Script Tag (Zero Build Tools)
Add this script tag inside your HTML `<head>` or before `</body>`:

```html
<script 
  src="https://api.bugreplay.dev/bugreplay.js" 
  data-api-key="br_live_your_project_api_key_here"
  defer>
</script>
```

For local development or self-hosted instances:
```html
<script 
  src="http://localhost:5000/bugreplay.js" 
  data-api-key="br_live_demo_1234567890abcdef"
  data-endpoint="http://localhost:5000/api/v1/ingest"
  defer>
</script>
```

---

## 2. React / Next.js / Modern SPA Integration

### Next.js (App Router `app/layout.tsx` or `app/layout.jsx`)
```jsx
import Script from 'next/script';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <Script
          src="http://localhost:5000/bugreplay.js"
          data-api-key={process.env.NEXT_PUBLIC_BUGREPLAY_KEY}
          strategy="afterInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### Programmatic Initialization (Vite / Vanilla JS)
```javascript
import BugReplay from 'bugreplay-sdk';

BugReplay.init({
  apiKey: 'br_live_your_project_api_key',
  endpoint: 'http://localhost:5000/api/v1/ingest',
  maxEvents: 15,
  captureConsole: true,
  captureNetwork: true,
  captureClicks: true,
  maskInputTypes: ['password', 'card', 'cvv']
});
```

---

## 3. Configuration Reference

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `apiKey` | `string` | *(Required)* | Project API key starting with `br_live_`. |
| `endpoint` | `string` | `/api/v1/ingest` | Backend ingestion URL. |
| `maxEvents` | `number` | `15` | Ring buffer size (number of recent actions stored). |
| `captureConsole` | `boolean` | `true` | Intercepts `console.error` and `console.warn`. |
| `captureNetwork` | `boolean` | `true` | Intercepts `window.fetch` network status & errors. |
| `captureClicks` | `boolean` | `true` | Intercepts DOM clicks and calculates CSS selectors. |
| `allowedDomains` | `string[]`| `['*']` | Allowlist of hostnames permitted to report. |

---

## 4. Public SDK Methods

### 4.1. `BugReplay.showReportWidget()`
Opens a floating "Report an Issue" feedback modal for end-users or QA:
```javascript
document.getElementById('help-button').addEventListener('click', () => {
  window.BugReplay.showReportWidget({
    title: 'Report a Problem',
    placeholder: 'What were you trying to do when this happened?'
  });
});
```

### 4.2. `BugReplay.addBreadcrumb(data)`
Log custom application state or user milestones:
```javascript
window.BugReplay.addBreadcrumb({
  category: 'checkout',
  message: 'User entered coupon code: SUMMER2026',
  level: 'info'
});
```

### 4.3. `BugReplay.captureError(error, customContext)`
Manually trigger an incident capture inside a `try / catch` block:
```javascript
try {
  executeCriticalAction();
} catch (err) {
  window.BugReplay.captureError(err, { orderId: 'ord_1234' });
}
```

---

## 5. PII Masking & Data Privacy

To guarantee privacy compliance:
1. **Inputs:** Any `<input type="password">`, `<input name="card">`, or inputs with attribute `data-private` or `data-mask` will have their value replaced with `[REDACTED_PII]`.
2. **Custom Sensitive Fields:** Simply tag any container or element with `data-private`:
   ```html
   <div data-private class="user-ssn-display">
     987-65-4321
   </div>
   ```
   The SDK will redact the contents before saving to the ring buffer.
