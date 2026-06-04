import { NextRequest, NextResponse } from 'next/server';

import { fetchEvent } from '@/services/nostr/client';
import { npubToHex } from '@/services/nostr/signing';
import { handleApiError, ApiError } from '@/lib/api-error';
import { NOSTR_KINDS } from '@/types/nostr';
import type { ProfileEventContent } from '@/types/nostr';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ npub: string }> }) {
  try {
    const { npub } = await params;
    let hexPubkey: string;
    try {
      hexPubkey = npubToHex(npub);
    } catch {
      throw new ApiError('VALIDATION_ERROR', 'Invalid npub', 400);
    }

    const event = await fetchEvent({
      kinds: [NOSTR_KINDS.PROFILE],
      authors: [hexPubkey],
    });

    if (!event) {
      return NextResponse.json({ profile: null });
    }

    let profile: ProfileEventContent | null = null;
    try {
      profile = JSON.parse(event.content) as ProfileEventContent;
    } catch {
      profile = null;
    }

    return NextResponse.json({ profile, eventId: event.id, createdAt: event.created_at });
  } catch (err) {
    return handleApiError(err);
  }
}
