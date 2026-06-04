import { z } from 'zod';

/**
 * Runtime validation of environment variables.
 * The app fails to start if any required variable is missing or malformed.
 * This catches configuration errors at boot, not at request time.
 */

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // App URL
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Breez
  BREEZ_API_KEY: z.string().min(1),
  BREEZ_NETWORK: z.enum(['mainnet', 'signet', 'testnet']).default('signet'),

  // Nostr
  SYSTEM_NSEC: z.string().min(1),
  NEXT_PUBLIC_NOSTR_RELAYS: z.string().min(1),

  // Demo
  DEMO_BTC_NGN_RATE: z.coerce.bigint(),
  PLATFORM_FEE_PERCENT: z.coerce.number().min(0).max(100),

  // Web Push
  WEB_PUSH_VAPID_PUBLIC: z.string().min(1),
  WEB_PUSH_VAPID_PRIVATE: z.string().min(1),
  WEB_PUSH_VAPID_SUBJECT: z.string().min(1),

  // Session
  SESSION_SECRET: z.string().min(32),
});

function parseEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Environment validation failed. Check .env.local against .env.example.');
  }
  return parsed.data;
}

// In test/dev where we may not have all vars, fall back gracefully.
// Production requires all variables.
export const env =
  process.env.NODE_ENV === 'production' ? parseEnv() : (process.env as unknown as z.infer<typeof envSchema>);

export const NOSTR_RELAY_LIST = (process.env.NEXT_PUBLIC_NOSTR_RELAYS || '')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);
