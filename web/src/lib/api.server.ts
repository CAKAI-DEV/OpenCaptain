import { cookies } from 'next/headers';

// Server-side uses internal Docker URL, falls back to localhost for local dev
const API_URL = process.env.API_URL || 'http://localhost:3000';
const API_BASE = `${API_URL}/api/v1`;

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown
  ) {
    super(`API Error: ${status}`);
    this.name = 'ApiError';
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * API client for Server Components
 * Automatically includes the access token from cookies
 */
export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new AuthError('Session expired');
    }
    throw new ApiError(response.status, await response.json());
  }

  return response.json();
}
