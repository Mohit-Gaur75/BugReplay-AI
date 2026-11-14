import React, { useEffect, useMemo, useRef, createElement } from 'react';
import { BugReplayContext } from './context.js';
import { init, captureException, addBreadcrumb, showReportWidget, getClient } from '@bugreplay/sdk';

/**
 * BugReplayProvider
 * Initializes BugReplay SDK once on mount and provides contextual helpers to the React tree.
 */
export function BugReplayProvider({
  apiKey,
  endpoint,
  maxEvents = 15,
  captureBodyUrls = [],
  maskPii = true,
  children,
}) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && apiKey) {
      init({
        apiKey,
        endpoint,
        maxEvents,
        captureBodyUrls,
        maskPii,
      });
      initialized.current = true;
    }
  }, [apiKey, endpoint, maxEvents, captureBodyUrls, maskPii]);

  const value = useMemo(() => ({
    apiKey,
    client: getClient(),
    captureException,
    addBreadcrumb,
    showReportWidget,
  }), [apiKey]);

  return createElement(BugReplayContext.Provider, { value }, children);
}
