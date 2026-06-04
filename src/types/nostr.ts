/**
 * Nostr event type definitions following NIP-15 for the marketplace.
 */

import type { Event } from 'nostr-tools';

export const NOSTR_KINDS = {
  PROFILE: 0,
  ZAP_RECEIPT: 9735,         // NIP-57: lightning zap receipt
  RELAY_LIST: 10002,         // NIP-65: relay list metadata
  STALL: 30017,              // NIP-15: marketplace stall
  PRODUCT: 30018,            // NIP-15: marketplace product
  // NOTE: Per NIP-15, kind 30019 is "Marketplace UI/UX config", NOT an order event.
  // Orders in NIP-15 are kind-4 encrypted DMs. Commerce's order publishing uses this
  // constant for an internal receipt event — that is non-standard and owned by Commerce.
  ORDER: 30019,
  LONG_FORM: 30023,          // NIP-23: long-form content (seller bios)
  ORDER_STATE: 30050,        // Maya custom: order state machine
  PRODUCT_REVIEW: 30051,     // Maya custom: buyer product review
  SELLER_BADGE: 30052,       // Maya custom: platform sales attestation
  STALL_STATUS: 30053,       // Maya custom: stall operational status
  CLASSIFIED_LISTING: 30402, // NIP-99: classified listing
} as const;

// Maya custom: kind 30050 order state
export type OrderStateStatus = 'shipped' | 'delivered' | 'disputed' | 'refunded';

export interface OrderStateEventContent {
  status: OrderStateStatus;
  note?: string;
  trackingRef?: string;    // shipped only
  disputeReason?: string;  // disputed only
}

// Maya custom: kind 30053 stall status content
export type StallStatusValue = 'open' | 'vacation' | 'closed';

export interface StallStatusEventContent {
  status: StallStatusValue;
  message?: string;
}

// NIP-15 kind 30017 stall event content
export interface StallEventContent {
  id: string;
  name: string;
  description?: string;
  currency: string;
  shipping: Array<{
    id: string;
    name?: string;
    cost: number;
    regions: string[];
  }>;
}

// NIP-15 kind 30018 product event content
export interface ProductEventContent {
  id: string;
  stall_id: string;
  name: string;
  description?: string;
  images?: string[];
  currency: string;
  price: number;
  quantity: number | null; // null = unlimited/digital
  specs?: Array<[string, string]>;
  shipping?: Array<{
    id: string;
    cost: number;
  }>;
}

export interface ProfileEventContent {
  name: string;
  about: string;
  picture: string | null;
  lud16?: string; // NIP-57: Lightning Address for zap support (e.g. "alice@maya.com")
}

// Maya custom: kind 30052 seller badge content
export interface SellerBadgeEventContent {
  firstSaleAt: number; // Unix timestamp of first settled order
  totalSales: number;  // Count of SALE-type ledger entries at time of publish
}

// Helper alias for typed Nostr events used in the app
export type NostrEvent = Event;
