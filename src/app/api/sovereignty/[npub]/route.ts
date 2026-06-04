/**
 * GET /api/sovereignty/:npub
 *
 * Reconstructs a seller's complete shop from public Nostr relays only.
 * Zero Postgres queries — no Prisma import, no database fallback.
 *
 * The slow query time IS the demonstration: this is how fast the
 * open Nostr relay network can serve a full shop.
 */
import { NextRequest, NextResponse } from 'next/server';

import { npubToHex } from '@/services/nostr/signing';
import { fetchSovereigntyData } from '@/services/nostr/sovereignty';
import { ApiError, handleApiError } from '@/lib/api-error';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ npub: string }> },
) {
  try {
    const { npub } = await params;

    let hexPubkey: string;
    try {
      hexPubkey = npubToHex(npub);
    } catch {
      throw new ApiError('VALIDATION_ERROR', `Invalid npub: "${npub}"`, 400);
    }

    const data = await fetchSovereigntyData(npub, hexPubkey);
    return NextResponse.json(data);
  } catch (err) {
    return handleApiError(err);
  }
}
