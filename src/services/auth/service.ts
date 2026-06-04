import { randomBytes } from 'crypto';
import { verifyEvent } from 'nostr-tools';
import type { Event as NostrEvent } from 'nostr-tools';

import * as repository from '../catalog/repository';
import { ApiError } from '@/lib/api-error';
import type { SessionData } from '@/lib/session';
import type { User } from '@/types/shared';
import { publishEvent } from '../nostr/publisher';
import { buildRelayListEventTemplate, buildLongFormEventTemplate } from '../nostr/events';
import { signEventWithSystemKey } from '../nostr/signing';
import { NOSTR_RELAY_LIST } from '@/lib/env';

// ============================================================================
// Signup
// ============================================================================

/**
 * Persist a new user. The server never sees the password or plaintext nsec.
 * The client generates the keypair, encrypts the secret key (PBKDF2 + AES-GCM),
 * and POSTs the encrypted blob alongside the public key.
 */
export async function signup(params: {
  username: string;
  displayName?: string | null;
  role: 'BUYER' | 'SELLER';
  npub: string;        // hex pubkey (64 chars), NOT bech32
  encryptedKey: string; // base64url AES-GCM ciphertext
  salt: string;         // base64url PBKDF2 salt
  iv: string;           // base64url AES-GCM IV
}): Promise<User> {
  const { username, displayName, role, npub, encryptedKey, salt, iv } = params;

  const existing = await repository.findUserByUsername(username);
  if (existing) throw new ApiError('CONFLICT', 'Username already taken', 409);

  const existingNpub = await repository.findUserByNpub(npub);
  if (existingNpub) throw new ApiError('CONFLICT', 'Nostr key already registered', 409);

  const user = await repository.createUser({
    npub,
    username,
    displayName: displayName ?? null,
    role,
    lightningAddr: role === 'SELLER' ? `${username}@maya.com` : null,
    encryptedKey,
    salt,
    iv,
  });

  return toUser(user);
}

// ============================================================================
// Challenge generation (stateless — challenge stashed in signed cookie)
// ============================================================================

/** Generate a random 32-byte hex challenge. */
export function generateChallenge(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Return the stored encrypted blob for this username so the client can
 * attempt local decryption. On unknown username, return a shape-identical
 * fake response to prevent username enumeration.
 */
export async function getChallengeBlob(username: string): Promise<{
  encryptedKey: string;
  salt: string;
  iv: string;
  npub: string;
} | null> {
  const user = await repository.findUserByUsername(username);
  if (!user || !user.encryptedKey || !user.salt || !user.iv) return null;

  return {
    encryptedKey: user.encryptedKey,
    salt: user.salt,
    iv: user.iv,
    npub: user.npub,
  };
}

// ============================================================================
// Login with signed challenge
// ============================================================================

/**
 * Verify that the client signed the challenge using the stored npub.
 * The client creates a kind 27235 Nostr event with `content = challenge`
 * and signs it with their decrypted nsec (or via NIP-07 extension).
 *
 * Verification:
 *   1. event.pubkey === stored npub (hex)
 *   2. event.content === expectedChallenge
 *   3. verifyEvent(event) === true (Schnorr signature is valid)
 */
export async function loginWithSignedChallenge(params: {
  username: string;
  signedEvent: NostrEvent;
  expectedChallenge: string;
}): Promise<User> {
  const { username, signedEvent, expectedChallenge } = params;

  const user = await repository.findUserByUsername(username);
  // Always run the same path to avoid timing leaks
  if (!user) {
    throw new ApiError('UNAUTHORIZED', 'Invalid credentials', 401);
  }

  if (signedEvent.pubkey !== user.npub) {
    throw new ApiError('UNAUTHORIZED', 'Invalid credentials', 401);
  }

  if (signedEvent.content !== expectedChallenge) {
    throw new ApiError('UNAUTHORIZED', 'Invalid credentials', 401);
  }

  if (!verifyEvent(signedEvent)) {
    throw new ApiError('UNAUTHORIZED', 'Invalid credentials', 401);
  }

  return toUser(user);
}

// ============================================================================
// User lookups
// ============================================================================

export async function getUserById(id: string): Promise<User | null> {
  const user = await repository.findUserById(id);
  if (!user) return null;
  return toUser(user);
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const user = await repository.findUserByUsername(username);
  if (!user) return null;
  return toUser(user);
}

// ============================================================================
// Profile update
// ============================================================================

/**
 * Update profile fields in Postgres.
 * If a pre-signed kind 0 Nostr event is provided, verify and publish it.
 * The server does NOT sign on the user's behalf (that's a client responsibility).
 */
export async function updateProfile(
  userId: string,
  input: {
    displayName?: string;
    about?: string;
    avatar?: string;
    location?: string;
    lightningAddr?: string;
  },
  signedProfileEvent?: NostrEvent,
  signedRelayListEvent?: NostrEvent,
): Promise<User> {
  const rawUser = await repository.findUserById(userId);
  if (!rawUser) throw new ApiError('NOT_FOUND', 'User not found', 404);

  if (signedProfileEvent) {
    if (signedProfileEvent.pubkey !== rawUser.npub) {
      throw new ApiError('FORBIDDEN', 'Event pubkey does not match session user', 403);
    }
    if (!verifyEvent(signedProfileEvent)) {
      throw new ApiError('VALIDATION_ERROR', 'Invalid Nostr event signature', 400);
    }
  }

  if (signedRelayListEvent) {
    if (signedRelayListEvent.pubkey !== rawUser.npub) {
      throw new ApiError('FORBIDDEN', 'Relay list event pubkey does not match session user', 403);
    }
    if (signedRelayListEvent.kind !== 10002) {
      throw new ApiError('VALIDATION_ERROR', 'Expected kind 10002 relay list event', 400);
    }
    if (!verifyEvent(signedRelayListEvent)) {
      throw new ApiError('VALIDATION_ERROR', 'Invalid relay list event signature', 400);
    }
  }

  const updated = await repository.updateUser(userId, {
    ...(input.displayName !== undefined && { displayName: input.displayName }),
    ...(input.about !== undefined && { about: input.about }),
    ...(input.avatar !== undefined && { avatar: input.avatar }),
    ...(input.location !== undefined && { location: input.location }),
    ...(input.lightningAddr !== undefined && { lightningAddr: input.lightningAddr }),
  });

  // Publish Nostr events best-effort — profile update never fails due to relay issues.
  if (signedProfileEvent) {
    void publishEvent(signedProfileEvent).catch((err) =>
      console.error('[auth] Profile Nostr publish failed for user', userId, err),
    );
  }

  // NIP-65: publish user-signed relay list if provided; otherwise publish platform relay list.
  const relayListEvent = signedRelayListEvent
    ?? signEventWithSystemKey(buildRelayListEventTemplate(NOSTR_RELAY_LIST));

  void publishEvent(relayListEvent).catch((err) =>
    console.error('[auth] Relay list Nostr publish failed for user', userId, err),
  );

  return toUser(updated);
}

// ============================================================================
// Long-form bio (NIP-23)
// ============================================================================

export async function updateLongBio(userId: string, longBio: string): Promise<User> {
  const rawUser = await repository.findUserById(userId);
  if (!rawUser) throw new ApiError('NOT_FOUND', 'User not found', 404);
  if (rawUser.role !== 'SELLER') throw new ApiError('FORBIDDEN', 'Only sellers can set a long bio', 403);

  const updated = await repository.updateUser(userId, { longBio });

  // NIP-23: publish kind 30023 long-form event signed by the platform key.
  void publishEvent(
    signEventWithSystemKey(
      buildLongFormEventTemplate({
        userId,
        displayName: updated.displayName,
        longBio,
      }),
    ),
  ).catch((err) => console.error('[auth] NIP-23 long bio publish failed for user', userId, err));

  return toUser(updated);
}

// ============================================================================
// Auth guards
// ============================================================================

export function requireUser(session: SessionData | null): SessionData {
  if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in required', 401);
  return session;
}

export function requireSeller(session: SessionData | null): SessionData {
  const s = requireUser(session);
  if (s.role !== 'SELLER') throw new ApiError('FORBIDDEN', 'Seller account required', 403);
  return s;
}

// ============================================================================
// Internal helpers
// ============================================================================

type PrismaUser = NonNullable<Awaited<ReturnType<typeof repository.findUserById>>>;

function toUser(u: PrismaUser): User {
  return {
    id: u.id,
    npub: u.npub,
    username: u.username,
    displayName: u.displayName,
    avatar: u.avatar,
    about: u.about,
    longBio: u.longBio ?? null,
    lightningAddr: u.lightningAddr,
    role: u.role as User['role'],
    createdAt: u.createdAt.toISOString(),
  };
}

// ============================================================================
// Username slug derivation
// ============================================================================

const RESERVED_USERNAMES = new Set([
  'admin', 'api', 'app', 'auth', 'maya', 'buyer', 'cart', 'checkout',
  'dashboard', 'help', 'home', 'login', 'logout', 'me', 'marketplace',
  'nostr', 'orders', 'payout', 'products', 'profile', 'search', 'sell',
  'seller', 'settings', 'shop', 'signup', 'support', 'system', 'terms',
  'wallet', 'www',
]);

/**
 * Derive a URL-safe username slug from arbitrary display text.
 * Returns the slug on success, throws ApiError on rejection.
 */
export function deriveUsernameSlug(rawUsername: string): string {
  // 1. Lowercase
  let slug = rawUsername.toLowerCase();
  // 2. NFKD-normalize and strip combining marks
  slug = slug.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  // 3. Replace non-alphanum runs with a single hyphen
  slug = slug.replace(/[^a-z0-9]+/g, '-');
  // 4. Trim leading/trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');
  // 5. Collapse consecutive hyphens
  slug = slug.replace(/-{2,}/g, '-');

  if (slug.length < 3) {
    throw new ApiError('VALIDATION_ERROR', 'Username must be at least 3 characters', 400);
  }
  if (slug.length > 30) {
    throw new ApiError('VALIDATION_ERROR', 'Username must be at most 30 characters', 400);
  }
  if (RESERVED_USERNAMES.has(slug)) {
    throw new ApiError('VALIDATION_ERROR', `"${slug}" is a reserved name`, 400);
  }

  return slug;
}

/**
 * Find a unique slug by appending -2, -3, ... if the base slug is taken.
 * Throws 409 if no free slug is found up to -99.
 */
export async function resolveUniqueSlug(baseSlug: string): Promise<string> {
  const base = await repository.findUserByUsername(baseSlug);
  if (!base) return baseSlug;

  for (let i = 2; i <= 99; i++) {
    const candidate = `${baseSlug}-${i}`;
    const existing = await repository.findUserByUsername(candidate);
    if (!existing) return candidate;
  }

  throw new ApiError(
    'CONFLICT',
    'Username is taken. Please choose a different name.',
    409,
  );
}
