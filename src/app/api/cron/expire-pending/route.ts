/**
 * /api/cron/expire-pending
 *
 * GET — cancel all PENDING orders whose Lightning invoice has expired.
 *
 * Run this on a 5-minute schedule (Vercel Cron, external cron, or manually).
 * Per the CLAUDE.md spec, expired orders:
 *   1. Transition PENDING → CANCELLED
 *   2. Delete the matching PendingPayment
 *   3. Restore product stock (stock + quantity)
 *
 * The endpoint is intentionally unauthenticated (cron-safe) — it performs
 * only safe, idempotent cancellations and logs every invocation.
 *
 * To protect it in production, set CRON_SECRET and check it here:
 *   Authorization: Bearer <CRON_SECRET>
 */

import { NextResponse, type NextRequest } from 'next/server';
import * as commerceService from '@/services/commerce/service';

export async function GET(request: NextRequest) {
  // Optional: verify cron secret if set (e.g. when called from Vercel Cron)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startedAt = new Date().toISOString();
  console.log('[cron/expire-pending] running at', startedAt);

  try {
    const { cancelled } = await commerceService.expirePendingOrders();
    console.log('[cron/expire-pending] cancelled', cancelled, 'orders');

    return NextResponse.json({ ok: true, cancelled, ranAt: startedAt });
  } catch (err) {
    console.error('[cron/expire-pending] error:', err);
    return NextResponse.json(
      { ok: false, error: String(err), ranAt: startedAt },
      { status: 500 },
    );
  }
}
