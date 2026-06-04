'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Copy, Check, Eye, EyeOff, Loader2, Store, MessageCircle, Star } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import {
  confirmOrderDelivered,
  getBuyerOrder,
  raiseOrderDispute,
  submitOrderReview,
  type BuyerOrderDetail,
} from '@/lib/api/commerce'
import { useSession } from '@/lib/auth/use-session'
import { OrderTracker } from '@/components/order-tracker'
import { EscrowPanel } from '@/components/escrow-panel'
import type { OrderStatus } from '@/types/shared'

const NGN_PER_BTC = 145_000_000n
const SATS_PER_BTC = 100_000_000n

function fmtNgn(satsStr: string): string {
  try {
    const sats = BigInt(satsStr)
    const ngn = (sats * NGN_PER_BTC) / SATS_PER_BTC
    return `₦${Number(ngn).toLocaleString('en-NG')}`
  } catch { return '₦0' }
}

function isReviewEligible(order: BuyerOrderDetail): boolean {
  if (order.status === 'DELIVERED') return true
  if (order.status === 'SHIPPED' && order.shippedAt) {
    return Date.now() - new Date(order.shippedAt).getTime() >= 14 * 24 * 60 * 60 * 1000
  }
  return false
}

function escrowPhase(order: BuyerOrderDetail): 'locked' | 'ready' | 'released' | 'disputed' | 'refunded' {
  if (order.currentState === 'disputed') return 'disputed'
  if (order.currentState === 'refunded') return 'refunded'
  if (order.status === 'DELIVERED') return 'released'
  if (order.status === 'SHIPPED') return 'ready'
  return 'locked'
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const cfg: Record<OrderStatus, { label: string; cls: string }> = {
    PENDING: { label: 'Awaiting payment', cls: 'bg-border text-muted' },
    PAID: { label: 'In escrow', cls: 'bg-primary/15 text-primary' },
    SHIPPED: { label: 'Shipped', cls: 'bg-gold/25 text-foreground' },
    DELIVERED: { label: 'Delivered', cls: 'bg-success/15 text-success' },
    CANCELLED: { label: 'Cancelled', cls: 'bg-destructive/10 text-destructive' },
  }
  const { label, cls } = cfg[status]
  return <span className={`text-xs font-sans font-bold px-3 py-1 rounded-full uppercase tracking-wide ${cls}`}>{label}</span>
}

export default function BuyerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const { user, isLoading: isSessionLoading } = useSession()

  const [order, setOrder] = useState<BuyerOrderDetail | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState<'not_found' | 'other' | null>(null)
  const [refCopied, setRefCopied] = useState(false)

  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewHover, setReviewHover] = useState(0)
  const [reviewContent, setReviewContent] = useState('')
  const [reviewPassword, setReviewPassword] = useState('')
  const [showReviewPw, setShowReviewPw] = useState(false)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewDone, setReviewDone] = useState<{ nostrEventId: string } | null>(null)

  useEffect(() => {
    if (!isSessionLoading && !user) router.push('/signin')
  }, [isSessionLoading, user, router])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setIsFetching(true)
    getBuyerOrder(id)
      .then(res => { if (!cancelled) setOrder(res) })
      .catch(err => {
        if (cancelled) return
        if (err instanceof ApiError && err.statusCode === 401) { router.push('/signin'); return }
        setFetchError(err instanceof ApiError && [403,404].includes(err.statusCode ?? 0) ? 'not_found' : 'other')
      })
      .finally(() => { if (!cancelled) setIsFetching(false) })
    return () => { cancelled = true }
  }, [id, user, router])

  const handleRelease = async () => {
    if (!order) return
    const res = await confirmOrderDelivered(order.id)
    setOrder(prev => prev ? { ...prev, ...res.order } : prev)
  }

  const handleDispute = async (reason: string) => {
    if (!order) return
    const res = await raiseOrderDispute(order.id, reason || undefined)
    setOrder(prev => prev ? { ...prev, ...res.order } : prev)
  }

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!order || reviewSubmitting) return
    if (!reviewRating) { setReviewError('Please choose a star rating.'); return }
    if (!reviewContent.trim()) { setReviewError('Write a few words about your experience.'); return }
    if (!reviewPassword) { setReviewError('Password needed to sign your review.'); return }
    setReviewSubmitting(true)
    setReviewError(null)
    try {
      const res = await submitOrderReview(order.id, { rating: reviewRating, content: reviewContent.trim(), password: reviewPassword })
      setReviewDone({ nostrEventId: res.nostrEventId })
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : 'Could not publish. Try again.')
    } finally {
      setReviewSubmitting(false)
    }
  }

  // ── Loading shell ────────────────────────────────────────────────────────────
  if (isSessionLoading || isFetching) {
    return (
      <div className="bg-background min-h-screen">
        <div className="sticky top-0 z-40 bg-background border-b border-border px-5 py-4">
          <div className="w-6 h-6 bg-border rounded animate-pulse" />
        </div>
        <main className="mx-auto max-w-2xl px-5 py-8 space-y-4">
          {[80, 200, 160, 200].map((h, i) => (
            <div key={i} className={`h-[${h}px] bg-border/30 rounded-2xl animate-pulse`} style={{ height: h }} />
          ))}
        </main>
      </div>
    )
  }

  if (fetchError || !order) {
    return (
      <div className="bg-background min-h-screen text-foreground flex flex-col items-center justify-center px-5 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-border/30 flex items-center justify-center mb-5">
          <span className="text-muted text-2xl">?</span>
        </div>
        <h1 className="font-serif text-3xl mb-2">{fetchError === 'not_found' ? 'Order not found.' : 'Could not load order.'}</h1>
        <p className="font-sans text-sm text-muted mb-6">
          {fetchError === 'not_found' ? "This order doesn't belong to your account." : 'Check your connection and try again.'}
        </p>
        <Link href="/buyer/orders" className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-sans font-semibold text-sm hover:bg-primary/90 transition-colors">
          Back to orders
        </Link>
      </div>
    )
  }

  const firstItem = order.items[0]
  const sellerName = order.seller.displayName ?? order.seller.username
  const totalNgn = order.priceNgnDisplay || fmtNgn(order.totalSats)
  const phase = escrowPhase(order)

  return (
    <div className="bg-background min-h-screen text-foreground">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto max-w-2xl px-5 py-3.5 flex items-center justify-between">
          <Link href="/buyer/orders" className="flex items-center gap-2 text-muted hover:text-foreground transition-colors -ml-1 p-1">
            <ChevronLeft className="w-5 h-5" />
            <span className="font-sans text-sm">Orders</span>
          </Link>
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-5 py-6 pb-24 space-y-5">

        {/* Order reference */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-sans text-[11px] text-muted uppercase tracking-widest mb-1">Reference</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm text-foreground font-medium">{order.id.slice(0, 16)}…</p>
              <button
                onClick={() => { navigator.clipboard.writeText(order.id); setRefCopied(true); setTimeout(() => setRefCopied(false), 2000) }}
                className="text-muted hover:text-accent transition-colors p-1"
                aria-label="Copy reference"
              >
                {refCopied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <p className="font-sans text-xs text-muted mt-1">
            {new Date(order.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>

        {/* ── ORDER TRACKER ─────────────────────────────────────────────────── */}
        <OrderTracker
          status={order.status}
          createdAt={order.createdAt}
          paidAt={order.paidAt}
          shippedAt={order.shippedAt}
          shippingNote={order.shippingNote}
          released={order.status === 'DELIVERED'}
        />

        {/* ── ESCROW PANEL ──────────────────────────────────────────────────── */}
        {order.status !== 'CANCELLED' && order.status !== 'PENDING' && (
          <EscrowPanel
            phase={phase}
            totalNgn={totalNgn}
            sellerName={sellerName}
            onRelease={order.status === 'SHIPPED' ? handleRelease : undefined}
            onDispute={(order.status === 'PAID' || order.status === 'SHIPPED') && phase !== 'disputed' ? handleDispute : undefined}
          />
        )}

        {/* ── PRODUCT CARD ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="font-sans text-xs font-bold uppercase tracking-wider text-muted">Item ordered</p>
          </div>
          {firstItem ? (
            <Link href={`/products/${firstItem.productId}`} className="flex gap-4 p-4 hover:bg-border/10 transition-colors group">
              <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-border/20">
                {firstItem.productImage ? (
                  <img src={firstItem.productImage} alt={firstItem.productTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full bg-border/30" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {firstItem.productTitle}
                </p>
                <p className="font-sans text-xs text-muted mt-1">Qty: {firstItem.quantity}</p>
                <p className="font-sans text-base font-bold text-accent mt-2">{fmtNgn(firstItem.priceSats)}</p>
              </div>
            </Link>
          ) : (
            <div className="px-5 py-4"><p className="font-sans text-sm text-muted">Item details unavailable.</p></div>
          )}
        </div>

        {/* ── ORDER SUMMARY ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="font-sans text-xs font-bold uppercase tracking-wider text-muted">Payment summary</p>
          </div>
          <div className="px-5 py-4 space-y-3">
            {[
              { label: 'Subtotal', value: firstItem ? fmtNgn((BigInt(firstItem.priceSats) * BigInt(firstItem.quantity)).toString()) : '—' },
              { label: 'Shipping', value: fmtNgn(order.shippingSats) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between font-sans text-sm">
                <span className="text-muted">{label}</span>
                <span className="text-foreground tabular-nums">{value}</span>
              </div>
            ))}
            <div className="border-t border-border pt-3 flex justify-between items-center">
              <span className="font-sans text-sm font-bold">Total paid</span>
              <span className="font-serif text-2xl text-primary">{totalNgn}</span>
            </div>
          </div>
        </div>

        {/* ── SELLER CARD ───────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <p className="font-sans text-xs font-bold uppercase tracking-wider text-muted">Sold by</p>
          </div>
          <Link href={`/shop/${order.seller.username}`} className="flex items-center gap-4 px-5 py-4 hover:bg-border/10 transition-colors group">
            <div className="w-12 h-12 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
              <span className="font-sans text-base font-bold text-accent">
                {sellerName.slice(0,2).toUpperCase()}
              </span>
            </div>
            <div className="flex-1">
              <p className="font-sans text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{sellerName}</p>
              <p className="font-sans text-xs text-muted flex items-center gap-1 mt-0.5">
                <Store className="w-3 h-3" /> Visit shop
              </p>
            </div>
            <ChevronLeft className="w-4 h-4 text-muted rotate-180" />
          </Link>
        </div>

        {/* ── REVIEW ────────────────────────────────────────────────────────── */}
        {isReviewEligible(order) && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Star className="w-4 h-4 text-gold" />
              <p className="font-sans text-xs font-bold uppercase tracking-wider text-muted">Your review</p>
            </div>

            {reviewDone ? (
              <div className="px-5 py-5 flex items-start gap-3">
                <Check className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="font-sans text-sm font-semibold text-success">Review published</p>
                  <p className="font-sans text-xs text-muted mt-1">Thanks for leaving feedback — it helps other buyers.</p>
                  {reviewDone.nostrEventId && (
                    <a href={`https://njump.me/${reviewDone.nostrEventId}`} target="_blank" rel="noopener noreferrer" className="font-sans text-xs text-accent hover:underline mt-2 inline-block">
                      View on Nostr ↗
                    </a>
                  )}
                </div>
              </div>
            ) : !reviewOpen ? (
              <div className="px-5 py-4">
                <p className="font-sans text-sm text-muted mb-4">How was your order? Help other buyers by leaving a review.</p>
                <button onClick={() => setReviewOpen(true)} className="w-full bg-primary text-primary-foreground py-3.5 rounded-xl font-sans font-semibold text-sm hover:bg-primary/90 transition-colors">
                  Leave a review
                </button>
              </div>
            ) : (
              <form onSubmit={handleReview} className="px-5 py-4 space-y-4">
                {/* Stars */}
                <div>
                  <p className="font-sans text-xs text-muted uppercase tracking-wide font-semibold mb-2">Your rating</p>
                  <div className="flex gap-1" onMouseLeave={() => setReviewHover(0)}>
                    {[1,2,3,4,5].map(n => {
                      const active = (reviewHover || reviewRating) >= n
                      return (
                        <button key={n} type="button"
                          onClick={() => setReviewRating(n)}
                          onMouseEnter={() => setReviewHover(n)}
                          className="text-3xl p-1 transition-transform hover:scale-110"
                          style={{ minWidth: 40, minHeight: 40 }}
                        >
                          <span className={active ? 'text-gold' : 'text-border'}>
                            {active ? '★' : '☆'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Review text */}
                <div>
                  <label className="block font-sans text-xs text-muted uppercase tracking-wide font-semibold mb-2">Your review</label>
                  <textarea
                    value={reviewContent} onChange={e => setReviewContent(e.target.value)}
                    placeholder="What did you love? How was delivery? Would you buy again?"
                    rows={4} maxLength={2000}
                    className="w-full px-3.5 py-3 bg-background border border-border rounded-xl font-sans text-sm placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                    style={{ fontSize: '16px' }}
                  />
                  <p className="font-sans text-[10px] text-muted text-right mt-1">{reviewContent.length}/2000</p>
                </div>

                {/* Password */}
                <div>
                  <label className="block font-sans text-xs text-muted uppercase tracking-wide font-semibold mb-2">
                    Password (signs your review)
                  </label>
                  <div className="relative">
                    <input type={showReviewPw ? 'text' : 'password'} value={reviewPassword}
                      onChange={e => setReviewPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full px-3.5 pr-12 py-3 bg-background border border-border rounded-xl font-sans text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      style={{ fontSize: '16px' }}
                    />
                    <button type="button" onClick={() => setShowReviewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-1">
                      {showReviewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {reviewError && <p className="font-sans text-xs text-destructive">{reviewError}</p>}

                <div className="flex gap-2 pt-1">
                  <button type="submit" disabled={reviewSubmitting}
                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-sans font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {reviewSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing…</> : 'Publish review'}
                  </button>
                  <button type="button" onClick={() => { setReviewOpen(false); setReviewError(null) }}
                    className="px-4 rounded-xl border border-border font-sans text-sm text-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Help */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <MessageCircle className="w-3.5 h-3.5 text-muted" />
          <p className="font-sans text-xs text-muted">Need help? Contact Maya support</p>
        </div>
      </main>
    </div>
  )
}
