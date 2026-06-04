/**
 * /api/dev/settle — demo-only endpoint to manually trigger payment settlement.
 *
 * POST { paymentHash } → runs the same markPaid path that the Breez SDK
 * paymentSucceeded event handler fires, so the full UI flow can be demoed
 * without waiting for a real Lightning payment to settle.
 *
 * NEVER expose this in production. The guard at the top ensures it's unreachable.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { handleApiError, ApiError } from '@/lib/api-error';
import * as commerceService from '@/services/commerce/service';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
  }

  try {
    const { paymentHash } = (await request.json()) as { paymentHash?: string };
    if (!paymentHash) throw new ApiError('VALIDATION_ERROR', 'paymentHash required', 400);

    const order = await commerceService.markPaid(paymentHash);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    return handleApiError(error);
  }
}
