import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/commerce/service');

import * as commerceService from '@/services/commerce/service';

// Valid CUIDs required by the Zod createOrderSchema validator
const PRODUCT_CUID = 'cjld2cyuq0000t3rmniod1foy';
const BANK_CUID = 'cjld2cjxh0000qzrmn831i7rn';

const mockOrderResponse = {
  id: 'order-123',
  buyerId: 'test-user-id',
  buyerNpub: 'npub1buyer',
  sellerId: 'seller-id',
  sellerNpub: 'npub1seller',
  items: [],
  totalSats: '10500',
  shippingSats: '500',
  invoiceBolt11: 'lnbc1000n1test',
  paymentHash: 'abc123def456',
  status: 'PENDING' as const,
  shippingNote: null,
  nostrEventId: null,
  createdAt: new Date().toISOString(),
  paidAt: null,
  shippedAt: null,
  ngnDisplay: '₦1,500',
};

// ── POST /api/orders ─────────────────────────────────────────────────────────

describe('POST /api/orders', () => {
  beforeEach(() => {
    vi.mocked(commerceService.createOrder).mockResolvedValue(mockOrderResponse);
  });

  it('creates an order and returns 201', async () => {
    const { POST } = await import('@/app/api/orders/route');

    const req = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({ productId: PRODUCT_CUID, quantity: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.id).toBe('order-123');
    expect(body.paymentHash).toBe('abc123def456');
  });

  it('returns 401 when not authenticated', async () => {
    const { getSession } = await import('@/lib/session');
    vi.mocked(getSession).mockResolvedValueOnce(null);

    const { POST } = await import('@/app/api/orders/route');
    const req = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({ productId: PRODUCT_CUID, quantity: 1 }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body (missing productId)', async () => {
    const { POST } = await import('@/app/api/orders/route');
    const req = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({ quantity: 1 }), // missing productId
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid quantity', async () => {
    const { POST } = await import('@/app/api/orders/route');
    const req = new NextRequest('http://localhost/api/orders', {
      method: 'POST',
      body: JSON.stringify({ productId: PRODUCT_CUID, quantity: -1 }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ── GET /api/orders ───────────────────────────────────────────────────────────

describe('GET /api/orders', () => {
  beforeEach(() => {
    vi.mocked(commerceService.listOrdersForUser).mockResolvedValue({
      items: [mockOrderResponse],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('returns paginated orders for authenticated user', async () => {
    const { GET } = await import('@/app/api/orders/route');
    const req = new NextRequest('http://localhost/api/orders');

    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('returns 401 when not authenticated', async () => {
    const { getSession } = await import('@/lib/session');
    vi.mocked(getSession).mockResolvedValueOnce(null);

    const { GET } = await import('@/app/api/orders/route');
    const req = new NextRequest('http://localhost/api/orders');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

export { PRODUCT_CUID, BANK_CUID };
