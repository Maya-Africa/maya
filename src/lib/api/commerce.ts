/**
 * Typed wrappers around the Commerce endpoints.
 *
 * Balance and order data live on the Commerce side; this module is the
 * client-side seam so dashboard / orders / withdraw pages can call into
 * them without each component re-deriving the URL and response shape.
 *
 * Sat values cross the wire as decimal strings; NGN display strings come
 * pre-formatted ("₦12,345") from the server using the demo rate.
 */

import { fetcher, patchFetcher, postFetcher } from '@/lib/fetcher';
import type { Order } from '@/types/shared';

// ============================================================================
// Wallet balance
// ============================================================================

export interface WalletBalance {
  balanceSats: string;
  balanceNgn: string; // pre-formatted "₦12,345"
  rateStale: boolean; // true when the CoinGecko rate fell back to a cached copy
}

export function getWalletBalance(): Promise<WalletBalance> {
  return fetcher('/api/wallet/balance');
}

// ============================================================================
// Orders
// ============================================================================

export interface ListOrdersQuery {
  page?: number;
  pageSize?: number;
}

export interface ListOrdersResponse {
  items: Order[];
  total: number;
  page: number;
  pageSize: number;
}

export function listOrders(query: ListOrdersQuery = {}): Promise<ListOrdersResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  const qs = params.toString();
  return fetcher(`/api/orders${qs ? `?${qs}` : ''}`);
}

export function getOrder(id: string): Promise<Order> {
  return fetcher(`/api/orders/${encodeURIComponent(id)}`);
}

// The buyer view of an order detail includes a denormalized seller summary
// and an NGN display value snapshotted at view time. The backend computes
// `shopUrl` as a fully qualified URL — the UI uses just the username for
// relative routing, so callers may want to pull it from `seller.username`.
export interface BuyerOrderDetail extends Order {
  seller: {
    id: string;
    username: string;
    displayName: string | null;
    shopUrl: string;
    initials: string;
    avatar: string | null;
  };
  priceNgnDisplay: string; // pre-formatted "₦12,345"
  ngnRecordedAt: string;
}

export function getBuyerOrder(id: string): Promise<BuyerOrderDetail> {
  return fetcher(`/api/orders/${encodeURIComponent(id)}`);
}

// ============================================================================
// Buyer review submission (kind 30051)
// ============================================================================

export interface SubmitOrderReviewInput {
  rating: number; // 1-5
  content: string; // 1-2000 chars
  password: string; // server decrypts buyer nsec to sign the kind 30051
}

export interface OrderReviewResponse {
  id: string;
  orderId: string;
  rating: number;
  content: string;
  nostrEventId: string;
  createdAt: string;
}

export function submitOrderReview(
  orderId: string,
  input: SubmitOrderReviewInput,
): Promise<OrderReviewResponse> {
  return postFetcher(`/api/orders/${encodeURIComponent(orderId)}/review`, input);
}

// ============================================================================
// Order state actions (kind 30050)
// ============================================================================

/**
 * Buyer confirms they received the order. Transitions order to DELIVERED
 * and publishes a kind 30050 order:state event server-side.
 */
export function confirmOrderDelivered(orderId: string): Promise<{ order: Order }> {
  return patchFetcher(`/api/orders/${encodeURIComponent(orderId)}/deliver`, {});
}

/**
 * Buyer raises a dispute. Reason is optional (max 500 chars). Server
 * publishes the kind 30050 with currentState=disputed.
 */
export function raiseOrderDispute(
  orderId: string,
  reason?: string,
): Promise<{ order: Order }> {
  const body: { reason?: string } = {};
  if (reason && reason.trim()) body.reason = reason.trim();
  return patchFetcher(`/api/orders/${encodeURIComponent(orderId)}/dispute`, body);
}

/**
 * Seller issues a refund. Note is optional (max 500 chars). Server
 * publishes the kind 30050 with currentState=refunded. Per Commerce
 * spec the actual sats-return-to-buyer flow is handled separately.
 */
export function refundOrder(
  orderId: string,
  note?: string,
): Promise<{ order: Order }> {
  const body: { note?: string } = {};
  if (note && note.trim()) body.note = note.trim();
  return postFetcher(`/api/orders/${encodeURIComponent(orderId)}/refund`, body);
}

// The seller view of an order detail includes the buyer's npub (pseudonymous,
// public) and the NIP-04 ciphertext of the shipping address — the seller's
// client decrypts using their nsec. Never exposes the buyer's displayName.
export interface SellerOrderDetail extends Order {
  buyer: {
    npub: string;
  };
  encryptedShipping: string | null; // null for digital products or pre-shipping-collection v1 orders
  priceNgnDisplay: string;
  ngnRecordedAt: string;
}

export function getSellerOrder(id: string): Promise<SellerOrderDetail> {
  return fetcher(`/api/orders/${encodeURIComponent(id)}`);
}

// ============================================================================
// Order creation (buyer-side)
// ============================================================================

export interface CreateOrderInput {
  productId: string;
  quantity?: number; // defaults to 1 server-side
  /**
   * Optional. NIP-04 ciphertext of the buyer's shipping address,
   * encrypted to the seller's pubkey client-side. Slice B will wire this.
   */
  encryptedShipping?: string;
}

/**
 * POST /api/orders. Requires an authenticated buyer (or seller buying
 * from someone else). The response is the freshly created Order with
 * `invoiceBolt11` + `paymentHash` already populated.
 */
export function createOrder(
  input: CreateOrderInput,
): Promise<Order & { ngnDisplay: string }> {
  return postFetcher('/api/orders', input);
}

// ============================================================================
// Invoice polling
// ============================================================================

export interface InvoiceStatus {
  settled: boolean;
  order: Order | null;
}

/**
 * GET /api/lightning/verify/[paymentHash]. The checkout page hits this
 * on a polling schedule until the order's status flips to PAID.
 */
export function verifyInvoiceStatus(paymentHash: string): Promise<InvoiceStatus> {
  return fetcher(`/api/lightning/verify/${encodeURIComponent(paymentHash)}`);
}

/**
 * Seller-only. Transition the order to SHIPPED.
 * Optional `shippingNote` is shown to the buyer on their order detail page.
 */
export function markOrderShipped(
  id: string,
  shippingNote?: string,
): Promise<Order> {
  const body: { shippingNote?: string } = {};
  if (shippingNote && shippingNote.trim()) body.shippingNote = shippingNote.trim();
  return patchFetcher(`/api/orders/${encodeURIComponent(id)}/ship`, body);
}
