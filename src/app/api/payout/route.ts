/**
 * /api/payout
 *
 * POST — initiate a naira off-ramp payout via real Bitnob sandbox API
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import * as commerceService from '@/services/commerce/service';
import { payoutSchema } from '@/validators/order';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to withdraw funds', 401);
    if (session.role !== 'SELLER') throw new ApiError('FORBIDDEN', 'Only sellers can initiate payouts', 403);

    const body = payoutSchema.parse(await request.json());
    const result = await commerceService.initiatePayout(
      session.userId,
      BigInt(body.amountSats),
      body.bankAccountId,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ApiError('VALIDATION_ERROR', 'Invalid payout request', 400, error.flatten()));
    }
    return handleApiError(error);
  }
}
