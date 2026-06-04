/**
 * /api/orders/[id]/retry
 *
 * POST — create a fresh order + invoice for a cancelled/expired order.
 *
 * The original cancelled order is left untouched as a record.
 * A brand-new order ID is issued with a fresh BOLT-11 invoice.
 * Stock is re-decremented atomically — returns 409 if the product
 * sold out while the original order was pending.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import * as commerceService from '@/services/commerce/service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to retry this order', 401);

    const { id } = await params;
    const result = await commerceService.retryOrder(id, session.userId);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
