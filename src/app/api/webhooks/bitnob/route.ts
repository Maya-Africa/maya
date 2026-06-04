/**
 * /api/webhooks/bitnob
 *
 * POST — Bitnob calls this when an NGN payout completes or fails.
 * Verifies the HMAC-SHA256 signature with BITNOB_WEBHOOK_SECRET, then
 * updates the Payout record status in Postgres.
 *
 * Bitnob sandbox typically delivers webhooks within 5-30 seconds of finalization.
 * The endpoint must return 200 quickly; Bitnob will retry on non-2xx responses.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { handleApiError, ApiError } from '@/lib/api-error';
import { verifyWebhookSignature } from '@/services/payout/bitnob-client';
import * as repository from '@/services/commerce/repository';

interface BitnobWebhookPayload {
  event?: string;
  data?: {
    id?: string;          // Bitnob payout ID (matches our Payout.externalId)
    status?: string;      // "SUCCESS" | "FAILED" | "PENDING" etc.
    reference?: string;   // Our maya-p-... reference
    sat_amount?: number;
    settlement_amount?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Bitnob signs the raw request body with BITNOB_WEBHOOK_SECRET via HMAC-SHA256.
    // The signature header name is x-bitnob-signature — verify once sandbox webhooks
    // arrive and adjust if Bitnob uses a different header name.
    const signature = request.headers.get('x-bitnob-signature') ?? '';

    if (!verifyWebhookSignature(signature, rawBody)) {
      // In dev without a secret configured, verifyWebhookSignature returns false.
      // Allow through in development so the flow can be tested end-to-end locally.
      if (process.env.NODE_ENV !== 'development') {
        throw new ApiError('FORBIDDEN', 'Invalid Bitnob webhook signature', 403);
      }
    }

    const payload = JSON.parse(rawBody) as BitnobWebhookPayload;
    const externalId = payload.data?.id;
    const rawStatus = (payload.data?.status ?? '').toUpperCase();

    if (!externalId) {
      // Non-payout event (e.g. account verification) — acknowledge and ignore.
      return NextResponse.json({ ok: true });
    }

    const payout = await repository.findPayoutByExternalId(externalId);
    if (!payout) {
      // Unknown payout — could be a replay or a payout we didn't initiate.
      // Acknowledge so Bitnob doesn't retry forever.
      console.warn('[bitnob-webhook] received event for unknown externalId:', externalId);
      return NextResponse.json({ ok: true });
    }

    if (rawStatus === 'SUCCESS' || rawStatus === 'COMPLETED') {
      await repository.updatePayoutStatus(payout.id, 'SUCCESS', new Date());
    } else if (rawStatus === 'FAILED') {
      await repository.updatePayoutStatus(payout.id, 'FAILED');
    }
    // PENDING and other intermediate states: no-op, wait for a terminal event.

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
