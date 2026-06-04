import { bech32 } from '@scure/base';

/**
 * Extracts the 32-byte payment hash (tag 'p') from a BOLT11 invoice string.
 *
 * BOLT11 bech32 data layout:
 *   words[0..6]          → timestamp (7 × 5-bit words = 35 bits)
 *   words[7..len-104]    → tagged fields
 *   words[len-104..end]  → signature (65 bytes = 104 × 5-bit words)
 *
 * Each tagged field: type (1 word) + length (2 words, big-endian) + data (length words).
 * Tag type 1 = 'p' = payment hash (52 × 5-bit words → 32 bytes after fromWords).
 */
export function extractPaymentHash(bolt11: string): string {
  // Use decodeUnsafe to accept a plain string (avoiding the branded-type constraint).
  const decoded = bech32.decodeUnsafe(bolt11, 2000);
  if (!decoded) throw new Error('Invalid bech32 BOLT11 invoice');

  // decoded.words is number[] per Bech32Decoded type.
  const words = decoded.words;

  // Signature occupies the last 104 words; tagged fields sit between timestamp and signature.
  const tagged = words.slice(7, words.length - 104);

  let pos = 0;
  while (pos < tagged.length) {
    const type = tagged[pos] ?? 0;
    // Length field is two 5-bit words packed into a 10-bit big-endian value.
    const len = ((tagged[pos + 1] ?? 0) << 5) | (tagged[pos + 2] ?? 0);
    pos += 3;

    if (type === 1) {
      // Tag 'p' — payment hash, always 52 words → 32 bytes (4 padding bits discarded).
      const hashWords = tagged.slice(pos, pos + len);
      const bytes = bech32.fromWords(hashWords);
      return Buffer.from(bytes).toString('hex');
    }

    pos += len;
  }

  throw new Error('Payment hash (tag p) not found in BOLT11 invoice');
}
