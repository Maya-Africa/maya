import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import type { UserRole } from '@/types/shared';

const COOKIE_NAME = 'maya_session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export interface SessionData {
  userId: string;
  role: UserRole;
  username: string;
  npub: string;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET not configured');
  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

function encode(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

function decode(token: string): SessionData | null {
  try {
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const payload = token.slice(0, dotIndex);
    const sig = token.slice(dotIndex + 1);

    const expectedSig = sign(payload);
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');

    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionData;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decode(token);
}

export function buildSessionCookie(data: SessionData): string {
  return encode(data);
}

export function sessionCookieOptions(value: string) {
  return {
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE,
    path: '/',
  };
}

export function clearSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  };
}
