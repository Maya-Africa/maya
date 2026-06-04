'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Copy, Check } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import { listPayoutHistory, type PayoutHistoryItem } from '@/lib/api/payout'
import { useSession } from '@/lib/auth/use-session'
import type { PayoutStatus } from '@/types/shared'

const STATUS_PILLS: Record<PayoutStatus, { bg: string; text: string; label: string }> = {
  SUCCESS: { bg: 'bg-success', text: 'text-primary-foreground', label: 'Sent' },
  PENDING: { bg: 'bg-gold', text: 'text-foreground', label: 'In transit' },
  FAILED: { bg: 'bg-error', text: 'text-primary-foreground', label: 'Failed' },
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0 || Number.isNaN(ms)) return ''
  const mins = Math.floor(ms / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return new Date(iso).toLocaleDateString()
}

export default function WithdrawalHistoryPage() {
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

  const [items, setItems] = useState<PayoutHistoryItem[] | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [copiedRef, setCopiedRef] = useState<string | null>(null)

  useEffect(() => {
    if (!user || user.role !== 'SELLER') return
    let cancelled = false
    setIsFetching(true)
    setFetchError(false)
    listPayoutHistory({ limit: 50 })
      .then(res => {
        if (!cancelled) setItems(res.items)
      })
      .catch(err => {
        if (cancelled) return
        if (err instanceof ApiError && err.statusCode === 401) {
          router.push('/signin')
          return
        }
        setFetchError(true)
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, router])

  const handleCopyRef = (reference: string) => {
    navigator.clipboard.writeText(reference)
    setCopiedRef(reference)
    setTimeout(() => setCopiedRef(null), 2000)
  }

  const BackHeader = (
    <div className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="px-5 py-3 flex items-center">
        <Link
          href="/seller/withdraw"
          className="p-3 -m-3 hover:bg-input rounded transition-colors inline-flex"
          aria-label="Back to withdraw"
        >
          <ChevronLeft className="w-6 h-6 text-foreground" strokeWidth={2} />
        </Link>
      </div>
    </div>
  )

  if (isSessionLoading || isFetching) {
    return (
      <div className="bg-background min-h-screen text-foreground">
        {BackHeader}
        <main className="mx-auto max-w-2xl px-5 sm:px-6 lg:px-8 py-6 pb-12" aria-busy="true">
          <div className="h-12 w-1/2 bg-input rounded mb-2 animate-pulse" />
          <div className="h-4 w-1/4 bg-input rounded mb-8 animate-pulse" />
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-white border border-border rounded-lg p-4 space-y-3 animate-pulse">
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <div className="h-6 bg-input rounded w-24" />
                    <div className="h-3 bg-input rounded w-32" />
                  </div>
                  <div className="h-6 bg-input rounded-full w-20" />
                </div>
                <div className="border-t border-border pt-3 h-3 bg-input rounded" />
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="bg-background min-h-screen text-foreground">
        {BackHeader}
        <main className="mx-auto max-w-2xl px-5 py-20 text-center">
          <p className="font-sans text-base text-muted mb-4">
            We couldn&apos;t load your withdrawal history.
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

  const safeItems = items ?? []

  return (
    <div className="bg-background min-h-screen text-foreground">
      {BackHeader}

      <main className="mx-auto max-w-2xl px-5 sm:px-6 lg:px-8 py-6 pb-12">
        <h1 className="font-serif text-4xl sm:text-5xl font-normal mb-2">Withdrawals.</h1>
        <p className="font-sans text-sm text-muted mb-8">
          {safeItems.length} {safeItems.length === 1 ? 'withdrawal' : 'withdrawals'} all time
        </p>

        {safeItems.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div
              className="w-16 h-16 rounded-full border-2 mb-5"
              style={{ borderColor: '#E8B43D' }}
              aria-hidden="true"
            />
            <h2 className="font-serif text-2xl font-normal mb-2">No withdrawals yet.</h2>
            <p className="font-sans text-sm text-muted max-w-sm">
              Your withdrawals will appear here once you cash out.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {safeItems.map(w => {
              const pill = STATUS_PILLS[w.status]
              const reference = w.externalId ?? w.id
              const isCopied = copiedRef === reference
              const ngn = Number(w.amountNgn) || 0
              const bankLabel = w.bankName
                ? `to ${w.bankName}${w.accountNumberMasked ? ` ${w.accountNumberMasked}` : ''}`
                : 'to a deleted bank account'

              return (
                <div
                  key={w.id}
                  className="bg-white border border-border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-serif text-2xl text-accent tabular-nums">
                        ₦{ngn.toLocaleString('en-NG')}
                      </p>
                      <p className="font-sans text-sm text-muted mt-0.5">{bankLabel}</p>
                    </div>
                    <div
                      className={`${pill.bg} ${pill.text} text-xs px-3 py-1 rounded-full font-sans font-medium shrink-0`}
                    >
                      {pill.label}
                    </div>
                  </div>

                  {w.status === 'FAILED' && w.failureReason && (
                    <p className="font-sans text-xs text-error">{w.failureReason}</p>
                  )}

                  <div className="border-t border-border pt-3 flex items-center justify-between gap-3">
                    <p className="font-sans text-xs text-muted">
                      {w.status === 'SUCCESS' && w.completedAt
                        ? `Arrived ${relativeTime(w.completedAt)}`
                        : w.status === 'PENDING'
                        ? `Started ${relativeTime(w.createdAt)}`
                        : w.status === 'FAILED'
                        ? `Failed ${relativeTime(w.completedAt ?? w.createdAt)}`
                        : 'Status unknown'}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopyRef(reference)}
                      className="font-sans text-xs text-accent hover:opacity-80 transition-opacity flex items-center gap-1 tabular-nums max-w-[55%] truncate"
                      aria-label="Copy reference"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 shrink-0" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 shrink-0" />
                          <span className="truncate">{reference}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
