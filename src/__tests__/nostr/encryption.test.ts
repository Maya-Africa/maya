import { describe, it, expect } from 'vitest';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { nip19 } from 'nostr-tools';
import { encryptToPubkey, decryptFromPubkey } from '@/services/nostr/encryption';

function makeKeypair() {
  const secretKey = generateSecretKey();
  const pubkey = getPublicKey(secretKey);
  const nsec = nip19.nsecEncode(secretKey);
  return { secretKey, pubkey, nsec };
}

describe('NIP-44 v2 encryption round-trip', () => {
  it('encrypts and decrypts a shipping address between two keypairs', () => {
    const buyer = makeKeypair();
    const seller = makeKeypair();

    const plaintext = JSON.stringify({
      name: 'Test Buyer',
      line1: '12 Lagos Street',
      city: 'Abuja',
      country: 'NG',
    });

    const ciphertext = encryptToPubkey(plaintext, buyer.nsec, seller.pubkey);
    expect(typeof ciphertext).toBe('string');
    expect(ciphertext).not.toBe(plaintext);

    const decrypted = decryptFromPubkey(ciphertext, seller.nsec, buyer.pubkey);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for the same plaintext (random nonce)', () => {
    const sender = makeKeypair();
    const recipient = makeKeypair();
    const plaintext = 'same message';

    const ct1 = encryptToPubkey(plaintext, sender.nsec, recipient.pubkey);
    const ct2 = encryptToPubkey(plaintext, sender.nsec, recipient.pubkey);
    expect(ct1).not.toBe(ct2);
  });

  it('throws on an invalid nsec', () => {
    const recipient = makeKeypair();
    expect(() => encryptToPubkey('hello', 'not-an-nsec', recipient.pubkey)).toThrow();
  });
});
