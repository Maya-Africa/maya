import { nip19 } from 'nostr-tools';
import { v2 as nip44 } from 'nostr-tools/nip44';

function nsecToSecretKey(nsec: string): Uint8Array {
  const { type, data } = nip19.decode(nsec);
  if (type !== 'nsec') throw new Error(`Expected nsec, got ${type}`);
  return data;
}

/**
 * NIP-44 v2 encrypt.
 * Encrypts `plaintext` from `senderNsec` to `recipientPubkey` (hex).
 * Returns base64-encoded ciphertext.
 */
export function encryptToPubkey(
  plaintext: string,
  senderNsec: string,
  recipientPubkey: string,
): string {
  const senderSecretKey = nsecToSecretKey(senderNsec);
  const conversationKey = nip44.utils.getConversationKey(senderSecretKey, recipientPubkey);
  return nip44.encrypt(plaintext, conversationKey);
}

/**
 * NIP-44 v2 decrypt.
 * Decrypts `ciphertext` using `recipientNsec` and the `senderPubkey` (hex).
 */
export function decryptFromPubkey(
  ciphertext: string,
  recipientNsec: string,
  senderPubkey: string,
): string {
  const recipientSecretKey = nsecToSecretKey(recipientNsec);
  const conversationKey = nip44.utils.getConversationKey(recipientSecretKey, senderPubkey);
  return nip44.decrypt(ciphertext, conversationKey);
}
