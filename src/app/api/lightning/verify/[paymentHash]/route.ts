/**
 * /api/lightning/verify/[paymentHash]
 *
 * GET — frontend polls this every 2 seconds to detect payment settlement.
 * Returns InvoiceStatus. If settled, also triggers the markPaid side effects.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import * as commerceService from '@/services/commerce/service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ paymentHash: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to check payment status', 401);

    const { paymentHash } = await params;
    const result = await commerceService.checkInvoiceStatus(paymentHash, session.userId);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
