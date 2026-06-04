import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Event as NostrEvent } from 'nostr-tools';

import { getSession } from '@/lib/session';
import { getUserById, updateProfile, requireUser } from '@/services/auth/service';
import { handleApiError, ApiError } from '@/lib/api-error';

/**
 * GET /api/auth/me
 * Returns the current authenticated user, or 401 if not signed in.
 * Called by every page that needs to know who's logged in.
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Not signed in', 401);

    const user = await getUserById(session.userId);
    if (!user) throw new ApiError('UNAUTHORIZED', 'Session invalid', 401);

    return NextResponse.json({ user });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * PATCH /api/auth/me
 *
 * Update profile fields. All fields are optional.
 *
 * If a pre-signed kind 0 Nostr event is included, it will be verified
 * (pubkey must match the session user) and published to relays.
 * For buyers without a Nostr key, omit nostrEvent — only Postgres is updated.
 *
 * Body: {
 *   displayName?: string
 *   about?: string
 *   avatar?: string       (Cloudinary URL)
 *   location?: string     (e.g. "Lagos, Nigeria")
 *   lightningAddr?: string
 *   nostrEvent?: SignedNostrEvent   (pre-signed kind 0 event from client)
 * }
 */
const nostrEventSchema = z.object({
  id: z.string(),
  pubkey: z.string(),
  created_at: z.number(),
  kind: z.number(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: z.string(),
});

const patchSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  about: z.string().max(500).optional(),
  avatar: z.string().url().optional(),
  location: z.string().max(100).optional(),
  lightningAddr: z.string().max(100).optional(),
  nostrEvent: nostrEventSchema.optional(),
  nostrRelayListEvent: nostrEventSchema.optional(), // NIP-65 kind 10002, client-signed
});

export async function PATCH(req: NextRequest) {
  try {
    const session = requireUser(await getSession());

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    }

    const { nostrEvent, nostrRelayListEvent, ...profileFields } = parsed.data;

    const hasUpdate =
      profileFields.displayName !== undefined ||
      profileFields.about !== undefined ||
      profileFields.avatar !== undefined ||
      profileFields.location !== undefined ||
      profileFields.lightningAddr !== undefined;

    if (!hasUpdate) {
      throw new ApiError('VALIDATION_ERROR', 'At least one field must be provided', 400);
    }

    const user = await updateProfile(
      session.userId,
      profileFields,
      nostrEvent as NostrEvent | undefined,
      nostrRelayListEvent as NostrEvent | undefined,
    );

    return NextResponse.json({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
