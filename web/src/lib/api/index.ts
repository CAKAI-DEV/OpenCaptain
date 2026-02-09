// Client-side API helpers
// All use credentials: include to send cookies

const API_BASE = '/api/v1';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiClientError(response.status, body);
  }

  if (response.status === 204) return {} as T;
  return response.json();
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public body: unknown
  ) {
    super(`API Error: ${status}`);
    this.name = 'ApiClientError';
  }
}

function get<T>(endpoint: string) {
  return request<T>(endpoint);
}

function post<T>(endpoint: string, data?: unknown) {
  return request<T>(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
}

function patch<T>(endpoint: string, data: unknown) {
  return request<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

function del<T>(endpoint: string, data?: unknown) {
  return request<T>(endpoint, {
    method: 'DELETE',
    body: data ? JSON.stringify(data) : undefined,
  });
}

export const api = { get, post, patch, del };
