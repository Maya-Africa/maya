/**
 * /api/auth/profile — DEPRECATED
 *
 * This route has moved to /api/auth/me (PATCH).
 * Keeping this file as a redirect stub so any bookmarked calls don't hard-404.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest) {
  // Forward to the canonical route
  const url = new URL('/api/auth/me', req.url);
  return NextResponse.redirect(url, { status: 308 }); // 308 = Permanent Redirect, preserves method
}
