export { BugReplayNextScript } from './BugReplayNextScript.js';
export { captureNextError } from './captureNextError.js';
export { withBugReplayApi } from './withBugReplayApi.js';

// Re-export core React components and hooks for convenience
export {
  BugReplayProvider,
  BugReplayErrorBoundary,
  useBugReplay,
  withBugReplay,
  BugReplayContext,
  init,
  captureException,
  addBreadcrumb,
  showReportWidget,
  getClient,
} from '@bugreplay/react';
