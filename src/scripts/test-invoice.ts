/**
 * Diagnostic: test prepareReceivePayment directly, with full error capture.
 * Run: npx tsx src/scripts/test-invoice.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { mkdirSync } from 'fs';

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const breez = require('@breeztech/breez-sdk-liquid/node');

  const mnemonic = process.env.PLATFORM_BREEZ_MNEMONIC;
  const apiKey   = process.env.BREEZ_API_KEY;

  if (!mnemonic) throw new Error('PLATFORM_BREEZ_MNEMONIC not set');
  if (!apiKey)   throw new Error('BREEZ_API_KEY not set');

  const cfg = breez.defaultConfig('mainnet', apiKey);
  cfg.workingDir = '.breez-wallets/platform';
  mkdirSync(cfg.workingDir, { recursive: true });

  console.log('Connecting to Breez SDK...');
  const sdk = await breez.connect({ mnemonic, config: cfg });

  console.log('Connected. Getting info...');
  const info = await sdk.getInfo();
  console.log('Balance:', info.walletInfo.balanceSat, 'sats');

  // In Breez SDK 0.12.x the Lightning (BOLT-11) payment method is called
  // 'bolt11Invoice'. The old string 'lightning' was removed in 0.12.0.
  // This still generates a real Lightning invoice — just a renamed enum value.
  console.log('\nCalling prepareReceivePayment (5000 sats, bolt11Invoice / Lightning)...');
  try {
    const prep = await sdk.prepareReceivePayment({
      paymentMethod: 'bolt11Invoice',
      amount: { type: 'bitcoin', payerAmountSat: 5000 },
    });
    console.log('prepareReceivePayment OK:', JSON.stringify(prep, null, 2));

    console.log('\nCalling receivePayment...');
    const recv = await sdk.receivePayment({ prepareResponse: prep, description: 'test' });
    console.log('\n✅ Invoice generated!');
    console.log('BOLT-11:', recv.destination);
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    console.error('\n❌ Error during receive flow:');
    console.error('  message:', err?.message ?? String(e));
    console.error('  code:   ', err?.code ?? 'n/a');
    console.error('  full:   ', e);
  }

  await sdk.disconnect().catch(() => {/* ignore */});
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});
