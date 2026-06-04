/**
 * CoinGecko pricing service — live BTC/NGN exchange rate.
 * Free tier, no API key required. Cached 60s in-memory.
 * Never throws to callers — returns stale cache on failure.
 */

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=ngn';

const CACHE_TTL_MS = 60_000;

interface RateCache {
  ratePerBtc: bigint;
  recordedAt: string;
  fetchedAt: number; // Date.now()
}

let cache: RateCache | null = null;

export interface BtcNgnRate {
  ratePerBtc: bigint;   // e.g. 145723000n means 1 BTC = ₦145,723,000
  recordedAt: string;   // ISO timestamp of fetch
  stale: boolean;       // true when returning cached data after a fetch failure
}

export async function getBtcNgnRate(): Promise<BtcNgnRate> {
  const now = Date.now();

  // Return fresh cache if within TTL.
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { ratePerBtc: cache.ratePerBtc, recordedAt: cache.recordedAt, stale: false };
  }

  try {
    const res = await fetch(COINGECKO_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);

    const json = (await res.json()) as { bitcoin?: { ngn?: number } };
    const raw = json?.bitcoin?.ngn;
    if (!raw || typeof raw !== 'number') throw new Error('Unexpected CoinGecko response shape');

    const recordedAt = new Date().toISOString();
    cache = { ratePerBtc: BigInt(Math.round(raw)), recordedAt, fetchedAt: now };

    return { ratePerBtc: cache.ratePerBtc, recordedAt, stale: false };
  } catch (err) {
    // Return stale cache rather than crashing the caller.
    if (cache) {
      console.warn('[coingecko] fetch failed, returning stale rate:', err);
      return { ratePerBtc: cache.ratePerBtc, recordedAt: cache.recordedAt, stale: true };
    }

    // No cache at all — fall back to the env-var demo rate.
    const fallback = BigInt(process.env.DEMO_BTC_NGN_RATE ?? '145000000');
    const recordedAt = new Date().toISOString();
    console.warn('[coingecko] no cache and fetch failed, using DEMO_BTC_NGN_RATE:', err);
    return { ratePerBtc: fallback, recordedAt, stale: true };
  }
}

/** Convert satoshis to NGN using the current (possibly cached) rate. */
export async function satsToNgnLive(sats: bigint): Promise<bigint> {
  const { ratePerBtc } = await getBtcNgnRate();
  return (sats * ratePerBtc) / 100_000_000n;
}
