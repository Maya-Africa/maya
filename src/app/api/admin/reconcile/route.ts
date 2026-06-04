import { NextResponse } from 'next/server';
import { reconcile } from '@/services/commerce/ledger';

/**
 * GET /api/admin/reconcile
 *
 * Compares ledger total against platform Breez wallet actual balance.
 * Run before every demo to confirm no drift.
 * No auth in v1 — all calls are logged.
 */
export async function GET() {
  console.log('[reconcile] endpoint called at', new Date().toISOString());

  try {
    const { ledgerTotal, platformWalletBalance, diff } = await reconcile();

    return NextResponse.json({
      ledgerTotal: ledgerTotal.toString(),
      platformWalletBalance: platformWalletBalance.toString(),
      diff: diff.toString(),
      ok: diff === 0n,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[reconcile] error:', err);
    return NextResponse.json(
      { error: 'Reconciliation failed', detail: String(err) },
      { status: 500 },
    );
  }
}
