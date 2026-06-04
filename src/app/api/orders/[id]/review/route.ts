import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getSession } from '@/lib/session';
import { requireUser } from '@/services/auth/service';
import { saveReview } from '@/services/catalog/service';
import { unlockSellerKey } from '@/lib/auth/server-crypto';
import { handleApiError, ApiError } from '@/lib/api-error';
import { prisma } from '@/lib/db';
import * as commerceService from '@/services/commerce/service';

const REVIEW_ELIGIBLE_STATES = new Set(['DELIVERED', 'SHIPPED']);
const AUTO_RELEASE_DAYS = 14;

const postSchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().min(1).max(2000),
  password: z.string().min(1),
});

/**
 * POST /api/orders/[id]/review
 *
 * Buyer submits a review for a completed order.
 * Eligible when: order is DELIVERED, or SHIPPED and shippedAt ≥ 14 days ago.
 * Verified purchase gate: session user must be the order's buyer.
 * Decrypts buyer nsec, signs and publishes kind 30051, mirrors to Review table.
 *
 * Parameterized-replaceable: re-POSTing updates an existing review.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireUser(await getSession());
    const { id: orderId } = await params;

    const body = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    }
    const { rating, content, password } = parsed.data;

    // Get order — Commerce verifies the user has access (buyer or seller).
    const order = await commerceService.getOrderForUser(orderId, session.userId);

    // Verified purchase gate: only the buyer can post a review.
    if (order.buyerId !== session.userId) {
      throw new ApiError('FORBIDDEN', 'Only the buyer can review an order', 403);
    }

    // Eligibility check: DELIVERED, or SHIPPED past the auto-release window.
    const isDelivered = order.status === 'DELIVERED';
    const isShippedPast14 =
      order.status === 'SHIPPED' &&
      order.shippedAt !== null &&
      Date.now() - new Date(order.shippedAt).getTime() >= AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000;

    if (!REVIEW_ELIGIBLE_STATES.has(order.status) || (!isDelivered && !isShippedPast14)) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Reviews are only available once the order is delivered or has been shipped for 14+ days',
        422,
      );
    }

    // Fetch buyer's encrypted key blob.
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { encryptedKey: true, salt: true, iv: true },
    });

    if (!user?.encryptedKey || !user.salt || !user.iv) {
      throw new ApiError('INTERNAL_ERROR', 'Buyer key not found', 500);
    }

    let secretKey: Uint8Array;
    try {
      secretKey = await unlockSellerKey(user.encryptedKey, user.salt, user.iv, password);
    } catch {
      throw new ApiError('UNAUTHORIZED', 'Incorrect password', 401);
    }

    const review = await saveReview(order, rating, content, secretKey);
    return NextResponse.json(review, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
