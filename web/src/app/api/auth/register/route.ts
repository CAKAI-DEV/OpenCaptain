import { NextResponse } from 'next/server';

const API_BASE = process.env.API_URL || 'http://localhost:3000/api/v1';

export async function POST(request: Request) {
  const body = await request.json();

  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
