import { NextRequest, NextResponse } from 'next/server';

import { getSellerBadge } from '@/services/catalog/service';
import { handleApiError } from '@/lib/api-error';
import { NOSTR_KINDS } from '@/types/nostr';

/**
 * GET /api/shop/[username]/badge
 *
 * Returns the seller's sales badge data derived from the ledger — the same
 * data that populates the kind 30052 event on relays.
 *
 * Response: { sellerHexPubkey, firstSaleAt, totalSales, nostr: { kind, dTag } }
 * Returns 404 if the seller has no completed sales yet (badge not issued).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;
    const badge = await getSellerBadge(username);

    if (!badge) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'No badge — seller has no completed sales yet' } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ...badge,
      nostr: {
        kind: NOSTR_KINDS.SELLER_BADGE,
        dTag: badge.sellerHexPubkey,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
