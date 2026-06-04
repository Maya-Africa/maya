import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { generateOrderId } from './id';

/**
 * Commerce repository — DB access layer.
 *
 * Owned by the Commerce Engineer. Only service.ts should call these functions.
 */

// ============================================================================
// Orders
// ============================================================================

const orderWithRelations = {
  items: {
    include: {
      product: {
        select: { id: true, title: true, images: true },
      },
    },
  },
  buyer: { select: { id: true, npub: true } },
  seller: { select: { id: true, npub: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof orderWithRelations;
}>;

export async function findOrderById(id: string): Promise<OrderWithRelations | null> {
  return prisma.order.findUnique({
    where: { id },
    include: orderWithRelations,
  });
}

export async function findOrderByPaymentHash(
  paymentHash: string,
): Promise<OrderWithRelations | null> {
  return prisma.order.findUnique({
    where: { paymentHash },
    include: orderWithRelations,
  });
}

export async function listOrdersByBuyer(
  buyerId: string,
  page: number,
  pageSize: number,
): Promise<{ items: OrderWithRelations[]; total: number }> {
  const where: Prisma.OrderWhereInput = { buyerId };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderWithRelations,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total };
}

export async function listOrdersBySeller(
  sellerId: string,
  page: number,
  pageSize: number,
): Promise<{ items: OrderWithRelations[]; total: number }> {
  const where: Prisma.OrderWhereInput = { sellerId };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: orderWithRelations,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total };
}

export async function createOrder(data: Prisma.OrderCreateInput): Promise<OrderWithRelations> {
  // Generate the user-visible BTS-XXXX-XXXX ID and retry on the (vanishingly
  // rare) collision. ~1.1 trillion keyspace means we essentially never hit
  // P2002 on Order.id, but the retry path keeps the contract honest. At the
  // moment createOrder runs, paymentHash isn't set yet — so any P2002 here
  // is the id field.
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const id = generateOrderId();
    try {
      return await prisma.order.create({
        data: { ...data, id },
        include: orderWithRelations,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        attempt < MAX_ATTEMPTS
      ) {
        // Try again with a fresh ID.
        continue;
      }
      throw err;
    }
  }
  // Unreachable — the loop above always either returns or throws.
  throw new Error('createOrder: exhausted retries without resolution');
}

/**
 * Atomically transition PENDING → PAID.
 * Returns the updated order, or null if the order was already processed (idempotent).
 */
export async function markOrderPaid(
  paymentHash: string,
): Promise<{ order: OrderWithRelations; wasAlreadyPaid: boolean }> {
  const updated = await prisma.order.updateMany({
    where: { paymentHash, status: 'PENDING' },
    data: { status: 'PAID', paidAt: new Date() },
  });

  const order = await findOrderByPaymentHash(paymentHash);
  if (!order) throw new Error(`Order not found for payment hash: ${paymentHash}`);

  return { order, wasAlreadyPaid: updated.count === 0 };
}

/**
 * Atomically decrement product stock after payment.
 * Uses WHERE stock > 0 guard.
 */
export async function decrementProductStock(productId: string, quantity: number): Promise<void> {
  await prisma.product.updateMany({
    where: { id: productId, stock: { gte: quantity } },
    data: { stock: { decrement: quantity } },
  });
}

export async function markOrderShipped(
  orderId: string,
  shippingNote?: string,
): Promise<OrderWithRelations> {
  return prisma.order.update({
    where: { id: orderId },
    data: { status: 'SHIPPED', shippedAt: new Date(), shippingNote: shippingNote ?? null },
    include: orderWithRelations,
  });
}

export async function markOrderDelivered(orderId: string): Promise<OrderWithRelations> {
  return prisma.order.update({
    where: { id: orderId },
    data: { status: 'DELIVERED' },
    include: orderWithRelations,
  });
}

export async function markOrderCancelled(orderId: string): Promise<OrderWithRelations> {
  return prisma.order.update({
    where: { id: orderId },
    data: { status: 'CANCELLED' },
    include: orderWithRelations,
  });
}

export async function updateOrderCurrentState(
  orderId: string,
  currentState: string,
): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { currentState },
  });
}

export async function updateOrderInvoice(
  orderId: string,
  invoiceBolt11: string,
  paymentHash: string,
): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { invoiceBolt11, paymentHash },
  });
}

export async function updateOrderNostrEventId(
  orderId: string,
  nostrEventId: string,
): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { nostrEventId },
  });
}

// ============================================================================
// Push Subscriptions
// ============================================================================

export async function findPushSubscriptionsByUserId(userId: string) {
  return prisma.pushSubscription.findMany({ where: { userId } });
}

export async function upsertPushSubscription(
  userId: string,
  endpoint: string,
  p256dh: string,
  auth: string,
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh, auth },
    update: { userId, p256dh, auth },
  });
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

// ============================================================================
// Payouts & Bank Accounts
// ============================================================================

export async function findBankAccountById(id: string) {
  return prisma.bankAccount.findUnique({ where: { id } });
}

export async function listBankAccountsByUser(userId: string) {
  return prisma.bankAccount.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
}

export async function listBankAccountsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return prisma.bankAccount.findMany({ where: { id: { in: ids } } });
}

export async function createBankAccount(data: {
  userId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}) {
  // First account for this user becomes the default.
  const existingCount = await prisma.bankAccount.count({ where: { userId: data.userId } });
  return prisma.bankAccount.create({
    data: { ...data, isDefault: existingCount === 0 },
  });
}

export async function deleteBankAccountById(id: string): Promise<void> {
  await prisma.bankAccount.delete({ where: { id } });
}

export async function hasPendingPayoutsForAccount(bankAccountId: string): Promise<boolean> {
  const count = await prisma.payout.count({
    where: { bankAccountId, status: 'PENDING' },
  });
  return count > 0;
}

// ============================================================================
// Ledger activity feed (M16)
// ============================================================================

export async function listLedgerActivity(
  userId: string,
  cursor: string | undefined,
  limit: number,
) {
  const take = Math.min(limit, 100) + 1; // over-fetch by 1 to detect next page
  const entries = await prisma.ledgerEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take,
  });

  const hasMore = entries.length > limit;
  const items = hasMore ? entries.slice(0, limit) : entries;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return { items, nextCursor };
}

export async function createPayout(data: Prisma.PayoutCreateInput) {
  return prisma.payout.create({ data });
}

export async function findPayoutById(id: string) {
  return prisma.payout.findUnique({
    where: { id },
    include: {
      user: { select: { id: true } },
    },
  });
}

export async function findPayoutByExternalId(externalId: string) {
  return prisma.payout.findFirst({
    where: { externalId },
  });
}

export async function updatePayoutStatus(
  id: string,
  status: 'PENDING' | 'SUCCESS' | 'FAILED',
  completedAt?: Date,
) {
  return prisma.payout.update({
    where: { id },
    data: { status, completedAt: completedAt ?? null },
  });
}

export async function listPayoutsByUser(
  userId: string,
  cursor: string | undefined,
  limit: number,
) {
  const take = Math.min(limit, 100) + 1;
  const payouts = await prisma.payout.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take,
    include: {
      // Join bank account for masked display (last4 derived at query time)
    },
  });

  const hasMore = payouts.length > limit;
  const items = hasMore ? payouts.slice(0, limit) : payouts;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;
  return { items, nextCursor };
}

// ============================================================================
// Expired-order cleanup (cron M — /api/cron/expire-pending)
// ============================================================================

/**
 * Find all expired PendingPayments that belong to a marketplace order.
 * Returns enough data to cancel each order and restore stock.
 */
export async function findExpiredPendingPaymentsWithOrders() {
  const now = new Date();
  return prisma.pendingPayment.findMany({
    where: {
      expiresAt: { lt: now },
      orderId: { not: null }, // only marketplace orders, not LNURL direct pays
    },
  });
}

/** Cancel a PENDING order, restore stock, delete PendingPayment. */
export async function cancelExpiredOrder(orderId: string, paymentHash: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // PENDING → CANCELLED (atomic guard)
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
    if (updated.count === 0) return; // already handled

    // Restore stock for each item
    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }

    // Delete the short-lived PendingPayment
    await tx.pendingPayment.delete({ where: { paymentHash } }).catch(() => {/* already gone */});
  });
}
