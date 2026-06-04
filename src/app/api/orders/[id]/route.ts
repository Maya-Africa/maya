/**
 * /api/orders/[id]
 *
 * GET — fetch a single order with role-differentiated response.
 *
 * Buyer view: includes `seller` summary block, never `encryptedShipping`.
 * Seller view: includes `encryptedShipping` + `buyer.npub`, never seller block.
 * Stranger: 403 (never 404 — don't leak whether an order ID exists).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import * as commerceService from '@/services/commerce/service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to view this order', 401);

    const { id } = await params;
    const order = await commerceService.getOrderDetailForUser(id, session.userId, session.role);
    return NextResponse.json(order);
  } catch (error) {
    return handleApiError(error);
  }
}
