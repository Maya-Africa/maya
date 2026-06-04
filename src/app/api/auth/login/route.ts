import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';

import { loginWithSignedChallenge } from '@/services/auth/service';
import { buildSessionCookie, sessionCookieOptions } from '@/lib/session';
import { handleApiError, ApiError } from '@/lib/api-error';
import { verifyChallengeToken, CHALLENGE_COOKIE } from '../challenge/route';

/**
 * POST /api/auth/login
 *
 * Step 2 of the challenge-response login flow.
 *
 * The client decrypts the stored key blob locally (using their password),
 * signs the challenge (from step 1) as a Nostr kind 27235 event, and sends
 * the full signed event here for verification.
 *
 * Body: { username, signedChallenge: NostrEvent }
 *
 * signedChallenge must be a complete signed Nostr event with:
 *   - kind: 27235
 *   - content: the exact challenge string returned by /api/auth/challenge
 *   - pubkey: the user's hex public key
 *   - a valid Schnorr signature
 *
 * On success: issues a session cookie. On failure: 401 (no info leak).
 */
const signedEventSchema = z.object({
  id: z.string(),
  pubkey: z.string(),
  created_at: z.number(),
  kind: z.number(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: z.string(),
});

const schema = z.object({
  username: z.string().min(1),
  signedChallenge: signedEventSchema,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError('VALIDATION_ERROR', 'username and signedChallenge are required', 400);
    }

    const { username, signedChallenge } = parsed.data;
    const normalizedUsername = username.toLowerCase();

    // Read and verify the challenge cookie (single-use, 60s TTL)
    const cookieStore = await cookies();
    const challengeToken = cookieStore.get(CHALLENGE_COOKIE)?.value;

    if (!challengeToken) {
      throw new ApiError('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    const tokenData = verifyChallengeToken(challengeToken);
    if (!tokenData || tokenData.username !== normalizedUsername) {
      throw new ApiError('UNAUTHORIZED', 'Invalid credentials', 401);
    }

    // Clear the challenge cookie immediately — single use
    cookieStore.set({
      name: CHALLENGE_COOKIE,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    const user = await loginWithSignedChallenge({
      username: normalizedUsername,
      signedEvent: signedChallenge,
      expectedChallenge: tokenData.challenge,
    });

    const token = buildSessionCookie({
      userId: user.id,
      role: user.role,
      username: user.username,
      npub: user.npub,
    });
    cookieStore.set(sessionCookieOptions(token));

    return NextResponse.json({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
