/**
 * /api/payout/history
 *
 * GET — paginated list of the authenticated seller's payouts.
 * Used by /seller/withdraw/history to show past withdrawal records.
 *
 * Query params:
 *   cursor  — last seen Payout.id (omit for first page)
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
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to view payout history', 401);
    if (session.role !== 'SELLER') throw new ApiError('FORBIDDEN', 'Only sellers have payouts', 403);

    const params = activityQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const result = await commerceService.getPayoutHistory(
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
