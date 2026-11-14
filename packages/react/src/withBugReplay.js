import { createElement } from 'react';
import { BugReplayErrorBoundary } from './BugReplayErrorBoundary.js';

/**
 * withBugReplay Higher-Order Component (HOC)
 * Wraps any React component with a BugReplayErrorBoundary.
 */
export function withBugReplay(WrappedComponent, errorBoundaryProps = {}) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  function ComponentWithBugReplay(props) {
    return createElement(
      BugReplayErrorBoundary,
      errorBoundaryProps,
      createElement(WrappedComponent, props)
    );
  }

  ComponentWithBugReplay.displayName = `withBugReplay(${displayName})`;
  return ComponentWithBugReplay;
}
