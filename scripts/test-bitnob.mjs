/**
 * Bitnob sandbox connectivity test.
 * Run: node scripts/test-bitnob.mjs
 *
 * Tests:
 *  1. HMAC-SHA256 auth is accepted by Bitnob
 *  2. Banks list endpoint returns Nigerian banks
 *  3. Quote endpoint accepts a BTC → NGN request
 */

import { createHmac, randomBytes } from 'crypto';

const CLIENT_ID = '69c50ed0-102c-4416-97f7-409a70e6c761';
const CLIENT_SECRET = 'sandbox_44bb9f6ada291ad99e6682568f371351b479494ff332fedf069a6b4f40c46fcf';
const BASE = 'https://api.bitnob.com';

// ── Auth helpers ──────────────────────────────────────────────────────────────

function postHeaders(payload) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString('hex');
  const signingString = `${CLIENT_ID}:${timestamp}:${nonce}:${payload}`;
  const signature = createHmac('sha256', CLIENT_SECRET).update(signingString).digest('hex');
  return {
    'Content-Type': 'application/json',
    'X-Auth-Client': CLIENT_ID,
    'X-Auth-Timestamp': timestamp,
    'X-Auth-Nonce': nonce,
    'X-Auth-Signature': signature,
  };
}

function getHeaders() {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString('hex');
  const signingString = `${CLIENT_ID}:${timestamp}:${nonce}:`;
  const signature = createHmac('sha256', CLIENT_SECRET).update(signingString).digest('hex');
  return {
    'Content-Type': 'application/json',
    'X-Auth-Client': CLIENT_ID,
    'X-Auth-Timestamp': timestamp,
    'X-Auth-Nonce': nonce,
    'X-Auth-Signature': signature,
  };
}

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.log(`  ❌ ${msg}`); }
function info(msg) { console.log(`     ${msg}`); }

// ── Test 1: Nigerian banks list ───────────────────────────────────────────────

async function testBanksList() {
  console.log('\nTest 1 — GET /api/payouts/banks/NG (auth + Nigerian banks)');
  try {
    const res = await fetch(`${BASE}/api/payouts/banks/NG`, {
      headers: getHeaders(),
    });

    const text = await res.text();
    if (!res.ok) {
      fail(`HTTP ${res.status}: ${text}`);
      return null;
    }

    const json = JSON.parse(text);
    // Bitnob may nest banks under data, data.banks, or return a flat array
    const banks = Array.isArray(json) ? json
      : Array.isArray(json.data) ? json.data
      : Array.isArray(json.data?.banks) ? json.data.banks
      : null;
    const count = banks ? banks.length : '?';
    pass(`Auth accepted. ${count} Nigerian banks returned.`);

    if (banks && banks.length > 0) {
      info(`Sample: ${JSON.stringify(banks.slice(0, 2))}`);
    } else {
      info(`Raw response (first 400 chars): ${JSON.stringify(json).slice(0, 400)}`);
    }

    return banks;
  } catch (err) {
    fail(`Network error: ${err.message}`);
    return null;
  }
}

// ── Test 2: Quote (BTC → NGN) ─────────────────────────────────────────────────

async function testQuote() {
  console.log('\nTest 2 — POST /api/payouts/quotes (1000 sats → NGN quote)');
  const body = JSON.stringify({
    from_asset: 'BTC',
    to_currency: 'NGN',
    country: 'NG',
    source: 'offchain',
    reference: `bitscy-test-${Date.now()}`,
    amount: '0.00001', // 1000 sats in BTC, as string
  });

  try {
    const res = await fetch(`${BASE}/api/payouts/quotes`, {
      method: 'POST',
      headers: postHeaders(body),
      body,
    });

    const text = await res.text();

    // 400/422 with a JSON error still means auth passed — the request reached Bitnob.
    let json;
    try { json = JSON.parse(text); } catch { json = null; }

    if (res.status === 401 || res.status === 403) {
      fail(`Auth rejected — HTTP ${res.status}: ${text}`);
      return;
    }

    if (!res.ok) {
      // Auth passed but request was rejected for business reasons (e.g. wrong field names).
      fail(`HTTP ${res.status} — auth OK but request rejected.`);
      info(`Response: ${text.slice(0, 300)}`);
      info('This is expected if the endpoint path or body shape differs in sandbox.');
      return;
    }

    pass('Quote created successfully.');
    info(`Raw response: ${JSON.stringify(json, null, 2).slice(0, 800)}`);
  } catch (err) {
    fail(`Network error: ${err.message}`);
  }
}

// ── Test 3: Auth with wrong secret (should fail) ───────────────────────────────

async function testBadAuth() {
  console.log('\nTest 3 — Bad credentials (should return 401/403)');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString('hex');
  const badSignature = 'deadbeefdeadbeefdeadbeef';

  try {
    const res = await fetch(`${BASE}/api/v1/banks?country=NG`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Client': CLIENT_ID,
        'X-Auth-Timestamp': timestamp,
        'X-Auth-Nonce': nonce,
        'X-Auth-Signature': badSignature,
      },
    });

    if (res.status === 401 || res.status === 403) {
      pass(`Correctly rejected bad credentials (HTTP ${res.status}).`);
    } else {
      fail(`Expected 401/403 but got ${res.status} — auth may not be enforced.`);
    }
  } catch (err) {
    fail(`Network error: ${err.message}`);
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('Bitnob Sandbox Connectivity Test');
console.log('==================================');
console.log(`Client ID: ${CLIENT_ID}`);
console.log(`Base URL:  ${BASE}`);

await testBanksList();
await testQuote();
await testBadAuth();

console.log('\nDone.\n');
