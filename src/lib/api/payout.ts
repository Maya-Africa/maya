/**
 * Typed wrappers around the bank-account and payout endpoints.
 *
 * Owned by Commerce on the backend; consumed by the seller withdraw flow
 * and bank-accounts UI on the client. Account numbers cross the wire
 * masked (last 4 only) after creation — the plaintext is never returned.
 */

import { deleteFetcher, fetcher, postFetcher } from '@/lib/fetcher';
import type { PayoutStatus } from '@/types/shared';

// ============================================================================
// Bank accounts
// ============================================================================

export interface BankAccountResponse {
  id: string;
  bankName: string;
  accountNumberMasked: string; // "****1234"
  accountName: string;
  isDefault: boolean;
  createdAt: string;
}

export interface AddBankAccountInput {
  bankName: string;
  accountNumber: string; // 10-digit NUBAN; server validates
  accountName: string;
}

export function listBankAccounts(): Promise<{ accounts: BankAccountResponse[] }> {
  return fetcher('/api/seller/bank-accounts');
}

export function addBankAccount(
  input: AddBankAccountInput,
): Promise<{ account: BankAccountResponse }> {
  return postFetcher('/api/seller/bank-accounts', input);
}

export function removeBankAccount(id: string): Promise<{ ok: true }> {
  return deleteFetcher(`/api/seller/bank-accounts/${encodeURIComponent(id)}`);
}

// ============================================================================
// Payouts
// ============================================================================

export interface InitiatePayoutInput {
  amountSats: string; // bigint serialized as string
  bankAccountId: string;
}

export interface PayoutResultResponse {
  payoutId: string;
  status: PayoutStatus;
  amountSats: string;
  amountNgn: string;
  etaSeconds: number;
  lightningInvoice?: string;
}

export function initiatePayout(input: InitiatePayoutInput): Promise<PayoutResultResponse> {
  return postFetcher('/api/payout', input);
}

export function getPayoutStatus(payoutId: string): Promise<PayoutResultResponse> {
  return fetcher(`/api/payout/${encodeURIComponent(payoutId)}`);
}

// ============================================================================
// Payout history
// ============================================================================

export interface PayoutHistoryItem {
  id: string;
  status: PayoutStatus;
  amountSats: string;
  amountNgn: string;
  bankAccountId: string;
  bankName: string | null;             // null if the linked bank account was deleted
  accountNumberMasked: string | null;  // same
  externalId: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface PayoutHistoryQuery {
  cursor?: string;
  limit?: number;
}

export function listPayoutHistory(
  query: PayoutHistoryQuery = {},
): Promise<{ items: PayoutHistoryItem[]; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit) params.set('limit', String(query.limit));
  const qs = params.toString();
  return fetcher(`/api/payout/history${qs ? `?${qs}` : ''}`);
}
