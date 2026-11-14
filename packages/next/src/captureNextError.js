import { captureException, addBreadcrumb, getClient } from '@bugreplay/sdk';

/**
 * captureNextError
 * Utility to capture errors within Next.js App Router error boundaries (app/error.tsx, app/global-error.tsx).
 * Captures Next.js internal error digests and route context.
 */
export function captureNextError(error, context = {}) {
  if (!error) return;

  const digest = error?.digest || context?.digest;
  const route = context?.route || (typeof window !== 'undefined' ? window.location.pathname : '');

  // 1. Record Next.js metadata breadcrumb
  addBreadcrumb({
    type: 'nextjs_app_router_error',
    digest,
    route,
    timestamp: Date.now(),
  });

  // 2. Format stack trace with Next.js digest
  const baseStack = error?.stack || '';
  const enhancedStack = digest
    ? `${baseStack}\n\nNext.js Error Digest: ${digest}`
    : baseStack;

  const errorDetails = {
    errorMessage: error?.message || 'Next.js App Router Error',
    errorType: error?.name || 'NextAppRouterError',
    errorStack: enhancedStack,
  };

  const client = getClient();
  const note = digest ? `[Next.js Digest: ${digest}]` : 'Captured via Next.js App Router error boundary';

  if (client) {
    client.captureIncident(errorDetails, note);
  } else {
    captureException(errorDetails.errorMessage, note);
  }
}
