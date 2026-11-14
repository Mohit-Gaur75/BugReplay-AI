export { BugReplayProvider } from './BugReplayProvider.js';
export { BugReplayErrorBoundary } from './BugReplayErrorBoundary.js';
export { useBugReplay } from './useBugReplay.js';
export { withBugReplay } from './withBugReplay.js';
export { BugReplayContext } from './context.js';

// Re-export SDK core primitives for direct access
export {
  init,
  captureException,
  addBreadcrumb,
  showReportWidget,
  getClient,
} from '@bugreplay/sdk';
