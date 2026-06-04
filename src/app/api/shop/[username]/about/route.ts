import { NextRequest, NextResponse } from 'next/server';

import { getUserByUsername } from '@/services/auth/service';
import { handleApiError, ApiError } from '@/lib/api-error';
import { NOSTR_KINDS } from '@/types/nostr';

/**
 * GET /api/shop/[username]/about
 *
 * Returns a seller's long-form bio along with the Nostr event metadata
 * that describes where the NIP-23 kind 30023 event lives.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
    const { username } = await params;
    const user = await getUserByUsername(username);

    if (!user || user.role !== 'SELLER') {
      throw new ApiError('NOT_FOUND', `No seller found for @${username}`, 404);
    }

    return NextResponse.json({
      username: user.username,
      displayName: user.displayName,
      longBio: user.longBio,
      nostr: user.longBio
        ? {
            kind: NOSTR_KINDS.LONG_FORM,
            dTag: `${user.id}-bio`,
            pubkey: user.npub,
          }
        : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
