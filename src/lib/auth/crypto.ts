/**
 * Client-side crypto for the zero-knowledge auth flow.
 *
 * The server never sees the user's password or plaintext Nostr secret key.
 * We derive a key from the password with PBKDF2-SHA256 (210k iterations,
 * matches OWASP 2023 recommendation), then encrypt the secret key with
 * AES-GCM. All blobs ship to the server as base64url strings.
 *
 * Browser-only. Imports nothing from the server bundle.
 */

const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;

export interface EncryptedBlob {
  ciphertext: string; // base64url
  salt: string; // base64url
  iv: string; // base64url
}

export function randomBytes(length: number): Uint8Array {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  return buf;
}

export function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt a secret (e.g., a 32-byte Nostr secret key) under a password.
 * Returns base64url-encoded ciphertext, salt, and IV — the exact shape the
 * server expects for /api/auth/signup.
 */
export async function encryptSecret(
  secret: Uint8Array,
  password: string,
): Promise<EncryptedBlob> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(password, salt);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      secret as BufferSource,
    ),
  );

  return {
    ciphertext: toBase64Url(ciphertext),
    salt: toBase64Url(salt),
    iv: toBase64Url(iv),
  };
}

/**
 * Decrypt a blob produced by encryptSecret. Throws if the password is wrong
 * (the AES-GCM auth tag will fail). Catch the throw and surface a generic
 * "incorrect password" UI — never tell the user whether the username exists.
 */
export async function decryptSecret(
  blob: EncryptedBlob,
  password: string,
): Promise<Uint8Array> {
  const salt = fromBase64Url(blob.salt);
  const iv = fromBase64Url(blob.iv);
  const ciphertext = fromBase64Url(blob.ciphertext);
  const key = await deriveKey(password, salt);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );

  return new Uint8Array(plaintext);
}
