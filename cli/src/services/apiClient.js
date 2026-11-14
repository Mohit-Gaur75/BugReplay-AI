import { loadConfig } from '../utils/configStore.js';

export class ApiClient {
  static getBaseUrl(overrideUrl = null) {
    if (overrideUrl) {
      return overrideUrl.replace(/\/$/, '');
    }
    const config = loadConfig();
    return (config.serverUrl || process.env.BUGREPLAY_SERVER || 'http://localhost:5001').replace(/\/$/, '');
  }

  static getHeaders(options = {}) {
    const config = loadConfig();
    const headers = { 'Content-Type': 'application/json' };

    // Explicit options take highest priority
    if (options.apiKey || options.key) {
      headers['x-api-key'] = options.apiKey || options.key;
      return headers;
    }
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
      return headers;
    }

    // Config / environment fallback
    if (config.token || process.env.BUGREPLAY_TOKEN) {
      headers['Authorization'] = `Bearer ${config.token || process.env.BUGREPLAY_TOKEN}`;
    } else if (config.apiKey || process.env.BUGREPLAY_KEY) {
      headers['x-api-key'] = config.apiKey || process.env.BUGREPLAY_KEY;
    }
    return headers;
  }

  static async fetchWithFallback(path, fetchOptions = {}, serverOverride = null) {
    const primaryUrl = this.getBaseUrl(serverOverride);
    try {
      return await fetch(`${primaryUrl}${path}`, fetchOptions);
    } catch (err) {
      // If server was not explicitly overridden and failed on default 5001, try 5000 as fallback
      if (!serverOverride && primaryUrl.includes('localhost:5001')) {
        try {
          const fallbackUrl = primaryUrl.replace('localhost:5001', 'localhost:5000');
          return await fetch(`${fallbackUrl}${path}`, fetchOptions);
        } catch (fallbackErr) {
          throw err;
        }
      }
      throw err;
    }
  }

  static async login(email, password, serverUrl = null) {
    const res = await this.fetchWithFallback(
      '/api/v1/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      },
      serverUrl
    );

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Login failed with status ${res.status}`);
    }

    return data.data; // { user, token }
  }

  static async listIncidents(options = {}) {
    const headers = this.getHeaders(options);
    const res = await this.fetchWithFallback(
      '/api/v1/incidents?limit=10',
      { headers },
      options.server
    );

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Failed to fetch incidents (${res.status})`);
    }

    return data.data?.incidents || [];
  }

  static async getIncident(incidentId, options = {}) {
    const headers = this.getHeaders(options);
    const res = await this.fetchWithFallback(
      `/api/v1/incidents/${incidentId}`,
      { headers },
      options.server
    );

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Failed to fetch incident ${incidentId} (${res.status})`);
    }

    return data.data?.incident;
  }
}
