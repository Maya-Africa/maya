/**
 * Ledger service — append-only record of every sats movement per seller.
 * A seller's balance = SUM(amountSats) WHERE userId = sellerId.
 * Entries are immutable. Corrections use type ADJUSTMENT; never UPDATE.
 */

import { prisma } from '@/lib/db';
import { getBtcNgnRate } from '@/services/pricing/coingecko';
import { connectPlatformWallet } from '@/services/lightning/breez-platform';

type LedgerEntryType = 'SALE' | 'WITHDRAWAL' | 'REFUND' | 'ADJUSTMENT';

export interface RecordEntryInput {
  userId: string;
  amountSats: bigint;     // positive = credit, negative = debit
  type: LedgerEntryType;
  refId?: string;         // orderId for SALE, payoutId for WITHDRAWAL
  description: string;
  recordedNgnRate?: bigint; // if omitted, fetched from CoinGecko now
}

export async function recordEntry(input: RecordEntryInput) {
  const ngnRate = input.recordedNgnRate ?? (await getBtcNgnRate()).ratePerBtc;

  return prisma.ledgerEntry.create({
    data: {
      userId: input.userId,
      amountSats: input.amountSats,
      type: input.type,
      refId: input.refId ?? null,
      description: input.description,
      recordedNgnRate: ngnRate,
    },
  });
}

/** Seller's current balance in sats. Returns 0n for unknown users. */
export async function getBalance(userId: string): Promise<bigint> {
  const result = await prisma.ledgerEntry.aggregate({
    where: { userId },
    _sum: { amountSats: true },
  });
  return result._sum.amountSats ?? 0n;
}

/**
 * Reconciliation — compare ledger sum against platform Breez wallet balance.
 * Used by GET /api/admin/reconcile before demo.
 */
export async function reconcile(): Promise<{
  ledgerTotal: bigint;
  platformWalletBalance: bigint;
  diff: bigint;
}> {
  const result = await prisma.ledgerEntry.aggregate({
    _sum: { amountSats: true },
  });
  const ledgerTotal = result._sum.amountSats ?? 0n;

  const { balanceSat } = await connectPlatformWallet();
  const platformWalletBalance = BigInt(balanceSat);

  return {
    ledgerTotal,
    platformWalletBalance,
    diff: platformWalletBalance - ledgerTotal,
  };
}
