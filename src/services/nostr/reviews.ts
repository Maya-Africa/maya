import { finalizeEvent, type Event, type EventTemplate } from 'nostr-tools';

import { NOSTR_KINDS } from '@/types/nostr';
import { publishEvent } from './client';

export interface ReviewEventParams {
  orderId: string;
  orderNostrEventId: string | null; // e tag — kind 30019 receipt ref; omitted if null
  sellerHexPubkey: string;          // p tag + a tag prefix
  productIds: string[];             // one a tag per product per §2.2
  rating: number;                   // 1–5 (emitted as string tag)
  content: string;                  // markdown review body
}

export function buildReviewEventTemplate(params: ReviewEventParams): EventTemplate {
  const { orderId, orderNostrEventId, sellerHexPubkey, productIds, rating, content } = params;

  const tags: string[][] = [
    ['d', orderId],
    ['p', sellerHexPubkey],
    ['rating', String(rating)],
  ];

  if (orderNostrEventId) {
    tags.push(['e', orderNostrEventId]);
  }

  for (const productId of productIds) {
    tags.push(['a', `${NOSTR_KINDS.PRODUCT}:${sellerHexPubkey}:${productId}`]);
  }

  return {
    kind: NOSTR_KINDS.PRODUCT_REVIEW,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  };
}

export async function publishReview(
  params: ReviewEventParams,
  buyerSecretKey: Uint8Array,
): Promise<Event> {
  const template = buildReviewEventTemplate(params);
  const signed = finalizeEvent(template, buyerSecretKey);
  await publishEvent(signed);
  return signed;
}
