'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { nip19 } from 'nostr-tools'
import { ChevronLeft, Copy, Check, Eye, EyeOff, Loader2 } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import {
  confirmOrderDelivered,
  getBuyerOrder,
  raiseOrderDispute,
  submitOrderReview,
  type BuyerOrderDetail,
} from '@/lib/api/commerce'
import { useSession } from '@/lib/auth/use-session'
import type { OrderStatus } from '@/types/shared'

// Buyer becomes review-eligible 14 days after shipping if not already
// marked delivered — same window the backend enforces in
// /api/orders/[id]/review.
const REVIEW_AUTO_RELEASE_DAYS = 14
const REVIEW_AUTO_RELEASE_MS = REVIEW_AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000

function isReviewEligible(order: BuyerOrderDetail): boolean {
  if (order.status === 'DELIVERED') return true
  if (order.status === 'SHIPPED' && order.shippedAt) {
    return Date.now() - new Date(order.shippedAt).getTime() >= REVIEW_AUTO_RELEASE_MS
  }
  return false
}

// Demo BTC/NGN rate, mirrored from the server, for client-side sats → ₦ conversions.
const NGN_PER_BTC = 145_000_000n
const SATS_PER_BTC = 100_000_000n

function formatNgnFromSats(satsStr: string): string {
  try {
    const sats = BigInt(satsStr)
    const ngn = (sats * NGN_PER_BTC) / SATS_PER_BTC
    return `₦${Number(ngn).toLocaleString('en-NG')}`
  } catch {
    return '₦0'
  }
}

const STATUS_PILLS: Record<OrderStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-input', text: 'text-muted', label: 'Awaiting payment' },
  PAID: { bg: 'bg-primary', text: 'text-primary-foreground', label: 'Paid · Awaiting shipment' },
  SHIPPED: { bg: 'bg-gold', text: 'text-foreground', label: 'Shipped' },
  DELIVERED: { bg: 'bg-success', text: 'text-primary-foreground', label: 'Delivered' },
  CANCELLED: { bg: 'bg-border', text: 'text-muted', label: 'Cancelled' },
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

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

export default function BuyerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)
  const { user, isLoading: isSessionLoading } = useSession()

  useEffect(() => {
    if (!isSessionLoading && !user) {
      router.push('/signin')
    }
  }, [isSessionLoading, user, router])

  const [order, setOrder] = useState<BuyerOrderDetail | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState<'not_found' | 'other' | null>(null)
  const [refCopied, setRefCopied] = useState(false)

  // Review form state. Hidden entirely until eligibility + form-open click.
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewHoverRating, setReviewHoverRating] = useState(0)
  const [reviewContent, setReviewContent] = useState('')
  const [reviewPassword, setReviewPassword] = useState('')
  const [reviewShowPassword, setReviewShowPassword] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewSubmitted, setReviewSubmitted] = useState<{ nostrEventId: string } | null>(null)

  // Order state action UI. Both actions share the same in-flight flag
  // since the two buttons share the same card area.
  const [stateActionSubmitting, setStateActionSubmitting] = useState<
    'deliver' | 'dispute' | null
  >(null)
  const [stateActionError, setStateActionError] = useState<string | null>(null)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setIsFetching(true)
    setFetchError(null)
    getBuyerOrder(id)
      .then(res => {
        if (!cancelled) setOrder(res)
      })
      .catch(err => {
        if (cancelled) return
        if (err instanceof ApiError && err.statusCode === 401) {
          router.push('/signin')
          return
        }
        if (err instanceof ApiError && (err.statusCode === 404 || err.statusCode === 403)) {
          // 403 means it exists but isn't yours; from the buyer's perspective
          // the order is "not yours" in both cases, so render the same view.
          setFetchError('not_found')
          return
        }
        setFetchError('other')
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false)
      })
    return () => {
      cancelled = true
    }
  }, [id, user, router])

  const handleCopyRef = () => {
    if (!order) return
    navigator.clipboard.writeText(order.id)
    setRefCopied(true)
    setTimeout(() => setRefCopied(false), 2000)
  }

  const handleConfirmDelivered = async () => {
    if (!order || stateActionSubmitting) return
    setStateActionSubmitting('deliver')
    setStateActionError(null)
    try {
      const res = await confirmOrderDelivered(order.id)
      // Preserve buyer-specific fields (seller, priceNgnDisplay) while
      // refreshing the base order fields the server just updated.
      setOrder(prev => (prev ? { ...prev, ...res.order } : prev))
    } catch (err) {
      setStateActionError(
        err instanceof ApiError
          ? err.message
          : 'Could not confirm delivery. Try again.',
      )
    } finally {
      setStateActionSubmitting(null)
    }
  }

  const handleSubmitDispute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!order || stateActionSubmitting) return
    setStateActionSubmitting('dispute')
    setStateActionError(null)
    try {
      const res = await raiseOrderDispute(order.id, disputeReason || undefined)
      setOrder(prev => (prev ? { ...prev, ...res.order } : prev))
      setDisputeOpen(false)
      setDisputeReason('')
    } catch (err) {
      setStateActionError(
        err instanceof ApiError
          ? err.message
          : 'Could not raise dispute. Try again.',
      )
    } finally {
      setStateActionSubmitting(null)
    }
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!order || reviewSubmitting) return
    if (reviewRating < 1 || reviewRating > 5) {
      setReviewError('Tap a star to choose a rating.')
      return
    }
    const trimmed = reviewContent.trim()
    if (trimmed.length === 0) {
      setReviewError('Add a few words about your experience.')
      return
    }
    if (!reviewPassword) {
      setReviewError('Your password is needed to sign the review.')
      return
    }
    setReviewSubmitting(true)
    setReviewError(null)
    try {
      const res = await submitOrderReview(order.id, {
        rating: reviewRating,
        content: trimmed,
        password: reviewPassword,
      })
      setReviewSubmitted({ nostrEventId: res.nostrEventId })
      setReviewPassword('')
    } catch (err) {
      setReviewError(
        err instanceof ApiError
          ? err.message
          : 'Could not publish your review. Try again.',
      )
    } finally {
      setReviewSubmitting(false)
    }
  }

  // ── Loading / error / not-found shells share the same header ───────────────
  const BackHeader = (
    <div className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="px-5 py-3 flex items-center">
        <Link
          href="/buyer/orders"
          className="p-3 -m-3 hover:bg-input rounded transition-colors inline-flex"
          aria-label="Back to your orders"
        >
          <ChevronLeft className="w-6 h-6 text-foreground" strokeWidth={2} />
        </Link>
      </div>
    </div>
  )

  // Cover both session hydration AND the order fetch so the screen never has
  // an empty frame — including the brief window between session resolving and
  // the redirect to /signin actually taking effect.
  if (isSessionLoading || isFetching) {
    return (
      <div className="bg-background min-h-screen text-foreground">
        {BackHeader}
        <main className="mx-auto max-w-2xl px-5 sm:px-6 lg:px-8 py-6 pb-24" aria-busy="true">
          <div className="space-y-3 animate-pulse">
            <div className="h-3 bg-input rounded w-32 mb-1" />
            <div className="h-5 bg-input rounded w-48" />
            <div className="h-10 bg-input rounded w-64 mt-6" />
            <div className="h-32 bg-input rounded mt-6" />
            <div className="h-24 bg-input rounded" />
          </div>
        </main>
      </div>
    )
  }

  if (fetchError === 'not_found' || !order) {
    return (
      <div className="bg-background min-h-screen text-foreground">
        {BackHeader}
        <main className="mx-auto max-w-xl px-5 py-20 text-center">
          <h1 className="font-serif text-3xl font-normal mb-2">Order not found.</h1>
          <p className="font-sans text-base text-muted mb-6">
            That order reference isn&apos;t one of yours.
          </p>
          <Link
            href="/buyer/orders"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
          >
            Back to your orders
          </Link>
        </main>
      </div>
    )
  }

  if (fetchError === 'other') {
    return (
      <div className="bg-background min-h-screen text-foreground">
        {BackHeader}
        <main className="mx-auto max-w-xl px-5 py-20 text-center">
          <p className="font-sans text-base text-muted mb-4">
            We couldn&apos;t load this order.
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

  const pill = STATUS_PILLS[order.status]!
  const firstItem = order.items[0]
  const productTitle = firstItem?.productTitle ?? '(item)'
  const productImage = firstItem?.productImage ?? ''
  const productId = firstItem?.productId
  const itemSubtotalSats = firstItem
    ? BigInt(firstItem.priceSats) * BigInt(firstItem.quantity)
    : 0n
  const sellerDisplayName = order.seller.displayName ?? order.seller.username
  // The backend returns a fully qualified shopUrl; rebuild a relative path so
  // links work on every host (localhost, preview, prod) without hard-coding.
  const sellerShopHref = order.seller.username ? `/shop/${order.seller.username}` : '#'

  return (
    <div className="bg-background min-h-screen text-foreground">
      {BackHeader}

      <main className="mx-auto max-w-2xl px-5 sm:px-6 lg:px-8 py-6 pb-24">
        {/* Reference + status pill row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="font-sans text-xs text-muted uppercase tracking-widest mb-1">
              Order reference
            </p>
            <div className="flex items-center gap-2">
              <p className="font-sans text-base tabular-nums font-medium break-all">{order.id}</p>
              <button
                onClick={handleCopyRef}
                className="text-accent hover:opacity-80 transition-opacity p-1 -m-1 shrink-0"
                aria-label="Copy reference"
              >
                {refCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div
            className={`${pill.bg} ${pill.text} text-xs px-3 py-1 rounded-full font-sans font-medium shrink-0 mt-1`}
          >
            {pill.label}
          </div>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-normal mb-8 mt-4">Your order.</h1>

        {/* Timeline */}
        <section className="mb-8">
          <h2 className="font-serif text-lg font-normal mb-4">Timeline</h2>
          <div className="space-y-3 font-sans text-sm">
            {order.paidAt && (
              <div className="flex gap-3">
                <div className="w-3 h-3 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <p className="text-foreground font-medium">Paid</p>
                  <p className="text-muted text-xs">
                    {formatDate(order.paidAt)} · {relativeTime(order.paidAt)}
                  </p>
                </div>
              </div>
            )}
            {order.shippedAt && (
              <div className="flex gap-3">
                <div className="w-3 h-3 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <p className="text-foreground font-medium">Shipped</p>
                  <p className="text-muted text-xs">
                    {formatDate(order.shippedAt)} · {relativeTime(order.shippedAt)}
                  </p>
                  {order.shippingNote && (
                    <p className="text-muted text-xs mt-1 italic">&ldquo;{order.shippingNote}&rdquo;</p>
                  )}
                </div>
              </div>
            )}
            {order.status === 'CANCELLED' && (
              <div className="flex gap-3">
                <div className="w-3 h-3 rounded-full bg-border mt-1.5 shrink-0" />
                <div>
                  <p className="text-muted font-medium">Cancelled</p>
                  <p className="text-muted text-xs">
                    {formatDate(order.createdAt)} · {relativeTime(order.createdAt)}
                  </p>
                </div>
              </div>
            )}
            {order.status === 'PENDING' && (
              <div className="flex gap-3">
                <div className="w-3 h-3 rounded-full bg-input mt-1.5 shrink-0" />
                <div>
                  <p className="text-muted font-medium">Awaiting payment</p>
                  <p className="text-muted text-xs">
                    {formatDate(order.createdAt)} · {relativeTime(order.createdAt)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Product card */}
        <section className="mb-8">
          <h2 className="font-serif text-lg font-normal mb-4">Item</h2>
          {productId ? (
            <Link
              href={`/products/${productId}`}
              className="bg-white border border-border rounded-lg p-4 flex gap-4 hover:bg-input/30 transition-colors"
            >
              {productImage ? (
                <img
                  src={productImage}
                  alt={productTitle}
                  className="w-20 h-20 rounded object-cover shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded bg-input shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-serif text-lg text-foreground mb-1 truncate">
                  {productTitle}
                </p>
                <p className="font-sans text-sm text-accent mb-2">
                  by {sellerDisplayName}
                </p>
                <p className="font-sans text-sm text-foreground tabular-nums">
                  {formatNgnFromSats(firstItem!.priceSats)}
                </p>
              </div>
            </Link>
          ) : (
            <div className="bg-white border border-border rounded-lg p-4">
              <p className="font-sans text-sm text-muted">Item details unavailable.</p>
            </div>
          )}
        </section>

        {/* Order summary */}
        <section className="mb-8">
          <h2 className="font-serif text-lg font-normal mb-4">Summary</h2>
          <div className="bg-white border border-border rounded-lg p-4 space-y-2 font-sans text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Subtotal</span>
              <span className="text-foreground tabular-nums">
                {formatNgnFromSats(itemSubtotalSats.toString())}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Shipping</span>
              <span className="text-foreground tabular-nums">
                {formatNgnFromSats(order.shippingSats)}
              </span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between items-baseline">
              <span className="text-foreground font-medium">You paid</span>
              <span className="font-serif text-xl text-accent tabular-nums">
                {order.priceNgnDisplay || formatNgnFromSats(order.totalSats)}
              </span>
            </div>
          </div>
        </section>

        {/* Bought from */}
        <section className="mb-8">
          <h2 className="font-serif text-lg font-normal mb-4">Bought from</h2>
          <Link
            href={sellerShopHref}
            className="bg-white border border-border rounded-lg p-4 flex items-center gap-4 hover:bg-input/30 transition-colors"
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-serif text-lg shrink-0"
              style={{ backgroundColor: 'rgba(214, 121, 97, 0.2)', color: '#1F1410' }}
            >
              {order.seller.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-sans text-base text-foreground font-medium">
                {sellerDisplayName}
              </p>
              <p className="font-sans text-xs text-accent">Visit shop →</p>
            </div>
          </Link>

          {/* Sovereignty link — direct buyers to the seller's full Nostr
              presence (kind 0, products, reviews, ledger, payouts...) so
              the public audit trail of the sale is one tap away. */}
          {(() => {
            try {
              const npub = nip19.npubEncode(order.sellerNpub)
              return (
                <p className="mt-3 text-center">
                  <Link
                    href={`/sovereignty/${npub}`}
                    className="font-sans text-xs text-accent hover:underline"
                  >
                    View this seller&apos;s Nostr presence ↗
                  </Link>
                </p>
              )
            } catch {
              return null
            }
          })()}
        </section>

        {/* Order state actions — buyer-side. "Confirm received" appears on
            SHIPPED orders; "Raise a dispute" on PAID or SHIPPED orders that
            haven't been disputed/delivered/refunded already. Hidden entirely
            on terminal states (DELIVERED, CANCELLED) and on PENDING. */}
        {(order.status === 'PAID' || order.status === 'SHIPPED') &&
          order.currentState !== 'disputed' &&
          order.currentState !== 'refunded' && (
            <section className="mb-8">
              <h2 className="font-serif text-lg font-normal mb-4">
                Status actions
              </h2>
              <div className="bg-white border border-border rounded-lg p-4 space-y-3">
                {order.status === 'SHIPPED' && (
                  <button
                    type="button"
                    onClick={handleConfirmDelivered}
                    disabled={stateActionSubmitting !== null}
                    className="w-full bg-primary text-primary-foreground py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ minHeight: '48px' }}
                  >
                    {stateActionSubmitting === 'deliver' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Confirming…
                      </>
                    ) : (
                      'Confirm I received this'
                    )}
                  </button>
                )}

                {!disputeOpen ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDisputeOpen(true)
                      setStateActionError(null)
                    }}
                    disabled={stateActionSubmitting !== null}
                    className="w-full bg-white border border-border text-foreground py-3 rounded font-sans font-medium hover:bg-input/30 transition-colors disabled:opacity-50"
                    style={{ minHeight: '48px' }}
                  >
                    Raise a dispute
                  </button>
                ) : (
                  <form
                    onSubmit={handleSubmitDispute}
                    className="space-y-3 pt-1"
                  >
                    <div>
                      <label
                        htmlFor="disputeReason"
                        className="block font-sans text-sm text-muted mb-2"
                      >
                        What went wrong? (optional)
                      </label>
                      <textarea
                        id="disputeReason"
                        value={disputeReason}
                        onChange={e => setDisputeReason(e.target.value)}
                        maxLength={500}
                        rows={3}
                        placeholder="Tell the seller and Maya what happened."
                        disabled={stateActionSubmitting !== null}
                        className="w-full px-4 py-3 bg-white border border-border rounded font-sans text-base placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                        style={{ fontSize: '16px' }}
                      />
                      <p className="font-sans text-xs text-muted mt-1 tabular-nums">
                        {disputeReason.length}/500
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={stateActionSubmitting !== null}
                        className="flex-1 bg-error text-primary-foreground py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        style={{ minHeight: '48px' }}
                      >
                        {stateActionSubmitting === 'dispute' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Submitting…
                          </>
                        ) : (
                          'Submit dispute'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDisputeOpen(false)
                          setDisputeReason('')
                          setStateActionError(null)
                        }}
                        disabled={stateActionSubmitting !== null}
                        className="text-muted font-sans font-medium hover:text-foreground transition-colors px-3"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                {stateActionError && (
                  <p className="font-sans text-sm text-error">
                    {stateActionError}
                  </p>
                )}
              </div>
            </section>
          )}

        {/* If the order has been disputed or refunded, surface that as a
            neutral notice — the actions card is hidden, so without this
            block the buyer sees no acknowledgement that their dispute went
            through. */}
        {order.currentState === 'disputed' && (
          <section className="mb-8">
            <div
              className="rounded-lg border px-4 py-3 sm:py-4"
              style={{
                backgroundColor: 'rgba(184, 80, 73, 0.10)',
                borderColor: '#B85049',
              }}
            >
              <p className="font-sans text-sm sm:text-base font-medium text-error">
                Dispute raised
              </p>
              <p className="font-sans text-sm text-foreground/80 mt-1">
                Maya and the seller can see your dispute. We&apos;ll be in
                touch about next steps.
              </p>
            </div>
          </section>
        )}

        {order.currentState === 'refunded' && (
          <section className="mb-8">
            <div className="rounded-lg border border-border px-4 py-3 sm:py-4 bg-input/30">
              <p className="font-sans text-sm sm:text-base font-medium text-foreground">
                This order was refunded
              </p>
              <p className="font-sans text-sm text-muted mt-1">
                The seller has marked the order refunded. Sats should arrive
                back in your Lightning wallet shortly.
              </p>
            </div>
          </section>
        )}

        {/* Review section — gated to delivered orders + the 14-day post-ship
            auto-release window. Backend enforces the same rule and would 422
            on a premature submit, but hiding the affordance here is the
            kinder UX. Once submitted we replace the form with a confirmation. */}
        {isReviewEligible(order) && (
          <section className="mb-8">
            <h2 className="font-serif text-lg font-normal mb-4">Your review</h2>

            {reviewSubmitted ? (
              <div className="bg-white border border-border rounded-lg p-4">
                <p className="font-sans text-sm text-success font-medium mb-2">
                  Review published to Nostr ✓
                </p>
                <p className="font-sans text-xs text-muted">
                  Thanks for letting other buyers know. Your review is signed
                  with your key and lives on public relays.
                </p>
                {reviewSubmitted.nostrEventId && (
                  <p className="mt-3 pt-3 border-t border-border">
                    <a
                      href={`https://njump.me/${reviewSubmitted.nostrEventId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-sans text-xs text-accent hover:underline"
                    >
                      View on Nostr ↗
                    </a>
                  </p>
                )}
              </div>
            ) : !reviewOpen ? (
              <div className="bg-white border border-border rounded-lg p-4">
                <p className="font-sans text-sm text-foreground mb-3">
                  How did this piece arrive? A short review helps other
                  buyers and goes straight to Nostr under your name.
                </p>
                <button
                  type="button"
                  onClick={() => setReviewOpen(true)}
                  className="w-full bg-primary text-primary-foreground py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
                  style={{ minHeight: '44px' }}
                >
                  Leave a review
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmitReview}
                className="bg-white border border-border rounded-lg p-4 space-y-4"
              >
                {/* Star picker — 5 large taps, hover preview on pointer
                    devices, persistent selection on tap. */}
                <div>
                  <p className="font-sans text-sm text-muted mb-2">
                    Your rating
                  </p>
                  <div
                    className="flex gap-1"
                    onMouseLeave={() => setReviewHoverRating(0)}
                    role="radiogroup"
                    aria-label="Rating"
                  >
                    {[1, 2, 3, 4, 5].map(n => {
                      const active = (reviewHoverRating || reviewRating) >= n
                      return (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={reviewRating === n}
                          aria-label={`${n} out of 5`}
                          onClick={() => setReviewRating(n)}
                          onMouseEnter={() => setReviewHoverRating(n)}
                          disabled={reviewSubmitting}
                          className="text-3xl leading-none p-1 -m-1 transition-colors"
                          style={{ minWidth: '44px', minHeight: '44px' }}
                        >
                          <span className={active ? 'text-gold' : 'text-border'}>
                            {active ? '★' : '☆'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Content */}
                <div>
                  <label
                    htmlFor="reviewContent"
                    className="block font-sans text-sm text-muted mb-2"
                  >
                    A few words for the next buyer
                  </label>
                  <textarea
                    id="reviewContent"
                    value={reviewContent}
                    onChange={e => setReviewContent(e.target.value)}
                    maxLength={2000}
                    rows={4}
                    placeholder="What did you love? How did it arrive?"
                    disabled={reviewSubmitting}
                    className="w-full px-4 py-3 bg-white border border-border rounded font-sans text-base placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    style={{ fontSize: '16px' }}
                  />
                  <p className="font-sans text-xs text-muted mt-1 tabular-nums">
                    {reviewContent.length}/2000
                  </p>
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="reviewPassword"
                    className="block font-sans text-sm text-muted mb-2"
                  >
                    Your password (used once to sign this review)
                  </label>
                  <div className="relative">
                    <input
                      id="reviewPassword"
                      type={reviewShowPassword ? 'text' : 'password'}
                      value={reviewPassword}
                      onChange={e => setReviewPassword(e.target.value)}
                      disabled={reviewSubmitting}
                      autoComplete="current-password"
                      className="w-full pl-4 pr-12 py-3 bg-white border border-border rounded font-sans text-base focus:outline-none focus:ring-2 focus:ring-primary"
                      style={{ minHeight: '48px', fontSize: '16px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setReviewShowPassword(p => !p)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-2"
                      aria-label={reviewShowPassword ? 'Hide password' : 'Show password'}
                    >
                      {reviewShowPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {reviewError && (
                  <p className="font-sans text-sm text-error">{reviewError}</p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={reviewSubmitting}
                    className="flex-1 bg-primary text-primary-foreground py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ minHeight: '48px' }}
                  >
                    {reviewSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Publishing…
                      </>
                    ) : (
                      'Publish review'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewOpen(false)
                      setReviewError(null)
                    }}
                    disabled={reviewSubmitting}
                    className="text-muted font-sans font-medium hover:text-foreground transition-colors px-3"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        <p className="font-sans text-xs text-muted text-center mt-8">
          Need help with this order? Reach out to Maya support.
        </p>
      </main>
    </div>
  )
}
