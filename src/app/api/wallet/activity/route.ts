/**
 * /api/wallet/activity
 *
 * GET — paginated seller ledger feed (SALE, WITHDRAWAL, REFUND, ADJUSTMENT).
 *
 * Cursor pagination on LedgerEntry.id (cuid — monotonically increasing).
 * amountNgnDisplay is computed from the rate snapshotted at entry time,
 * NOT the current rate — historical values stay stable as BTC/NGN moves.
 *
 * Query params:
 *   cursor  — last seen LedgerEntry.id (omit for first page)
 *   limit   — entries per page, default 20, max 100
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import { activityQuerySchema } from '@/validators/order';
import * as commerceService from '@/services/commerce/service';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to view wallet activity', 401);
    if (session.role !== 'SELLER') throw new ApiError('FORBIDDEN', 'Only sellers have a wallet activity feed', 403);

    const params = activityQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const result = await commerceService.getWalletActivity(
      session.userId,
      params.cursor,
      params.limit,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ApiError('VALIDATION_ERROR', 'Invalid query parameters', 400, error.flatten()));
    }
    return handleApiError(error);
  }
}
