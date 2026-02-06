import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_BASE = process.env.API_URL || 'http://localhost:3000/api/v1';

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  // Call backend logout if we have a token
  if (accessToken) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // Ignore errors - we're logging out anyway
    }
  }

  // Clear cookies
  cookieStore.delete('access_token');
  cookieStore.delete('refresh_token');

  return NextResponse.json({ message: 'Logged out' });
}
