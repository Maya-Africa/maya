/**
 * /api/lnurlp/[username]  (proxied from /.well-known/lnurlp/[username])
 *
 * Lightning Address resolution — step 1 of the LNURL-pay flow.
 * External Lightning wallets GET this to discover how to pay a seller.
 *
 * Returns LNURL-pay metadata so any Lightning wallet can pay username@maya.com.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { handleApiError, ApiError } from '@/lib/api-error';
import * as catalogService from '@/services/catalog/service';

const MIN_SENDABLE_MSAT = 1_000n;        // 1 sat minimum
const MAX_SENDABLE_MSAT = 10_000_000n;   // 100,000 sats maximum

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;
    const seller = await catalogService.getSellerByUsername(username);
    if (!seller) throw new ApiError('NOT_FOUND', `No seller found for username: ${username}`, 404);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://maya.com';
    const callbackUrl = `${appUrl}/api/lnurlp/${username}/callback`;

    const metadata = JSON.stringify([
      ['text/plain', `Pay ${seller.displayName ?? seller.username} on Maya`],
      ['text/identifier', `${seller.username}@${new URL(appUrl).hostname}`],
    ]);

    return NextResponse.json({
      tag: 'payRequest',
      callback: callbackUrl,
      minSendable: Number(MIN_SENDABLE_MSAT),
      maxSendable: Number(MAX_SENDABLE_MSAT),
      metadata,
      allowsNostr: false,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
