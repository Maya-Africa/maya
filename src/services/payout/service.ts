import type { PayoutResult, BankAccount } from '@/types/shared';
import { createFundingInvoice, waitForFundingConfirmation, preparePayout, confirmPayout, getStatus, type PreparedPayout } from './bitnob-client';

export type { PreparedPayout };

export async function getFundingInvoice(amountSats: bigint): Promise<{ invoiceId: string; bolt11: string; paymentHash: string }> {
  return createFundingInvoice(amountSats);
}

export async function waitForFunding(invoiceId: string): Promise<void> {
  return waitForFundingConfirmation(invoiceId);
}

export async function preparePayoutRequest(
  amountSats: bigint,
  bankAccountId: string,
  bankAccount: Pick<BankAccount, 'accountName' | 'accountNumber' | 'bankName'>,
): Promise<PreparedPayout> {
  const fullAccount: BankAccount = {
    id: bankAccountId,
    bankName: bankAccount.bankName,
    accountNumber: bankAccount.accountNumber,
    accountName: bankAccount.accountName,
    isDefault: false,
  };
  return preparePayout(amountSats, fullAccount);
}

export async function confirmPayoutRequest(
  quoteId: string,
  payoutId: string,
  amountSats: string,
  amountNgn: string,
): Promise<PayoutResult> {
  const result = await confirmPayout(quoteId, payoutId);
  return { ...result, amountSats, amountNgn };
}

export async function getPayoutStatusById(payoutId: string): Promise<PayoutResult | null> {
  return getStatus(payoutId);
}
