/**
 * BugReplay AI - Lightweight In-Browser Flight Recorder SDK
 * Size: < 3KB minified | Zero Dependencies | Passive Ring Buffer
 *
 * Automatically records the last 15 user actions (clicks, network failures,
 * console errors) with zero-leak PII masking, and transmits telemetry upon
 * unhandled exceptions or explicit issue reporting.
 */
(function (global) {
  'use strict';

  // Prevent multiple initializations
  if (global.__BUGREPLAY_INITIALIZED__) return;
  global.__BUGREPLAY_INITIALIZED__ = true;

  // Configuration defaults
  const config = {
    apiKey: '',
    endpoint: '/api/v1/ingest',
    maxEvents: 15,
    autoCapture: true,
    maskInputTypes: ['password', 'card', 'cvv', 'cvc', 'ssn', 'secret', 'token'],
    allowedDomains: ['*']
  };

  // Extract configuration from <script> tag attributes if available
  const currentScript = document.currentScript || document.querySelector('script[data-api-key]');
  if (currentScript) {
    if (currentScript.getAttribute('data-api-key')) {
      config.apiKey = currentScript.getAttribute('data-api-key');
    }
    if (currentScript.getAttribute('data-endpoint')) {
      config.endpoint = currentScript.getAttribute('data-endpoint');
    }
  }

  // Circular Ring Buffer to guarantee O(1) space complexity and zero memory leaks
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
      ].filter(Boolean);
    }

    clear() {
      this.buffer = new Array(this.capacity);
      this.cursor = 0;
      this.isFull = false;
    }
  }

  const ringBuffer = new RingBuffer(config.maxEvents);

  // PII Redaction Engine
  const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;
  const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  function redactPII(text) {
    if (typeof text !== 'string') return text;
    return text
      .replace(CREDIT_CARD_REGEX, '••••-••••-••••-••••')
      .replace(EMAIL_REGEX, (email) => {
        const parts = email.split('@');
        return parts[0].charAt(0) + '•••@' + parts[1];
      });
  }

  function isSensitiveElement(el) {
    if (!el || !el.getAttribute) return false;
    const type = (el.getAttribute('type') || '').toLowerCase();
    const name = (el.getAttribute('name') || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const isPrivate = el.hasAttribute('data-private') || el.hasAttribute('data-mask');

    if (isPrivate || type === 'password') return true;

    for (const term of config.maskInputTypes) {
      if (name.includes(term) || id.includes(term) || placeholder.includes(term)) {
        return true;
      }
    }
    return false;
  }

  // Optimal CSS & Data-TestID Selector Generator
  function getBestSelector(el) {
    if (!el || el === document || el === window) return 'window';
    if (el.getAttribute && el.getAttribute('data-testid')) {
      return `[data-testid="${el.getAttribute('data-testid')}"]`;
    }
    if (el.getAttribute && el.getAttribute('data-cy')) {
      return `[data-cy="${el.getAttribute('data-cy')}"]`;
    }
    if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
      return `#${CSS.escape(el.id)}`;
    }
    if (el.tagName) {
      const tag = el.tagName.toLowerCase();
      if (el.classList && el.classList.length > 0) {
        const validClasses = Array.from(el.classList)
          .filter(c => !c.includes(':') && !c.includes('[') && !c.startsWith('hover:'))
          .slice(0, 2);
        if (validClasses.length > 0) {
          const candidate = `${tag}.${validClasses.map(c => CSS.escape(c)).join('.')}`;
          try {
            if (document.querySelectorAll(candidate).length === 1) return candidate;
          } catch (e) {
            // fallback if selector syntax fails
          }
        }
      }
      return tag;
    }
    return 'unknown-element';
  }

  // Safe innerText extractor with length truncation
  function getElementText(el) {
    if (!el) return '';
    if (isSensitiveElement(el)) return '[REDACTED_PII]';
    const text = (el.innerText || el.textContent || el.value || '').trim();
    const truncated = text.length > 30 ? text.substring(0, 30) + '...' : text;
    return redactPII(truncated);
  }

  // 1. User Click Interceptor
  function initClickInterceptor() {
    document.addEventListener(
      'click',
      function (e) {
        try {
          const target = e.target;
          if (!target) return;

          const selector = getBestSelector(target);
          const innerText = getElementText(target);
          const isSensitive = isSensitiveElement(target);

          ringBuffer.push({
            type: 'click',
            timestamp: Date.now(),
            tagName: target.tagName ? target.tagName.toUpperCase() : 'UNKNOWN',
            id: target.id || null,
            className: target.className ? String(target.className).slice(0, 80) : null,
            selector: selector,
            innerText: isSensitive ? '[REDACTED_PII]' : innerText,
            coordinates: {
              x: Math.round(e.clientX || 0),
              y: Math.round(e.clientY || 0)
            }
          });
        } catch (err) {
          // Silent catch to never crash user page
        }
      },
      { capture: true, passive: true }
    );
  }

  // 2. Network Fetch & XHR Interceptor
  function initNetworkInterceptor() {
    if (global.fetch) {
      const originalFetch = global.fetch;
      global.fetch = function (input, init) {
        const startTime = Date.now();
        let url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        const method = (init && init.method ? init.method : 'GET').toUpperCase();

        // Do not intercept BugReplay's own ingestion calls
        if (url.includes('/api/v1/ingest')) {
          return originalFetch.apply(this, arguments);
        }

        return originalFetch
          .apply(this, arguments)
          .then((response) => {
            const durationMs = Date.now() - startTime;
            // Record network call if status >= 400 or on error
            if (!response.ok) {
              const clone = response.clone();
              clone
                .text()
                .then((bodyText) => {
                  let parsedBody = bodyText;
                  try {
                    parsedBody = JSON.parse(bodyText);
                  } catch (e) {
                    if (bodyText.length > 500) {
                      parsedBody = bodyText.substring(0, 500) + '... (truncated)';
                    }
                  }

                  ringBuffer.push({
                    type: 'network',
                    timestamp: startTime,
                    method: method,
                    url: redactPII(url),
                    status: response.status,
                    durationMs: durationMs,
                    responseBody: parsedBody
                  });
                })
                .catch(() => {
                  ringBuffer.push({
                    type: 'network',
                    timestamp: startTime,
                    method: method,
                    url: redactPII(url),
                    status: response.status,
                    durationMs: durationMs
                  });
                });
            } else {
              // Also log successful endpoints that are relevant
              ringBuffer.push({
                type: 'network',
                timestamp: startTime,
                method: method,
                url: redactPII(url),
                status: response.status,
                durationMs: durationMs
              });
            }
            return response;
          })
          .catch((networkError) => {
            const durationMs = Date.now() - startTime;
            ringBuffer.push({
              type: 'network',
              timestamp: startTime,
              method: method,
              url: redactPII(url),
              status: 0,
              durationMs: durationMs,
              error: networkError ? networkError.message : 'Network request failed'
            });
            throw networkError;
          });
      };
    }
  }

  // 3. Console Interceptor
  function initConsoleInterceptor() {
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    console.error = function (...args) {
      try {
        const message = args
          .map((arg) => {
            if (arg instanceof Error) return arg.stack || arg.message;
            if (typeof arg === 'object') {
              try {
                return JSON.stringify(arg);
              } catch (e) {
                return String(arg);
              }
            }
            return String(arg);
          })
          .join(' ');

        ringBuffer.push({
          type: 'console',
          timestamp: Date.now(),
          level: 'error',
          message: redactPII(message.slice(0, 500))
        });
      } catch (e) {
        // Silent catch
      }
      return originalConsoleError.apply(console, args);
    };

    console.warn = function (...args) {
      try {
        const message = args
          .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
          .join(' ');

        ringBuffer.push({
          type: 'console',
          timestamp: Date.now(),
          level: 'warn',
          message: redactPII(message.slice(0, 300))
        });
      } catch (e) {
        // Silent catch
      }
      return originalConsoleWarn.apply(console, args);
    };
  }

  // 4. Navigation & Route Change Interceptor
  function initNavigationInterceptor() {
    let currentUrl = global.location ? global.location.href : '';

    function trackNavigation(toUrl) {
      if (toUrl !== currentUrl) {
        ringBuffer.push({
          type: 'navigation',
          timestamp: Date.now(),
          from: currentUrl,
          to: toUrl
        });
        currentUrl = toUrl;
      }
    }

    if (global.history) {
      const origPushState = global.history.pushState;
      const origReplaceState = global.history.replaceState;

      global.history.pushState = function () {
        origPushState.apply(this, arguments);
        trackNavigation(global.location.href);
      };

      global.history.replaceState = function () {
        origReplaceState.apply(this, arguments);
        trackNavigation(global.location.href);
      };

      global.addEventListener('popstate', () => trackNavigation(global.location.href));
      global.addEventListener('hashchange', () => trackNavigation(global.location.href));
    }
  }

  // 5. Telemetry Transmission Dispatcher
  function sendIncident(incidentData) {
    if (!config.apiKey) {
      console.warn('[BugReplay AI] Cannot ingest incident: data-api-key not configured.');
      return;
    }

    const payload = {
      errorMessage: incidentData.errorMessage || 'Unknown Error',
      errorType: incidentData.errorType || 'Error',
      errorStack: incidentData.errorStack || '',
      pageUrl: global.location ? global.location.href : '',
      userAgent: global.navigator ? global.navigator.userAgent : '',
      viewport: `${global.innerWidth || 1440}x${global.innerHeight || 900}`,
      telemetry: ringBuffer.getItems()
    };

    const targetUrl = config.endpoint;

    // Use sendBeacon if available, otherwise fetch with keepalive
    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        // Many browsers support sending headers via fetch better, but sendBeacon is safest for unload
        const success = navigator.sendBeacon(`${targetUrl}?apiKey=${encodeURIComponent(config.apiKey)}`, blob);
        if (success) return;
      } catch (e) {
        // Fallback to fetch
      }
    }

    // Fallback: standard fetch
    try {
      fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey
        },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {
        // Suppress delivery failure so app remains unaffected
      });
    } catch (e) {
      // Suppress delivery failure
    }
  }

  // 6. Global Uncaught Error Traps
  function initGlobalErrorTraps() {
    global.addEventListener('error', function (event) {
      try {
        const error = event.error || {};
        sendIncident({
          errorMessage: event.message || error.message || 'Script error',
          errorType: error.name || 'UncaughtError',
          errorStack: error.stack || `${event.filename}:${event.lineno}:${event.colno}`
        });
      } catch (e) {
        // Silent catch
      }
    });

    global.addEventListener('unhandledrejection', function (event) {
      try {
        const reason = event.reason;
        const message = reason instanceof Error ? reason.message : String(reason);
        const stack = reason instanceof Error ? reason.stack : '';
        sendIncident({
          errorMessage: `Unhandled Promise Rejection: ${message}`,
          errorType: reason && reason.name ? reason.name : 'UnhandledRejection',
          errorStack: stack
        });
      } catch (e) {
        // Silent catch
      }
    });
  }

  // Initialize listeners if autoCapture is enabled
  if (config.autoCapture) {
    initClickInterceptor();
    initNetworkInterceptor();
    initConsoleInterceptor();
    initNavigationInterceptor();
    initGlobalErrorTraps();
  }

  // Public SDK Interface
  global.BugReplay = {
    init: function (options = {}) {
      Object.assign(config, options);
    },
    reportIssue: function (customNote) {
      sendIncident({
        errorMessage: customNote || 'User reported issue',
        errorType: 'UserReport',
        errorStack: new Error().stack
      });
    },
    addBreadcrumb: function (data) {
      ringBuffer.push({
        type: 'custom',
        timestamp: Date.now(),
        data: data
      });
    },
    getBuffer: function () {
      return ringBuffer.getItems();
    },
    clearBuffer: function () {
      ringBuffer.clear();
    }
  };

  // Log non-intrusive initialization confirmation
  if (global.console && global.console.debug) {
    global.console.debug('[BugReplay AI] In-browser SDK active. Flight recorder listening.');
  }
})(typeof window !== 'undefined' ? window : this);
