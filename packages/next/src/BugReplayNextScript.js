import { createElement } from 'react';

/**
 * BugReplayNextScript
 * Drop-in script component for Next.js App Router (app/layout.tsx) or Pages Router (pages/_app.tsx).
 * Non-blocking, deferred flight recorder injection.
 */
export function BugReplayNextScript({
  apiKey,
  endpoint,
  src = '/bugreplay.js',
  captureConsole = true,
  captureNetwork = true,
  captureBodyUrls = [],
}) {
  if (!apiKey) {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      console.warn('[BugReplay] Missing apiKey in BugReplayNextScript.');
    }
  }

  const captureBodyUrlsStr = Array.isArray(captureBodyUrls) ? captureBodyUrls.join(',') : '';

  return createElement('script', {
    id: 'bugreplay-next-sdk',
    src,
    'data-api-key': apiKey,
    'data-endpoint': endpoint,
    'data-capture-console': String(captureConsole),
    'data-capture-network': String(captureNetwork),
    'data-capture-body-urls': captureBodyUrlsStr,
    defer: true,
  });
}
