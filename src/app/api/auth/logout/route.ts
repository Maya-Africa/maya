import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { clearSessionCookieOptions } from '@/lib/session';

export async function POST() {
  (await cookies()).set(clearSessionCookieOptions());
  return NextResponse.json({ ok: true });
}
