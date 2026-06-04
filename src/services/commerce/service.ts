import type { Order, OrderItem, OrderStatus } from '@/types/shared';
import { ApiError } from '@/lib/api-error';
import { formatNgn, satsToNgn } from '@/lib/currency';
import { sendPushNotification, ExpiredSubscriptionError } from '@/lib/push';
import * as repository from './repository';
import type { OrderWithRelations } from './repository';
import * as catalogService from '@/services/catalog/service';
import {
  createPlatformInvoice,
  getReceivePaymentStatus,
  sendPlatformPayment,
} from '@/services/lightning/breez-platform';
import { trackPendingPayment, findByPaymentHash } from './pending-payments';
import { recordEntry, getBalance } from './ledger';
import { getBtcNgnRate, satsToNgnLive } from '@/services/pricing/coingecko';
import * as payoutService from '@/services/payout/service';
import { publishEvent } from '@/services/nostr/client';
import { signEventWithSystemKey, npubToHex } from '@/services/nostr/signing';
import { encryptToPubkey } from '@/services/nostr/encryption';
import { publishZapReceipt } from '@/services/nostr/zaps';
import { publishOrderStateEvent, type OrderStateParams } from '@/services/nostr/order-state';
import { publishSellerBadge } from '@/services/nostr/badge';
import { NOSTR_KINDS } from '@/types/nostr';
import { prisma } from '@/lib/db';

// ============================================================================
// Mappers
// ============================================================================

function mapOrderItem(item: OrderWithRelations['items'][number]): OrderItem {
  return {
    id: item.id,
    productId: item.productId,
    productTitle: item.product.title,
    productImage: item.product.images[0] ?? '',
    quantity: item.quantity,
    priceSats: item.priceSats.toString(),
  };
}

function mapOrder(order: OrderWithRelations): Order {
  return {
    id: order.id,
    buyerId: order.buyerId,
    buyerNpub: order.buyer.npub,
    sellerId: order.sellerId,
    sellerNpub: order.seller.npub,
    items: order.items.map(mapOrderItem),
    totalSats: order.totalSats.toString(),
    shippingSats: order.shippingSats.toString(),
    invoiceBolt11: order.invoiceBolt11,
    paymentHash: order.paymentHash,
    status: order.status as OrderStatus,
    shippingNote: order.shippingNote,
    nostrEventId: order.nostrEventId,
    currentState: order.currentState,
    createdAt: order.createdAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    shippedAt: order.shippedAt?.toISOString() ?? null,
  };
}

function toOrderStateParams(order: OrderWithRelations): OrderStateParams {
  return {
    id: order.id,
    nostrEventId: order.nostrEventId,
    sellerNpub: order.seller.npub,
    buyerNpub: order.buyer.npub,
  };
}

// ============================================================================
// Order creation (M8)
// ============================================================================

// Breez SDK Liquid invoice constraints. Generating an invoice below the
// minimum or above the maximum throws `Amount must be between 100 and
// 25000000`. Catch it here so the user gets a friendly 400 instead of a
// 500, and so we never insert an Order row that can't be paid.
const MIN_INVOICE_SATS = 100n;
const MAX_INVOICE_SATS = 25_000_000n;

export interface CreateOrderParams {
  productId: string;
  quantity: number;
  buyerId: string;
  buyerNpub: string;
  encryptedShipping?: string;
}

export async function createOrder(params: CreateOrderParams): Promise<Order & { ngnDisplay: string }> {
  const { productId, quantity, buyerId, encryptedShipping } = params;

  const product = await catalogService.getProduct(productId);
  if (product.status !== 'ACTIVE') throw new ApiError('OUT_OF_STOCK', 'Product is not available', 409);
  if (product.stock < quantity) throw new ApiError('OUT_OF_STOCK', 'Not enough stock', 409);

  const seller = await catalogService.getSellerById(product.sellerId);
  if (!seller) throw new ApiError('NOT_FOUND', 'Seller not found', 404);

  const priceSatsBig = BigInt(product.priceSats);
  const shippingSatsBig = BigInt(product.shippingSats);
  const totalSats = priceSatsBig * BigInt(quantity) + shippingSatsBig;

  if (totalSats < MIN_INVOICE_SATS) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `Total of ${formatNgn(satsToNgn(totalSats))} is below Lightning's minimum (${formatNgn(satsToNgn(MIN_INVOICE_SATS))}). Ask the seller to raise the price or order more than one.`,
      400,
    );
  }
  if (totalSats > MAX_INVOICE_SATS) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `Total of ${formatNgn(satsToNgn(totalSats))} exceeds Lightning's per-invoice maximum (${formatNgn(satsToNgn(MAX_INVOICE_SATS))}).`,
      400,
    );
  }

  const order = await repository.createOrder({
    buyer: { connect: { id: buyerId } },
    seller: { connect: { id: product.sellerId } },
    totalSats,
    shippingSats: shippingSatsBig,
    encryptedShipping: encryptedShipping ?? null,
    items: {
      create: [{ product: { connect: { id: productId } }, quantity, priceSats: priceSatsBig }],
    },
  });

  // Generate invoice on the platform wallet (not a per-seller wallet).
  const invoice = await createPlatformInvoice(
    totalSats,
    `Maya order #${order.id} — ${product.title}`,
  );

  // Track which seller this payment belongs to so we can credit them on settlement.
  await trackPendingPayment({
    paymentHash: invoice.paymentHash,
    sellerId: product.sellerId,
    amountSats: totalSats,
    orderId: order.id,
    description: `Order #${order.id} — ${product.title}`,
    expiresAt: invoice.expiresAt,
  });

  await repository.updateOrderInvoice(order.id, invoice.bolt11, invoice.paymentHash);

  const updatedOrder = await repository.findOrderById(order.id);
  if (!updatedOrder) throw new ApiError('INTERNAL_ERROR', 'Order creation failed', 500);

  const ngnAmount = await satsToNgnLive(totalSats);
  const ngnDisplay = formatNgn(ngnAmount);

  return { ...mapOrder(updatedOrder), ngnDisplay };
}

// ============================================================================
// Payment settlement (M7 + M9)
// ============================================================================

/**
 * Handle an incoming payment — called by both the Breez event listener and
 * the frontend polling endpoint. Idempotent: the atomic WHERE status='PENDING'
 * update ensures only the first caller triggers side effects.
 *
 * The three critical DB writes — PENDING→PAID order update, SALE ledger entry,
 * and PendingPayment deletion — run inside a single Prisma transaction so they
 * all succeed or all roll back. Non-fatal side effects (stock decrement, Nostr
 * publish, push notification) run outside the transaction.
 */
export async function markPaid(paymentHash: string): Promise<Order> {
  // Fetch the NGN rate before entering the transaction — it's an external HTTP
  // call and must not hold a DB connection open while waiting for CoinGecko.
  const { ratePerBtc } = await getBtcNgnRate();

  const { order, wasAlreadyPaid } = await prisma.$transaction(
    async (tx) => {
      // Cast tx to the full prisma type — safe because the transaction client has
      // the same model API as PrismaClient; TypeScript just narrows it too aggressively.
      const db = tx as unknown as typeof prisma;

      // Look up PendingPayment inside the transaction for a consistent read.
      const pending = await db.pendingPayment.findUnique({ where: { paymentHash } });

      // Atomically transition PENDING → PAID. Only one concurrent caller wins.
      const updated = await db.order.updateMany({
        where: { paymentHash, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date() },
      });

      // Re-fetch with all relations needed by mapOrder and the side-effect helpers.
      const order = await db.order.findUnique({
        where: { paymentHash },
        include: {
          items: { include: { product: { select: { id: true, title: true, images: true } } } },
          buyer: { select: { id: true, npub: true } },
          seller: { select: { id: true, npub: true } },
        },
      });
      if (!order) throw new Error(`Order not found for payment hash: ${paymentHash}`);

      const wasAlreadyPaid = updated.count === 0;

      if (!wasAlreadyPaid && pending) {
        // Record the SALE in the seller's ledger. Must be inside the transaction
        // so a ledger failure rolls back the order status change too.
        await db.ledgerEntry.create({
          data: {
            userId: pending.sellerId,
            amountSats: pending.amountSats,
            type: 'SALE',
            refId: order.id,
            description: `Sale — order #${order.id}`,
            recordedNgnRate: ratePerBtc,
          },
        });

        // Delete the short-lived PendingPayment — also inside the transaction.
        await db.pendingPayment.delete({ where: { paymentHash } }).catch(() => {
          // Already deleted by a concurrent call — idempotent, no-op.
        });
      }

      return { order, wasAlreadyPaid };
    },
    {
      // Bump from Prisma's 5s default. Settlement does 6 DB round-trips through
      // Supabase + pgbouncer; on a cold connection or slow link, 5s isn't enough
      // and the COMMIT throws P2028 ("Transaction not found"), rolling back the
      // PAID transition and looping the buyer's checkout polling.
      timeout: 20_000,
      maxWait: 10_000,
    },
  );

  if (!wasAlreadyPaid) {
    // Non-fatal side effects outside the transaction. A failure here does NOT
    // roll back the payment or ledger entry — the seller is already credited.
    for (const item of order.items) {
      await repository.decrementProductStock(item.productId, item.quantity);
    }
    await publishOrderNostrEvent(order);
    void publishZapReceipt({
      sellerHexPubkey: order.seller.npub,
      buyerHexPubkey: order.buyer.npub,
      bolt11: order.invoiceBolt11 ?? '',
      amountSats: order.totalSats,
      orderNostrEventId: order.nostrEventId,
      paidAt: order.paidAt ?? new Date(),
    }).catch((err) => console.error('NIP-57 zap receipt failed:', err));
    void publishSellerBadge(order.sellerId).catch((err) =>
      console.error('NIP-52 seller badge failed:', err),
    );
    await notifySeller(order);
  }

  return mapOrder(order as unknown as OrderWithRelations);
}

async function publishOrderNostrEvent(order: OrderWithRelations): Promise<void> {
  try {
    const content = JSON.stringify({
      orderId: order.id,
      items: order.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        priceSats: i.priceSats.toString(),
      })),
      totalSats: order.totalSats.toString(),
      shippingAddress: order.encryptedShipping
        ? encryptToPubkey(
            order.encryptedShipping,
            process.env.SYSTEM_NSEC!,
            npubToHex(order.seller.npub),
          )
        : null,
      paymentHash: order.paymentHash,
    });

    const template = {
      kind: NOSTR_KINDS.ORDER,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', order.id],
        ['p', order.seller.npub],
      ],
      content,
    };

    const signed = signEventWithSystemKey(template);
    await publishEvent(signed);
    await repository.updateOrderNostrEventId(order.id, signed.id);
  } catch (err) {
    // Nostr publish failure is non-fatal.
    console.error('Failed to publish order Nostr event:', err);
  }
}

async function notifySeller(order: OrderWithRelations): Promise<void> {
  const subscriptions = await repository.findPushSubscriptionsByUserId(order.sellerId);
  if (subscriptions.length === 0) return;

  const firstItem = order.items[0];
  const productTitle = firstItem?.product.title ?? 'your item';
  const ngnAmount = await satsToNgnLive(order.totalSats);
  const amountDisplay = formatNgn(ngnAmount);

  const payload = {
    title: 'Sale on Maya!',
    body: `You just sold "${productTitle}" for ${amountDisplay}`,
    icon: '/icons/icon-192.png',
    url: `/seller/orders/${order.id}`,
  };

  for (const sub of subscriptions) {
    try {
      await sendPushNotification({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, payload);
    } catch (err) {
      if (err instanceof ExpiredSubscriptionError) {
        await repository.deletePushSubscription(err.endpoint);
      }
    }
  }
}

// ============================================================================
// Order queries
// ============================================================================

export async function getOrderForUser(orderId: string, userId: string): Promise<Order> {
  const order = await repository.findOrderById(orderId);
  if (!order) throw new ApiError('NOT_FOUND', 'Order not found', 404);
  if (order.buyerId !== userId && order.sellerId !== userId) {
    throw new ApiError('FORBIDDEN', 'Access denied', 403);
  }
  return mapOrder(order);
}

export async function listOrdersForUser(
  userId: string,
  role: 'BUYER' | 'SELLER',
  page: number,
  pageSize: number,
): Promise<{ items: Order[]; total: number; page: number; pageSize: number }> {
  const { items, total } =
    role === 'SELLER'
      ? await repository.listOrdersBySeller(userId, page, pageSize)
      : await repository.listOrdersByBuyer(userId, page, pageSize);

  return { items: items.map(mapOrder), total, page, pageSize };
}

export async function checkInvoiceStatus(
  paymentHash: string,
  requestingUserId: string,
): Promise<{ settled: boolean; order: Order | null }> {
  // Check if already settled in DB (fast path — no Lightning call needed).
  const raw = await repository.findOrderByPaymentHash(paymentHash);

  if (raw && raw.buyerId !== requestingUserId && raw.sellerId !== requestingUserId) {
    throw new ApiError('FORBIDDEN', 'Access denied', 403);
  }

  if (raw?.status === 'PAID' || raw?.status === 'SHIPPED' || raw?.status === 'DELIVERED') {
    return { settled: true, order: mapOrder(raw) };
  }

  // Not yet settled in DB — check pending payments table.
  const pending = await findByPaymentHash(paymentHash);
  if (!pending) return { settled: false, order: null };

  // Mock-mode fallback. The mock provider's setTimeout-based settlement fires
  // in-process events that rely on the instrumentation hook's handler being
  // registered in the same module instance — Next.js dev mode doesn't always
  // honor that. Make the polling endpoint itself authoritative in mock mode:
  // if the PendingPayment is older than the mock's 30s auto-settle window,
  // mark it paid synchronously.
  if (process.env.USE_MOCK_LIGHTNING === 'true') {
    const MOCK_SETTLE_MS = 30_000;
    const age = Date.now() - pending.createdAt.getTime();
    if (age >= MOCK_SETTLE_MS) {
      const paidOrder = await markPaid(paymentHash);
      return { settled: true, order: paidOrder };
    }
    return { settled: false, order: null };
  }

  // Real Lightning fallback. Same shape of issue: in dev mode the boot-time
  // event listener can end up on a different module instance than the SDK
  // that actually received the payment, so paymentSucceeded never reaches
  // markPaid. Ask the SDK directly whether this paymentHash has settled,
  // and call markPaid if so. The SDK lookup is hard-capped at 2 seconds.
  //
  // Skip the lookup for very fresh invoices (under 5 seconds old) — the
  // payment can't have landed yet, the lookup just adds latency to the
  // response. Real Lightning typically takes 5-30 seconds to settle.
  const SETTLEMENT_GRACE_MS = 5_000;
  const age = Date.now() - pending.createdAt.getTime();
  if (age < SETTLEMENT_GRACE_MS) {
    return { settled: false, order: null };
  }

  try {
    const status = await getReceivePaymentStatus(paymentHash);
    if (status === 'settled') {
      const paidOrder = await markPaid(paymentHash);
      return { settled: true, order: paidOrder };
    }
  } catch (err) {
    console.warn(
      '[checkInvoiceStatus] SDK status poll failed, returning negative response:',
      err,
    );
  }

  return { settled: false, order: null };
}

// ============================================================================
// Shipping
// ============================================================================

export async function markShipped(
  orderId: string,
  sellerId: string,
  shippingNote?: string,
): Promise<Order> {
  const order = await repository.findOrderById(orderId);
  if (!order) throw new ApiError('NOT_FOUND', 'Order not found', 404);
  if (order.sellerId !== sellerId) throw new ApiError('FORBIDDEN', 'Access denied', 403);
  if (order.status !== 'PAID') {
    throw new ApiError('VALIDATION_ERROR', 'Order must be PAID before it can be shipped', 400);
  }
  const updated = await repository.markOrderShipped(orderId, shippingNote);
  // kind 30050 shipped — system key acts as platform proxy for seller in v1
  void publishOrderStateEvent('shipped', toOrderStateParams(updated), null, {
    note: shippingNote,
  }).then(() => repository.updateOrderCurrentState(orderId, 'shipped'))
    .catch((err) => console.error('kind 30050 shipped failed:', err));
  return mapOrder(updated);
}

export async function markDelivered(orderId: string, buyerId: string): Promise<Order> {
  const order = await repository.findOrderById(orderId);
  if (!order) throw new ApiError('NOT_FOUND', 'Order not found', 404);
  if (order.buyerId !== buyerId) throw new ApiError('FORBIDDEN', 'Only the buyer can confirm delivery', 403);
  if (order.status !== 'SHIPPED') {
    throw new ApiError('VALIDATION_ERROR', 'Order must be SHIPPED before it can be marked delivered', 400);
  }
  const updated = await repository.markOrderDelivered(orderId);
  void publishOrderStateEvent('delivered', toOrderStateParams(updated), null)
    .then(() => repository.updateOrderCurrentState(orderId, 'delivered'))
    .catch((err) => console.error('kind 30050 delivered failed:', err));
  return mapOrder(updated);
}

export async function disputeOrder(
  orderId: string,
  buyerId: string,
  disputeReason?: string,
): Promise<Order> {
  const order = await repository.findOrderById(orderId);
  if (!order) throw new ApiError('NOT_FOUND', 'Order not found', 404);
  if (order.buyerId !== buyerId) throw new ApiError('FORBIDDEN', 'Only the buyer can raise a dispute', 403);
  if (order.status !== 'PAID' && order.status !== 'SHIPPED') {
    throw new ApiError('VALIDATION_ERROR', 'Order must be PAID or SHIPPED to raise a dispute', 400);
  }
  // Publish the Nostr dispute event; DB status unchanged until resolution.
  void publishOrderStateEvent('disputed', toOrderStateParams(order), null, { disputeReason })
    .then(() => repository.updateOrderCurrentState(orderId, 'disputed'))
    .catch((err) => console.error('kind 30050 disputed failed:', err));
  return mapOrder(order);
}

export async function refundOrder(orderId: string, note?: string): Promise<Order> {
  const order = await repository.findOrderById(orderId);
  if (!order) throw new ApiError('NOT_FOUND', 'Order not found', 404);
  if (order.status === 'CANCELLED' || order.status === 'DELIVERED') {
    throw new ApiError('VALIDATION_ERROR', 'Order cannot be refunded in its current state', 400);
  }
  const updated = await repository.markOrderCancelled(orderId);
  // System-only signer for refunded per §2.1 design doc
  void publishOrderStateEvent('refunded', toOrderStateParams(updated), null, { note })
    .then(() => repository.updateOrderCurrentState(orderId, 'refunded'))
    .catch((err) => console.error('kind 30050 refunded failed:', err));
  return mapOrder(updated);
}

// ============================================================================
// Wallet balance — ledger-based (M5), not per-seller Breez wallet
// ============================================================================

export async function getSellerBalance(sellerId: string): Promise<{
  balanceSats: string;
  balanceNgn: string;
  rateStale: boolean;
}> {
  const balanceSats = await getBalance(sellerId);

  // Use the fixed demo rate (same as product/order NGN displays) so a seller's
  // balance always matches what their sale was quoted at. The live CoinGecko
  // rate is still used for ledger snapshots and v2 production pricing.
  return {
    balanceSats: balanceSats.toString(),
    balanceNgn: formatNgn(satsToNgn(balanceSats)),
    rateStale: false,
  };
}

// ============================================================================
// Payouts / withdrawals (M12)
// ============================================================================

export async function initiatePayout(
  sellerId: string,
  amountSats: bigint,
  bankAccountId: string,
): Promise<import('@/types/shared').PayoutResult> {
  const account = await repository.findBankAccountById(bankAccountId);
  if (!account || account.userId !== sellerId) {
    throw new ApiError('NOT_FOUND', 'Bank account not found', 404);
  }

  const balance = await getBalance(sellerId);
  if (amountSats > balance) {
    throw new ApiError('VALIDATION_ERROR', 'Insufficient balance', 400);
  }

  // Step 1: Bitnob issues a Lightning invoice → Breez pays it → Bitnob wallet funded.
  // Strict ordering: fund first, then payout. Ledger is only debited after all steps confirm.
  const funding = await payoutService.getFundingInvoice(amountSats);
  await sendPlatformPayment(funding.bolt11);
  await payoutService.waitForFunding(funding.invoiceId);

  // Step 2: Quote + initialize with Bitnob (wallet is now funded).
  const prepared = await payoutService.preparePayoutRequest(amountSats, bankAccountId, {
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    bankName: account.bankName,
  });

  // Step 3: Finalize — Bitnob processes the NGN bank transfer.
  const result = await payoutService.confirmPayoutRequest(
    prepared.quoteId,
    prepared.payoutId,
    prepared.amountSats,
    prepared.amountNgn,
  );

  // Step 4: ONLY after Bitnob finalize confirmed — debit the seller's ledger.
  const { ratePerBtc } = await getBtcNgnRate();
  const amountNgn = (amountSats * ratePerBtc) / 100_000_000n;
  await recordEntry({
    userId: sellerId,
    amountSats: -amountSats,
    type: 'WITHDRAWAL',
    refId: result.payoutId,
    description: `Withdrawal to ${account.bankName} ****${account.accountNumber.slice(-4)}`,
    recordedNgnRate: ratePerBtc,
  });

  // Persist payout record for history and webhook updates.
  await repository.createPayout({
    user: { connect: { id: sellerId } },
    bankAccountId,
    amountSats,
    amountNgn,
    status: 'PENDING',
    externalId: result.payoutId,
  });

  return result;
}

// ============================================================================
// Push notification subscriptions
// ============================================================================

export async function subscribeToNotifications(
  userId: string,
  endpoint: string,
  p256dh: string,
  auth: string,
): Promise<void> {
  await repository.upsertPushSubscription(userId, endpoint, p256dh, auth);
}

// ============================================================================
// Bank account management (M11.5)
// ============================================================================

/** Mask account number to last 4 digits for client responses. */
function maskAccountNumber(accountNumber: string): string {
  return `****${accountNumber.slice(-4)}`;
}

function mapBankAccount(account: {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
  createdAt: Date;
}) {
  return {
    id: account.id,
    bankName: account.bankName,
    accountNumberMasked: maskAccountNumber(account.accountNumber),
    accountName: account.accountName,
    isDefault: account.isDefault,
    createdAt: account.createdAt.toISOString(),
  };
}

export async function listBankAccounts(sellerId: string) {
  const accounts = await repository.listBankAccountsByUser(sellerId);
  return accounts.map(mapBankAccount);
}

export async function addBankAccount(
  sellerId: string,
  data: { bankName: string; accountNumber: string; accountName: string },
) {
  const account = await repository.createBankAccount({ userId: sellerId, ...data });
  return mapBankAccount(account);
}

export async function removeBankAccount(sellerId: string, accountId: string): Promise<void> {
  const account = await repository.findBankAccountById(accountId);
  if (!account || account.userId !== sellerId) {
    throw new ApiError('NOT_FOUND', 'Bank account not found', 404);
  }

  const hasPending = await repository.hasPendingPayoutsForAccount(accountId);
  if (hasPending) {
    throw new ApiError(
      'BANK_ACCOUNT_IN_USE',
      'Cannot delete a bank account with a pending payout',
      409,
    );
  }

  await repository.deleteBankAccountById(accountId);
}

// ============================================================================
// Wallet activity feed (M16)
// ============================================================================

export async function getWalletActivity(
  sellerId: string,
  cursor: string | undefined,
  limit: number,
) {
  const { items, nextCursor } = await repository.listLedgerActivity(sellerId, cursor, limit);

  const mapped = items.map((entry) => {
    // amountNgnDisplay is computed from the snapshotted rate at entry time — stable.
    const ngnAmount = (BigInt(entry.amountSats) * BigInt(entry.recordedNgnRate)) / 100_000_000n;
    return {
      id: entry.id,
      type: entry.type,
      amountSats: entry.amountSats.toString(),
      amountNgnDisplay: formatNgn(ngnAmount),
      description: entry.description,
      refId: entry.refId,
      createdAt: entry.createdAt.toISOString(),
    };
  });

  return { items: mapped, nextCursor };
}

// ============================================================================
// Order retry (M15)
// ============================================================================

export async function retryOrder(
  originalOrderId: string,
  buyerId: string,
): Promise<Order & { bolt11: string; paymentHash: string; expiresAt: string; ngnDisplay: string }> {
  const original = await repository.findOrderById(originalOrderId);
  if (!original) throw new ApiError('NOT_FOUND', 'Order not found', 404);
  if (original.buyerId !== buyerId) throw new ApiError('FORBIDDEN', 'Access denied', 403);

  if (original.status !== 'CANCELLED' && original.status !== 'PENDING') {
    throw new ApiError('ORDER_NOT_RETRYABLE', 'Only cancelled orders can be retried', 400);
  }

  // Re-check product availability.
  const productId = original.items[0]?.productId;
  if (!productId) throw new ApiError('INTERNAL_ERROR', 'Order has no items', 500);

  const quantity = original.items[0]?.quantity ?? 1;
  const product = await catalogService.getProduct(productId);
  if (product.status !== 'ACTIVE' || product.stock < quantity) {
    throw new ApiError('OUT_OF_STOCK', 'Product is no longer available', 409);
  }

  // Create a fresh order (new ID) for the same product + buyer.
  const newOrder = await createOrder({
    productId,
    quantity,
    buyerId,
    buyerNpub: original.buyer.npub,
    encryptedShipping: original.encryptedShipping ?? undefined,
  });

  const invoice = await createPlatformInvoice(
    BigInt(newOrder.totalSats),
    `Maya order #${newOrder.id} (retry of #${originalOrderId}) — ${product.title}`,
  );

  await trackPendingPayment({
    paymentHash: invoice.paymentHash,
    sellerId: product.sellerId,
    amountSats: BigInt(newOrder.totalSats),
    orderId: newOrder.id,
    description: `Order #${newOrder.id} — ${product.title}`,
    expiresAt: invoice.expiresAt,
  });

  await repository.updateOrderInvoice(newOrder.id, invoice.bolt11, invoice.paymentHash);

  const ngnAmount = await satsToNgnLive(BigInt(newOrder.totalSats));
  const ngnDisplay = formatNgn(ngnAmount);

  return {
    ...newOrder,
    bolt11: invoice.bolt11,
    paymentHash: invoice.paymentHash,
    expiresAt: invoice.expiresAt.toISOString(),
    ngnDisplay,
  };
}

// ============================================================================
// Payout history (GET /api/payout/history)
// ============================================================================

export async function getPayoutHistory(
  sellerId: string,
  cursor: string | undefined,
  limit: number,
) {
  const { items, nextCursor } = await repository.listPayoutsByUser(sellerId, cursor, limit);

  // Join in bank details so the history page can render
  // "₦42,300 to GTBank ****1234" without a second client-side fetch.
  // The Payout model doesn't declare a Prisma relation to BankAccount in v1,
  // so we fetch them in a single batched query and map by id.
  const bankAccountIds = Array.from(new Set(items.map((p) => p.bankAccountId)));
  const banks = await repository.listBankAccountsByIds(bankAccountIds);
  const byId = new Map(banks.map((b) => [b.id, b]));

  const mapped = items.map((p) => {
    const bank = byId.get(p.bankAccountId);
    return {
      id: p.id,
      status: p.status,
      amountSats: p.amountSats.toString(),
      amountNgn: p.amountNgn.toString(),
      bankAccountId: p.bankAccountId,
      bankName: bank?.bankName ?? null,
      accountNumberMasked: bank ? maskAccountNumber(bank.accountNumber) : null,
      externalId: p.externalId,
      failureReason: p.failureReason ?? null,
      createdAt: p.createdAt.toISOString(),
      completedAt: p.completedAt?.toISOString() ?? null,
    };
  });

  return { items: mapped, nextCursor };
}

// ============================================================================
// Expire pending orders (cron — /api/cron/expire-pending)
// ============================================================================

/**
 * Cancel all PENDING orders whose Lightning invoice has expired.
 * Called by the cron endpoint every 5 minutes.
 * Returns the count of cancelled orders.
 */
export async function expirePendingOrders(): Promise<{ cancelled: number }> {
  const expired = await repository.findExpiredPendingPaymentsWithOrders();
  let cancelled = 0;

  for (const pending of expired) {
    if (!pending.orderId) continue;
    try {
      await repository.cancelExpiredOrder(pending.orderId, pending.paymentHash);
      cancelled++;
    } catch (err) {
      // Log but don't let one failure block the rest.
      console.error('[expire-pending] failed to cancel order:', pending.orderId, err);
    }
  }

  return { cancelled };
}

// ============================================================================
// Role-differentiated order detail (M15)
// ============================================================================

export async function getOrderDetailForUser(
  orderId: string,
  userId: string,
  role: 'BUYER' | 'SELLER',
) {
  const order = await repository.findOrderById(orderId);
  if (!order) throw new ApiError('NOT_FOUND', 'Order not found', 404);

  // 403 for strangers — never 404 (don't leak existence).
  if (order.buyerId !== userId && order.sellerId !== userId) {
    throw new ApiError('FORBIDDEN', 'Access denied', 403);
  }

  const base = mapOrder(order);
  // Use the fixed demo rate so order detail NGN matches the product listing
  // and the seller's balance card (same convention as getSellerBalance).
  // The live CoinGecko rate is still snapshotted into LedgerEntry.recordedNgnRate
  // at SALE time for ledger history.
  const ngnAmount = satsToNgn(BigInt(order.totalSats));
  const recordedAt = new Date().toISOString();

  if (role === 'SELLER' && order.sellerId === userId) {
    return {
      ...base,
      buyer: { npub: order.buyer.npub },
      encryptedShipping: (order as unknown as { encryptedShipping: string | null }).encryptedShipping ?? null,
      priceNgnDisplay: formatNgn(ngnAmount),
      ngnRecordedAt: recordedAt,
    };
  }

  // Buyer view — include seller summary.
  const sellerUser = await prisma.user.findUnique({
    where: { id: order.sellerId },
    select: { id: true, username: true, displayName: true, avatar: true },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://maya.com';
  return {
    ...base,
    seller: {
      id: sellerUser?.id ?? order.sellerId,
      username: sellerUser?.username ?? '',
      displayName: sellerUser?.displayName ?? null,
      shopUrl: `${appUrl}/shop/${sellerUser?.username ?? ''}`,
      initials: (sellerUser?.displayName ?? sellerUser?.username ?? 'B')[0]?.toUpperCase() ?? 'B',
      avatar: sellerUser?.avatar ?? null,
    },
    priceNgnDisplay: formatNgn(ngnAmount),
    ngnRecordedAt: recordedAt,
  };
}
