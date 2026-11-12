# BugReplay AI — In-Browser Client SDK Specification (`bugreplay.js`)

## 1. Overview & Constraints

The `bugreplay.js` client SDK is designed to be embedded in any client-side JavaScript environment (React, Next.js, Vue, Angular, Svelte, or legacy vanilla HTML).

### Hard Constraints:
1. **Zero Dependencies:** Pure vanilla ECMAScript (ES2018+ compatible).
2. **Bundle Size:** Under 3KB minified and gzipped.
3. **Execution Model:** Non-blocking, passive event listeners, zero synchronous layout reflow triggers.
4. **Memory Footprint:** Strict $O(1)$ memory usage bounded by a fixed circular ring buffer.

---

## 2. Integration & Initialization

### Standard HTML Script Embed
```html
<script 
  src="https://cdn.bugreplay.dev/bugreplay.js" 
  data-api-key="br_live_your_project_key_here"
  data-endpoint="https://api.bugreplay.dev/api/v1/ingest"
  defer>
</script>
```

### Module / SPA Initialization
```javascript
import BugReplay from 'bugreplay-sdk';

BugReplay.init({
  apiKey: 'br_live_your_project_key_here',
  endpoint: 'https://api.bugreplay.dev/api/v1/ingest',
  maxEvents: 15,
  maskInputTypes: ['password', 'card', 'cvv'],
  collectConsoleLogs: true,
  collectNetworkErrors: true
});
```

---

## 3. Core Subsystems

### 3.1. Circular Ring Buffer
The SDK maintains a fixed-capacity circular buffer of the last 15 actions:
```javascript
class RingBuffer {
  constructor(capacity = 15) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.cursor = 0;
    this.isFull = false;
  }

  push(item) {
    this.buffer[this.cursor] = item;
    this.cursor = (this.cursor + 1) % this.capacity;
    if (this.cursor === 0) this.isFull = true;
  }

  getItems() {
    if (!this.isFull) return this.buffer.slice(0, this.cursor);
    return [
      ...this.buffer.slice(this.cursor),
      ...this.buffer.slice(0, this.cursor)
    ];
  }
}
```

### 3.2. Intelligent DOM Click Interceptor & Selector Generator
Captures user clicks using a passive root listener on `document.addEventListener('click', handler, { capture: true, passive: true })`.

#### Optimal Selector Algorithm:
1. Check for `data-testid` or `data-cy`:
   ```javascript
   if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
   ```
2. Check for unique element ID:
   ```javascript
   if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
     return `#${CSS.escape(el.id)}`;
   }
   ```
3. Check for distinctive semantic tag + class name:
   ```javascript
   const tag = el.tagName.toLowerCase();
   const classList = Array.from(el.classList).filter(c => !c.startsWith('hover:') && !c.includes(':'));
   if (classList.length > 0) {
     const candidate = `${tag}.${classList.slice(0, 2).join('.')}`;
     if (document.querySelectorAll(candidate).length === 1) return candidate;
   }
   ```
4. Build relative path upwards to nearest identifiable ancestor.
5. Extract sanitized inner text snippet (truncated to 30 characters).

### 3.3. Network Interceptor (`window.fetch` and `XMLHttpRequest`)
Monitors outgoing network requests:
- Hooks `window.fetch` via prototype wrapper.
- Records:
  - Timestamp, Method (`GET`, `POST`, `PUT`, `DELETE`).
  - Request URL (stripping query parameters matching `token`, `secret`, `key`, `auth`).
  - Response HTTP Status (`200`, `404`, `500`).
  - Round-trip duration in milliseconds.
  - If the request returns a non-2xx status, records the truncated response body (up to 2KB) for Playwright route mocking.
- Headers `Authorization`, `Cookie`, and `Set-Cookie` are purged before recording.

### 3.4. Console Interceptor
- Hooks `console.error` and `console.warn`.
- Converts complex objects into structured JSON strings using a circular reference-safe serializer.
- Passes through original console logs untouched to the browser's developer console.

### 3.5. Automated PII Sanitization
Ensures zero sensitive data ever leaves the user's browser:
- Input value redactor:
  ```javascript
  function sanitizeInput(element) {
    const type = (element.getAttribute('type') || '').toLowerCase();
    const name = (element.getAttribute('name') || '').toLowerCase();
    const isPrivate = element.hasAttribute('data-private') || element.hasAttribute('data-mask');

    if (type === 'password' || isPrivate || /card|cvv|cvc|ssn|secret|token/.test(name)) {
      return '[REDACTED_PII]';
    }
    return element.value;
  }
  ```
- Luhn credit card regex scrubber for text content:
  ```javascript
  const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;
  function scrubText(text) {
    return text.replace(CREDIT_CARD_REGEX, '••••-••••-••••-••••');
  }
  ```

### 3.6. Global Crash Traps & Dispatch
- `window.addEventListener('error', (event) => { ... })`
- `window.addEventListener('unhandledrejection', (event) => { ... })`
- Transmits telemetry payload via:
  ```javascript
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon(endpoint, blob);
  } else {
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(payload),
      keepalive: true
    });
  }
  ```

---

## 4. Public SDK API

```javascript
// Manual issue reporting (e.g. from a user "Help" or "Report Bug" modal)
window.BugReplay.reportIssue(userNote);

// Add custom developer breadcrumb
window.BugReplay.addBreadcrumb({
  category: 'auth',
  message: 'User completed two-factor authentication challenge'
});

// Programmatic configuration
window.BugReplay.configure({
  allowedDomains: ['app.example.com']
});
```
