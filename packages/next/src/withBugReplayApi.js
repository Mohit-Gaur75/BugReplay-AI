/**
 * withBugReplayApi
 * Wraps Next.js API Routes (Pages router or App Router Route Handlers)
 * to catch server-side exceptions and dispatch incidents to BugReplay AI.
 */
export function withBugReplayApi(handler, options = {}) {
  const apiKey = options.apiKey || process.env.BUGREPLAY_API_KEY;
  const endpoint = options.endpoint || process.env.BUGREPLAY_ENDPOINT || 'http://localhost:5001/api/v1/ingest';

  return async function wrappedApiHandler(...args) {
    const isAppRouter = args[0] instanceof Request || (args[0] && typeof args[0].headers?.get === 'function');

    try {
      return await handler(...args);
    } catch (err) {
      // Extract Request Context
      let method = 'GET';
      let url = '/api';
      let userAgent = 'NextJs-Server';

      if (isAppRouter) {
        const req = args[0];
        method = req.method || 'GET';
        url = req.url || '/api';
        userAgent = req.headers?.get?.('user-agent') || userAgent;
      } else {
        const req = args[0];
        method = req?.method || 'GET';
        url = req?.url || '/api';
        userAgent = req?.headers?.['user-agent'] || userAgent;
      }

      // Dispatch to BugReplay Server Ingestion if API key is configured
      if (apiKey) {
        const payload = {
          errorMessage: err?.message || 'Internal Next.js API Route Error',
          errorType: err?.name || 'NextApiServerError',
          errorStack: err?.stack || '',
          pageUrl: url,
          userAgent,
          viewport: 'server',
          telemetry: [
            {
              type: 'network',
              method,
              url,
              status: 500,
              timestamp: Date.now(),
              error: err?.message,
            },
          ],
        };

        try {
          await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
            },
            body: JSON.stringify(payload),
          });
        } catch (dispatchErr) {
          console.warn('[BugReplay] Failed to dispatch server incident:', dispatchErr.message);
        }
      }

      // Re-throw or send 500
      if (!isAppRouter && args[1] && typeof args[1].status === 'function') {
        const res = args[1];
        return res.status(500).json({
          error: 'InternalServerError',
          message: err?.message || 'Server error occurred and reported to BugReplay',
        });
      }

      throw err;
    }
  };
}
