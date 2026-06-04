import { NextRequest, NextResponse } from 'next/server';

import { getSellerReviews } from '@/services/catalog/service';
import { handleApiError } from '@/lib/api-error';

/**
 * GET /api/shop/[username]/reviews
 *
 * Returns aggregated review data for a seller:
 *   { averageRating, count, reviews: [...] }
 *
 * Each review entry: { id, orderId, rating, content, nostrEventId, createdAt }
 * orderId is intentionally included so Nostr clients can fetch the kind 30051
 * event via { kinds:[30051], "#d":[orderId] } to verify buyer signatures.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;
    const data = await getSellerReviews(username);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
