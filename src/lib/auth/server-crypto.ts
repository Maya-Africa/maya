/**
 * Server-side mirror of the client AES-GCM decryption in crypto.ts.
 *
 * Uses node:crypto's webcrypto implementation — same algorithm and
 * parameters as the client so blobs created by encryptSecret() can be
 * decoded here. Never import this file into client bundles.
 */

import { webcrypto } from 'node:crypto';
import { privateKeyFromSeedWords, validateWords } from 'nostr-tools/nip06';

const { subtle } = webcrypto;
const PBKDF2_ITERATIONS = 210_000;

function fromBase64Url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    raw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

/**
 * Decrypt a stored encrypted blob (ciphertext / salt / iv — all base64url)
 * with the user's plaintext password. Throws if the password is wrong.
 */
export async function serverDecryptBlob(
  ciphertext: string,
  salt: string,
  iv: string,
  password: string,
): Promise<Uint8Array> {
  const key = await deriveKey(password, fromBase64Url(salt));
  const plain = await subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(iv) },
    key,
    fromBase64Url(ciphertext),
  );
  return new Uint8Array(plain);
}

/**
 * Decrypt a seller's stored blob and derive their Nostr secret key.
 * The blob encrypts the 12-word mnemonic (per keygen.ts design).
 * Throws on wrong password or corrupted blob.
 */
export async function unlockSellerKey(
  encryptedKey: string,
  salt: string,
  iv: string,
  password: string,
): Promise<Uint8Array> {
  const bytes = await serverDecryptBlob(encryptedKey, salt, iv, password);
  const mnemonic = new TextDecoder().decode(bytes);
  if (!validateWords(mnemonic)) {
    throw new Error('Invalid credentials');
  }
  return privateKeyFromSeedWords(mnemonic);
}
