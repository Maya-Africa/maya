import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/session';
import { updateLongBio, requireSeller } from '@/services/auth/service';
import { handleApiError, ApiError } from '@/lib/api-error';

const patchSchema = z.object({
  longBio: z.string().min(1).max(10000),
});

/**
 * PATCH /api/auth/me/long-bio
 *
 * Save a seller's long-form bio (markdown). On success, publishes a NIP-23
 * kind 30023 event to relays. Sellers only.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = requireSeller(await getSession());

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    }

    const user = await updateLongBio(session.userId, parsed.data.longBio);
    return NextResponse.json({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
