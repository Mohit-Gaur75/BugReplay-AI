import './bugreplay.js';

/**
 * BugReplay AI — Official Client Capture SDK (ES Module Entrypoint)
 */

function getGlobalClient() {
  if (typeof window !== 'undefined' && window.BugReplay) {
    return window.BugReplay;
  }
  return null;
}

export function init(options = {}) {
  const client = getGlobalClient();
  if (client) {
    client.init(options);
    return client;
  }
  return null;
}

export function captureException(error, note = '') {
  const client = getGlobalClient();
  if (!client) {
    console.warn('[BugReplay] SDK not initialized. Call init({ apiKey }) before capturing errors.');
    return;
  }

  const errorDetails = typeof error === 'string'
    ? { errorMessage: error, errorType: 'Error', errorStack: '' }
    : {
        errorMessage: error?.message || 'Unknown Error',
        errorType: error?.name || 'Error',
        errorStack: error?.stack || '',
      };

  client.captureIncident(errorDetails, note);
}

export function addBreadcrumb(event) {
  const client = getGlobalClient();
  if (client && client.buffer) {
    client.buffer.push({
      timestamp: Date.now(),
      ...event,
    });
  }
}

export function showReportWidget() {
  const client = getGlobalClient();
  if (client) {
    client.showReportWidget();
  }
}

export function getClient() {
  return getGlobalClient();
}

export default {
  init,
  captureException,
  addBreadcrumb,
  showReportWidget,
  getClient,
};
