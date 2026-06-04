/**
 * /api/wallet/balance
 *
 * GET — return the authenticated seller's current sats balance.
 * Reads from Breez wallet (mock in dev). Cached for 10s on the client via SWR.
 */

import { NextResponse } from 'next/server';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import * as commerceService from '@/services/commerce/service';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to view your balance', 401);
    if (session.role !== 'SELLER') throw new ApiError('FORBIDDEN', 'Only sellers have a wallet balance', 403);

    const balance = await commerceService.getSellerBalance(session.userId);
    return NextResponse.json(balance);
  } catch (error) {
    return handleApiError(error);
  }
}
