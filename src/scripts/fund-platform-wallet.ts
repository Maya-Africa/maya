/**
 * M3 — Fund the platform wallet.
 *
 * Generates a 5000-sat invoice on the platform Breez wallet (signet).
 * Pay it from an external signet Lightning wallet to give the platform
 * wallet working balance for the withdrawal flow test.
 *
 * Run: npx tsx src/scripts/fund-platform-wallet.ts
 */

// Load env BEFORE any other imports — USE_MOCK is a module-level constant
// in breez-platform.ts evaluated at import time.
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

const AMOUNT_SATS = 5000n;

async function main() {
  // Dynamic import so breez-platform evaluates AFTER dotenv has run above.
  const { createPlatformInvoice, connectPlatformWallet } = await import(
    '../services/lightning/breez-platform'
  );

  console.log('Generating funding invoice on the platform wallet...\n');
  console.log('Network:', process.env.BREEZ_NETWORK ?? 'signet');
  console.log('Mock mode:', process.env.USE_MOCK_LIGHTNING ?? 'false');

  const info = await connectPlatformWallet();
  console.log('Current balance:', info.balanceSat.toString(), 'sats');

  const invoice = await createPlatformInvoice(AMOUNT_SATS, 'Platform wallet funding - M3');

  const network = process.env.BREEZ_NETWORK ?? 'mainnet';
  console.log(`\n── Pay this invoice from any ${network} Lightning wallet ──────────────────`);
  console.log('\nBOLT-11:\n');
  console.log(invoice.bolt11);
  console.log('\nPayment hash:', invoice.paymentHash);
  console.log('Amount:      ', AMOUNT_SATS.toString(), 'sats');
  console.log('Expires at:  ', invoice.expiresAt.toISOString());
  console.log('\n── After payment ──────────────────────────────────────────────────────');
  console.log('Re-run the connect script to confirm the balance increased:');
  console.log('  npx tsx src/scripts/test-breez-connect.ts');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
