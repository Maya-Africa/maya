/**
 * Shared types — the single source of truth for cross-role data shapes.
 *
 * Every engineer imports from here. Do not invent shapes. If a field is missing,
 * coordinate with the owning engineer before adding it.
 *
 * BigInt values (sats, naira) are serialized as strings at API boundaries.
 * JSON cannot represent bigint directly.
 */

// ============================================================================
// Users
// ============================================================================

export type UserRole = 'BUYER' | 'SELLER';

export interface User {
  id: string;
  npub: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  about: string | null;
  longBio: string | null;
  lightningAddr: string | null;
  role: UserRole;
  createdAt: string;
}

export interface SellerInfo {
  id: string;
  username: string;
  npub: string;
  lightningAddress: string;
  displayName: string | null;
  avatar: string | null;
  about: string | null;
  stallStatus: string;           // "open" | "vacation" | "closed"
  stallStatusMessage: string | null;
}

// ============================================================================
// Products
// ============================================================================

export type ProductCategory =
  | 'paintings'
  | 'jewelry'
  | 'textiles'
  | 'leather'
  | 'pottery'
  | 'sculpture'
  | 'prints_digital'
  | 'other';

export type ProductStatus = 'ACTIVE' | 'SOLD_OUT' | 'UNLISTED';

export interface Product {
  id: string;
  sellerId: string;
  sellerUsername: string;
  sellerDisplayName: string | null;
  title: string;
  description: string;
  priceSats: string; // bigint serialized
  priceNgnDisplay: string; // computed by backend at live CoinGecko rate (cached 60s)
  shippingSats: string;
  category: ProductCategory;
  images: string[];
  isDigital: boolean;
  stock: number;
  status: ProductStatus;
  nostrEventId: string | null;
  createdAt: string;
}

export interface CreateProductInput {
  title: string;
  description: string;
  priceSats: string;
  shippingSats: string;
  category: ProductCategory;
  images: string[];
  isDigital: boolean;
  digitalUrl?: string;
  stock: number;
}

export interface UpdateProductInput {
  title?: string;
  description?: string;
  priceSats?: string;
  shippingSats?: string;
  category?: ProductCategory;
  images?: string[];
  stock?: number;
  status?: ProductStatus;
}

// ============================================================================
// Orders
// ============================================================================

export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface Order {
  id: string;
  buyerId: string;
  buyerNpub: string;
  sellerId: string;
  sellerNpub: string;
  items: OrderItem[];
  totalSats: string;
  shippingSats: string;
  invoiceBolt11: string | null;
  paymentHash: string | null;
  status: OrderStatus;
  shippingNote: string | null;
  nostrEventId: string | null;
  // Mirrors the most recent kind 30050 state. Optional until Commerce wires
  // publishOrderStateEvent in Stage 3, at which point mapOrder will set it.
  currentState?: string;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
}

export interface OrderItem {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string;
  quantity: number;
  priceSats: string;
}

export interface CreateOrderInput {
  productId: string;
  quantity: number;
  encryptedShipping?: string; // NIP-04 encrypted, optional for digital products
}

// ============================================================================
// Lightning
// ============================================================================

export interface LightningInvoice {
  bolt11: string;
  paymentHash: string;
  amountSats: string;
  expiresAt: string;
}

export interface InvoiceStatus {
  paymentHash: string;
  settled: boolean;
  settledAt: string | null;
}

// ============================================================================
// Payouts (real Bitnob sandbox integration in v1; production graduates via KYB)
// ============================================================================

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  isDefault: boolean;
}

export interface PayoutRequest {
  amountSats: string;
  bankAccountId: string;
}

export type PayoutStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

/**
 * Immediate response from the Bitnob payout API.
 * Returned by initiatePayout() and getPayoutStatus().
 * Distinct from `Payout` (the full DB record with bank account details).
 */
export interface PayoutResult {
  payoutId: string; // Bitnob payout ID (real, from sandbox API)
  status: PayoutStatus;
  amountSats: string;
  amountNgn: string; // computed from live CoinGecko rate at time of withdrawal
  etaSeconds: number;
  lightningInvoice?: string; // BOLT-11 for platform wallet to pay (Bitnob withdrawal flow)
}

export interface Payout {
  id: string;
  amountSats: string;
  amountNgn: string;
  bankAccount: BankAccount;
  status: PayoutStatus;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
  etaSeconds: number;
}

// ============================================================================
// Ledger — append-only seller balance entries
// ============================================================================

/**
 * The append-only record of every change to a seller's sat balance.
 * A seller's current balance = SUM(amountSats) for their userId.
 * Entries are immutable; corrections use the ADJUSTMENT type, never an UPDATE.
 */

export type LedgerEntryType = 'SALE' | 'WITHDRAWAL' | 'REFUND' | 'ADJUSTMENT';

export interface LedgerEntry {
  id: string;
  userId: string;
  amountSats: string; // bigint serialized; positive = credit, negative = debit
  type: LedgerEntryType;
  refId: string | null; // OrderId for SALE, PayoutId for WITHDRAWAL, etc.
  description: string; // human-readable, for audit trail
  recordedNgnRate: string; // BTC/NGN rate from CoinGecko at time of entry
  createdAt: string; // ISO timestamp
}

// ============================================================================
// PendingPayment — short-lived paymentHash → seller/order mapping
// ============================================================================

/**
 * Tracks inbound Lightning payments expected by the platform wallet.
 * Created when an invoice is generated; deleted when the payment settles
 * or expires. Maps the paymentHash to the seller (for ledger credit) and
 * the order (for status update).
 */

export interface PendingPayment {
  paymentHash: string;
  sellerId: string;
  amountSats: string; // bigint serialized
  orderId: string | null; // null if direct LNURL pay outside marketplace flow
  description: string;
  createdAt: string; // ISO timestamp
  expiresAt: string; // ISO timestamp — typically 1h from creation
}

// ============================================================================
// API response wrappers
// ============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'LIGHTNING_FAILED'
  | 'PAYOUT_FAILED'
  | 'INSUFFICIENT_BALANCE'
  | 'OUT_OF_STOCK'
  | 'BANK_ACCOUNT_IN_USE'
  | 'ORDER_NOT_RETRYABLE';
