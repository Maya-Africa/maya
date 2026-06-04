/**
 * Typed wrappers around seller-specific endpoints that don't belong in
 * commerce.ts (orders/lightning) or payout.ts (bank accounts).
 *
 * Right now: stall status. As we wire more Nostr-publishing seller
 * actions (long bio, etc.) they land here too.
 */

import { fetcher, patchFetcher } from '@/lib/fetcher';

// ============================================================================
// Stall status (kind 30053)
// ============================================================================

export type StallStatus = 'open' | 'vacation' | 'closed';

export interface StallStatusInput {
  status: StallStatus;
  /** Optional message shown to buyers when status is vacation/closed. */
  message?: string;
  /** Required: server decrypts the seller's nsec with this to sign the kind 30053. */
  password: string;
}

export interface StallStatusResponse {
  stallStatus: StallStatus;
  stallStatusMessage: string | null;
  nostrEventId: string;
}

export function updateStallStatus(input: StallStatusInput): Promise<StallStatusResponse> {
  return patchFetcher('/api/seller/stall/status', input);
}

// ============================================================================
// Storefront read — pre-seeding the seller's own settings form
// ============================================================================

export interface ShopCurrentStatus {
  stallStatus: StallStatus;
  stallStatusMessage: string | null;
}

/**
 * The seller may need to read their own current stall status to pre-fill
 * the settings form. Re-uses /api/shop/<username>, which always exposes
 * stallStatus/stallStatusMessage in the seller block.
 */
export function getOwnStallStatus(username: string): Promise<ShopCurrentStatus> {
  return fetcher<{ seller: ShopCurrentStatus }>(
    `/api/shop/${encodeURIComponent(username)}`,
  ).then(r => ({
    stallStatus: r.seller.stallStatus,
    stallStatusMessage: r.seller.stallStatusMessage,
  }));
}

// ============================================================================
// Reviews (kind 30051)
// ============================================================================

export interface ShopReview {
  id: string;
  orderId: string;
  rating: number;
  content: string;
  nostrEventId: string;
  createdAt: string;
}

export interface ShopReviewsResponse {
  averageRating: number; // 1 decimal, e.g. 4.7
  count: number;
  reviews: ShopReview[];
}

export function getShopReviews(username: string): Promise<ShopReviewsResponse> {
  return fetcher(`/api/shop/${encodeURIComponent(username)}/reviews`);
}

// ============================================================================
// Long bio (kind 30023)
// ============================================================================

import type { User } from '@/types/shared';

/**
 * Save the authenticated seller's long-form bio. Server publishes a NIP-23
 * kind 30023 event to relays on success. Min 1 char, max 10,000 chars.
 */
export function updateLongBio(longBio: string): Promise<{ user: User }> {
  return patchFetcher('/api/auth/me/long-bio', { longBio });
}

export interface ShopAboutResponse {
  username: string;
  displayName: string | null;
  longBio: string | null;
  nostr: { kind: number; dTag: string; pubkey: string } | null;
}

/**
 * Public storefront read — returns the seller's long bio markdown along
 * with the Nostr event coordinates so clients can link out to the NIP-23
 * article on a long-form reader.
 */
export function getShopAbout(username: string): Promise<ShopAboutResponse> {
  return fetcher(`/api/shop/${encodeURIComponent(username)}/about`);
}
