import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE = process.env.API_URL || 'http://localhost:3000/api/v1';

export async function POST(request: Request) {
  const body = await request.json();

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return NextResponse.json(await response.json(), { status: response.status });
  }

  const data = await response.json();
  const cookieStore = await cookies();

  // Set HTTP-only cookies for security
  cookieStore.set('access_token', data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15, // 15 minutes
    path: '/',
  });

  cookieStore.set('refresh_token', data.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  return NextResponse.json({ user: data.user });
}
