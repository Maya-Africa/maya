import { SimplePool, type Event, type Filter } from 'nostr-tools';
import { NOSTR_RELAY_LIST } from '@/lib/env';
import { NOSTR_KINDS } from '@/types/nostr';
import type { NostrEvent } from '@/types/nostr';

/**
 * Nostr client — manages relay pool and event publishing.
 *
 * Owned by the Catalog Engineer but used by both Catalog (products, profiles)
 * and Commerce (orders) for publishing signed events.
 *
 * The pool is a singleton — don't create new SimplePool instances per request.
 */

declare global {
  // eslint-disable-next-line no-var
  var __nostrPool: SimplePool | undefined;
}

function getPool(): SimplePool {
  if (!globalThis.__nostrPool) {
    globalThis.__nostrPool = new SimplePool();
  }
  return globalThis.__nostrPool;
}

export function getRelays(): string[] {
  return NOSTR_RELAY_LIST;
}

/**
 * Publish a signed event to all configured relays.
 * Returns the number of relays that accepted the event.
 * Does NOT throw if some relays fail — best-effort publish.
 */
export async function publishEvent(event: Event): Promise<number> {
  const pool = getPool();
  const relays = getRelays();

  if (relays.length === 0) {
    console.warn('No Nostr relays configured. Event not published.');
    return 0;
  }

  const promises = pool.publish(relays, event);
  const results = await Promise.allSettled(promises);

  const successCount = results.filter((r) => r.status === 'fulfilled').length;

  if (successCount === 0) {
    console.error('Failed to publish event to any relay', {
      eventId: event.id,
      kind: event.kind,
    });
  }

  return successCount;
}

/**
 * Fetch a single event by filter from the relay pool.
 * Times out after 3 seconds.
 */
export async function fetchEvent(filter: {
  kinds?: number[];
  authors?: string[];
  '#d'?: string[];
  ids?: string[];
}): Promise<Event | null> {
  const pool = getPool();
  const relays = getRelays();

  return pool.get(relays, filter, { maxWait: 3000 });
}

// ============================================================================
// Relay-read helpers — sovereignty surface
//
// All functions below are best-effort: they NEVER throw to callers and
// NEVER query Postgres. A relay failure returns null / []. The 4-second
// timeout is intentional — it keeps the sovereignty API honest about
// relay speed.
//
// NOTE: fetchProductsFromRelays and fetchProductByIdFromRelay are owned by
// the Catalog teammate and will be added to this file separately.
// ============================================================================

const READ_TIMEOUT_MS = 4000;

/** Internal: fetch many events matching a filter. Best-effort, never throws. */
async function queryMany(filter: Filter): Promise<NostrEvent[]> {
  const pool = getPool();
  const relays = getRelays();
  if (relays.length === 0) return [];
  try {
    return await pool.querySync(relays, filter, { maxWait: READ_TIMEOUT_MS });
  } catch (err) {
    console.warn('[nostr/client] queryMany failed', { kinds: filter.kinds }, err);
    return [];
  }
}

/** Internal: fetch the single most-recent event matching a filter. Best-effort. */
async function querySingle(filter: Filter): Promise<NostrEvent | null> {
  const pool = getPool();
  const relays = getRelays();
  if (relays.length === 0) return null;
  try {
    return await pool.get(relays, filter, { maxWait: READ_TIMEOUT_MS });
  } catch (err) {
    console.warn('[nostr/client] querySingle failed', { kinds: filter.kinds }, err);
    return null;
  }
}

/** Kind 0 — user profile metadata. Latest event wins. */
export function fetchProfileFromRelays(hexPubkey: string): Promise<NostrEvent | null> {
  return querySingle({ kinds: [NOSTR_KINDS.PROFILE], authors: [hexPubkey], limit: 1 });
}

/** Kind 30017 — NIP-15 stall definition. Latest event wins. */
export function fetchStallFromRelays(hexPubkey: string): Promise<NostrEvent | null> {
  return querySingle({ kinds: [NOSTR_KINDS.STALL], authors: [hexPubkey], limit: 1 });
}

/** Kind 30023 — NIP-23 long-form seller bio. Latest event wins. */
export function fetchLongBioFromRelays(hexPubkey: string): Promise<NostrEvent | null> {
  return querySingle({ kinds: [NOSTR_KINDS.LONG_FORM], authors: [hexPubkey], limit: 1 });
}

/**
 * Kind 30052 — Maya seller badge.
 * Filtered by d-tag (seller hex pubkey), NOT by author — badges are
 * signed by the system key, not the seller.
 */
export function fetchBadgeFromRelays(hexPubkey: string): Promise<NostrEvent | null> {
  return querySingle({ kinds: [NOSTR_KINDS.SELLER_BADGE], '#d': [hexPubkey], limit: 1 });
}

/** Kind 30053 — Maya stall status overlay. Latest event wins. */
export function fetchStallStatusFromRelays(hexPubkey: string): Promise<NostrEvent | null> {
  return querySingle({ kinds: [NOSTR_KINDS.STALL_STATUS], authors: [hexPubkey], limit: 1 });
}

/** Kind 30402 — NIP-99 classified listings (dual-published alongside kind 30018). */
export function fetchClassifiedListingsFromRelays(hexPubkey: string): Promise<NostrEvent[]> {
  return queryMany({ kinds: [NOSTR_KINDS.CLASSIFIED_LISTING], authors: [hexPubkey] });
}

/**
 * Kind 30051 — Maya product reviews written about this seller.
 * Reviews are authored by buyers; the seller is referenced via #p tag.
 */
export function fetchReviewsAboutSeller(hexPubkey: string): Promise<NostrEvent[]> {
  return queryMany({ kinds: [NOSTR_KINDS.PRODUCT_REVIEW], '#p': [hexPubkey] });
}

/**
 * Kind 9735 — NIP-57 zap receipts where this seller is the recipient.
 * Published by the platform Lightning wallet; seller referenced via #p tag.
 */
export function fetchZapReceiptsForSeller(hexPubkey: string): Promise<NostrEvent[]> {
  return queryMany({ kinds: [NOSTR_KINDS.ZAP_RECEIPT], '#p': [hexPubkey] });
}

/** Kind 10002 — NIP-65 relay list metadata. Latest event wins. */
export function fetchRelayListFromRelays(hexPubkey: string): Promise<NostrEvent | null> {
  return querySingle({ kinds: [NOSTR_KINDS.RELAY_LIST], authors: [hexPubkey], limit: 1 });
}

/**
 * Kind 30050 — Maya order state events where this seller is a party.
 * Both buyer and seller are tagged via #p; filtering by seller pubkey
 * returns all order state events for orders this seller was involved in.
 */
export function fetchOrderStateEventsForSeller(hexPubkey: string): Promise<NostrEvent[]> {
  return queryMany({ kinds: [NOSTR_KINDS.ORDER_STATE], '#p': [hexPubkey] });
}

/**
 * Fetch all events of given kinds authored by a specific pubkey.
 * Used by the sovereignty landing page to count platform-level activity.
 */
export function fetchEventsByAuthorAndKinds(
  hexPubkey: string,
  kinds: number[],
): Promise<NostrEvent[]> {
  return queryMany({ kinds, authors: [hexPubkey] });
}

/**
 * Rough platform-wide count of events of a given kind (no author filter).
 * Capped at limit to keep relay queries fast. Not all relays support
 * unfiltered kind queries — returns [] on failure.
 */
export function fetchEventsByKind(kinds: number[], limit = 100): Promise<NostrEvent[]> {
  return queryMany({ kinds, limit });
}
