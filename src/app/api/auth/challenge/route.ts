import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { cookies } from 'next/headers';

import { generateChallenge, getChallengeBlob } from '@/services/auth/service';
import { handleApiError } from '@/lib/api-error';

/**
 * POST /api/auth/challenge
 *
 * Step 1 of the challenge-response login flow.
 *
 * Given { username }, returns { challenge, encryptedKey, salt, iv, npub }
 * so the client can attempt local decryption of the stored key blob.
 * If decryption succeeds (correct password), the client signs the challenge
 * and calls POST /api/auth/login with the signed event.
 *
 * Anti-enumeration: on unknown username, returns an identical-shaped response
 * with random bytes so an attacker cannot tell if a username exists.
 *
 * Challenge storage: stashed in a short-lived HMAC-signed cookie (__challenge).
 * This keeps the server stateless across serverless invocations.
 */
const schema = z.object({
  username: z.string().min(1),
});

const CHALLENGE_COOKIE = '__challenge';
const CHALLENGE_TTL_MS = 60_000; // 60 seconds

function getChallengeSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET not configured');
  return s;
}

/** Build a signed, time-limited challenge token stored as a cookie value. */
export function buildChallengeToken(username: string, challenge: string): string {
  const payload = Buffer.from(
    JSON.stringify({ username, challenge, exp: Date.now() + CHALLENGE_TTL_MS }),
  ).toString('base64url');
  const sig = createHmac('sha256', getChallengeSecret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

/** Verify the challenge cookie and return { username, challenge } or null. */
export function verifyChallengeToken(token: string): { username: string; challenge: string } | null {
  try {
    const dotIndex = token.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const payload = token.slice(0, dotIndex);
    const sig = token.slice(dotIndex + 1);

    const expectedSig = createHmac('sha256', getChallengeSecret()).update(payload).digest('hex');
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const { username, challenge, exp } = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { username: string; challenge: string; exp: number };

    if (Date.now() > exp) return null; // expired

    return { username, challenge };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    // Normalise to lowercase slug so the lookup matches what's stored
    const username = parsed.success ? parsed.data.username.toLowerCase() : '';

    const challenge = generateChallenge();
    const blob = await getChallengeBlob(username);

    let responseBody: {
      challenge: string;
      encryptedKey: string;
      salt: string;
      iv: string;
      npub: string;
    };

    if (blob) {
      // Known user — return the real encrypted blob
      responseBody = { challenge, ...blob };
    } else {
      // Unknown user — return a fake but shape-identical response
      responseBody = {
        challenge,
        encryptedKey: randomBytes(48).toString('base64url'),
        salt: randomBytes(16).toString('base64url'),
        iv: randomBytes(12).toString('base64url'),
        npub: randomBytes(32).toString('hex'),
      };
    }

    // Stash the challenge in a short-lived signed cookie so /api/auth/login
    // can verify it without any server-side state (works on Vercel serverless).
    const challengeToken = buildChallengeToken(username, challenge);
    const cookieStore = await cookies();
    cookieStore.set({
      name: CHALLENGE_COOKIE,
      value: challengeToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60,
      path: '/',
    });

    return NextResponse.json(responseBody);
  } catch (err) {
    return handleApiError(err);
  }
}

export { CHALLENGE_COOKIE };
