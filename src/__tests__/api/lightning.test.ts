import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/commerce/service');

import * as commerceService from '@/services/commerce/service';

describe('GET /api/lightning/verify/[paymentHash]', () => {
  it('returns settled:false when not yet paid', async () => {
    vi.mocked(commerceService.checkInvoiceStatus).mockResolvedValue({
      settled: false,
      order: null,
    });

    const { GET } = await import('@/app/api/lightning/verify/[paymentHash]/route');
    const req = new NextRequest('http://localhost/api/lightning/verify/abc123');
    const res = await GET(req, { params: Promise.resolve({ paymentHash: 'abc123' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settled).toBe(false);
  });

  it('returns settled:true with order when paid', async () => {
    vi.mocked(commerceService.checkInvoiceStatus).mockResolvedValue({
      settled: true,
      order: {
        id: 'order-123',
        buyerId: 'test-user-id',
        buyerNpub: 'npub1buyer',
        sellerId: 'seller-id',
        sellerNpub: 'npub1seller',
        items: [],
        totalSats: '10500',
        shippingSats: '500',
        invoiceBolt11: 'lnbc1000n1test',
        paymentHash: 'abc123',
        status: 'PAID',
        shippingNote: null,
        nostrEventId: null,
        createdAt: new Date().toISOString(),
        paidAt: new Date().toISOString(),
        shippedAt: null,
      },
    });

    const { GET } = await import('@/app/api/lightning/verify/[paymentHash]/route');
    const req = new NextRequest('http://localhost/api/lightning/verify/abc123');
    const res = await GET(req, { params: Promise.resolve({ paymentHash: 'abc123' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.settled).toBe(true);
    expect(body.order.status).toBe('PAID');
  });

  it('returns 401 when not authenticated', async () => {
    const { getSession } = await import('@/lib/session');
    vi.mocked(getSession).mockResolvedValueOnce(null);

    const { GET } = await import('@/app/api/lightning/verify/[paymentHash]/route');
    const req = new NextRequest('http://localhost/api/lightning/verify/abc123');
    const res = await GET(req, { params: Promise.resolve({ paymentHash: 'abc123' }) });
    expect(res.status).toBe(401);
  });
});
