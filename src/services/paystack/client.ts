import crypto from 'crypto'

const PAYSTACK_BASE = 'https://api.paystack.co'

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set')
  return key
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json()
  if (!json.status) throw new Error(json.message ?? 'Paystack request failed')
  return json.data as T
}

export interface InitializePaymentParams {
  email: string
  amountKobo: number
  reference: string
  callbackUrl?: string
  metadata?: Record<string, unknown>
  channels?: Array<'card' | 'bank' | 'ussd' | 'qr' | 'mobile_money' | 'bank_transfer'>
}

export interface InitializePaymentResult {
  authorization_url: string
  access_code: string
  reference: string
}

export async function initializePayment(params: InitializePaymentParams): Promise<InitializePaymentResult> {
  return request<InitializePaymentResult>('POST', '/transaction/initialize', {
    email: params.email,
    amount: params.amountKobo,
    reference: params.reference,
    callback_url: params.callbackUrl,
    metadata: params.metadata,
    channels: params.channels ?? ['card', 'bank', 'ussd', 'bank_transfer'],
  })
}

export interface VerifyPaymentResult {
  status: 'success' | 'failed' | 'abandoned' | 'pending'
  reference: string
  amount: number
  channel: string
  paid_at: string | null
  metadata: Record<string, unknown> | null
  customer: { email: string }
}

export async function verifyPayment(reference: string): Promise<VerifyPaymentResult> {
  return request<VerifyPaymentResult>('GET', `/transaction/verify/${reference}`)
}

export interface BankListItem {
  name: string
  slug: string
  code: string
}

export async function listBanks(): Promise<BankListItem[]> {
  return request<BankListItem[]>('GET', '/bank?currency=NGN&perPage=100')
}

export interface ResolveAccountResult {
  account_number: string
  account_name: string
}

export async function resolveAccountNumber(accountNumber: string, bankCode: string): Promise<ResolveAccountResult> {
  return request<ResolveAccountResult>('GET', `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`)
}

export interface CreateRecipientParams {
  accountName: string
  accountNumber: string
  bankCode: string
}

export interface RecipientResult {
  recipient_code: string
  name: string
  account_number: string
  bank_code: string
}

export async function createTransferRecipient(params: CreateRecipientParams): Promise<RecipientResult> {
  return request<RecipientResult>('POST', '/transferrecipient', {
    type: 'nuban',
    name: params.accountName,
    account_number: params.accountNumber,
    bank_code: params.bankCode,
    currency: 'NGN',
  })
}

export interface InitiateTransferResult {
  transfer_code: string
  status: string
  amount: number
  recipient: string
}

export async function initiateTransfer(amountKobo: number, recipientCode: string, reason: string): Promise<InitiateTransferResult> {
  return request<InitiateTransferResult>('POST', '/transfer', {
    source: 'balance',
    amount: amountKobo,
    recipient: recipientCode,
    reason,
  })
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET
  if (!secret) return false
  const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex')
  return hash === signature
}
