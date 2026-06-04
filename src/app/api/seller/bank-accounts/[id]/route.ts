/**
 * /api/seller/bank-accounts/[id]
 *
 * DELETE — remove a saved bank account.
 *          Rejected (409) if a PENDING payout references this account.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import * as commerceService from '@/services/commerce/service';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to remove a bank account', 401);
    if (session.role !== 'SELLER') throw new ApiError('FORBIDDEN', 'Only sellers can remove bank accounts', 403);

    const { id } = await params;
    await commerceService.removeBankAccount(session.userId, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
