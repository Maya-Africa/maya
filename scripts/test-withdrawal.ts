/**
 * Live withdrawal test — full flow: fund Bitnob → quote → initialize → finalize.
 * Usage: npx tsx scripts/test-withdrawal.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { createFundingInvoice, waitForFundingConfirmation, preparePayout, confirmPayout } from '@/services/payout/bitnob-client';
import { sendPlatformPayment } from '@/services/lightning/breez-platform';

const amountSats = 1200n;
const bankAccount = {
  id: 'cmps58uzs0001ju04dc9z0en9',
  bankName: 'Opay',
  accountNumber: '7080289874',
  accountName: 'Oghenerukevwe Sandra Idjighere',
  isDefault: true,
};

async function main() {
  console.log('=== STEP 1: Bitnob issues funding invoice ===');
  const funding = await createFundingInvoice(amountSats);
  console.log('Invoice ID  :', funding.invoiceId);
  console.log('Payment hash:', funding.paymentHash);
  console.log('BOLT-11     :', funding.bolt11.slice(0, 60) + '...');

  console.log('\n=== STEP 2: Breez pays the Bitnob invoice ===');
  await sendPlatformPayment(funding.bolt11);
  console.log('Breez payment sent ✓');

  console.log('\n=== STEP 3: Wait for Bitnob to confirm receipt ===');
  await waitForFundingConfirmation(funding.invoiceId);
  console.log('Bitnob wallet funded ✓');

  console.log('\n=== STEP 4: Quote + initialize payout ===');
  const prepared = await preparePayout(amountSats, bankAccount);
  console.log('Quote ID  :', prepared.quoteId);
  console.log('Payout ID :', prepared.payoutId);
  console.log('NGN amount:', prepared.amountNgn);

  console.log('\n=== STEP 5: Finalize — Bitnob sends NGN to bank ===');
  const result = await confirmPayout(prepared.quoteId, prepared.payoutId);
  console.log('Status    :', result.status);
  console.log('Payout ID :', result.payoutId);

  console.log('\n=== WITHDRAWAL COMPLETE ===');
  console.log(amountSats.toString(), 'sats →', prepared.amountNgn, 'NGN → Opay ****9874');
}

main().catch(e => {
  console.error('\nFAILED:', e.message);
  process.exit(1);
});
