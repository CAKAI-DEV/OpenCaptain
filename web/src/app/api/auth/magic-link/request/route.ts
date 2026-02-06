import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:3000';

export async function POST(request: Request) {
  const body = await request.json();

  const response = await fetch(`${API_URL}/api/v1/auth/magic-link/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Always return the backend response as-is
  // Backend already handles email enumeration protection
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
