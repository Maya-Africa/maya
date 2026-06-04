/**
 * PendingPayment service — maps inbound paymentHash → seller + order.
 * Short-lived: created when invoice is generated, deleted on settlement or expiry.
 */

import { prisma } from '@/lib/db';

export interface TrackPendingPaymentInput {
  paymentHash: string;
  sellerId: string;
  amountSats: bigint;
  orderId?: string;
  description: string;
  expiresAt: Date;
}

export async function trackPendingPayment(input: TrackPendingPaymentInput): Promise<void> {
  await prisma.pendingPayment.create({
    data: {
      paymentHash: input.paymentHash,
      sellerId: input.sellerId,
      amountSats: input.amountSats,
      orderId: input.orderId ?? null,
      description: input.description,
      expiresAt: input.expiresAt,
    },
  });
}

export async function findByPaymentHash(paymentHash: string) {
  return prisma.pendingPayment.findUnique({ where: { paymentHash } });
}

export async function deletePendingPayment(paymentHash: string): Promise<void> {
  await prisma.pendingPayment.delete({ where: { paymentHash } }).catch(() => {
    // Already deleted (idempotent) — no-op.
  });
}

/** Clean up expired entries. Returns the count deleted. */
export async function cleanupExpired(): Promise<number> {
  const result = await prisma.pendingPayment.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
