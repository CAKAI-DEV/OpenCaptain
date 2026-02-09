import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    // Decode JWT payload (middle segment) without verifying — the backend already verified it when issuing
    const payload = JSON.parse(atob(token.split('.')[1]));
    return NextResponse.json({
      user: { id: payload.sub, email: payload.email, orgId: payload.org },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
