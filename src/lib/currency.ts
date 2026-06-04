/**
 * Currency conversion helpers.
 *
 * Sats and Naira are both bigint to avoid float precision issues.
 * Conversion uses the fixed demo rate from env vars — no live price feeds in v1.
 *
 * All functions accept and return bigint. Serialization to/from JSON happens
 * at API boundaries using `.toString()` and `BigInt(value)`.
 */

const SATS_PER_BTC = 100_000_000n;

function getDemoBtcNgnRate(): bigint {
  const raw = process.env.DEMO_BTC_NGN_RATE || '145000000';
  return BigInt(raw);
}

export function satsToNgn(sats: bigint): bigint {
  const rate = getDemoBtcNgnRate();
  return (sats * rate) / SATS_PER_BTC;
}

export function ngnToSats(ngn: bigint): bigint {
  const rate = getDemoBtcNgnRate();
  return (ngn * SATS_PER_BTC) / rate;
}

export function formatNgn(ngn: bigint): string {
  // ₦1,234,567 — no decimals, comma thousands
  const ngnNumber = Number(ngn);
  return `₦${ngnNumber.toLocaleString('en-NG')}`;
}

export function formatSats(sats: bigint): string {
  // 12,345 sats — comma thousands
  const satsNumber = Number(sats);
  return `${satsNumber.toLocaleString('en-NG')} sats`;
}

export function formatBoth(sats: bigint): string {
  // For dual display: "₦1,234 (12,345 sats)"
  return `${formatNgn(satsToNgn(sats))} (${formatSats(sats)})`;
}

// Helper for JSON serialization at API boundaries
export function bigintToString(value: bigint): string {
  return value.toString();
}

export function stringToBigint(value: string): bigint {
  return BigInt(value);
}
