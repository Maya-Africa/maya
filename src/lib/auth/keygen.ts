/**
 * High-level identity helpers — keypair generation, mnemonic recovery,
 * and the encrypted-blob shape that the server expects for signup.
 *
 * Uses NIP-06 for 12-word recovery phrases. The encrypted blob actually
 * encrypts the MNEMONIC (not the raw secret key) so the recovery phrase
 * can be re-shown later via the recovery flow.
 */

import { getPublicKey } from 'nostr-tools/pure';
import {
  generateSeedWords,
  privateKeyFromSeedWords,
  validateWords,
} from 'nostr-tools/nip06';

import { decryptSecret, encryptSecret, type EncryptedBlob } from './crypto';

export interface NewIdentity {
  mnemonic: string; // 12 words, shown to the user ONCE at signup
  npubHex: string; // 64-char hex pubkey — the format /api/auth/signup expects
  secretKey: Uint8Array; // 32 raw bytes, for signing in this session
  encrypted: EncryptedBlob; // base64url ciphertext + salt + iv, posted to server
}

/**
 * Generate a fresh Nostr identity from scratch.
 * The mnemonic is encrypted under the user's password and the resulting
 * blob is what we POST to /api/auth/signup.
 */
export async function createIdentity(password: string): Promise<NewIdentity> {
  const mnemonic = generateSeedWords();
  const secretKey = privateKeyFromSeedWords(mnemonic);
  const npubHex = getPublicKey(secretKey);
  const mnemonicBytes = new TextEncoder().encode(mnemonic);
  const encrypted = await encryptSecret(mnemonicBytes, password);
  return { mnemonic, npubHex, secretKey, encrypted };
}

/**
 * Decrypt an existing identity from its stored blob using the user's password.
 * Throws on wrong password — catch and surface "incorrect credentials".
 */
export async function unlockIdentity(
  blob: EncryptedBlob,
  password: string,
): Promise<{ mnemonic: string; secretKey: Uint8Array; npubHex: string }> {
  const bytes = await decryptSecret(blob, password);
  const mnemonic = new TextDecoder().decode(bytes);
  if (!validateWords(mnemonic)) {
    throw new Error('Decrypted blob is not a valid mnemonic');
  }
  const secretKey = privateKeyFromSeedWords(mnemonic);
  const npubHex = getPublicKey(secretKey);
  return { mnemonic, secretKey, npubHex };
}

/**
 * Re-encrypt an existing identity under a new password — used by the
 * change-password flow. The mnemonic stays the same; only the wrapping
 * key changes.
 */
export async function reEncryptIdentity(
  blob: EncryptedBlob,
  oldPassword: string,
  newPassword: string,
): Promise<EncryptedBlob> {
  const bytes = await decryptSecret(blob, oldPassword);
  return encryptSecret(bytes, newPassword);
}

export function isValidMnemonic(mnemonic: string): boolean {
  return validateWords(mnemonic);
}

/**
 * Derive a Nostr identity from a user-supplied recovery phrase
 * (e.g., for "I lost my password, here's my 12 words" flow).
 */
export function identityFromMnemonic(mnemonic: string): {
  secretKey: Uint8Array;
  npubHex: string;
} {
  if (!validateWords(mnemonic)) {
    throw new Error('Invalid mnemonic');
  }
  const secretKey = privateKeyFromSeedWords(mnemonic);
  return { secretKey, npubHex: getPublicKey(secretKey) };
}
