import type { EventTemplate } from 'nostr-tools';

import { prisma } from '@/lib/db';
import { NOSTR_KINDS } from '@/types/nostr';
import type { SellerBadgeEventContent } from '@/types/nostr';
import { signEventWithSystemKey } from './signing';
import { publishEvent } from './client';

export function buildSellerBadgeEventTemplate(params: {
  sellerHexPubkey: string;
  firstSaleAt: number;
  totalSales: number;
}): EventTemplate {
  const content: SellerBadgeEventContent = {
    firstSaleAt: params.firstSaleAt,
    totalSales: params.totalSales,
  };
  return {
    kind: NOSTR_KINDS.SELLER_BADGE,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', params.sellerHexPubkey],
      ['p', params.sellerHexPubkey],
      ['L', 'maya.com/badge'],
    ],
    content: JSON.stringify(content),
  };
}

/**
 * Read this seller's SALE ledger entries, build a kind 30052 badge event,
 * sign with the platform key (SYSTEM_NSEC), and publish to relays.
 *
 * Returns early (no-op) if the seller has no sales yet — no badge is
 * issued until the first successful settlement.
 *
 * Commerce wires this with one line in markPaid() — see Stage 3 integration
 * doc at docs/commerce-custom-nips-integration.md.
 */
export async function publishSellerBadge(sellerId: string): Promise<void> {
  const [seller, firstEntry, totalSales] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sellerId },
      select: { npub: true },
    }),
    prisma.ledgerEntry.findFirst({
      where: { userId: sellerId, type: 'SALE' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.ledgerEntry.count({
      where: { userId: sellerId, type: 'SALE' },
    }),
  ]);

  if (!seller || !firstEntry || totalSales === 0) return;

  const template = buildSellerBadgeEventTemplate({
    sellerHexPubkey: seller.npub,
    firstSaleAt: Math.floor(firstEntry.createdAt.getTime() / 1000),
    totalSales,
  });

  const signed = signEventWithSystemKey(template);
  await publishEvent(signed);
}

/**
 * Read badge data for a seller directly from the ledger.
 * Returns null if the seller has no sales yet.
 */
export async function readBadgeData(sellerId: string): Promise<{
  sellerHexPubkey: string;
  firstSaleAt: number;
  totalSales: number;
} | null> {
  const [seller, firstEntry, totalSales] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sellerId },
      select: { npub: true },
    }),
    prisma.ledgerEntry.findFirst({
      where: { userId: sellerId, type: 'SALE' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.ledgerEntry.count({
      where: { userId: sellerId, type: 'SALE' },
    }),
  ]);

  if (!seller || !firstEntry || totalSales === 0) return null;

  return {
    sellerHexPubkey: seller.npub,
    firstSaleAt: Math.floor(firstEntry.createdAt.getTime() / 1000),
    totalSales,
  };
}
