import { loadConfig } from '../utils/configStore.js';

export class ApiClient {
  static getBaseUrl() {
    const config = loadConfig();
    return (config.serverUrl || 'http://localhost:5000').replace(/\/$/, '');
  }

  static getHeaders() {
    const config = loadConfig();
    const headers = { 'Content-Type': 'application/json' };
    if (config.token) {
      headers['Authorization'] = `Bearer ${config.token}`;
    }
    return headers;
  }

  static async login(email, password, serverUrl = null) {
    const baseUrl = (serverUrl || this.getBaseUrl()).replace(/\/$/, '');
    const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Login failed with status ${res.status}`);
    }

    return data.data; // { user, token }
  }

  static async listIncidents() {
    const baseUrl = this.getBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/incidents?limit=10`, {
      headers: this.getHeaders(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Failed to fetch incidents (${res.status})`);
    }

    return data.data?.incidents || [];
  }

  static async getIncident(incidentId) {
    const baseUrl = this.getBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/incidents/${incidentId}`, {
      headers: this.getHeaders(),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Failed to fetch incident ${incidentId} (${res.status})`);
    }

    return data.data?.incident;
  }
}
