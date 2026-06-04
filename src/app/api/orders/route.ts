/**
 * /api/orders
 *
 * Owned by the Commerce Engineer.
 * GET  — list the current user's orders (buyer sees their purchases, seller sees their sales)
 * POST — create a new order and return the Lightning invoice
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import * as commerceService from '@/services/commerce/service';
import { createOrderSchema, listOrdersQuerySchema } from '@/validators/order';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to view orders', 401);

    const params = listOrdersQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const result = await commerceService.listOrdersForUser(
      session.userId,
      session.role,
      params.page,
      params.pageSize,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ApiError('VALIDATION_ERROR', 'Invalid query parameters', 400, error.flatten()));
    }
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to place an order', 401);

    const body = createOrderSchema.parse(await request.json());

    const order = await commerceService.createOrder({
      productId: body.productId,
      quantity: body.quantity,
      buyerId: session.userId,
      buyerNpub: session.npub,
      encryptedShipping: body.encryptedShipping,
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ApiError('VALIDATION_ERROR', 'Invalid order data', 400, error.flatten()));
    }
    return handleApiError(error);
  }
}
