import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { BugReplayErrorBoundary } from '../src/BugReplayErrorBoundary.js';
import { withBugReplay } from '../src/withBugReplay.js';
import { useBugReplay } from '../src/useBugReplay.js';

describe('@bugreplay/react Subsystem Test Suite', () => {
  beforeEach(() => {
    // Reset window mock
    globalThis.window = {
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

  test('BugReplayErrorBoundary renders children normally when no error occurs', () => {
    const Child = () => createElement('div', { id: 'child-content' }, 'Hello BugReplay');
    const tree = createElement(BugReplayErrorBoundary, null, createElement(Child));
    const html = renderToString(tree);

    assert.ok(html.includes('Hello BugReplay'));
  });

  test('BugReplayErrorBoundary catches render error and records component stack', () => {
    const errorBoundary = new BugReplayErrorBoundary({
      extraContext: { page: 'checkout' },
    });

    const mockError = new Error('State corruption in checkout button');
    mockError.name = 'TypeError';
    const mockErrorInfo = {
      componentStack: '\n    at CheckoutButton\n    at CartSummary\n    at App',
    };

    errorBoundary.componentDidCatch(mockError, mockErrorInfo);

    // Verify error state
    assert.equal(errorBoundary.state.errorInfo, mockErrorInfo);

    // Verify breadcrumb pushed to window.BugReplay
    const items = globalThis.window.BugReplay.buffer.getItems();
    assert.equal(items.length, 1);
    assert.equal(items[0].type, 'react_component_stack');
    assert.ok(items[0].componentStack.includes('CheckoutButton'));

    // Verify incident captured
    assert.ok(globalThis.window.BugReplay.lastCaptured);
    assert.equal(globalThis.window.BugReplay.lastCaptured.details.errorMessage, 'State corruption in checkout button');
    assert.ok(globalThis.window.BugReplay.lastCaptured.details.errorStack.includes('React Component Stack:'));
    assert.ok(globalThis.window.BugReplay.lastCaptured.note.includes('checkout'));
  });

  test('BugReplayErrorBoundary renders custom fallback element or function', () => {
    const boundary = new BugReplayErrorBoundary({
      fallback: ({ error, resetError }) => createElement('button', { onClick: resetError }, `Error: ${error.message}`),
    });

    boundary.state = {
      hasError: true,
      error: new Error('Custom crash message'),
      errorInfo: null,
    };

    const rendered = boundary.render();
    const html = renderToString(rendered);
    assert.ok(html.includes('Error: Custom crash message'));
  });

  test('resetError() resets boundary state to non-error', () => {
    const boundary = new BugReplayErrorBoundary({});
    boundary.state = {
      hasError: true,
      error: new Error('Temp error'),
      errorInfo: {},
    };

    boundary.resetError();
    assert.equal(boundary.state.hasError, false);
    assert.equal(boundary.state.error, null);
    assert.equal(boundary.state.errorInfo, null);
  });

  test('withBugReplay HOC wraps component with BugReplayErrorBoundary', () => {
    const SimpleComponent = (props) => createElement('span', null, props.label);
    const Wrapped = withBugReplay(SimpleComponent);

    assert.equal(Wrapped.displayName, 'withBugReplay(SimpleComponent)');

    const html = renderToString(createElement(Wrapped, { label: 'Wrapped Test' }));
    assert.ok(html.includes('Wrapped Test'));
  });

  test('useBugReplay hook returns fallback functions when outside provider', () => {
    let hookResult = null;
    function Consumer() {
      hookResult = useBugReplay();
      return createElement('span', null, 'Consumer');
    }
    renderToString(createElement(Consumer));

    assert.equal(typeof hookResult.captureException, 'function');
    assert.equal(typeof hookResult.addBreadcrumb, 'function');
    assert.equal(typeof hookResult.showReportWidget, 'function');
  });
});
