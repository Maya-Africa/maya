/**
 * /api/lnurlp/[username]/callback
 *
 * LNURL-pay step 2: wallet GETs this with ?amount=<msats>, server returns a BOLT-11 invoice.
 * Called by external Lightning wallets after the metadata fetch from step 1.
 *
 * Uses the platform Breez wallet (not a per-seller wallet) and records a
 * PendingPayment so the settlement event knows which seller to credit.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { handleApiError, ApiError } from '@/lib/api-error';
import * as catalogService from '@/services/catalog/service';
import { createPlatformInvoice } from '@/services/lightning/breez-platform';
import { trackPendingPayment } from '@/services/commerce/pending-payments';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;
    const amountMsatParam = request.nextUrl.searchParams.get('amount');
    if (!amountMsatParam) throw new ApiError('VALIDATION_ERROR', 'amount parameter required', 400);

    const amountSats = BigInt(amountMsatParam) / 1000n;
    if (amountSats < 1n) throw new ApiError('VALIDATION_ERROR', 'amount too small', 400);

    const seller = await catalogService.getSellerByUsername(username);
    if (!seller) throw new ApiError('NOT_FOUND', `No seller: ${username}`, 404);

    const description = `Pay ${seller.displayName ?? seller.username} on Maya`;
    const invoice = await createPlatformInvoice(amountSats, description);

    // Track so the settlement event handler knows which seller to credit.
    // orderId is null — this is a direct LNURL pay, not an internal marketplace order.
    await trackPendingPayment({
      paymentHash: invoice.paymentHash,
      sellerId: seller.id,
      amountSats,
      description,
      expiresAt: invoice.expiresAt,
    });

    return NextResponse.json({ pr: invoice.bolt11, routes: [] });
  } catch (error) {
    return handleApiError(error);
  }
}
