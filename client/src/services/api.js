/**
 * Centralized API Client with JWT Auth and Error Handling
 */

const BASE_URL = '/api/v1';

export class ApiError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', status = 500, details = []) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('bugreplay_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle file downloads
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/javascript') || contentType.includes('text/plain')) {
    if (!response.ok) throw new ApiError('Failed to download file', 'DOWNLOAD_ERROR', response.status);
    return response.text();
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    data = {};
  }

  if (!response.ok) {
    const errorMsg = data?.error?.message || `Request failed with status ${response.status}`;
    const errorCode = data?.error?.code || 'API_ERROR';
    const errorDetails = data?.error?.details || [];
    throw new ApiError(errorMsg, errorCode, response.status, errorDetails);
  }

  return data;
}

export const api = {
  get: (endpoint, options) => apiRequest(endpoint, { method: 'GET', ...options }),
  post: (endpoint, body, options) => apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body), ...options }),
  patch: (endpoint, body, options) => apiRequest(endpoint, { method: 'PATCH', body: JSON.stringify(body), ...options }),
  delete: (endpoint, options) => apiRequest(endpoint, { method: 'DELETE', ...options }),
};
