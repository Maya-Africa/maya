import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';

import { signup, deriveUsernameSlug, resolveUniqueSlug } from '@/services/auth/service';
import { buildSessionCookie, sessionCookieOptions } from '@/lib/session';
import { handleApiError, ApiError } from '@/lib/api-error';

/**
 * POST /api/auth/signup
 *
 * Client-side-crypto model: the server NEVER receives the password or
 * plaintext nsec. The client generates the Nostr keypair and encrypts
 * the secret key (PBKDF2 + AES-GCM) before sending.
 *
 * Body: { username, displayName?, role, npub, encryptedKey, salt, iv }
 *   - username: display name / desired slug (will be slugified server-side)
 *   - npub: hex-encoded 32-byte Nostr public key (NOT bech32)
 *   - encryptedKey: base64url AES-GCM ciphertext of the secret key
 *   - salt: base64url PBKDF2 salt (16 bytes)
 *   - iv: base64url AES-GCM IV (12 bytes)
 */
const schema = z.object({
  username: z.string().min(1).max(80),
  displayName: z.string().max(80).optional(),
  role: z.enum(['BUYER', 'SELLER']).default('BUYER'),
  // Nostr pubkey as 64-char hex string (NOT "npub1..." bech32)
  npub: z.string().regex(/^[0-9a-f]{64}$/, 'npub must be a 64-char hex string'),
  encryptedKey: z.string().min(1, 'encryptedKey is required'),
  salt: z.string().min(1, 'salt is required'),
  iv: z.string().min(1, 'iv is required'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    }

    const { username: rawUsername, displayName, role, npub, encryptedKey, salt, iv } = parsed.data;

    // Derive and validate the URL-safe slug
    const baseSlug = deriveUsernameSlug(rawUsername);
    const username = await resolveUniqueSlug(baseSlug);

    const user = await signup({ username, displayName, role, npub, encryptedKey, salt, iv });

    const token = buildSessionCookie({
      userId: user.id,
      role: user.role,
      username: user.username,
      npub: user.npub,
    });
    (await cookies()).set(sessionCookieOptions(token));

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
