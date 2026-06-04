/**
 * Order ID generator — BTS-XXXX-XXXX format.
 *
 * Spec (Commerce CLAUDE.md, "Order ID format"):
 * - `BTS-` literal prefix.
 * - Two groups of 4 characters from Crockford Base32, no I/L/O/U
 *   (to avoid visual ambiguity).
 * - Total 13 characters incl. dashes. ~1.1 trillion keyspace; collisions
 *   are vanishingly rare but the create path still retries on P2002.
 * - Random per order via `crypto.randomBytes`, not Math.random.
 * - Written directly to Order.id (the primary key); no separate UUID.
 */

import { randomBytes } from 'crypto';

// Crockford Base32 — 32 chars, no I/L/O/U.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function randomGroup(): string {
  // 256 % 32 === 0, so `byte % 32` is uniform across the alphabet — no modulo bias.
  const bytes = randomBytes(4);
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += ALPHABET[bytes[i]! % 32];
  }
  return out;
}

export function generateOrderId(): string {
  return `BTS-${randomGroup()}-${randomGroup()}`;
}
