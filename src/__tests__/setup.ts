import { vi } from 'vitest';

// ── Prisma ────────────────────────────────────────────────────────────────────
vi.mock('@prisma/client', () => {
  const PrismaClient = vi.fn(() => ({}));
  return { PrismaClient };
});

vi.mock('@/lib/db', () => ({
  prisma: {
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    orderItem: { create: vi.fn() },
    product: { update: vi.fn(), findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    pushSubscription: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    payout: { create: vi.fn(), findUnique: vi.fn() },
    bankAccount: { findUnique: vi.fn() },
  },
}));

// ── Session ───────────────────────────────────────────────────────────────────
vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: 'test-user-id',
    role: 'BUYER',
    username: 'testuser',
    npub: 'npub1test',
  }),
  buildSessionCookie: vi.fn().mockReturnValue('session=test'),
  sessionCookieOptions: vi.fn().mockReturnValue({}),
  clearSessionCookieOptions: vi.fn().mockReturnValue({}),
}));

// ── Lightning ─────────────────────────────────────────────────────────────────
vi.mock('@/services/lightning/breez-client', () => ({
  createInvoice: vi.fn().mockResolvedValue({
    bolt11: 'lnbc1000n1test',
    paymentHash: 'abc123def456',
    amountSats: '1000',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  }),
  verifyInvoice: vi.fn().mockResolvedValue({
    paymentHash: 'abc123def456',
    settled: false,
    settledAt: null,
  }),
  getWalletBalance: vi.fn().mockResolvedValue(250_000n),
  mockSettleInvoice: vi.fn().mockReturnValue(true),
}));

// ── Breez wallet manager ──────────────────────────────────────────────────────
vi.mock('@/services/lightning/wallet-manager', () => ({
  getSellerWallet: vi.fn(),
  trackInvoice: vi.fn(),
  findSettlement: vi.fn().mockReturnValue(null),
}));

// ── Breez SDK Spark ───────────────────────────────────────────────────────────
vi.mock('@breeztech/breez-sdk-spark', () => ({
  init: vi.fn().mockResolvedValue(undefined),
  connect: vi.fn().mockResolvedValue({
    receivePayment: vi.fn().mockResolvedValue({ paymentRequest: 'lnbc1000n1test', feeSats: 1 }),
    getInfo: vi.fn().mockResolvedValue({ balanceSats: 250000 }),
    addEventListener: vi.fn().mockResolvedValue('listener-id'),
  }),
  defaultConfig: vi.fn().mockReturnValue({ apiKey: '' }),
}));

// ── Payout ────────────────────────────────────────────────────────────────────
vi.mock('@/services/payout/service', () => ({
  initiatePayoutRequest: vi.fn().mockResolvedValue({
    payoutId: 'payout-123',
    status: 'PENDING',
    amountSats: '100000',
    amountNgn: '145000',
    etaSeconds: 3,
  }),
  getPayoutStatusById: vi.fn().mockResolvedValue({
    payoutId: 'payout-123',
    status: 'SUCCESS',
    amountSats: '100000',
    amountNgn: '145000',
    etaSeconds: 0,
  }),
}));

// ── Web Push ──────────────────────────────────────────────────────────────────
vi.mock('@/lib/push', () => ({
  sendPushNotification: vi.fn().mockResolvedValue(true),
  ExpiredSubscriptionError: class ExpiredSubscriptionError extends Error {
    endpoint: string;
    constructor(endpoint: string) {
      super('expired');
      this.endpoint = endpoint;
    }
  },
}));

// ── Nostr ─────────────────────────────────────────────────────────────────────
vi.mock('@/services/nostr/client', () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/nostr/signing', () => ({
  signEventWithSystemKey: vi.fn().mockReturnValue({ id: 'nostr-event-id', sig: 'sig' }),
}));

// ── Catalog service (cross-role boundary) ─────────────────────────────────────
vi.mock('@/services/catalog/service', () => ({
  getProduct: vi.fn().mockResolvedValue({
    id: 'product-id',
    sellerId: 'seller-id',
    sellerUsername: 'adaeze',
    sellerDisplayName: 'Adaeze',
    title: 'Adire Textile',
    description: 'Hand-dyed indigo textile',
    priceSats: '10000',
    priceNgnDisplay: '₦14,500',
    shippingSats: '500',
    category: 'textiles',
    images: ['https://res.cloudinary.com/test/image/upload/test.jpg'],
    isDigital: false,
    stock: 5,
    status: 'ACTIVE',
    nostrEventId: null,
    createdAt: new Date().toISOString(),
  }),
  getSellerById: vi.fn().mockResolvedValue({
    id: 'seller-id',
    username: 'adaeze',
    npub: 'npub1seller',
    lightningAddress: 'adaeze@maya.com',
    displayName: 'Adaeze',
    avatar: null,
  }),
}));

// ── next/headers (used by getSession in route handlers) ───────────────────────
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

// ── Environment variables ─────────────────────────────────────────────────────
process.env.SESSION_SECRET = 'test-secret-32-bytes-long-padding!!';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.DEMO_BTC_NGN_RATE = '145000000';
process.env.USE_MOCK_LIGHTNING = 'true';
process.env.WEB_PUSH_VAPID_PUBLIC = 'test-vapid-public';
process.env.WEB_PUSH_VAPID_PRIVATE = 'test-vapid-private';
process.env.WEB_PUSH_VAPID_SUBJECT = 'mailto:test@test.com';
