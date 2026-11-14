import crypto from 'crypto';

/**
 * Incident Fingerprinting Engine
 * Generates canonical, normalized fingerprint hashes for error deduplication.
 * Prevents telemetry storms and burns of AI quotas during recurring production errors.
 */
export class FingerprintService {
  /**
   * Normalize an error message by stripping transient variable values (UUIDs, timestamps, numbers, memory addresses)
   */
  static normalizeErrorMessage(message) {
    if (!message || typeof message !== 'string') return 'UnknownError';

    return message
      // Replace UUIDs
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
      // Replace ISO timestamps
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/gi, '<TIMESTAMP>')
      // Replace hex memory addresses
      .replace(/0x[0-9a-fA-F]+/g, '<HEX>')
      // Replace line and column numbers (e.g. :123:45)
      .replace(/:\d+:\d+/g, ':<LINE>:<COL>')
      // Replace standalone IDs / large numbers
      .replace(/\b\d{4,}\b/g, '<ID>')
      .trim();
  }

  /**
   * Extract top non-internal frames from stack trace
   */
  static normalizeStack(stack) {
    if (!stack || typeof stack !== 'string') return '';

    const lines = stack.split('\n');
    const relevantFrames = [];

    for (let i = 1; i < lines.length && relevantFrames.length < 3; i++) {
      const line = lines[i].trim();
      // Skip node internals
      if (line.includes('node:internal') || line.includes('node_modules')) continue;
      
      // Clean frame down to function and sanitized file
      const cleaned = line
        .replace(/:\d+:\d+/g, '') // remove line:col
        .replace(/\(.*?\)/g, '')   // remove parens
        .trim();
      if (cleaned) {
        relevantFrames.push(cleaned);
      }
    }

    return relevantFrames.join('|');
  }

  /**
   * Normalize page URL to just its pathname
   */
  static normalizePath(pageUrl) {
    if (!pageUrl) return '/';
    try {
      const parsed = new URL(pageUrl, 'http://localhost');
      return parsed.pathname;
    } catch (e) {
      return pageUrl.split('?')[0].split('#')[0] || '/';
    }
  }

  /**
   * Compute a 64-character SHA-256 canonical fingerprint
   */
  static computeFingerprint({ errorType = 'Error', errorMessage = '', errorStack = '', pageUrl = '' }) {
    const normType = (errorType || 'Error').trim();
    const normMsg = this.normalizeErrorMessage(errorMessage);
    const normStack = this.normalizeStack(errorStack);
    const normPath = this.normalizePath(pageUrl);

    const canonicalString = `${normType}:::${normMsg}:::${normStack}:::${normPath}`;
    return crypto.createHash('sha256').update(canonicalString).digest('hex');
  }
}
