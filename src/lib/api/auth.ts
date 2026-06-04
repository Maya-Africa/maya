/**
 * Typed wrappers around the Catalog-role auth endpoints.
 *
 * Every function returns a typed result and throws `ApiError` on non-2xx.
 * Components catch the throw and switch on `error.code` rather than parsing
 * messages.
 *
 * Contracts mirror /api/auth/* on the server. If a route shape changes,
 * update the matching wrapper here in the same PR.
 */

import { fetcher, patchFetcher, postFetcher } from '@/lib/fetcher';
import type { User, UserRole } from '@/types/shared';

// ============================================================================
// Signup
// ============================================================================

export interface SignupInput {
  username: string; // raw display name; server derives the URL-safe slug
  displayName?: string;
  role: UserRole;
  npub: string; // 64-char hex (NOT bech32)
  encryptedKey: string; // base64url AES-GCM ciphertext of the mnemonic
  salt: string; // base64url PBKDF2 salt
  iv: string; // base64url AES-GCM IV
}

export function signup(input: SignupInput): Promise<{ user: User }> {
  return postFetcher('/api/auth/signup', input);
}

// ============================================================================
// Challenge-response login
// ============================================================================

export interface ChallengeResponse {
  challenge: string; // hex string the client signs as a kind 27235 event
  encryptedKey: string;
  salt: string;
  iv: string;
  npub: string;
}

export function requestChallenge(username: string): Promise<ChallengeResponse> {
  return postFetcher('/api/auth/challenge', { username });
}

/**
 * The shape /api/auth/login expects for `signedChallenge`. This is the
 * `VerifiedEvent` returned by `signChallenge()` in `@/lib/auth/sign`,
 * narrowed to what the server's zod schema validates.
 */
export interface SignedChallengeEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export function login(input: {
  username: string;
  signedChallenge: SignedChallengeEvent;
}): Promise<{ user: User }> {
  return postFetcher('/api/auth/login', input);
}

// ============================================================================
// Session lifecycle
// ============================================================================

export function logout(): Promise<{ ok: true }> {
  return postFetcher('/api/auth/logout', {});
}

export function me(): Promise<{ user: User }> {
  return fetcher('/api/auth/me');
}

// ============================================================================
// Profile update
// ============================================================================

export interface UpdateProfileInput {
  displayName?: string;
  about?: string;
  avatar?: string; // Cloudinary URL
  location?: string;
  lightningAddr?: string;
  /**
   * Optional pre-signed kind 0 Nostr event. If included, the server
   * publishes it to relays so the user's profile is mirrored on Nostr.
   * Build via `signNostrEvent` in `@/lib/auth/sign`.
   */
  nostrEvent?: SignedChallengeEvent;
  /**
   * Optional pre-signed kind 10002 (relay list) event. Published alongside
   * the kind 0 so clients reading the seller's profile know which relays
   * to query for the rest of their Nostr presence (products, orders, etc.).
   */
  nostrRelayListEvent?: SignedChallengeEvent;
}

export function updateProfile(input: UpdateProfileInput): Promise<{ user: User }> {
  return patchFetcher('/api/auth/me', input);
}
