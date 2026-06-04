import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import * as commerceService from '@/services/commerce/service';

const bodySchema = z.object({
  reason: z.string().max(500).optional(),
});

/**
 * PATCH /api/orders/[id]/dispute
 * Buyer raises a dispute — publishes a kind 30050 disputed event and marks
 * the DB currentState. Order DB status is unchanged until resolution.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in required', 401);
    if (session.role !== 'BUYER') throw new ApiError('FORBIDDEN', 'Only buyers can raise a dispute', 403);

    const { id } = await params;
    const body = bodySchema.safeParse(await req.json().catch(() => ({})));
    const reason = body.success ? body.data.reason : undefined;

    const order = await commerceService.disputeOrder(id, session.userId, reason);
    return NextResponse.json(order);
  } catch (err) {
    return handleApiError(err);
  }
}
