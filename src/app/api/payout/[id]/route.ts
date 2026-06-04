/**
 * /api/payout/[id]
 *
 * GET — poll payout status (buyer polls after initiating withdrawal)
 */

import { NextResponse, type NextRequest } from 'next/server';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import * as payoutService from '@/services/payout/service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to check payout status', 401);

    const { id } = await params;
    const result = await payoutService.getPayoutStatusById(id);
    if (!result) throw new ApiError('NOT_FOUND', 'Payout not found', 404);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
