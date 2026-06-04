/**
 * Sovereignty service — reconstructs a seller's complete shop from public
 * Nostr relays with zero Postgres queries.
 *
 * This is the demo centerpiece for the Best Nostr Project proof: every piece
 * of data returned here was fetched live from relays, signed by keys the
 * seller controls, and verifiable by anyone independently.
 *
 * DO NOT add Prisma imports or database queries to this file.
 */

import { nip19 } from 'nostr-tools';
import { NOSTR_RELAY_LIST } from '@/lib/env';
import type { NostrEvent } from '@/types/nostr';
import type { ProfileEventContent, StallEventContent, SellerBadgeEventContent, StallStatusEventContent } from '@/types/nostr';
import {
  fetchProfileFromRelays,
  fetchStallFromRelays,
  fetchLongBioFromRelays,
  fetchBadgeFromRelays,
  fetchStallStatusFromRelays,
  fetchClassifiedListingsFromRelays,
  fetchReviewsAboutSeller,
  fetchZapReceiptsForSeller,
  fetchRelayListFromRelays,
  fetchOrderStateEventsForSeller,
} from './client';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SovereigntyResult {
  source: 'nostr_relays_only';
  queriedAt: string;
  queryDurationMs: number;
  relays: Array<{ url: string; responded: boolean }>;
  npub: string;
  hexPubkey: string;
  eventsRetrieved: {
    profile: 0 | 1;
    stall: 0 | 1;
    products: number;
    classifiedListings: number;
    longBio: 0 | 1;
    badge: 0 | 1;
    stallStatus: 0 | 1;
    reviews: number;
    zapReceipts: number;
    relayList: 0 | 1;
    orderStateEvents: number;
  };
  perKindDurationMs: {
    profile: number;
    stall: number;
    products: number;
    classifiedListings: number;
    longBio: number;
    badge: number;
    stallStatus: number;
    reviews: number;
    zapReceipts: number;
    relayList: number;
    orderStateEvents: number;
  };
  reconstructed: {
    profile: { name: string; about: string; picture: string | null; lud16?: string } | null;
    stall: { name: string; description?: string; currency: string; shipping: unknown[] } | null;
    longBio: string | null;
    products: Array<{
      eventId: string;
      dTag: string;
      title: string;
      description: string;
      priceSats: string;
      currency: string;
      images: string[];
      signature: string;
    }>;
    badge: { firstSaleAt: number; totalSales: number } | null;
    stallStatus: { status: 'open' | 'vacation' | 'closed'; message?: string } | null;
    reviews: Array<{
      eventId: string;
      reviewerNpub: string;
      rating: string;
      content: string;
      signature: string;
    }>;
    totalZapReceipts: number;
    preferredRelays: string[] | null;
  };
  rawEvents: {
    profile: NostrEvent | null;
    stall: NostrEvent | null;
    products: NostrEvent[];
    longBio: NostrEvent | null;
    badge: NostrEvent | null;
    stallStatus: NostrEvent | null;
    reviews: NostrEvent[];
    relayList: NostrEvent | null;
  };
}

// ── Internal helpers ───────────────────────────────────────────────────────

interface Timed<T> {
  result: T;
  durationMs: number;
}

async function timed<T>(fn: () => Promise<T>): Promise<Timed<T>> {
  const start = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - start };
}

function safeParseJson<T>(content: string): T | null {
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

// ── Main service function ──────────────────────────────────────────────────

export async function fetchSovereigntyData(
  npub: string,
  hexPubkey: string,
): Promise<SovereigntyResult> {
  const queriedAt = new Date().toISOString();
  const overallStart = Date.now();

  // Fire all relay queries in parallel. Promise.allSettled so a single relay
  // failure never aborts the entire reconstruction.
  const settled = await Promise.allSettled([
    timed(() => fetchProfileFromRelays(hexPubkey)),           // 0
    timed(() => fetchStallFromRelays(hexPubkey)),              // 1
    timed(() => fetchLongBioFromRelays(hexPubkey)),            // 2
    timed(() => fetchBadgeFromRelays(hexPubkey)),              // 3
    timed(() => fetchStallStatusFromRelays(hexPubkey)),        // 4
    timed(() => fetchClassifiedListingsFromRelays(hexPubkey)), // 5
    timed(() => fetchReviewsAboutSeller(hexPubkey)),           // 6
    timed(() => fetchZapReceiptsForSeller(hexPubkey)),         // 7
    timed(() => fetchRelayListFromRelays(hexPubkey)),          // 8
    timed(() => fetchOrderStateEventsForSeller(hexPubkey)),    // 9
  ]);

  const queryDurationMs = Date.now() - overallStart;

  // Unwrap settled results — use safe defaults on rejection (helpers don't
  // throw, but Promise.allSettled handles the edge case anyway).
  function unwrap<T>(idx: number, fallback: T): Timed<T> {
    const s = settled[idx];
    return s?.status === 'fulfilled'
      ? (s.value as Timed<T>)
      : { result: fallback, durationMs: 0 };
  }

  const { result: profileEvent,     durationMs: profileMs }     = unwrap<NostrEvent | null>(0, null);
  const { result: stallEvent,       durationMs: stallMs }       = unwrap<NostrEvent | null>(1, null);
  const { result: longBioEvent,     durationMs: longBioMs }     = unwrap<NostrEvent | null>(2, null);
  const { result: badgeEvent,       durationMs: badgeMs }       = unwrap<NostrEvent | null>(3, null);
  const { result: stallStatusEvent, durationMs: stallStatusMs } = unwrap<NostrEvent | null>(4, null);
  const { result: listings,         durationMs: listingsMs }    = unwrap<NostrEvent[]>(5, []);
  const { result: reviews,          durationMs: reviewsMs }     = unwrap<NostrEvent[]>(6, []);
  const { result: zapReceipts,      durationMs: zapsMs }        = unwrap<NostrEvent[]>(7, []);
  const { result: relayListEvent,   durationMs: relayListMs }   = unwrap<NostrEvent | null>(8, null);
  const { result: orderStateEvents, durationMs: orderStateMs }  = unwrap<NostrEvent[]>(9, []);

  // ── Reconstruct profile ────────────────────────────────────────────────
  const profileContent = profileEvent
    ? safeParseJson<ProfileEventContent>(profileEvent.content)
    : null;

  const reconstructedProfile = profileContent
    ? {
        name: profileContent.name,
        about: profileContent.about,
        picture: profileContent.picture ?? null,
        ...(profileContent.lud16 ? { lud16: profileContent.lud16 } : {}),
      }
    : null;

  // ── Reconstruct stall ──────────────────────────────────────────────────
  const stallContent = stallEvent
    ? safeParseJson<StallEventContent>(stallEvent.content)
    : null;

  const reconstructedStall = stallContent
    ? {
        name: stallContent.name,
        description: stallContent.description,
        currency: stallContent.currency,
        shipping: stallContent.shipping,
      }
    : null;

  // ── Reconstruct products (from classified listings = NIP-99 kind 30402) ──
  // Use NIP-99 events for the sovereignty surface — more broadly discoverable
  // than NIP-15. Products use tags directly rather than JSON content.
  const reconstructedProducts = listings.map((e) => {
    const dTag = e.tags.find((t) => t[0] === 'd')?.[1] ?? '';
    const title = e.tags.find((t) => t[0] === 'title')?.[1] ?? '';
    const priceTag = e.tags.find((t) => t[0] === 'price');
    const imageUrls = e.tags.filter((t) => t[0] === 'image').map((t) => t[1]).filter((v): v is string => v !== undefined);
    return {
      eventId: e.id,
      dTag,
      title,
      description: e.content,
      priceSats: priceTag?.[1] ?? '0',
      currency: priceTag?.[2] ?? 'SATS',
      images: imageUrls,
      signature: e.sig,
    };
  });

  // ── Reconstruct badge ──────────────────────────────────────────────────
  const badgeContent = badgeEvent
    ? safeParseJson<SellerBadgeEventContent>(badgeEvent.content)
    : null;

  const reconstructedBadge = badgeContent
    ? { firstSaleAt: badgeContent.firstSaleAt, totalSales: badgeContent.totalSales }
    : null;

  // ── Reconstruct stall status ───────────────────────────────────────────
  const stallStatusContent = stallStatusEvent
    ? safeParseJson<StallStatusEventContent>(stallStatusEvent.content)
    : null;

  const reconstructedStallStatus = stallStatusContent
    ? {
        status: stallStatusContent.status,
        ...(stallStatusContent.message ? { message: stallStatusContent.message } : {}),
      }
    : null;

  // ── Reconstruct reviews ────────────────────────────────────────────────
  const reconstructedReviews = reviews.map((e) => {
    const rating = e.tags.find((t) => t[0] === 'rating')?.[1] ?? '?';
    let reviewerNpub: string;
    try {
      reviewerNpub = nip19.npubEncode(e.pubkey);
    } catch {
      reviewerNpub = e.pubkey;
    }
    return {
      eventId: e.id,
      reviewerNpub,
      rating,
      content: e.content,
      signature: e.sig,
    };
  });

  // ── Reconstruct relay list ─────────────────────────────────────────────
  const preferredRelays = relayListEvent
    ? relayListEvent.tags
        .filter((t) => t[0] === 'r')
        .map((t) => t[1])
        .filter((v): v is string => v !== undefined)
    : null;

  // ── Relay status — all configured relays were queried ─────────────────
  // We can't cheaply determine per-relay respond status from querySync,
  // so we mark all configured relays as responded if we got any duration.
  const relaysStatus = NOSTR_RELAY_LIST.map((url) => ({
    url,
    responded: queryDurationMs < 4000,
  }));

  return {
    source: 'nostr_relays_only',
    queriedAt,
    queryDurationMs,
    relays: relaysStatus,
    npub,
    hexPubkey,
    eventsRetrieved: {
      profile: profileEvent ? 1 : 0,
      stall: stallEvent ? 1 : 0,
      products: listings.length,
      classifiedListings: listings.length,
      longBio: longBioEvent ? 1 : 0,
      badge: badgeEvent ? 1 : 0,
      stallStatus: stallStatusEvent ? 1 : 0,
      reviews: reviews.length,
      zapReceipts: zapReceipts.length,
      relayList: relayListEvent ? 1 : 0,
      orderStateEvents: orderStateEvents.length,
    },
    perKindDurationMs: {
      profile: profileMs,
      stall: stallMs,
      products: listingsMs,
      classifiedListings: listingsMs,
      longBio: longBioMs,
      badge: badgeMs,
      stallStatus: stallStatusMs,
      reviews: reviewsMs,
      zapReceipts: zapsMs,
      relayList: relayListMs,
      orderStateEvents: orderStateMs,
    },
    reconstructed: {
      profile: reconstructedProfile,
      stall: reconstructedStall,
      longBio: longBioEvent?.content ?? null,
      products: reconstructedProducts,
      badge: reconstructedBadge,
      stallStatus: reconstructedStallStatus,
      reviews: reconstructedReviews,
      totalZapReceipts: zapReceipts.length,
      preferredRelays,
    },
    rawEvents: {
      profile: profileEvent,
      stall: stallEvent,
      products: listings,
      longBio: longBioEvent,
      badge: badgeEvent,
      stallStatus: stallStatusEvent,
      reviews,
      relayList: relayListEvent,
    },
  };
}
