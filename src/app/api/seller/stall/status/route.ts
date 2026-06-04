import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/session';
import { requireSeller } from '@/services/auth/service';
import { updateStallStatus } from '@/services/catalog/service';
import { unlockSellerKey } from '@/lib/auth/server-crypto';
import { handleApiError, ApiError } from '@/lib/api-error';
import { prisma } from '@/lib/db';

const patchSchema = z.object({
  status: z.enum(['open', 'vacation', 'closed']),
  message: z.string().max(200).optional(),
  password: z.string().min(1),
});

/**
 * PATCH /api/seller/stall/status
 *
 * Set the stall's operational status (open / vacation / closed).
 * Decrypts the seller's Nostr key server-side with their password,
 * signs and publishes a kind 30053 event, and mirrors the status to
 * the DB for fast storefront reads.
 *
 * Body: { status, message?, password }
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = requireSeller(await getSession());

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    }

    const { status, message, password } = parsed.data;

    // Fetch the seller's encrypted key blob.
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { encryptedKey: true, salt: true, iv: true },
    });

    if (!user?.encryptedKey || !user.salt || !user.iv) {
      throw new ApiError('INTERNAL_ERROR', 'Seller key not found', 500);
    }

    // Decrypt mnemonic → derive secret key. Throws on wrong password.
    let secretKey: Uint8Array;
    try {
      secretKey = await unlockSellerKey(user.encryptedKey, user.salt, user.iv, password);
    } catch {
      throw new ApiError('UNAUTHORIZED', 'Incorrect password', 401);
    }

    const result = await updateStallStatus(session.userId, status, message, secretKey);

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
