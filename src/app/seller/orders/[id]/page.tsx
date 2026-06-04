'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { nip04 } from 'nostr-tools'
import { ChevronLeft, Copy, Check, Loader2 } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import {
  getSellerOrder,
  markOrderShipped,
  refundOrder,
  type SellerOrderDetail,
} from '@/lib/api/commerce'
import { useSession } from '@/lib/auth/use-session'
import { getSecretKey } from '@/lib/auth/storage'
import type { OrderStatus } from '@/types/shared'

// Demo BTC/NGN rate, mirrored from the server.
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
  PAID: { bg: 'bg-primary', text: 'text-primary-foreground', label: 'New sale · Ready to ship' },
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

// Mirrors the validation contract in Commerce CLAUDE.md "Shipping address
// validation rules". When the buyer-side shipping form lands, this shape
// is what the seller's nip04 decryption should produce.
interface ShippingAddress {
  recipientName: string
  addressLine1: string
  addressLine2?: string
  city: string
  stateRegion: string
  postalCode?: string
  country: string
  phone: string
  notes?: string
}

type ShippingDecryptState =
  | { kind: 'none' }                                    // null ciphertext (digital / pre-collection)
  | { kind: 'locked' }                                  // seller needs to sign in again to decrypt
  | { kind: 'decrypting' }
  | { kind: 'ok'; address: ShippingAddress; raw: string }
  | { kind: 'ok-raw'; raw: string }                     // decrypted but didn't match expected shape
  | { kind: 'error'; message: string }

function formatAddressForCopy(a: ShippingAddress): string {
  const lines = [a.recipientName, a.addressLine1]
  if (a.addressLine2) lines.push(a.addressLine2)
  lines.push(
    [a.city, a.stateRegion, a.postalCode].filter(Boolean).join(', '),
  )
  lines.push(a.country)
  if (a.phone) lines.push(`Phone: ${a.phone}`)
  if (a.notes) lines.push(`Notes: ${a.notes}`)
  return lines.join('\n')
}

export default function SellerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const { id } = use(params)
  const { user, isLoading: isSessionLoading } = useSession()

  useEffect(() => {
    if (isSessionLoading) return
    if (!user) {
      router.push('/signin')
      return
    }
    if (user.role !== 'SELLER') {
      router.push(`/buyer/orders/${encodeURIComponent(id)}`)
    }
  }, [isSessionLoading, user, router, id])

  const [order, setOrder] = useState<SellerOrderDetail | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState<'not_found' | 'other' | null>(null)
  const [shipping, setShipping] = useState<ShippingDecryptState>({ kind: 'decrypting' })

  const [refCopied, setRefCopied] = useState(false)
  const [addressCopied, setAddressCopied] = useState(false)
  const [shippingConfirm, setShippingConfirm] = useState(false)
  const [isShipping, setIsShipping] = useState(false)
  const [shippingError, setShippingError] = useState<string | null>(null)

  // Refund action — seller initiates with an optional note. Confirmation
  // dialog before submit so an accidental tap doesn't fire a real refund.
  const [refundConfirm, setRefundConfirm] = useState(false)
  const [refundNote, setRefundNote] = useState('')
  const [isRefunding, setIsRefunding] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || user.role !== 'SELLER') return
    let cancelled = false
    setIsFetching(true)
    setFetchError(null)
    getSellerOrder(id)
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

  // Decrypt the shipping address once the order arrives. NIP-04 with the
  // seller's nsec (cached in IndexedDB after sign-in) and the buyer's npub.
  useEffect(() => {
    if (!user || !order) return
    let cancelled = false

    if (!order.encryptedShipping) {
      setShipping({ kind: 'none' })
      return
    }

    setShipping({ kind: 'decrypting' })
    ;(async () => {
      const sk = await getSecretKey(user.npub)
      if (cancelled) return
      if (!sk) {
        setShipping({ kind: 'locked' })
        return
      }
      try {
        const raw = await nip04.decrypt(sk, order.buyer.npub, order.encryptedShipping!)
        if (cancelled) return
        let parsed: ShippingAddress | null = null
        try {
          const json = JSON.parse(raw) as Partial<ShippingAddress>
          if (json && typeof json === 'object' && json.recipientName && json.addressLine1) {
            parsed = json as ShippingAddress
          }
        } catch {
          // Not JSON — fall back to raw.
        }
        if (parsed) setShipping({ kind: 'ok', address: parsed, raw })
        else setShipping({ kind: 'ok-raw', raw })
      } catch (err) {
        if (cancelled) return
        setShipping({
          kind: 'error',
          message:
            err instanceof Error
              ? err.message
              : 'Could not decrypt the shipping address.',
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [order, user])

  const handleCopyRef = () => {
    if (!order) return
    navigator.clipboard.writeText(order.id)
    setRefCopied(true)
    setTimeout(() => setRefCopied(false), 2000)
  }

  const handleCopyAddress = () => {
    if (shipping.kind === 'ok') {
      navigator.clipboard.writeText(formatAddressForCopy(shipping.address))
    } else if (shipping.kind === 'ok-raw') {
      navigator.clipboard.writeText(shipping.raw)
    } else {
      return
    }
    setAddressCopied(true)
    setTimeout(() => setAddressCopied(false), 2000)
  }

  const handleConfirmShipped = async () => {
    if (!order) return
    setIsShipping(true)
    setShippingError(null)
    try {
      const updated = await markOrderShipped(order.id)
      setOrder(prev => (prev ? { ...prev, ...updated } : prev))
      setShippingConfirm(false)
    } catch (err) {
      setShippingError(
        err instanceof ApiError ? err.message : 'Could not mark this order shipped. Try again.',
      )
    } finally {
      setIsShipping(false)
    }
  }

  const handleRefund = async () => {
    if (!order || isRefunding) return
    setIsRefunding(true)
    setRefundError(null)
    try {
      const res = await refundOrder(order.id, refundNote || undefined)
      // Preserve seller-view-specific fields (buyer, encryptedShipping,
      // priceNgnDisplay) while updating the base order fields.
      setOrder(prev => (prev ? { ...prev, ...res.order } : prev))
      setRefundConfirm(false)
      setRefundNote('')
    } catch (err) {
      setRefundError(
        err instanceof ApiError
          ? err.message
          : 'Could not issue refund. Try again.',
      )
    } finally {
      setIsRefunding(false)
    }
  }

  const BackHeader = (
    <div className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="px-5 py-3 flex items-center">
        <Link
          href="/seller/orders"
          className="p-3 -m-3 hover:bg-input rounded transition-colors inline-flex"
          aria-label="Back to orders"
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
            That order reference doesn&apos;t match anything in your shop.
          </p>
          <Link
            href="/seller/orders"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
          >
            Back to orders
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
  const itemSubtotalSats = firstItem
    ? BigInt(firstItem.priceSats) * BigInt(firstItem.quantity)
    : 0n
  const buyerLabel = `Buyer · ${order.buyer.npub.slice(-4)}`

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

        <h1 className="font-serif text-3xl sm:text-4xl font-normal mb-8 mt-4">Order details.</h1>

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
          <div className="bg-white border border-border rounded-lg p-4 flex gap-4">
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
              <p className="font-sans text-xs text-muted mb-1">Your product</p>
              <p className="font-serif text-lg text-foreground mb-2 truncate">{productTitle}</p>
              {firstItem && (
                <p className="font-sans text-sm text-foreground tabular-nums">
                  {formatNgnFromSats(firstItem.priceSats)}
                </p>
              )}
            </div>
          </div>
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
              <span className="text-foreground font-medium">Buyer paid</span>
              <span className="font-serif text-xl text-accent tabular-nums">
                {order.priceNgnDisplay || formatNgnFromSats(order.totalSats)}
              </span>
            </div>
          </div>
        </section>

        {/* Buyer block — pseudonymous (npub-only per the spec). */}
        <section className="mb-8">
          <h2 className="font-serif text-lg font-normal mb-4">Buyer</h2>
          <div className="bg-white border border-border rounded-lg p-4">
            <p className="font-sans text-base text-foreground font-medium">{buyerLabel}</p>
            <p className="font-sans text-xs text-muted mt-1 break-all">
              {order.buyer.npub}
            </p>
          </div>
        </section>

        {/* Shipping address — NIP-04 decrypted client-side. */}
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif text-lg font-normal">Ship to</h2>
            {(shipping.kind === 'ok' || shipping.kind === 'ok-raw') && (
              <button
                onClick={handleCopyAddress}
                className="font-sans text-sm text-accent hover:opacity-80 transition-opacity flex items-center gap-1.5"
              >
                {addressCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy address
                  </>
                )}
              </button>
            )}
          </div>
          <div className="bg-white border border-border rounded-lg p-4">
            {shipping.kind === 'decrypting' && (
              <p className="font-sans text-sm text-muted flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Decrypting…
              </p>
            )}
            {shipping.kind === 'none' && (
              <p className="font-sans text-sm text-muted">
                No shipping address was provided for this order.
              </p>
            )}
            {shipping.kind === 'locked' && (
              <p className="font-sans text-sm text-muted">
                Sign in again to decrypt the shipping address. Your key isn&apos;t in this
                browser session.
              </p>
            )}
            {shipping.kind === 'error' && (
              <p className="font-sans text-sm text-error">{shipping.message}</p>
            )}
            {shipping.kind === 'ok' && (
              <>
                <p className="font-sans text-base text-foreground leading-relaxed whitespace-pre-line">
                  {shipping.address.recipientName}
                  {'\n'}
                  {shipping.address.addressLine1}
                  {shipping.address.addressLine2 && (
                    <>
                      {'\n'}
                      {shipping.address.addressLine2}
                    </>
                  )}
                  {'\n'}
                  {[shipping.address.city, shipping.address.stateRegion, shipping.address.postalCode]
                    .filter(Boolean)
                    .join(', ')}
                  {'\n'}
                  {shipping.address.country}
                  {shipping.address.phone && (
                    <>
                      {'\n\n'}
                      Phone: {shipping.address.phone}
                    </>
                  )}
                  {shipping.address.notes && (
                    <>
                      {'\n'}
                      Notes: {shipping.address.notes}
                    </>
                  )}
                </p>
                <p className="font-sans text-xs text-muted mt-3 pt-3 border-t border-border">
                  Encrypted to your account. Only you can see this.
                </p>
              </>
            )}
            {shipping.kind === 'ok-raw' && (
              <>
                <pre className="font-sans text-sm text-foreground whitespace-pre-wrap wrap-break-word">
                  {shipping.raw}
                </pre>
                <p className="font-sans text-xs text-muted mt-3 pt-3 border-t border-border">
                  Encrypted to your account. Only you can see this.
                </p>
              </>
            )}
          </div>
        </section>

        {/* Buyer raised a dispute — surface it so the seller acts. */}
        {order.currentState === 'disputed' && (
          <section className="mb-6">
            <div
              className="rounded-lg border px-4 py-3 sm:py-4"
              style={{
                backgroundColor: 'rgba(184, 80, 73, 0.10)',
                borderColor: '#B85049',
              }}
            >
              <p className="font-sans text-sm sm:text-base font-medium text-error">
                The buyer raised a dispute on this order.
              </p>
              <p className="font-sans text-sm text-foreground/80 mt-1">
                Reach out to {buyerLabel} or message Maya support to
                resolve. You can still issue a refund below.
              </p>
            </div>
          </section>
        )}

        {/* Already refunded — terminal state for this branch. */}
        {order.currentState === 'refunded' && (
          <section className="mb-6">
            <div className="rounded-lg border border-border px-4 py-3 sm:py-4 bg-input/30">
              <p className="font-sans text-sm sm:text-base font-medium text-foreground">
                This order has been refunded.
              </p>
              <p className="font-sans text-sm text-muted mt-1">
                The refund event is on Nostr. No further action needed.
              </p>
            </div>
          </section>
        )}

        {/* Mark-as-shipped action — only when PAID */}
        {order.status === 'PAID' && (
          <>
            <div className="h-px bg-gold opacity-60 mb-6" />

            {!shippingConfirm ? (
              <button
                onClick={() => setShippingConfirm(true)}
                className="w-full bg-primary text-primary-foreground py-4 rounded font-sans font-medium hover:opacity-90 transition-opacity"
                style={{ minHeight: '56px' }}
              >
                Mark as shipped
              </button>
            ) : (
              <div className="bg-[#F5EFE3] rounded-lg p-4 space-y-4">
                <p className="font-sans text-sm text-foreground">
                  Mark this order as shipped to {buyerLabel}? They&apos;ll see the status update.
                </p>
                {shippingError && (
                  <p className="font-sans text-xs text-error">{shippingError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmShipped}
                    disabled={isShipping}
                    className="flex-1 bg-primary text-primary-foreground py-3 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isShipping ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      'Confirm'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setShippingConfirm(false)
                      setShippingError(null)
                    }}
                    disabled={isShipping}
                    className="flex-1 bg-transparent text-foreground py-3 rounded font-sans text-sm font-medium hover:bg-border transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Refund action — available on every non-terminal state EXCEPT
            already refunded. CANCELLED and DELIVERED are intentionally
            included: the seller might still need to issue a goodwill
            refund post-delivery (damaged item, wrong fit). The spec
            hides on CANCELLED/DELIVERED — we follow that. */}
        {order.status !== 'CANCELLED' &&
          order.status !== 'DELIVERED' &&
          order.currentState !== 'refunded' && (
            <section className="mt-8">
              <h2 className="font-serif text-lg font-normal mb-4">Refund</h2>
              {!refundConfirm ? (
                <button
                  type="button"
                  onClick={() => {
                    setRefundConfirm(true)
                    setRefundError(null)
                  }}
                  className="w-full bg-white border border-error text-error py-3 rounded font-sans font-medium hover:bg-error/5 transition-colors"
                  style={{ minHeight: '48px' }}
                >
                  Refund this order
                </button>
              ) : (
                <div className="bg-white border border-border rounded-lg p-4 space-y-3">
                  <p className="font-sans text-sm text-foreground">
                    Refund this order to {buyerLabel}? The buyer will see
                    the refund on their side and the event goes to Nostr.
                  </p>
                  <div>
                    <label
                      htmlFor="refundNote"
                      className="block font-sans text-sm text-muted mb-2"
                    >
                      Note for the buyer (optional)
                    </label>
                    <textarea
                      id="refundNote"
                      value={refundNote}
                      onChange={e => setRefundNote(e.target.value)}
                      maxLength={500}
                      rows={3}
                      placeholder="Out of stock, shipping damage, etc."
                      disabled={isRefunding}
                      className="w-full px-4 py-3 bg-white border border-border rounded font-sans text-base placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                      style={{ fontSize: '16px' }}
                    />
                    <p className="font-sans text-xs text-muted mt-1 tabular-nums">
                      {refundNote.length}/500
                    </p>
                  </div>

                  {refundError && (
                    <p className="font-sans text-xs text-error">{refundError}</p>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleRefund}
                      disabled={isRefunding}
                      className="flex-1 bg-error text-primary-foreground py-3 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      style={{ minHeight: '48px' }}
                    >
                      {isRefunding ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Refunding…
                        </>
                      ) : (
                        'Confirm refund'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRefundConfirm(false)
                        setRefundNote('')
                        setRefundError(null)
                      }}
                      disabled={isRefunding}
                      className="flex-1 bg-transparent text-foreground py-3 rounded font-sans text-sm font-medium hover:bg-border transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
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
