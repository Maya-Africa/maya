/**
 * Bitnob live client — real HTTP calls, HMAC-SHA256 auth.
 *
 * Auth: HMAC-SHA256 (X-Auth-Client / X-Auth-Timestamp / X-Auth-Nonce / X-Auth-Signature).
 * Env vars: BITNOB_CLIENT_ID, BITNOB_CLIENT_SECRET, BITNOB_WEBHOOK_SECRET.
 * Base URL: https://api.bitnob.com (override with BITNOB_API_BASE).
 *
 * ── Correct withdrawal flow ───────────────────────────────────────────────────
 * Bitnob uses a wallet-based model, NOT a per-payout Lightning invoice model.
 *
 * 1. createFundingInvoice(amountSats)
 *    POST /api/lightning/invoices → returns a BOLT-11 invoice Bitnob issues.
 *    Caller pays this invoice from the Breez platform wallet.
 *    Payment credits the Bitnob BTC wallet balance.
 *
 * 2. preparePayout(amountSats, bankAccount)
 *    POST /api/payouts/quotes   → get rate + quoteId (QT_XXXXXX)
 *    POST /api/payouts/:quoteId/initialize → lock quote, attach beneficiary
 *    Returns quoteId + payoutId for step 3.
 *
 * 3. confirmPayout(quoteId, payoutId)
 *    POST /api/payouts/:quoteId/finalize → Bitnob processes NGN bank transfer.
 */

import { createHmac, randomBytes } from 'crypto';
import type { PayoutResult, PayoutStatus, BankAccount } from '@/types/shared';
import { satsToNgnLive } from '@/services/pricing/coingecko';

const BASE = process.env.BITNOB_API_BASE ?? 'https://api.bitnob.com';

// ── Auth ──────────────────────────────────────────────────────────────────────

function creds() {
  const clientId = process.env.BITNOB_CLIENT_ID;
  const secretKey = process.env.BITNOB_CLIENT_SECRET;
  if (!clientId || !secretKey) throw new Error('BITNOB_CLIENT_ID and BITNOB_CLIENT_SECRET are required');
  return { clientId, secretKey };
}

function makeHeaders(clientId: string, secretKey: string, body: string): HeadersInit {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString('hex');
  const sig = createHmac('sha256', secretKey).update(`${clientId}:${ts}:${nonce}:${body}`).digest('hex');
  return { 'Content-Type': 'application/json', 'X-Auth-Client': clientId, 'X-Auth-Timestamp': ts, 'X-Auth-Nonce': nonce, 'X-Auth-Signature': sig };
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const { clientId, secretKey } = creds();
  const payload = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: makeHeaders(clientId, secretKey, payload), body: payload });
  const text = await res.text().catch(() => res.statusText);
  if (!res.ok) throw new Error(`Bitnob ${res.status} at ${path}: ${text}`);
  return JSON.parse(text) as T;
}

async function apiGet<T>(path: string): Promise<T> {
  const { clientId, secretKey } = creds();
  const res = await fetch(`${BASE}${path}`, { method: 'GET', headers: makeHeaders(clientId, secretKey, '') });
  const text = await res.text().catch(() => res.statusText);
  if (!res.ok) throw new Error(`Bitnob ${res.status} at ${path}: ${text}`);
  return JSON.parse(text) as T;
}

// ── Bank code lookup ──────────────────────────────────────────────────────────

interface BitnobBank { bank_code: string; bank_name: string; }
interface BanksResponse { data: { banks: BitnobBank[] } }

let bankCache: BitnobBank[] | null = null;

async function resolveBankCode(bankName: string): Promise<string> {
  if (!bankCache) {
    const r = await apiGet<BanksResponse>('/api/payouts/banks/NG');
    bankCache = r.data.banks;
  }
  const n = bankName.toLowerCase().trim();
  const match = bankCache.find(b => b.bank_name.toLowerCase().includes(n) || n.includes(b.bank_name.toLowerCase()));
  if (!match) throw new Error(`Bitnob: cannot resolve bank code for "${bankName}"`);
  return match.bank_code;
}

// ── Response shapes ───────────────────────────────────────────────────────────

interface LightningInvoiceResponse {
  success: boolean;
  data: { id: string; payment_hash: string; request: string; status?: string; amount?: number; };
}

interface QuoteResponse {
  success: boolean;
  data: {
    payout: {
      id: string;           // UUID — internal record ID
      quote_id: string;     // e.g. "QT_357315" — used in initialize/finalize URLs
      sat_amount: string;
      settlement_amount: string;
      exchange_rate: { rate: string };
      expires_at: string;
    };
  };
}

interface InitializeResponse {
  success: boolean;
  data: { payout: { id: string; status: string } };
}

interface InvoiceStatusResponse {
  success: boolean;
  data: { id: string; status: string; payment_hash: string };
}

interface StatusResponse {
  success: boolean;
  data: { id: string; status: string; sat_amount: string; settlement_amount: string };
}

function mapStatus(s: string): PayoutStatus {
  const u = (s ?? '').toUpperCase();
  if (u === 'SUCCESS' || u === 'COMPLETED' || u === 'PAID') return 'SUCCESS';
  if (u === 'FAILED' || u === 'EXPIRED') return 'FAILED';
  return 'PENDING';
}

// ── Public interface ──────────────────────────────────────────────────────────

/**
 * Step 0 — Create a Lightning invoice at Bitnob for Breez to pay.
 * Paying this invoice funds the Bitnob BTC wallet so the payout can proceed.
 */
export async function createFundingInvoice(amountSats: bigint): Promise<{ invoiceId: string; bolt11: string; paymentHash: string }> {
  const r = await apiPost<LightningInvoiceResponse>('/api/lightning/invoices', {
    amount: Number(amountSats),
    description: 'Maya seller withdrawal funding',
    reference: `maya-fund-${Date.now()}-${randomBytes(4).toString('hex')}`,
  });
  console.log('[bitnob] funding invoice created:', r.data.id, 'hash:', r.data.payment_hash);
  return { invoiceId: r.data.id, bolt11: r.data.request, paymentHash: r.data.payment_hash };
}

/**
 * Poll until the Bitnob Lightning invoice is paid (max ~30s, checks every 2s).
 * Returns true when Bitnob confirms receipt.
 */
export async function waitForFundingConfirmation(invoiceId: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const r = await apiGet<InvoiceStatusResponse>(`/api/lightning/invoices/${invoiceId}`);
    const status = r.data.status?.toLowerCase() ?? '';
    console.log('[bitnob] funding invoice status:', status);
    if (status === 'paid' || status === 'settled' || status === 'complete') return;
    if (status === 'expired' || status === 'failed') throw new Error(`Bitnob funding invoice ${status}`);
    await new Promise(res => setTimeout(res, 2000));
  }
  throw new Error('Bitnob funding invoice not confirmed within timeout');
}

export interface PreparedPayout {
  quoteId: string;   // QT_XXXXXX — used in initialize/finalize URLs
  payoutId: string;  // UUID from initialize response
  amountSats: string;
  amountNgn: string;
}

/**
 * Step 1 — Quote + initialize the payout with Bitnob.
 * Bitnob wallet must already be funded before calling this.
 */
export async function preparePayout(amountSats: bigint, bankAccount: BankAccount): Promise<PreparedPayout> {
  const [amountNgn, bankCode] = await Promise.all([
    satsToNgnLive(amountSats),
    resolveBankCode(bankAccount.bankName),
  ]);

  const quote = await apiPost<QuoteResponse>('/api/payouts/quotes', {
    from_asset: 'BTC',
    to_currency: 'NGN',
    country: 'NG',
    source: 'offchain',
    reference: `maya-q-${Date.now()}-${randomBytes(4).toString('hex')}`,
    amount: (Number(amountSats) / 100_000_000).toString(),
  });
  console.log('[bitnob] quote:', quote.data.payout.quote_id, '| NGN:', quote.data.payout.settlement_amount);

  const quoteId = quote.data.payout.quote_id; // QT_XXXXXX

  const initialized = await apiPost<InitializeResponse>(`/api/payouts/${quoteId}/initialize`, {
    quote_id: quoteId,
    reference: `maya-p-${Date.now()}-${randomBytes(4).toString('hex')}`,
    payment_reason: 'vendor_payment',
    beneficiary: {
      destination_type: 'bank',
      country: 'NG',
      account_name: bankAccount.accountName,
      account_number: bankAccount.accountNumber,
      bank_code: bankCode,
    },
  });
  console.log('[bitnob] initialized:', initialized.data.payout.id, 'status:', initialized.data.payout.status);

  return {
    quoteId,
    payoutId: initialized.data.payout.id,
    amountSats: amountSats.toString(),
    amountNgn: amountNgn.toString(),
  };
}

/**
 * Step 2 — Finalize the payout. Bitnob processes the NGN bank transfer.
 */
export async function confirmPayout(quoteId: string, payoutId: string): Promise<PayoutResult> {
  const finalized = await apiPost<InitializeResponse>(`/api/payouts/${quoteId}/finalize`, {});
  console.log('[bitnob] finalized:', JSON.stringify(finalized.data, null, 2));
  return {
    payoutId,
    status: mapStatus(finalized.data?.payout?.status ?? 'PENDING'),
    amountSats: '0',
    amountNgn: '0',
    etaSeconds: 30,
  };
}

export async function getStatus(payoutId: string): Promise<PayoutResult | null> {
  try {
    const r = await apiGet<StatusResponse>(`/api/payouts/${payoutId}`);
    return {
      payoutId,
      status: mapStatus(r.data.status),
      amountSats: r.data.sat_amount,
      amountNgn: r.data.settlement_amount,
      etaSeconds: 0,
    };
  } catch {
    return null;
  }
}

export function verifyWebhookSignature(signature: string, payload: string): boolean {
  const secret = process.env.BITNOB_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
