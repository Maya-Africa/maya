/**
 * /api/seller/bank-accounts
 *
 * GET  — list the authenticated seller's saved bank accounts (masked).
 * POST — add a new saved bank account (10-digit NUBAN, any Nigerian bank).
 *
 * Account numbers are masked in all responses (last 4 digits only).
 * The full number is stored in Postgres and only ever read server-side
 * (during payout initiation) — never returned to the client after creation.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import { addBankAccountSchema } from '@/validators/order';
import * as commerceService from '@/services/commerce/service';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to view bank accounts', 401);
    if (session.role !== 'SELLER') throw new ApiError('FORBIDDEN', 'Only sellers have bank accounts', 403);

    const accounts = await commerceService.listBankAccounts(session.userId);
    return NextResponse.json({ accounts });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to add a bank account', 401);
    if (session.role !== 'SELLER') throw new ApiError('FORBIDDEN', 'Only sellers can add bank accounts', 403);

    const body = addBankAccountSchema.parse(await request.json());
    const account = await commerceService.addBankAccount(session.userId, body);

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ApiError('VALIDATION_ERROR', 'Invalid bank account data', 400, error.flatten()));
    }
    return handleApiError(error);
  }
}
