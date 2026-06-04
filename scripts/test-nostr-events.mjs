/**
 * Bitscy Nostr Event Audit Script
 *
 * Queries all configured relays for every event kind Bitscy publishes —
 * standard NIPs and custom kinds. Run with:
 *
 *   node scripts/test-nostr-events.mjs
 *
 * Optionally pass a seller hex pubkey to filter by seller:
 *
 *   node scripts/test-nostr-events.mjs <sellerHexPubkey>
 */

import { SimplePool, nip19, getPublicKey } from 'nostr-tools';

// ── Config ────────────────────────────────────────────────────────────────────

const RELAYS = (process.env.NEXT_PUBLIC_NOSTR_RELAYS ?? 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://nostr.wine')
  .split(',')
  .map(r => r.trim());

const SYSTEM_NSEC = process.env.SYSTEM_NSEC;
if (!SYSTEM_NSEC) {
  console.error('❌  SYSTEM_NSEC not set. Run: source .env.local && node scripts/test-nostr-events.mjs');
  process.exit(1);
}

const { data: systemSecretKey } = nip19.decode(SYSTEM_NSEC);
const SYSTEM_PUBKEY = getPublicKey(systemSecretKey);

// Optional: pass a seller hex pubkey as first CLI arg to scope queries
const SELLER_PUBKEY = process.argv[2] ?? null;

const TIMEOUT_MS = 6000;

// ── Helpers ───────────────────────────────────────────────────────────────────

const pool = new SimplePool();

function ts(unix) {
  if (!unix) return 'n/a';
  return new Date(unix * 1000).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function short(str, len = 64) {
  if (!str) return '(none)';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function parseContent(event) {
  try { return JSON.parse(event.content); } catch { return event.content; }
}

async function query(filter, label) {
  try {
    const events = await pool.querySync(RELAYS, filter, { maxWait: TIMEOUT_MS });
    return events;
  } catch (err) {
    console.error(`  ⚠  Query failed for ${label}:`, err.message);
    return [];
  }
}

function printEvents(events, label, formatter) {
  const icon = events.length > 0 ? '✅' : '⚪';
  console.log(`\n${icon}  ${label} — ${events.length} event(s) found`);
  if (events.length === 0) {
    console.log('   (none on these relays — may not have been triggered yet)');
    return;
  }
  for (const e of events.slice(0, 3)) {
    formatter(e);
  }
  if (events.length > 3) {
    console.log(`   … and ${events.length - 3} more`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║           Bitscy Nostr Event Audit                      ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');
console.log('🔑  System pubkey:', SYSTEM_PUBKEY);
if (SELLER_PUBKEY) {
  console.log('🔍  Filtering by seller:', SELLER_PUBKEY);
}
console.log('📡  Relays:', RELAYS.join(', '));
console.log('⏳  Querying (up to', TIMEOUT_MS / 1000, 'seconds per batch)…');

const authors = SELLER_PUBKEY
  ? [SELLER_PUBKEY, SYSTEM_PUBKEY]
  : [SYSTEM_PUBKEY];

// ── NIP-01: Profiles (kind 0) ─────────────────────────────────────────────────
{
  const filter = { kinds: [0], authors, limit: 5 };
  const events = await query(filter, 'kind 0 profiles');
  printEvents(events, 'NIP-01 — Kind 0 (User Profile)', e => {
    const c = parseContent(e);
    console.log(`   pubkey: ${e.pubkey.slice(0,16)}…  name: ${c?.name ?? '?'}  lud16: ${c?.lud16 ?? '(missing — frontend needs to add)'}`);
  });
}

// ── NIP-15: Stalls (kind 30017) ───────────────────────────────────────────────
{
  const filter = { kinds: [30017], authors, limit: 10 };
  const events = await query(filter, 'kind 30017 stalls');
  printEvents(events, 'NIP-15 — Kind 30017 (Stalls)', e => {
    const c = parseContent(e);
    const d = e.tags.find(t => t[0] === 'd')?.[1];
    console.log(`   d: ${short(d, 20)}  name: ${c?.name ?? '?'}  currency: ${c?.currency ?? '?'}`);
  });
}

// ── NIP-15: Products (kind 30018) ─────────────────────────────────────────────
{
  const filter = { kinds: [30018], authors, limit: 10 };
  const events = await query(filter, 'kind 30018 products');
  printEvents(events, 'NIP-15 — Kind 30018 (Products)', e => {
    const c = parseContent(e);
    const d = e.tags.find(t => t[0] === 'd')?.[1];
    console.log(`   d: ${short(d, 20)}  name: ${c?.name ?? '?'}  price: ${c?.price} ${c?.currency}  stall_id: ${c?.stall_id ? '✓' : '❌ MISSING'}`);
  });
}

// ── NIP-99: Classified listings (kind 30402) ──────────────────────────────────
{
  const filter = { kinds: [30402], authors, limit: 10 };
  const events = await query(filter, 'kind 30402 classified listings');
  printEvents(events, 'NIP-99 — Kind 30402 (Classified Listings)', e => {
    const title = e.tags.find(t => t[0] === 'title')?.[1];
    const price = e.tags.find(t => t[0] === 'price');
    console.log(`   title: ${short(title ?? '?', 40)}  price: ${price?.[1]} ${price?.[2]}`);
  });
}

// ── NIP-23: Long-form bio (kind 30023) ────────────────────────────────────────
{
  const filter = { kinds: [30023], authors, limit: 5 };
  const events = await query(filter, 'kind 30023 long-form');
  printEvents(events, 'NIP-23 — Kind 30023 (Seller Bio)', e => {
    const d = e.tags.find(t => t[0] === 'd')?.[1];
    const title = e.tags.find(t => t[0] === 'title')?.[1];
    console.log(`   d: ${short(d, 30)}  title: ${title ?? '?'}  chars: ${e.content.length}`);
  });
}

// ── NIP-57: Zap receipts (kind 9735) ─────────────────────────────────────────
{
  const pTag = SELLER_PUBKEY ? [SELLER_PUBKEY] : undefined;
  const filter = pTag
    ? { kinds: [9735], '#p': pTag, limit: 5 }
    : { kinds: [9735], authors: [SYSTEM_PUBKEY], limit: 5 };
  const events = await query(filter, 'kind 9735 zap receipts');
  printEvents(events, 'NIP-57 — Kind 9735 (Zap Receipts)', e => {
    const p = e.tags.find(t => t[0] === 'p')?.[1];
    const amount = e.tags.find(t => t[0] === 'amount')?.[1];
    const msats = amount ? Number(amount) : 0;
    console.log(`   recipient: ${short(p, 16)}…  amount: ${msats / 1000} sats  at: ${ts(e.created_at)}`);
  });
}

// ── NIP-65: Relay list (kind 10002) ──────────────────────────────────────────
{
  const filter = { kinds: [10002], authors, limit: 5 };
  const events = await query(filter, 'kind 10002 relay list');
  printEvents(events, 'NIP-65 — Kind 10002 (Relay List)', e => {
    const relays = e.tags.filter(t => t[0] === 'r').map(t => t[1]);
    console.log(`   pubkey: ${e.pubkey.slice(0,16)}…  relays: ${relays.slice(0,3).join(', ')}`);
  });
}

// ── Custom 30050: Order state ──────────────────────────────────────────────────
{
  const filter = { kinds: [30050], authors: [SYSTEM_PUBKEY], limit: 10 };
  const events = await query(filter, 'kind 30050 order:state');
  printEvents(events, 'Custom — Kind 30050 (Order State)', e => {
    const c = parseContent(e);
    const d = e.tags.find(t => t[0] === 'd')?.[1];
    const status = e.tags.find(t => t[0] === 'status')?.[1];
    const ps = e.tags.filter(t => t[0] === 'p').map(t => t[1].slice(0,8));
    console.log(`   order: ${short(d, 16)}…  status: ${status}  parties: [${ps.join(', ')}]  at: ${ts(e.created_at)}`);
    if (c?.trackingRef) console.log(`   trackingRef: ${c.trackingRef}`);
  });
}

// ── Custom 30051: Reviews ──────────────────────────────────────────────────────
{
  const filter = SELLER_PUBKEY
    ? { kinds: [30051], '#p': [SELLER_PUBKEY], limit: 10 }
    : { kinds: [30051], limit: 10 };
  const events = await query(filter, 'kind 30051 product:review');
  printEvents(events, 'Custom — Kind 30051 (Product Review)', e => {
    const rating = e.tags.find(t => t[0] === 'rating')?.[1];
    const d = e.tags.find(t => t[0] === 'd')?.[1];
    const aTag = e.tags.find(t => t[0] === 'a')?.[1];
    const eTag = e.tags.find(t => t[0] === 'e')?.[1];
    console.log(`   order: ${short(d, 16)}  rating: ${'⭐'.repeat(Number(rating ?? 0))}  buyer: ${e.pubkey.slice(0,8)}…`);
    console.log(`   e tag (order receipt): ${eTag ? '✓' : '❌ MISSING'}  a tag (product): ${aTag ? '✓' : '❌ MISSING'}`);
    console.log(`   review: "${short(e.content, 60)}"`);
  });
}

// ── Custom 30052: Seller badge ────────────────────────────────────────────────
{
  const filter = { kinds: [30052], authors: [SYSTEM_PUBKEY], limit: 10 };
  const events = await query(filter, 'kind 30052 seller:badge');
  printEvents(events, 'Custom — Kind 30052 (Seller Badge)', e => {
    const c = parseContent(e);
    const d = e.tags.find(t => t[0] === 'd')?.[1];
    const L = e.tags.find(t => t[0] === 'L')?.[1];
    console.log(`   seller: ${short(d, 16)}…  totalSales: ${c?.totalSales}  firstSaleAt: ${ts(c?.firstSaleAt)}  L: ${L}`);
  });
}

// ── Custom 30053: Stall status ────────────────────────────────────────────────
{
  const filter = { kinds: [30053], authors, limit: 10 };
  const events = await query(filter, 'kind 30053 stall:status');
  printEvents(events, 'Custom — Kind 30053 (Stall Status)', e => {
    const c = parseContent(e);
    const d = e.tags.find(t => t[0] === 'd')?.[1];
    const aTag = e.tags.find(t => t[0] === 'a')?.[1];
    console.log(`   stall: ${short(d, 20)}  status: ${c?.status}  msg: "${c?.message ?? ''}"  a tag: ${aTag ? '✓' : '❌ MISSING'}`);
  });
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('');
console.log('══════════════════════════════════════════════════════════');
console.log('  Done. ⚪ = not yet triggered  ✅ = found on relay');
console.log('');
console.log('  To trigger missing events:');
console.log('  • 30017/30018/30402 → create or update any product');
console.log('  • 9735/30052        → settle any Lightning payment');
console.log('  • 10002             → PATCH /api/auth/me (update profile)');
console.log('  • 30023             → PATCH /api/auth/me/long-bio');
console.log('  • 30053             → PATCH /api/seller/stall/status');
console.log('  • 30050             → ship / deliver / dispute / refund an order');
console.log('  • 30051             → POST /api/orders/<id>/review');
console.log('══════════════════════════════════════════════════════════');
console.log('');

pool.close(RELAYS);
