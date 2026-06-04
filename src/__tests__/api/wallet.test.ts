import { describe, it, expect, vi } from 'vitest';
vi.mock('@/services/commerce/service');

import * as commerceService from '@/services/commerce/service';

describe('GET /api/wallet/balance', () => {
  it('returns balance for authenticated seller', async () => {
    const { getSession } = await import('@/lib/session');
    vi.mocked(getSession).mockResolvedValueOnce({
      userId: 'seller-id',
      role: 'SELLER',
      username: 'adaeze',
      npub: 'npub1seller',
    });

    vi.mocked(commerceService.getSellerBalance).mockResolvedValue({
      balanceSats: '250000',
      balanceNgn: '₦362,500',
      rateStale: false,
    });

    const { GET } = await import('@/app/api/wallet/balance/route');
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balanceSats).toBe('250000');
    expect(body.balanceNgn).toMatch(/₦/);
  });

  it('returns 403 when caller is a buyer (not a seller)', async () => {
    const { getSession } = await import('@/lib/session');
    vi.mocked(getSession).mockResolvedValueOnce({
      userId: 'buyer-id',
      role: 'BUYER',
      username: 'tobi',
      npub: 'npub1buyer',
    });

    const { GET } = await import('@/app/api/wallet/balance/route');
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    const { getSession } = await import('@/lib/session');
    vi.mocked(getSession).mockResolvedValueOnce(null);

    const { GET } = await import('@/app/api/wallet/balance/route');
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
