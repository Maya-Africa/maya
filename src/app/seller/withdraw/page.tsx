'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Check, Copy, Loader2 } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import { getWalletBalance } from '@/lib/api/commerce'
import {
  addBankAccount as apiAddBankAccount,
  initiatePayout as apiInitiatePayout,
  listBankAccounts,
  type BankAccountResponse,
  type PayoutResultResponse,
} from '@/lib/api/payout'
import { useSession } from '@/lib/auth/use-session'

// Demo BTC/NGN rate, mirrored from the server. Used to convert the user-typed
// NGN amount into the sats value the payout endpoint expects.
const NGN_PER_BTC = 145_000_000n
const SATS_PER_BTC = 100_000_000n

function ngnToSats(ngn: bigint): bigint {
  return (ngn * SATS_PER_BTC) / NGN_PER_BTC
}

function satsToNgn(sats: bigint): bigint {
  return (sats * NGN_PER_BTC) / SATS_PER_BTC
}

const NIGERIAN_BANKS = [
  'GTBank',
  'Zenith Bank',
  'Access Bank',
  'UBA',
  'First Bank',
  'FCMB',
  'Stanbic IBTC',
  'Wema Bank',
  'Kuda',
  'Opay',
]

type View = 'form' | 'submitting' | 'success'

export default function WithdrawPage() {
  const router = useRouter()
  const { user, isLoading: isSessionLoading } = useSession()

  useEffect(() => {
    if (isSessionLoading) return
    if (!user) {
      router.push('/signin')
      return
    }
    if (user.role !== 'SELLER') {
      router.push('/')
    }
  }, [isSessionLoading, user, router])

  // ── Balance + bank accounts state ───────────────────────────────────────────
  const [balanceSats, setBalanceSats] = useState<bigint | null>(null)
  const [savedBanks, setSavedBanks] = useState<BankAccountResponse[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [dataError, setDataError] = useState(false)

  // ── Form state ──────────────────────────────────────────────────────────────
  const [selectedBankId, setSelectedBankId] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [view, setView] = useState<View>('form')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [payoutResult, setPayoutResult] = useState<PayoutResultResponse | null>(null)

  // ── Add-bank-inline form state ──────────────────────────────────────────────
  const [showAddBank, setShowAddBank] = useState(false)
  const [newBankName, setNewBankName] = useState(NIGERIAN_BANKS[0]!)
  const [newAccountNumber, setNewAccountNumber] = useState('')
  const [newAccountHolder, setNewAccountHolder] = useState('')
  const [isSavingBank, setIsSavingBank] = useState(false)
  const [addBankError, setAddBankError] = useState<string | null>(null)

  // ── Reference copy state ────────────────────────────────────────────────────
  const [refCopied, setRefCopied] = useState(false)

  // Fetch balance + bank accounts together so the form is fully usable once
  // the loading view clears. SWR would be nice here but the page is small.
  useEffect(() => {
    if (!user || user.role !== 'SELLER') return
    let cancelled = false
    setIsLoadingData(true)
    setDataError(false)
    Promise.all([getWalletBalance(), listBankAccounts()])
      .then(([balance, banks]) => {
        if (cancelled) return
        setBalanceSats(BigInt(balance.balanceSats))
        setSavedBanks(banks.accounts)
        if (banks.accounts.length > 0) {
          setSelectedBankId(banks.accounts[0]!.id)
        }
      })
      .catch(err => {
        if (cancelled) return
        if (err instanceof ApiError && err.statusCode === 401) {
          router.push('/signin')
          return
        }
        setDataError(true)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingData(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, router])

  // Derived values for the form.
  const balanceNgn = balanceSats !== null ? Number(satsToNgn(balanceSats)) : 0
  const numericAmount = parseInt(amount || '0', 10)
  const isOverBalance = numericAmount > balanceNgn
  const isValidAmount = numericAmount > 0 && !isOverBalance
  const canWithdraw =
    selectedBankId !== '' && isValidAmount && !showAddBank && view !== 'submitting'
  const selectedBank = savedBanks.find(b => b.id === selectedBankId)

  const handleWithdrawAll = () => {
    setAmount(String(balanceNgn))
  }

  const handleSaveBank = async () => {
    if (!newAccountNumber || !newAccountHolder) return
    if (!/^\d{10}$/.test(newAccountNumber)) {
      setAddBankError('Account number must be exactly 10 digits.')
      return
    }
    setIsSavingBank(true)
    setAddBankError(null)
    try {
      const { account } = await apiAddBankAccount({
        bankName: newBankName,
        accountNumber: newAccountNumber,
        accountName: newAccountHolder,
      })
      setSavedBanks(prev => [...prev, account])
      setSelectedBankId(account.id)
      setNewBankName(NIGERIAN_BANKS[0]!)
      setNewAccountNumber('')
      setNewAccountHolder('')
      setShowAddBank(false)
    } catch (err) {
      setAddBankError(
        err instanceof ApiError ? err.message : 'Could not save bank account. Try again.',
      )
    } finally {
      setIsSavingBank(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canWithdraw) return
    setView('submitting')
    setSubmitError(null)
    try {
      const amountSats = ngnToSats(BigInt(numericAmount))
      const result = await apiInitiatePayout({
        amountSats: amountSats.toString(),
        bankAccountId: selectedBankId,
      })
      setPayoutResult(result)
      setView('success')
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : 'Could not start the withdrawal. Try again.',
      )
      setView('form')
    }
  }

  const handleCopyRef = () => {
    if (!payoutResult) return
    navigator.clipboard.writeText(payoutResult.payoutId)
    setRefCopied(true)
    setTimeout(() => setRefCopied(false), 2000)
  }

  const handleAnother = () => {
    setAmount('')
    setPayoutResult(null)
    setView('form')
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Header is rendered in every state so the screen never has an empty frame.
  const BackHeader = (
    <div className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="px-5 py-3 flex items-center">
        <button
          onClick={() => router.back()}
          className="p-3 -m-3 hover:bg-input rounded transition-colors"
          aria-label="Go back"
          disabled={view === 'submitting'}
        >
          <ChevronLeft className="w-6 h-6 text-foreground" strokeWidth={2} />
        </button>
      </div>
    </div>
  )

  // ── Loading view ────────────────────────────────────────────────────────────
  if (isSessionLoading || isLoadingData) {
    return (
      <div className="bg-background min-h-screen text-foreground">
        {BackHeader}
        <main
          className="mx-auto max-w-xl px-5 sm:px-6 lg:px-8 py-6 pb-24 space-y-6 animate-pulse"
          aria-busy="true"
        >
          <div className="h-12 bg-input rounded w-1/2" />
          <div className="bg-white border border-border rounded-lg p-5 space-y-3">
            <div className="h-3 bg-input rounded w-1/3" />
            <div className="h-10 bg-input rounded w-3/4" />
            <div className="h-3 bg-input rounded w-1/4" />
          </div>
          <div className="space-y-3">
            <div className="h-16 bg-input rounded" />
            <div className="h-16 bg-input rounded" />
          </div>
        </main>
      </div>
    )
  }

  // ── Error fetching balance / banks ──────────────────────────────────────────
  if (dataError) {
    return (
      <div className="bg-background min-h-screen text-foreground">
        {BackHeader}
        <main className="mx-auto max-w-xl px-5 py-20 text-center">
          <p className="font-sans text-base text-muted mb-4">
            We couldn&apos;t load your withdraw info.
          </p>
          <button
            onClick={() => router.refresh()}
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
        </main>
      </div>
    )
  }

  // ── Success view ────────────────────────────────────────────────────────────
  if (view === 'success' && payoutResult) {
    const sentNgn = Number(payoutResult.amountNgn) || numericAmount
    const etaMinutes = Math.max(1, Math.round((payoutResult.etaSeconds ?? 1800) / 60))
    return (
      <div className="bg-background min-h-screen text-foreground">
        <main className="mx-auto max-w-xl px-5 sm:px-6 lg:px-8 pt-20 pb-12 text-center">
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <Check className="w-8 h-8 text-success" strokeWidth={3} />
            </div>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl font-normal leading-tight mb-3 tabular-nums">
            ₦{sentNgn.toLocaleString('en-NG')} sent.
          </h1>
          <p className="font-sans text-base text-muted mb-10 max-w-md mx-auto">
            It should arrive in your {selectedBank?.bankName ?? 'bank'} account in about{' '}
            {etaMinutes} minute{etaMinutes === 1 ? '' : 's'}.
          </p>

          <div className="inline-flex items-center gap-3 bg-white border border-border px-4 py-2 rounded-full mb-10">
            <span className="font-sans text-xs text-muted">Ref:</span>
            <span className="font-sans text-sm tabular-nums text-foreground break-all">
              {payoutResult.payoutId}
            </span>
            <button
              onClick={handleCopyRef}
              className="text-accent hover:opacity-80 transition-opacity shrink-0"
              aria-label="Copy reference"
            >
              {refCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <div className="space-y-3">
            <Link
              href="/seller"
              className="block w-full bg-primary text-primary-foreground py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
            >
              Back to dashboard
            </Link>
            <button
              onClick={handleAnother}
              className="block w-full text-accent font-sans font-medium hover:opacity-80 transition-opacity py-3"
            >
              Withdraw another amount
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Form view ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-background min-h-screen text-foreground">
      {BackHeader}

      <form onSubmit={handleSubmit} className="mx-auto max-w-xl px-5 sm:px-6 lg:px-8 py-6 pb-24">
        <h1 className="font-serif text-4xl sm:text-5xl font-normal leading-tight mb-8">
          Withdraw.
        </h1>

        {/* 1. Balance card */}
        <section className="bg-white border border-border rounded-lg p-5 mb-8">
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="font-sans text-xs uppercase tracking-widest text-muted">
              Available to withdraw
            </p>
            <Link
              href="/seller/withdraw/history"
              className="font-sans text-xs text-accent hover:opacity-80 transition-opacity"
            >
              View history
            </Link>
          </div>
          <p className="font-serif text-4xl sm:text-5xl font-normal tabular-nums">
            ₦{balanceNgn.toLocaleString('en-NG')}
          </p>
          <p className="font-sans text-sm text-muted mt-1 tabular-nums">
            ≈ {balanceSats !== null ? Number(balanceSats).toLocaleString('en-NG') : '0'} sats
          </p>
        </section>

        {/* 2. Bank account selector */}
        <section className="mb-8">
          <h2 className="font-serif text-xl font-normal mb-4">Where it goes.</h2>

          <div className="space-y-3">
            {savedBanks.map(bank => {
              const isSelected = selectedBankId === bank.id
              return (
                <button
                  key={bank.id}
                  type="button"
                  onClick={() => {
                    setSelectedBankId(bank.id)
                    setShowAddBank(false)
                  }}
                  className="w-full bg-white border border-border rounded-lg p-4 flex items-center gap-4 text-left hover:bg-input/40 transition-colors"
                  disabled={view === 'submitting'}
                >
                  <div className="w-10 h-10 rounded bg-[#F5EFE3] flex items-center justify-center shrink-0">
                    <span className="font-serif text-sm text-foreground">
                      {bank.bankName.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-base font-medium text-foreground">
                      {bank.bankName}
                    </p>
                    <p className="font-sans text-sm text-muted truncate">
                      {bank.accountNumberMasked} · {bank.accountName}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      isSelected ? 'border-accent' : 'border-border'
                    }`}
                  >
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                  </div>
                </button>
              )
            })}

            {!showAddBank ? (
              <button
                type="button"
                onClick={() => setShowAddBank(true)}
                className="w-full bg-white border border-dashed border-border rounded-lg p-4 text-center hover:bg-input/40 transition-colors"
                disabled={view === 'submitting'}
              >
                <span className="font-sans text-base text-accent font-medium">
                  + Add {savedBanks.length === 0 ? 'a' : 'another'} bank account
                </span>
              </button>
            ) : (
              <div className="bg-white border border-border rounded-lg p-4 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="bankName" className="block font-sans text-sm font-medium">
                    Bank name
                  </label>
                  <select
                    id="bankName"
                    value={newBankName}
                    onChange={e => setNewBankName(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-border rounded font-sans text-base focus:outline-none focus:ring-2 focus:ring-primary"
                    style={{ minHeight: '48px', fontSize: '16px' }}
                    disabled={isSavingBank}
                  >
                    {NIGERIAN_BANKS.map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="accountNumber" className="block font-sans text-sm font-medium">
                    Account number
                  </label>
                  <input
                    id="accountNumber"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    maxLength={10}
                    value={newAccountNumber}
                    onChange={e => setNewAccountNumber(e.target.value.replace(/\D/g, ''))}
                    placeholder="0123456789"
                    className="w-full px-4 py-3 bg-white border border-border rounded font-sans text-base tabular-nums placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    style={{ minHeight: '48px', fontSize: '16px' }}
                    disabled={isSavingBank}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="accountHolder" className="block font-sans text-sm font-medium">
                    Account holder name
                  </label>
                  <input
                    id="accountHolder"
                    type="text"
                    value={newAccountHolder}
                    onChange={e => setNewAccountHolder(e.target.value)}
                    placeholder="As it appears on your bank account"
                    className="w-full px-4 py-3 bg-white border border-border rounded font-sans text-base placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    style={{ minHeight: '48px', fontSize: '16px' }}
                    disabled={isSavingBank}
                  />
                  <p className="font-sans text-xs text-muted">
                    We&apos;ll show this back to you before every withdrawal so you can double-check it.
                  </p>
                </div>

                {addBankError && (
                  <p className="font-sans text-sm text-error">{addBankError}</p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSaveBank}
                    disabled={!newAccountNumber || !newAccountHolder || isSavingBank}
                    className="flex-1 bg-primary text-primary-foreground py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSavingBank ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      'Save bank'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddBank(false)
                      setNewAccountNumber('')
                      setNewAccountHolder('')
                      setAddBankError(null)
                    }}
                    className="text-muted font-sans font-medium hover:text-foreground transition-colors px-3"
                    disabled={isSavingBank}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 3. Amount block */}
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif text-xl font-normal">How much.</h2>
            <button
              type="button"
              onClick={handleWithdrawAll}
              className="font-sans text-sm text-accent hover:opacity-80 transition-opacity"
              disabled={view === 'submitting' || balanceNgn === 0}
            >
              Withdraw all
            </button>
          </div>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground font-medium pointer-events-none">
              ₦
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="0"
              className={`w-full pl-8 pr-4 py-3 bg-white border rounded font-sans text-base tabular-nums placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary ${
                isOverBalance ? 'border-error' : 'border-border'
              }`}
              style={{ minHeight: '48px', fontSize: '16px' }}
              disabled={view === 'submitting'}
            />
          </div>

          {isOverBalance ? (
            <p className="font-sans text-sm text-error mt-2 tabular-nums">
              You only have ₦{balanceNgn.toLocaleString('en-NG')} to withdraw.
            </p>
          ) : (
            <p className="font-sans text-sm text-muted mt-2 tabular-nums">
              Available: ₦{balanceNgn.toLocaleString('en-NG')}.
            </p>
          )}
        </section>

        {/* 4. Preview block */}
        {selectedBank && isValidAmount && (
          <section className="bg-[#F5EFE3] rounded-lg p-4 mb-8 space-y-3">
            <div>
              <p className="font-sans text-xs text-muted mb-1">You&apos;re sending</p>
              <p className="font-serif text-2xl text-accent tabular-nums">
                ₦{numericAmount.toLocaleString('en-NG')}
              </p>
            </div>
            <div>
              <p className="font-sans text-xs text-muted mb-1">To</p>
              <p className="font-sans text-sm text-foreground">
                {selectedBank.bankName} · {selectedBank.accountNumberMasked}
              </p>
            </div>
            <div>
              <p className="font-sans text-xs text-muted mb-1">Arrives in</p>
              <p className="font-sans text-sm text-foreground">
                About 30 minutes during banking hours.
              </p>
            </div>
            <p className="font-sans text-xs text-success pt-1">
              No fees on this withdrawal.
            </p>
          </section>
        )}

        {submitError && (
          <p className="font-sans text-sm text-error mb-4 text-center">{submitError}</p>
        )}

        {/* 5. Confirm CTA */}
        <div className="h-px bg-gold opacity-60 mb-6" />

        <button
          type="submit"
          disabled={!canWithdraw}
          className="w-full bg-primary text-primary-foreground py-4 rounded font-sans text-base font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ minHeight: '56px' }}
        >
          {view === 'submitting' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="tabular-nums">
                Sending ₦{numericAmount.toLocaleString('en-NG')} to{' '}
                {selectedBank?.bankName} {selectedBank?.accountNumberMasked ?? ''}…
              </span>
            </>
          ) : (
            <span className="tabular-nums">
              Withdraw {numericAmount > 0 ? `₦${numericAmount.toLocaleString('en-NG')}` : ''}
            </span>
          )}
        </button>
      </form>
    </div>
  )
}
