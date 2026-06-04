/**
 * /api/orders/[id]/ship
 *
 * PATCH — seller marks an order as shipped (auth: seller of that order only)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import * as commerceService from '@/services/commerce/service';
import { shipOrderSchema } from '@/validators/order';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to update this order', 401);
    if (session.role !== 'SELLER') throw new ApiError('FORBIDDEN', 'Only sellers can mark orders shipped', 403);

    const { id } = await params;
    const body = shipOrderSchema.parse(await request.json().catch(() => ({})));

    const order = await commerceService.markShipped(id, session.userId, body.shippingNote);
    return NextResponse.json(order);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ApiError('VALIDATION_ERROR', 'Invalid request body', 400, error.flatten()));
    }
    return handleApiError(error);
  }
}
