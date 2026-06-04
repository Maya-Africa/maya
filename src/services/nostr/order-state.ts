import { finalizeEvent, type Event, type EventTemplate } from 'nostr-tools';

import { NOSTR_KINDS } from '@/types/nostr';
import type { OrderStateStatus, OrderStateEventContent } from '@/types/nostr';
import { signEventWithSystemKey } from './signing';
import { publishEvent } from './client';

// Minimal order fields required to build a kind 30050 event.
// Commerce passes its full Order object; only these fields are read.
export interface OrderStateParams {
  id: string;                    // d tag
  nostrEventId: string | null;   // e tag — omitted when null
  sellerNpub: string;            // first p tag (seller hex pubkey)
  buyerNpub: string;             // second p tag (buyer hex pubkey)
}

export interface OrderStateOptions {
  note?: string;
  trackingRef?: string;   // shipped only
  disputeReason?: string; // disputed only
}

// State-machine signer rules per §2.1 design doc.
// Clients SHOULD reject events where pubkey doesn't match the expected signer.
const VALID_SIGNERS: Record<OrderStateStatus, string> = {
  shipped: 'seller',
  delivered: 'buyer',
  disputed: 'buyer',
  refunded: 'system',
};

export function buildOrderStateEventTemplate(
  order: OrderStateParams,
  status: OrderStateStatus,
  options: OrderStateOptions = {},
): EventTemplate {
  const content: OrderStateEventContent = {
    status,
    ...(options.note ? { note: options.note } : {}),
    ...(options.trackingRef ? { trackingRef: options.trackingRef } : {}),
    ...(options.disputeReason ? { disputeReason: options.disputeReason } : {}),
  };

  const tags: string[][] = [
    ['d', order.id],
    ['p', order.sellerNpub],
    ['p', order.buyerNpub],
    ['status', status],
  ];

  if (order.nostrEventId) {
    tags.push(['e', order.nostrEventId]);
  }

  return {
    kind: NOSTR_KINDS.ORDER_STATE,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: JSON.stringify(content),
  };
}

/**
 * Build, sign, and publish a kind 30050 order state event.
 *
 * Pass `secretKey = null` for the `refunded` status — the system key signs it.
 * For `shipped`, pass the seller's decrypted secret key.
 * For `delivered` and `disputed`, pass the buyer's decrypted secret key.
 *
 * Commerce wires this in Stage 3. See docs/commerce-custom-nips-integration.md.
 */
export async function publishOrderStateEvent(
  status: OrderStateStatus,
  order: OrderStateParams,
  secretKey: Uint8Array | null,
  options: OrderStateOptions = {},
): Promise<Event> {
  if (status === 'refunded' && secretKey !== null) {
    throw new Error('refunded transitions must be signed by the system key — pass secretKey: null');
  }
  if (status !== 'refunded' && secretKey === null) {
    throw new Error(`${status} transitions require the signer's secret key`);
  }

  const template = buildOrderStateEventTemplate(order, status, options);

  const signed =
    secretKey === null
      ? signEventWithSystemKey(template)
      : finalizeEvent(template, secretKey);

  await publishEvent(signed);
  return signed;
}

// Exported for documentation — describes who should sign each transition.
export { VALID_SIGNERS };
