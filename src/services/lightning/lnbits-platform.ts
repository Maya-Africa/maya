/**
 * LNBits platform wallet — Lightning backend used when BREEZ_NETWORK !== 'mainnet'.
 *
 * Points at any LNBits instance (hosted demo, self-hosted testnet, etc.)
 * via two env vars:
 *   LNBITS_URL       — base URL of your LNBits instance (default: https://demo.lnbits.com)
 *   LNBITS_ADMIN_KEY — admin API key from your LNBits wallet
 *
 * Quick setup:
 *   1. Open https://demo.lnbits.com  (or your own testnet instance)
 *   2. Create a wallet — no signup needed
 *   3. Click "API info" → copy the Admin key
 *   4. Add to .env.local:  LNBITS_ADMIN_KEY=<paste here>
 *
 * For a real testnet node, point LNBITS_URL at a LNBits instance
 * backed by a testnet LND/CLN node. demo.lnbits.com is mainnet.
 */

import type { WalletInfo, CreatedInvoice, SdkEventHandler } from './breez-platform';

const LNBITS_URL = (process.env.LNBITS_URL ?? 'https://demo.lnbits.com').replace(/\/$/, '');
const LNBITS_ADMIN_KEY = process.env.LNBITS_ADMIN_KEY ?? '';

// ── Response shapes ───────────────────────────────────────────────────────────

interface LNBitsWalletInfo {
  id: string;
  name: string;
  balance: number; // millisatoshis
}

interface LNBitsCreateResponse {
  payment_hash: string;
  payment_request: string;
  bolt11?: string; // some versions use this field name instead
}

interface LNBitsPayment {
  payment_hash: string;
  amount: number;  // millisatoshis; positive = incoming, negative = outgoing
  status: string;  // 'complete' | 'pending' | 'failed'
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function lnbFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!LNBITS_ADMIN_KEY) {
    throw new Error(
      'LNBITS_ADMIN_KEY is not set. ' +
      'Create a wallet at https://demo.lnbits.com → API info → copy Admin key → add to .env.local',
    );
  }
  const res = await fetch(`${LNBITS_URL}${path}`, {
    ...init,
    headers: { 'X-Api-Key': LNBITS_ADMIN_KEY, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`LNBits ${res.status} at ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Wallet ID (cached) ────────────────────────────────────────────────────────

let cachedWalletId: string | null = null;

async function getWalletId(): Promise<string> {
  if (cachedWalletId) return cachedWalletId;
  const info = await lnbFetch<LNBitsWalletInfo>('/api/v1/wallet');
  cachedWalletId = info.id;
  return info.id;
}

// ── Public functions ──────────────────────────────────────────────────────────

export async function lnbitsGetWalletInfo(): Promise<WalletInfo> {
  const info = await lnbFetch<LNBitsWalletInfo>('/api/v1/wallet');
  return {
    balanceSat: BigInt(Math.floor(info.balance / 1000)),
    pendingSendSat: 0n,
    pendingReceiveSat: 0n,
  };
}

export async function lnbitsCreateInvoice(amountSats: bigint, description: string): Promise<CreatedInvoice> {
  const data = await lnbFetch<LNBitsCreateResponse>('/api/v1/payments', {
    method: 'POST',
    body: JSON.stringify({
      out: false,
      amount: Number(amountSats),
      memo: description.replace(/[^\x00-\x7F]/g, '').slice(0, 128),
    }),
  });
  return {
    bolt11: data.payment_request ?? data.bolt11 ?? '',
    paymentHash: data.payment_hash,
    expiresAt: new Date(Date.now() + 3_600_000),
  };
}

export async function lnbitsSendPayment(bolt11: string): Promise<void> {
  await lnbFetch('/api/v1/payments', {
    method: 'POST',
    body: JSON.stringify({ out: true, bolt11 }),
  });
}

// ── Event handler — WebSocket primary, polling fallback ───────────────────────

// Deduplicate across both WebSocket and polling paths.
const firedHashes = new Set<string>();

function fireOnce(hash: string, amountMsat: number, handler: SdkEventHandler) {
  if (firedHashes.has(hash)) return;
  firedHashes.add(hash);
  // Emit the same shape as the real Breez SDK and the mock so instrumentation.ts
  // can read event.details.details.paymentHash regardless of which backend is active.
  handler({
    type: 'paymentSucceeded',
    details: {
      amountSat: Math.floor(amountMsat / 1000),
      paymentType: 'receive',
      details: { type: 'lightning', paymentHash: hash },
    },
  });
}

export async function lnbitsAddEventHandler(handler: SdkEventHandler): Promise<void> {
  const walletId = await getWalletId();

  // Primary: LNBits WebSocket fires immediately on payment receipt.
  const wsBase = LNBITS_URL.replace(/^https/, 'wss').replace(/^http/, 'ws');
  const wsUrl = `${wsBase}/api/v1/ws/${walletId}`;

  const connectWs = () => {
    try {
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            payment?: { payment_hash: string; amount: number };
          };
          if (msg.payment && msg.payment.amount > 0) {
            fireOnce(msg.payment.payment_hash, msg.payment.amount, handler);
          }
        } catch { /* ignore malformed frames */ }
      };
      ws.onclose = () => setTimeout(connectWs, 5_000);
      ws.onerror = () => ws.close();
    } catch {
      // WebSocket unavailable (old Node without global WebSocket) — polling covers it.
    }
  };
  connectWs();

  // Fallback / redundancy: poll every 5 s for newly completed incoming payments.
  const poll = async () => {
    try {
      const payments = await lnbFetch<LNBitsPayment[]>('/api/v1/payments?limit=20');
      for (const p of payments) {
        if (p.amount > 0 && p.status === 'complete') {
          fireOnce(p.payment_hash, p.amount, handler);
        }
      }
    } catch { /* ignore transient errors */ }
    setTimeout(poll, 5_000);
  };
  void poll();
}
