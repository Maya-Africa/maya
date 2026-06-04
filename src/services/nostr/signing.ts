import { finalizeEvent, nip19, type EventTemplate, type Event } from 'nostr-tools';

/**
 * Event signing helpers.
 *
 * For sellers using NIP-07, the client signs in the browser and sends us the signed event.
 * For buyers without NIP-07, we sign server-side using SYSTEM_NSEC.
 * For sellers signing up without NIP-07, we generate keys server-side and store them encrypted.
 */

/**
 * Sign an event server-side using the system Nostr key.
 * Used for buyer-initiated events (orders) when the buyer doesn't have NIP-07.
 */
export function signEventWithSystemKey(template: EventTemplate): Event {
  const nsec = process.env.SYSTEM_NSEC;
  if (!nsec) {
    throw new Error('SYSTEM_NSEC environment variable not configured');
  }

  const { type, data } = nip19.decode(nsec);
  if (type !== 'nsec') {
    throw new Error('SYSTEM_NSEC is not a valid nsec');
  }

  return finalizeEvent(template, data);
}

/**
 * Sign an event with an arbitrary secret key (hex bytes).
 * Used for users with server-stored encrypted keys after decryption.
 */
export function signEventWithKey(template: EventTemplate, secretKey: Uint8Array): Event {
  return finalizeEvent(template, secretKey);
}

/**
 * Convert npub format to hex pubkey.
 */
export function npubToHex(npub: string): string {
  const { type, data } = nip19.decode(npub);
  if (type !== 'npub') {
    throw new Error(`Expected npub, got ${type}`);
  }
  return data;
}

/**
 * Convert hex pubkey to npub format for display.
 */
export function hexToNpub(hex: string): string {
  return nip19.npubEncode(hex);
}
