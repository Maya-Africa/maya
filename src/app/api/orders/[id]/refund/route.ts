import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import * as commerceService from '@/services/commerce/service';

const bodySchema = z.object({
  note: z.string().max(500).optional(),
});

/**
 * POST /api/orders/[id]/refund
 * Seller or admin issues a refund — transitions order to CANCELLED and
 * publishes a kind 30050 refunded event signed by the system key.
 * Per §2.1: refunded is system-only in v1; seller requests go through
 * this endpoint which validates seller ownership before triggering.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in required', 401);
    if (session.role !== 'SELLER') throw new ApiError('FORBIDDEN', 'Only sellers can initiate refunds', 403);

    const { id } = await params;

    // Verify the seller owns this order before refunding.
    const existing = await commerceService.getOrderForUser(id, session.userId);
    if (existing.sellerId !== session.userId) {
      throw new ApiError('FORBIDDEN', 'Not your order', 403);
    }

    const body = bodySchema.safeParse(await req.json().catch(() => ({})));
    const note = body.success ? body.data.note : undefined;

    const order = await commerceService.refundOrder(id, note);
    return NextResponse.json(order);
  } catch (err) {
    return handleApiError(err);
  }
}
