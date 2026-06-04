import { NOSTR_KINDS } from '@/types/nostr';
import { NOSTR_RELAY_LIST } from '@/lib/env';
import { signEventWithSystemKey } from './signing';
import { publishEvent } from './client';

export interface ZapReceiptParams {
  sellerHexPubkey: string;      // p tag — recipient
  buyerHexPubkey: string;       // P tag — sender
  bolt11: string;               // bolt11 tag
  amountSats: bigint;           // converted to msats for the amount tag
  orderNostrEventId: string | null; // e tag — included when available
  paidAt: Date;                 // used as created_at for idempotency
}

/**
 * NIP-57: publish a kind 9735 zap receipt on order settlement.
 *
 * The receipt is signed by the platform key (SYSTEM_NSEC). Since Maya is
 * the custodial Lightning wallet, the platform is the lnurl server and is the
 * correct signer for the zap receipt per NIP-57 Appendix E.
 *
 * The description tag holds a synthetic kind 9734 zap request capturing
 * buyer, seller, relays, and amount. It is signed by the system key as a
 * platform proxy — real buyer-signed zap requests require NIP-07 client flow.
 */
export async function publishZapReceipt(params: ZapReceiptParams): Promise<void> {
  const { sellerHexPubkey, buyerHexPubkey, bolt11, amountSats, orderNostrEventId, paidAt } = params;
  const amountMsats = amountSats * 1000n;
  const createdAt = Math.floor(paidAt.getTime() / 1000);

  // Synthetic zap request — captures the payment intent without requiring
  // the buyer to have signed it (they paid via the platform wallet, not a NIP-07 flow).
  const zapRequest = {
    kind: 9734,
    content: '',
    pubkey: buyerHexPubkey,
    created_at: createdAt,
    tags: [
      ['p', sellerHexPubkey],
      ['amount', String(amountMsats)],
      ['relays', ...NOSTR_RELAY_LIST],
    ],
  };

  const tags: string[][] = [
    ['p', sellerHexPubkey],
    ['P', buyerHexPubkey],
    ['bolt11', bolt11],
    ['amount', String(amountMsats)],
    ['description', JSON.stringify(zapRequest)],
  ];

  if (orderNostrEventId) {
    tags.push(['e', orderNostrEventId]);
  }

  const template = {
    kind: NOSTR_KINDS.ZAP_RECEIPT,
    created_at: createdAt,
    tags,
    content: '',
  };

  const signed = signEventWithSystemKey(template);
  await publishEvent(signed);
}
