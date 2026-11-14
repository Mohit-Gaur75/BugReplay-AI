import { useBugReplayContext } from './context.js';
import { captureException, addBreadcrumb, showReportWidget, getClient } from '@bugreplay/sdk';

/**
 * useBugReplay hook
 * Returns contextual helpers for manual error capture, breadcrumb tracking, and report modal.
 */
export function useBugReplay() {
  let context = null;
  try {
    context = useBugReplayContext();
  } catch {
    // Graceful fallback when invoked outside React render lifecycle
  }

  if (context) {
    return context;
  }

  // Fallback to direct SDK functions if used outside provider
  return {
    apiKey: null,
    client: getClient(),
    captureException,
    addBreadcrumb,
    showReportWidget,
  };
}
