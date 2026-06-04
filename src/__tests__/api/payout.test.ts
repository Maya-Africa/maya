import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/services/commerce/service');

import * as commerceService from '@/services/commerce/service';

// Valid CUID required by the Zod payoutSchema validator
const BANK_CUID = 'cjld2cjxh0000qzrmn831i7rn';

const mockPayoutResult = {
  payoutId: 'payout-123',
  status: 'PENDING' as const,
  amountSats: '100000',
  amountNgn: '145000',
  etaSeconds: 3,
};

describe('POST /api/payout', () => {
  beforeEach(() => {
    vi.mocked(commerceService.initiatePayout).mockResolvedValue(mockPayoutResult);
  });

  it('initiates payout for authenticated seller and returns 201', async () => {
    const { getSession } = await import('@/lib/session');
    vi.mocked(getSession).mockResolvedValueOnce({
      userId: 'seller-id',
      role: 'SELLER',
      username: 'adaeze',
      npub: 'npub1seller',
    });

    const { POST } = await import('@/app/api/payout/route');
    const req = new NextRequest('http://localhost/api/payout', {
      method: 'POST',
      body: JSON.stringify({ amountSats: '100000', bankAccountId: BANK_CUID }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.payoutId).toBe('payout-123');
    expect(body.status).toBe('PENDING');
  });

  it('returns 403 when caller is a buyer', async () => {
    const { getSession } = await import('@/lib/session');
    vi.mocked(getSession).mockResolvedValueOnce({
      userId: 'buyer-id',
      role: 'BUYER',
      username: 'tobi',
      npub: 'npub1buyer',
    });

    const { POST } = await import('@/app/api/payout/route');
    const req = new NextRequest('http://localhost/api/payout', {
      method: 'POST',
      body: JSON.stringify({ amountSats: '100000', bankAccountId: BANK_CUID }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid payload (bankAccountId not a CUID)', async () => {
    const { getSession } = await import('@/lib/session');
    vi.mocked(getSession).mockResolvedValueOnce({
      userId: 'seller-id',
      role: 'SELLER',
      username: 'adaeze',
      npub: 'npub1seller',
    });

    const { POST } = await import('@/app/api/payout/route');
    const req = new NextRequest('http://localhost/api/payout', {
      method: 'POST',
      body: JSON.stringify({ amountSats: 'not-a-number', bankAccountId: 'not-a-cuid' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
