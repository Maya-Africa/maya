import type { EventTemplate } from 'nostr-tools';

import { NOSTR_KINDS } from '@/types/nostr';
import type { ProductEventContent, StallEventContent, StallStatusEventContent, ProfileEventContent } from '@/types/nostr';
import type { StallStatusValue } from '@/types/nostr';
import type { Product, SellerInfo } from '@/types/shared';

// NIP-65: relay list metadata (kind 10002)
// All relays are marked read+write (no marker = both directions per spec).
export function buildRelayListEventTemplate(relays: string[]): EventTemplate {
  return {
    kind: NOSTR_KINDS.RELAY_LIST,
    created_at: Math.floor(Date.now() / 1000),
    tags: relays.map((url) => ['r', url]),
    content: '',
  };
}

// NIP-23: long-form content (kind 30023) used for seller bios.
// `d` tag is stable per user so the event is replaceable.
export function buildLongFormEventTemplate(params: {
  userId: string;
  displayName: string | null;
  longBio: string;
  sellerNpub?: string;
}): EventTemplate {
  const now = Math.floor(Date.now() / 1000);
  const tags: string[][] = [
    ['d', `${params.userId}-bio`],
    ['title', `About ${params.displayName ?? 'this seller'}`],
    ['published_at', String(now)],
  ];
  if (params.sellerNpub) tags.push(['p', params.sellerNpub]);
  return {
    kind: NOSTR_KINDS.LONG_FORM,
    created_at: now,
    tags,
    content: params.longBio,
  };
}

// NIP-99: classified listing (kind 30402) dual-published alongside kind 30018.
// Both events share the same `d` tag so they can be linked by consumers.
export function buildClassifiedListingEventTemplate(product: Product, sellerNpub?: string): EventTemplate {
  const now = Math.floor(Date.now() / 1000);
  const tags: string[][] = [
    ['d', product.id],
    ['title', product.title],
    ['summary', product.description.slice(0, 200)],
    ['price', product.priceSats, 'SATS'],
    ['t', product.category],
    ['published_at', String(now)],
    ['status', product.status === 'ACTIVE' ? 'active' : 'sold'],
  ];

  for (const url of product.images) {
    tags.push(['image', url]);
  }

  if (sellerNpub) tags.push(['p', sellerNpub]);

  return {
    kind: NOSTR_KINDS.CLASSIFIED_LISTING,
    created_at: now,
    tags,
    content: product.description,
  };
}

// Each seller maps to exactly one stall (their store). The stall id is the sellerId.
// Stall events are replaceable (kind 30017 with matching `d` tag), so re-publishing is idempotent.
export function buildStallEventTemplate(seller: SellerInfo): EventTemplate {
  const content: StallEventContent = {
    id: seller.id,
    name: seller.displayName ?? seller.username,
    ...(seller.about ? { description: seller.about } : {}),
    currency: 'SATS',
    shipping: [
      {
        id: 'default',
        name: 'Standard',
        cost: 0,
        regions: [],
      },
    ],
  };

  return {
    kind: NOSTR_KINDS.STALL,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['d', seller.id], ['p', seller.npub]],
    content: JSON.stringify(content),
  };
}

export function buildProductEventTemplate(product: Product, sellerNpub?: string): EventTemplate {
  const content: ProductEventContent = {
    id: product.id,
    stall_id: product.sellerId,
    name: product.title,
    description: product.description,
    ...(product.images.length > 0 ? { images: product.images } : {}),
    currency: 'SATS',
    price: Number(product.priceSats),
    quantity: product.isDigital ? null : product.stock,
    shipping: [{ id: 'default', cost: Number(product.shippingSats) }],
  };

  const tags: string[][] = [
    ['d', product.id],
    ['t', product.category],
  ];
  if (sellerNpub) tags.push(['p', sellerNpub]);
  return {
    kind: NOSTR_KINDS.PRODUCT,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: JSON.stringify(content),
  };
}

export function buildProfileEventTemplate(profile: {
  displayName: string | null;
  about: string | null;
  avatar: string | null;
  lightningAddr?: string | null; // NIP-57: emitted as lud16 for zap support
}): EventTemplate {
  const content: ProfileEventContent = {
    name: profile.displayName ?? '',
    about: profile.about ?? '',
    picture: profile.avatar,
    ...(profile.lightningAddr ? { lud16: profile.lightningAddr } : {}),
  };

  return {
    kind: NOSTR_KINDS.PROFILE,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content: JSON.stringify(content),
  };
}

// Maya custom kind 30053 — stall operational status overlay.
// stallId === sellerId in this implementation (one stall per seller).
// The "a" tag references the parent kind 30017 stall event per §2.4 of the design doc.
export function buildStallStatusEventTemplate(params: {
  stallId: string;
  sellerHexPubkey: string;
  status: StallStatusValue;
  message?: string;
}): EventTemplate {
  const { stallId, sellerHexPubkey, status, message } = params;
  const content: StallStatusEventContent = {
    status,
    ...(message ? { message } : {}),
  };
  return {
    kind: NOSTR_KINDS.STALL_STATUS,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', stallId],
      ['a', `30017:${sellerHexPubkey}:${stallId}`],
      ['p', sellerHexPubkey],
    ],
    content: JSON.stringify(content),
  };
}
