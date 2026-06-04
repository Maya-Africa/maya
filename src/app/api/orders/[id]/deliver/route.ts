import { NextResponse, type NextRequest } from 'next/server';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import * as commerceService from '@/services/commerce/service';

/**
 * PATCH /api/orders/[id]/deliver
 * Buyer confirms receipt — transitions order SHIPPED → DELIVERED and
 * publishes a kind 30050 delivered event.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in required', 401);
    if (session.role !== 'BUYER') throw new ApiError('FORBIDDEN', 'Only buyers can confirm delivery', 403);

    const { id } = await params;
    const order = await commerceService.markDelivered(id, session.userId);
    return NextResponse.json(order);
  } catch (err) {
    return handleApiError(err);
  }
}
