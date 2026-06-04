/**
 * Nostr event signing helpers — used at login (challenge-response) and
 * any time we need to author a kind 0 / 30018 / 30019 event from the
 * browser.
 *
 * The server never sees the secret key. Events are signed here and the
 * fully-signed event is posted to the relevant API route.
 */

import { finalizeEvent, type EventTemplate, type VerifiedEvent } from 'nostr-tools/pure';

const CHALLENGE_EVENT_KIND = 27235; // NIP-98 HTTP Auth shape; matches the server's verifier

/**
 * Sign the login challenge as a kind 27235 event. This is what
 * POST /api/auth/login expects in the `signedChallenge` field.
 */
export function signChallenge(challenge: string, secretKey: Uint8Array): VerifiedEvent {
  return finalizeEvent(
    {
      kind: CHALLENGE_EVENT_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: challenge,
    },
    secretKey,
  );
}

/**
 * Sign an arbitrary Nostr event template. Used for product creates
 * (kind 30018), profile updates (kind 0), order events (kind 30019).
 *
 * Pass an event template with kind/created_at/tags/content; the helper
 * adds id/pubkey/sig.
 */
export function signNostrEvent(
  template: EventTemplate,
  secretKey: Uint8Array,
): VerifiedEvent {
  return finalizeEvent(template, secretKey);
}
