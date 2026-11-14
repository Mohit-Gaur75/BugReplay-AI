/**
 * BugReplay AI — In-Browser Telemetry Capture SDK (bugreplay.js)
 * Lightweight, zero-dependency client capture library.
 * Maintains an in-memory rolling ring buffer of the last 15 user actions,
 * masks PII, and transmits incident packets upon unhandled errors or user reports.
 */

(function (window, document) {
  'use strict';

  // Prevent multiple initializations
  if (window.__BUGREPLAY_INITIALIZED__) {
    return;
  }
  window.__BUGREPLAY_INITIALIZED__ = true;

  // =========================================================================
  // 1. Rolling Ring Buffer (Fixed Capacity: 15 items, O(1) memory bound)
  // =========================================================================
  class RingBuffer {
    constructor(capacity = 15) {
      this.capacity = capacity;
      this.buffer = new Array(capacity);
      this.cursor = 0;
      this.isFull = false;
    }

    push(item) {
      this.buffer[this.cursor] = {
        ...item,
        timestamp: item.timestamp || Date.now(),
      };
      this.cursor = (this.cursor + 1) % this.capacity;
      if (this.cursor === 0) {
        this.isFull = true;
      }
    }

    getItems() {
      if (!this.isFull) {
        return this.buffer.slice(0, this.cursor);
      }
      return [
        ...this.buffer.slice(this.cursor),
        ...this.buffer.slice(0, this.cursor),
      ];
    }

    clear() {
      this.buffer = new Array(this.capacity);
      this.cursor = 0;
      this.isFull = false;
    }
  }

  // =========================================================================
  // 2. Centralized PII Masker & Sanitizer
  // =========================================================================
  const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;
  const SENSITIVE_PARAM_REGEX = /((?:password|passwd|card|credit|cvv|cvc|ssn|secret|token|auth|key))=([^&]+)/gi;
  const SENSITIVE_ATTR_REGEX = /password|passwd|card|credit|cvv|cvc|ssn|secret|token|auth/i;

  function isSensitiveElement(el) {
    if (!el || !el.getAttribute) return false;
    const type = (el.getAttribute('type') || '').toLowerCase();
    const name = (el.getAttribute('name') || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const hasPrivateAttr = el.hasAttribute('data-private') || el.hasAttribute('data-mask');

    return (
      type === 'password' ||
      hasPrivateAttr ||
      SENSITIVE_ATTR_REGEX.test(name) ||
      SENSITIVE_ATTR_REGEX.test(id)
    );
  }

  function scrubText(text) {
    if (typeof text !== 'string') return text;
    // Mask potential credit card sequences
    return text.replace(CREDIT_CARD_REGEX, '••••-••••-••••-••••');
  }

  function scrubUrl(url) {
    if (typeof url !== 'string') return url;
    return url.replace(SENSITIVE_PARAM_REGEX, '$1=[REDACTED_PII]');
  }

  function scrubPayload(data, depth = 0) {
    if (data === null || data === undefined) return null;
    if (depth > 5) return '[NESTED_PAYLOAD_TRUNCATED]';

    if (typeof data === 'string') {
      const trimmed = data.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsed = JSON.parse(trimmed);
          return scrubPayload(parsed, depth + 1);
        } catch (e) {
          // not valid JSON, treat as text
        }
      }
      return scrubText(data.length > 2000 ? data.slice(0, 2000) + '...[truncated]' : data);
    }

    if (Array.isArray(data)) {
      return data.slice(0, 50).map((item) => scrubPayload(item, depth + 1));
    }

    if (typeof data === 'object') {
      const result = {};
      for (const key of Object.keys(data)) {
        if (SENSITIVE_ATTR_REGEX.test(key) || /api[_-]?key|bearer|private[_-]?key/i.test(key)) {
          result[key] = '[REDACTED_PII]';
        } else {
          result[key] = scrubPayload(data[key], depth + 1);
        }
      }
      return result;
    }

    return data;
  }

  function getSafeSelector(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';

    // 1. Check data-testid or data-cy
    const testId = el.getAttribute('data-testid') || el.getAttribute('data-cy');
    if (testId) {
      return `[data-testid="${testId}"]`;
    }

    // 2. Check unique ID
    if (el.id && !/\d{4,}/.test(el.id)) {
      try {
        if (document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
          return `#${CSS.escape(el.id)}`;
        }
      } catch (e) {}
    }

    // 3. Tag name and semantic class
    const tag = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') {
      const classes = el.className
        .split(/\s+/)
        .filter((c) => c && !c.includes(':') && !c.startsWith('hover:') && !/\d/.test(c))
        .slice(0, 2);

      if (classes.length > 0) {
        const candidate = `${tag}.${classes.join('.')}`;
        try {
          if (document.querySelectorAll(candidate).length === 1) {
            return candidate;
          }
        } catch (e) {}
      }
    }

    // 4. Fallback: simple tag and role or text indicator
    return tag;
  }

  // =========================================================================
  // 3. BugReplay Client Core
  // =========================================================================
  class BugReplayClient {
    constructor() {
      this.apiKey = null;
      this.endpoint = '/api/v1/ingest';
      this.maxEvents = 15;
      this.captureConsole = true;
      this.captureNetwork = true;
      this.captureClicks = true;
      this.captureBodyUrls = [];
      this.buffer = new RingBuffer(15);
      this.isSubmitting = false;
      this.lastSentErrorFingerprint = null;
    }

    init(options = {}) {
      this.apiKey = options.apiKey || this.extractScriptApiKey();
      this.endpoint = options.endpoint || this.extractScriptEndpoint() || this.endpoint;
      this.maxEvents = options.maxEvents || 15;
      this.captureConsole = options.captureConsole !== false;
      this.captureNetwork = options.captureNetwork !== false;
      this.captureClicks = options.captureClicks !== false;

      const scriptBodyUrls = this.extractScriptCaptureBodyUrls();
      const rawBodyUrls = options.captureBodyUrls !== undefined ? options.captureBodyUrls : scriptBodyUrls;
      if (Array.isArray(rawBodyUrls)) {
        this.captureBodyUrls = rawBodyUrls;
      } else if (typeof rawBodyUrls === 'string') {
        this.captureBodyUrls = rawBodyUrls.split(',').map((s) => s.trim()).filter(Boolean);
      } else {
        this.captureBodyUrls = [];
      }

      this.buffer = new RingBuffer(this.maxEvents);

      this.setupErrorListeners();
      if (this.captureClicks) this.setupClickInterceptor();
      if (this.captureNetwork) this.setupNetworkInterceptor();
      if (this.captureConsole) this.setupConsoleInterceptor();

      console.log('[BugReplay AI] SDK active. Ready to capture incidents.');
    }

    extractScriptApiKey() {
      if (typeof document === 'undefined') return null;
      if (document.currentScript && typeof document.currentScript.getAttribute === 'function') {
        return document.currentScript.getAttribute('data-api-key');
      }
      if (typeof document.querySelector === 'function') {
        const script = document.querySelector('script[data-api-key]');
        return script ? script.getAttribute('data-api-key') : null;
      }
      return null;
    }

    extractScriptEndpoint() {
      if (typeof document === 'undefined') return null;
      if (document.currentScript && typeof document.currentScript.getAttribute === 'function') {
        return document.currentScript.getAttribute('data-endpoint');
      }
      if (typeof document.querySelector === 'function') {
        const script = document.querySelector('script[data-endpoint]');
        return script ? script.getAttribute('data-endpoint') : null;
      }
      return null;
    }

    extractScriptCaptureBodyUrls() {
      let raw = null;
      if (document.currentScript) {
        raw = document.currentScript.getAttribute('data-capture-body-urls');
      }
      if (!raw) {
        const script = document.querySelector('script[data-capture-body-urls]');
        raw = script ? script.getAttribute('data-capture-body-urls') : null;
      }
      if (!raw) return [];
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }

    shouldCaptureBody(url) {
      if (!this.captureBodyUrls || this.captureBodyUrls.length === 0 || !url) {
        return false;
      }
      return this.captureBodyUrls.some((pattern) => {
        if (pattern instanceof RegExp) {
          return pattern.test(url);
        }
        return typeof pattern === 'string' && url.includes(pattern);
      });
    }

    // -----------------------------------------------------------------------
    // Click Interceptor
    // -----------------------------------------------------------------------
    setupClickInterceptor() {
      document.addEventListener(
        'click',
        (e) => {
          try {
            const target = e.target;
            if (!target || target.nodeType !== Node.ELEMENT_NODE) return;

            // Never record clicks inside our own report widget
            if (target.closest && target.closest('#bugreplay-report-widget-container')) {
              return;
            }

            const isSensitive = isSensitiveElement(target) || (target.closest && isSensitiveElement(target.closest('form')));
            const rawText = target.innerText || target.value || target.getAttribute('aria-label') || '';
            const safeText = isSensitive ? '[REDACTED_PII]' : scrubText(rawText.trim().slice(0, 30));

            this.buffer.push({
              type: 'click',
              tagName: target.tagName,
              id: target.id || null,
              selector: getSafeSelector(target),
              innerText: safeText,
              coordinates: { x: Math.round(e.clientX), y: Math.round(e.clientY) },
            });
          } catch (err) {
            // Passive catch, never break app
          }
        },
        { capture: true, passive: true }
      );
    }

    // -----------------------------------------------------------------------
    // Network Interceptor (Fetch Monkey-Patch)
    // -----------------------------------------------------------------------
    setupNetworkInterceptor() {
      if (!window.fetch) return;
      const originalFetch = window.fetch;
      const self = this;

      window.fetch = async function (...args) {
        const [resource, config = {}] = args;
        const startTime = Date.now();
        const method = (config.method || 'GET').toUpperCase();
        let rawUrl = typeof resource === 'string' ? resource : resource && resource.url ? resource.url : '';
        const safeUrl = scrubUrl(rawUrl);

        // Do NOT intercept BugReplay's own ingestion calls
        if (safeUrl.includes('/api/v1/ingest') || (self.endpoint && safeUrl.includes(self.endpoint))) {
          return originalFetch.apply(this, args);
        }

        const shouldCapture = self.shouldCaptureBody(safeUrl);
        let scrubbedReqBody = null;
        if (shouldCapture && config && config.body) {
          try {
            scrubbedReqBody = scrubPayload(config.body);
          } catch (e) {}
        }

        try {
          const response = await originalFetch.apply(this, args);
          const duration = Date.now() - startTime;

          // Record non-2xx responses or allowlisted payloads for route mocking & debugging
          if (!response.ok) {
            let errorBody = null;
            try {
              // Clone to inspect body without consuming client stream
              const clone = response.clone();
              const text = await clone.text();
              errorBody = scrubPayload(text);
            } catch (e) {
              errorBody = { statusText: response.statusText };
            }

            self.buffer.push({
              type: 'network',
              method,
              url: safeUrl,
              status: response.status,
              durationMs: duration,
              requestBody: scrubbedReqBody,
              responseBody: errorBody,
            });
          } else if (shouldCapture) {
            let successBody = null;
            try {
              const clone = response.clone();
              const text = await clone.text();
              successBody = scrubPayload(text);
            } catch (e) {
              successBody = { statusText: response.statusText };
            }

            self.buffer.push({
              type: 'network',
              method,
              url: safeUrl,
              status: response.status,
              durationMs: duration,
              requestBody: scrubbedReqBody,
              responseBody: successBody,
            });
          }

          return response;
        } catch (networkError) {
          const duration = Date.now() - startTime;
          self.buffer.push({
            type: 'network',
            method,
            url: safeUrl,
            status: 0,
            durationMs: duration,
            requestBody: scrubbedReqBody,
            responseBody: { error: networkError.message || 'Network request failed' },
          });
          throw networkError;
        }
      };
    }

    // -----------------------------------------------------------------------
    // Console Interceptor
    // -----------------------------------------------------------------------
    setupConsoleInterceptor() {
      const originalError = console.error;
      const originalWarn = console.warn;
      const self = this;

      console.error = function (...args) {
        try {
          const message = args
            .map((a) => (typeof a === 'object' ? (a instanceof Error ? a.message : JSON.stringify(a)) : String(a)))
            .join(' ');
          self.buffer.push({
            type: 'console',
            level: 'error',
            message: scrubText(message.slice(0, 300)),
          });
        } catch (e) {}
        originalError.apply(console, args);
      };

      console.warn = function (...args) {
        try {
          const message = args
            .map((a) => (typeof a === 'object' ? String(a) : String(a)))
            .join(' ');
          self.buffer.push({
            type: 'console',
            level: 'warn',
            message: scrubText(message.slice(0, 200)),
          });
        } catch (e) {}
        originalWarn.apply(console, args);
      };
    }

    // -----------------------------------------------------------------------
    // Global Error Handlers (window.onerror & unhandledrejection)
    // -----------------------------------------------------------------------
    setupErrorListeners() {
      window.addEventListener('error', (event) => {
        if (!event.error && !event.message) return;
        const error = event.error || {};
        this.captureIncident({
          errorMessage: error.message || event.message || 'Uncaught Error',
          errorType: error.name || 'Error',
          errorStack: error.stack || `${event.filename}:${event.lineno}:${event.colno}`,
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason || {};
        this.captureIncident({
          errorMessage: reason.message || (typeof reason === 'string' ? reason : 'Unhandled Promise Rejection'),
          errorType: reason.name || 'UnhandledRejection',
          errorStack: reason.stack || String(reason),
        });
      });
    }

    // -----------------------------------------------------------------------
    // Incident Dispatcher
    // -----------------------------------------------------------------------
    captureIncident(errorDetails, userNote = null) {
      if (!this.apiKey) {
        console.warn('[BugReplay AI] Missing API key. Incident will not be transmitted.');
        return;
      }

      // Deduplicate: avoid firing multiple incidents for the exact same error in quick succession
      const fingerprint = `${errorDetails.errorType}:${errorDetails.errorMessage}`;
      if (this.lastSentErrorFingerprint === fingerprint) {
        return;
      }
      this.lastSentErrorFingerprint = fingerprint;
      setTimeout(() => {
        this.lastSentErrorFingerprint = null;
      }, 3000);

      const telemetry = this.buffer.getItems();
      if (userNote) {
        telemetry.push({
          type: 'user_report',
          message: scrubText(userNote),
          timestamp: Date.now(),
        });
      }

      const payload = {
        errorMessage: scrubText(errorDetails.errorMessage),
        errorType: errorDetails.errorType || 'Error',
        errorStack: scrubText(errorDetails.errorStack || ''),
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        telemetry,
      };

      this.sendPayload(payload);
    }

    sendPayload(payload) {
      const serialized = JSON.stringify(payload);

      // 1. Attempt navigator.sendBeacon
      if (navigator.sendBeacon) {
        try {
          const blob = new Blob([serialized], { type: 'application/json' });
          const urlWithKey = this.endpoint.includes('?')
            ? `${this.endpoint}&apiKey=${encodeURIComponent(this.apiKey)}`
            : `${this.endpoint}?apiKey=${encodeURIComponent(this.apiKey)}`;

          const success = navigator.sendBeacon(urlWithKey, blob);
          if (success) return;
        } catch (e) {}
      }

      // 2. Fallback to keepalive fetch
      try {
        fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          body: serialized,
          keepalive: true,
        }).catch(() => {});
      } catch (err) {}
    }

    // -----------------------------------------------------------------------
    // Report Issue Widget (BugReplay.showReportWidget())
    // -----------------------------------------------------------------------
    showReportWidget(options = {}) {
      if (document.getElementById('bugreplay-report-widget-container')) {
        return;
      }

      const container = document.createElement('div');
      container.id = 'bugreplay-report-widget-container';
      container.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; max-width: 440px; width: 90%; color: #f4f4f5; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${options.title || 'Report a Problem'}</h3>
              <button id="bugreplay-widget-close" style="background: none; border: none; color: #a1a1aa; cursor: pointer; font-size: 18px;">&times;</button>
            </div>
            <p style="margin: 0 0 12px 0; font-size: 13px; color: #a1a1aa;">
              Recent actions and network errors leading to this page will be attached automatically.
            </p>
            <textarea id="bugreplay-widget-note" rows="3" placeholder="${options.placeholder || 'What went wrong?'}" style="width: 100%; box-sizing: border-box; background: #09090b; border: 1px solid #3f3f46; border-radius: 8px; padding: 10px; color: #f4f4f5; font-size: 13px; outline: none; margin-bottom: 16px;"></textarea>
            <div style="display: flex; justify-content: flex-end; gap: 8px;">
              <button id="bugreplay-widget-cancel" style="background: #27272a; border: 1px solid #3f3f46; border-radius: 6px; padding: 6px 14px; color: #d4d4d8; font-size: 13px; cursor: pointer;">Cancel</button>
              <button id="bugreplay-widget-submit" style="background: #2563eb; border: none; border-radius: 6px; padding: 6px 14px; color: #ffffff; font-size: 13px; font-weight: 500; cursor: pointer;">Send Report</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(container);

      const close = () => {
        if (container.parentNode) container.parentNode.removeChild(container);
      };

      container.querySelector('#bugreplay-widget-close').onclick = close;
      container.querySelector('#bugreplay-widget-cancel').onclick = close;
      container.querySelector('#bugreplay-widget-submit').onclick = () => {
        const note = container.querySelector('#bugreplay-widget-note').value;
        this.captureIncident(
          {
            errorMessage: 'User Reported Issue',
            errorType: 'UserReport',
            errorStack: 'Reported manually via BugReplay widget',
          },
          note
        );
        close();
        alert('Thank you! Your bug report and action replay have been sent.');
      };
    }
  }

  // Create global singleton instance
  const instance = new BugReplayClient();
  window.BugReplay = instance;

  // Auto-initialize if running in a browser DOM environment with script tag
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        const key = instance.extractScriptApiKey();
        if (key) instance.init({ apiKey: key });
      });
    } else {
      const key = instance.extractScriptApiKey();
      if (key) instance.init({ apiKey: key });
    }
  }

  // Export RingBuffer and security helpers for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BugReplayClient, RingBuffer, scrubText, scrubUrl, isSensitiveElement, scrubPayload };
  }
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : {});
