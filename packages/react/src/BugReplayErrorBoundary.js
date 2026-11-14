import React, { Component, createElement } from 'react';
import { captureException, addBreadcrumb, getClient } from '@bugreplay/sdk';

/**
 * BugReplayErrorBoundary
 * Idiomatic React class Error Boundary that captures component stack traces,
 * records them into BugReplay telemetry, and dispatches an incident for Playwright synthesis.
 */
export class BugReplayErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
    this.resetError = this.resetError.bind(this);
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    this.state = {
      ...this.state,
      hasError: true,
      error,
      errorInfo,
    };

    const isMounted = typeof this.updater?.isMounted === 'function' ? this.updater.isMounted(this) : false;
    if (isMounted && typeof this.setState === 'function') {
      this.setState({ errorInfo });
    }

    // 1. Record React Component Stack breadcrumb
    addBreadcrumb({
      type: 'react_component_stack',
      componentStack: errorInfo?.componentStack || '',
      timestamp: Date.now(),
    });

    // 2. Dispatch Incident to BugReplay Flight Recorder
    const client = getClient();
    const errorStack = error?.stack || '';
    const componentStack = errorInfo?.componentStack || '';
    const fullStack = `${errorStack}\n\nReact Component Stack:${componentStack}`;

    const errorDetails = {
      errorMessage: error?.message || 'Uncaught React Rendering Error',
      errorType: error?.name || 'ReactRenderError',
      errorStack: fullStack,
    };

    if (client) {
      const extra = typeof this.props.extraContext === 'function'
        ? this.props.extraContext()
        : this.props.extraContext;

      const userNote = extra ? `[React Context: ${JSON.stringify(extra)}]` : 'Captured via BugReplayErrorBoundary';
      client.captureIncident(errorDetails, userNote);
    } else {
      captureException(error, 'Captured via BugReplayErrorBoundary');
    }

    // 3. User callback
    if (typeof this.props.onError === 'function') {
      try {
        this.props.onError(error, errorInfo);
      } catch (cbErr) {
        console.error('[BugReplay] Error in onError callback:', cbErr);
      }
    }
  }

  resetError() {
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };

    const isMounted = typeof this.updater?.isMounted === 'function' ? this.updater.isMounted(this) : false;
    if (isMounted && typeof this.setState === 'function') {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
      });
    }
  }

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { fallback, children } = this.props;

    if (!hasError) {
      return children;
    }

    // 1. Function Fallback
    if (typeof fallback === 'function') {
      return fallback({
        error,
        errorInfo,
        resetError: this.resetError,
      });
    }

    // 2. React Element Fallback
    if (React.isValidElement(fallback)) {
      return fallback;
    }

    // 3. Default Clean Fallback Card
    return createElement(
      'div',
      {
        role: 'alert',
        style: {
          padding: '24px',
          margin: '16px 0',
          borderRadius: '12px',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #334155',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        },
      },
      createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', marginBottom: '12px' } },
        createElement('span', { style: { fontSize: '20px', marginRight: '8px' } }, '⚠️'),
        createElement(
          'h3',
          { style: { margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#f43f5e' } },
          'Application Rendering Error'
        )
      ),
      createElement(
        'p',
        { style: { margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' } },
        'An unhandled error occurred in this component. A reproduction flight recording has been automatically captured by BugReplay AI.'
      ),
      error?.message
        ? createElement(
            'pre',
            {
              style: {
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#020617',
                color: '#fda4af',
                fontSize: '12px',
                overflowX: 'auto',
                marginBottom: '16px',
                border: '1px solid #1e293b',
              },
            },
            error.message
          )
        : null,
      createElement(
        'button',
        {
          onClick: this.resetError,
          style: {
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
          },
        },
        'Try Again'
      )
    );
  }
}
