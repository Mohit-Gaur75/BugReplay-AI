import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import {
  BugReplayNextScript,
  captureNextError,
  withBugReplayApi,
  BugReplayErrorBoundary,
} from '../src/index.js';

describe('@bugreplay/next Subsystem Test Suite', () => {
  beforeEach(() => {
    // Reset window mock
    globalThis.window = {
      location: {
        pathname: '/dashboard/analytics',
      },
      BugReplay: {
        buffer: {
          items: [],
          push(item) {
            this.items.push(item);
          },
          getItems() {
            return this.items;
          },
        },
        captureIncident(details, note) {
          this.lastCaptured = { details, note };
        },
      },
    };
  });

  test('BugReplayNextScript renders script tag with all data attributes', () => {
    const element = createElement(BugReplayNextScript, {
      apiKey: 'br_live_next_test_123',
      endpoint: 'https://bugreplay.example.com/api/v1/ingest',
      src: '/custom-sdk.js',
      captureConsole: true,
      captureNetwork: true,
      captureBodyUrls: ['/api/login', '/api/checkout'],
    });

    const html = renderToString(element);

    assert.ok(html.includes('id="bugreplay-next-sdk"'));
    assert.ok(html.includes('src="/custom-sdk.js"'));
    assert.ok(html.includes('data-api-key="br_live_next_test_123"'));
    assert.ok(html.includes('data-endpoint="https://bugreplay.example.com/api/v1/ingest"'));
    assert.ok(html.includes('data-capture-console="true"'));
    assert.ok(html.includes('data-capture-network="true"'));
    assert.ok(html.includes('data-capture-body-urls="/api/login,/api/checkout"'));
    assert.ok(html.includes('defer'));
  });

  test('captureNextError formats Next.js error digest and breadcrumb into incident', () => {
    const error = new Error('Dynamic server usage in client component');
    error.name = 'UnhandledRuntimeError';
    error.digest = 'NEXT_REDIRECT;replace;/login;307;';

    captureNextError(error, { route: '/dashboard/settings' });

    // Verify breadcrumb
    const items = globalThis.window.BugReplay.buffer.getItems();
    assert.equal(items.length, 1);
    assert.equal(items[0].type, 'nextjs_app_router_error');
    assert.equal(items[0].digest, 'NEXT_REDIRECT;replace;/login;307;');
    assert.equal(items[0].route, '/dashboard/settings');

    // Verify captured incident
    const captured = globalThis.window.BugReplay.lastCaptured;
    assert.ok(captured);
    assert.equal(captured.details.errorMessage, 'Dynamic server usage in client component');
    assert.equal(captured.details.errorType, 'UnhandledRuntimeError');
    assert.ok(captured.details.errorStack.includes('Next.js Error Digest: NEXT_REDIRECT'));
    assert.ok(captured.note.includes('NEXT_REDIRECT'));
  });

  test('withBugReplayApi passes through successful execution', async () => {
    const handler = async (req) => {
      return { status: 200, body: 'Success' };
    };

    const wrapped = withBugReplayApi(handler);
    const result = await wrapped({ method: 'GET', url: '/api/health' });
    assert.deepEqual(result, { status: 200, body: 'Success' });
  });

  test('withBugReplayApi wraps Pages Router API handler and sends 500 JSON on failure', async () => {
    let dispatchedPayload = null;
    let dispatchedHeaders = null;

    // Mock fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      dispatchedPayload = JSON.parse(options.body);
      dispatchedHeaders = options.headers;
      return { ok: true };
    };

    try {
      const failingHandler = async (req, res) => {
        throw new Error('Database connection failed in /api/users');
      };

      const wrapped = withBugReplayApi(failingHandler, {
        apiKey: 'br_live_api_route_key',
        endpoint: 'http://localhost:5001/api/v1/ingest',
      });

      const mockReq = {
        method: 'POST',
        url: '/api/users',
        headers: { 'user-agent': 'Jest-Test-Runner' },
      };

      let responseJson = null;
      let responseStatusCode = null;
      const mockRes = {
        status(code) {
          responseStatusCode = code;
          return this;
        },
        json(data) {
          responseJson = data;
          return this;
        },
      };

      await wrapped(mockReq, mockRes);

      // Verify response
      assert.equal(responseStatusCode, 500);
      assert.equal(responseJson.error, 'InternalServerError');
      assert.equal(responseJson.message, 'Database connection failed in /api/users');

      // Verify BugReplay dispatch
      assert.ok(dispatchedPayload);
      assert.equal(dispatchedPayload.errorMessage, 'Database connection failed in /api/users');
      assert.equal(dispatchedPayload.pageUrl, '/api/users');
      assert.equal(dispatchedPayload.userAgent, 'Jest-Test-Runner');
      assert.equal(dispatchedPayload.telemetry[0].status, 500);
      assert.equal(dispatchedHeaders['x-api-key'], 'br_live_api_route_key');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('withBugReplayApi wraps App Router route handler and rethrows after reporting', async () => {
    let dispatched = false;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      dispatched = true;
      return { ok: true };
    };

    try {
      const failingRouteHandler = async (req) => {
        throw new Error('Payment gateway timeout');
      };

      const wrapped = withBugReplayApi(failingRouteHandler, {
        apiKey: 'br_live_app_router_key',
      });

      const mockAppRouterReq = {
        method: 'POST',
        url: 'http://localhost:3000/api/checkout',
        headers: {
          get(key) {
            if (key === 'user-agent') return 'Mozilla/5.0';
            return null;
          },
        },
      };

      await assert.rejects(
        async () => {
          await wrapped(mockAppRouterReq);
        },
        {
          name: 'Error',
          message: 'Payment gateway timeout',
        }
      );

      assert.equal(dispatched, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('Next.js package re-exports React components for unified imports', () => {
    assert.equal(typeof BugReplayErrorBoundary, 'function');
  });
});
