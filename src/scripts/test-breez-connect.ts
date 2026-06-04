/**
 * M2 smoke test — verify the platform Breez wallet connects and returns wallet info.
 *
 * Run: npx tsx src/scripts/test-breez-connect.ts
 *
 * Requires .env.local with BREEZ_API_KEY, PLATFORM_BREEZ_MNEMONIC, BREEZ_NETWORK.
 * USE_MOCK_LIGHTNING must be "false" or unset for this to hit the real SDK.
 */

// Load env BEFORE any other imports — USE_MOCK is a module-level constant
// in breez-platform.ts evaluated at import time.
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  // Dynamic import so breez-platform evaluates AFTER dotenv has run above.
  const { connectPlatformWallet } = await import('../services/lightning/breez-platform');

  console.log('Connecting to platform Breez wallet...');
  console.log('Network:', process.env.BREEZ_NETWORK ?? 'signet');
  console.log('Mock mode:', process.env.USE_MOCK_LIGHTNING ?? 'false');

  const info = await connectPlatformWallet();

  console.log('\n✓ Connected.');
  console.log('  Balance (sats):         ', info.balanceSat.toString());
  console.log('  Pending send (sats):    ', info.pendingSendSat.toString());
  console.log('  Pending receive (sats): ', info.pendingReceiveSat.toString());
}

main().catch((err) => {
  console.error('Connection failed:', err);
  process.exit(1);
});
