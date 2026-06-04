'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import { listOrders, markOrderShipped } from '@/lib/api/commerce'
import { useSession } from '@/lib/auth/use-session'
import type { Order, OrderStatus } from '@/types/shared'

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

type FilterKey = 'ALL' | 'PAID' | 'SHIPPED' | 'DELIVERED'

const STATUS_PILLS: Record<OrderStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-input', text: 'text-muted', label: 'Awaiting payment' },
  PAID: { bg: 'bg-primary', text: 'text-primary-foreground', label: 'New sale · Ready to ship' },
  SHIPPED: { bg: 'bg-gold', text: 'text-foreground', label: 'Shipped' },
  DELIVERED: { bg: 'bg-success', text: 'text-primary-foreground', label: 'Delivered' },
  CANCELLED: { bg: 'bg-border', text: 'text-muted', label: 'Cancelled' },
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PAID', label: 'Ready to ship' },
  { key: 'SHIPPED', label: 'Shipped' },
  { key: 'DELIVERED', label: 'Delivered' },
]

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

function rowDateLine(order: Order): string {
  if (order.status === 'CANCELLED') return `Cancelled ${relativeTime(order.createdAt)}`
  if (order.status === 'DELIVERED') return order.shippedAt ? `Delivered ${relativeTime(order.shippedAt)}` : 'Delivered'
  if (order.status === 'SHIPPED') return order.shippedAt ? `Shipped ${relativeTime(order.shippedAt)}` : 'Shipped'
  if (order.status === 'PAID') return order.paidAt ? `Paid ${relativeTime(order.paidAt)}` : 'Paid'
  return `Created ${relativeTime(order.createdAt)}`
}

export default function SellerOrdersListPage() {
  const router = useRouter()
  const { user, isLoading: isSessionLoading } = useSession()

  // Auth + role guard. Buyers get bounced to /buyer/orders (their analogue).
  useEffect(() => {
    if (isSessionLoading) return
    if (!user) {
      router.push('/signin')
      return
    }
    if (user.role !== 'SELLER') {
      router.push('/buyer/orders')
    }
  }, [isSessionLoading, user, router])

  const [orders, setOrders] = useState<Order[] | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('ALL')

  // Per-row mark-as-shipped state.
  const [shippingConfirm, setShippingConfirm] = useState<string | null>(null)
  const [shippingInProgress, setShippingInProgress] = useState<string | null>(null)
  const [shippingError, setShippingError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || user.role !== 'SELLER') return
    let cancelled = false
    setIsFetching(true)
    setFetchError(false)
    listOrders({ page: 1, pageSize: 50 })
      .then(res => {
        if (!cancelled) setOrders(res.items)
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

  const handleConfirmShipped = async (orderId: string) => {
    setShippingInProgress(orderId)
    setShippingError(null)
    try {
      const updated = await markOrderShipped(orderId)
      // Patch the affected row in place so the pill flips without a refetch.
      setOrders(prev =>
        prev ? prev.map(o => (o.id === orderId ? { ...o, ...updated } : o)) : prev,
      )
      setShippingConfirm(null)
    } catch (err) {
      setShippingError(
        err instanceof ApiError ? err.message : 'Could not mark this order shipped. Try again.',
      )
    } finally {
      setShippingInProgress(null)
    }
  }

  const Header = (
    <div className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="px-5 py-3 flex items-center">
        <Link
          href="/seller"
          className="p-3 -m-3 hover:bg-input rounded transition-colors inline-flex"
          aria-label="Back to dashboard"
        >
          <ChevronLeft className="w-6 h-6 text-foreground" strokeWidth={2} />
        </Link>
      </div>
    </div>
  )

  if (isSessionLoading || isFetching) {
    return (
      <div className="bg-background min-h-screen text-foreground">
        {Header}
        <main className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8 py-6 pb-12" aria-busy="true">
          <div className="h-12 w-1/3 bg-input rounded mb-3 animate-pulse" />
          <div className="h-4 w-1/4 bg-input rounded mb-6 animate-pulse" />
          <div className="flex gap-2 mb-6">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-9 w-24 bg-input rounded-full animate-pulse" />
            ))}
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-white border border-border rounded-lg p-4 animate-pulse space-y-3">
                <div className="h-3 bg-input rounded w-1/4" />
                <div className="flex gap-3">
                  <div className="w-14 h-14 bg-input rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-input rounded w-2/3" />
                    <div className="h-3 bg-input rounded w-1/3" />
                  </div>
                </div>
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
        {Header}
        <main className="mx-auto max-w-3xl px-5 py-20 text-center">
          <p className="font-sans text-base text-muted mb-4">
            We couldn&apos;t load your orders.
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

  const safeOrders = orders ?? []
  const countFor = (key: FilterKey): number => {
    if (key === 'ALL') return safeOrders.length
    return safeOrders.filter(o => o.status === key).length
  }
  const visible = safeOrders.filter(o => (filter === 'ALL' ? true : o.status === filter))

  return (
    <div className="bg-background min-h-screen text-foreground">
      {Header}

      <main className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8 py-6 pb-12">
        <h1 className="font-serif text-4xl sm:text-5xl font-normal mb-2">Orders.</h1>
        <p className="font-sans text-sm text-muted mb-6">
          {safeOrders.length} {safeOrders.length === 1 ? 'order' : 'orders'} all time
        </p>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map(f => {
            const isActive = filter === f.key
            const count = countFor(f.key)
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white border border-border text-foreground hover:border-primary'
                }`}
                style={{ minHeight: '36px' }}
              >
                {f.label}
                <span className={`ml-2 text-xs ${isActive ? 'opacity-80' : 'text-muted'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* List */}
        {visible.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div
              className="w-16 h-16 rounded-full border-2 mb-5"
              style={{ borderColor: '#E8B43D' }}
              aria-hidden="true"
            />
            <h2 className="font-serif text-2xl font-normal mb-2">
              {filter === 'ALL' ? 'No orders here yet.' : 'No orders in this view.'}
            </h2>
            <p className="font-sans text-sm text-muted max-w-sm">
              {filter === 'ALL'
                ? 'Your first sale is one share away.'
                : 'Try a different filter, or check back later.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map(order => {
              const pill = STATUS_PILLS[order.status]!
              const isPaid = order.status === 'PAID'
              const isConfirming = shippingConfirm === order.id
              const firstItem = order.items[0]
              const productTitle = firstItem?.productTitle ?? '(item)'
              const productImage = firstItem?.productImage ?? ''
              const buyerLabel = `Buyer · ${order.buyerNpub.slice(-4)}`

              return (
                <div
                  key={order.id}
                  className="bg-white border border-border rounded-lg overflow-hidden"
                >
                  <Link
                    href={`/seller/orders/${encodeURIComponent(order.id)}`}
                    className="block p-4 hover:bg-input/30 transition-colors"
                  >
                    {/* Top row: ref + pill */}
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <p className="text-xs text-muted font-sans tabular-nums truncate">
                        {order.id}
                      </p>
                      <div
                        className={`${pill.bg} ${pill.text} text-xs px-3 py-1 rounded-full font-sans font-medium whitespace-nowrap`}
                      >
                        {pill.label}
                      </div>
                    </div>

                    {/* Middle: product info */}
                    <div className="flex items-center gap-3 mb-3">
                      {productImage ? (
                        <img
                          src={productImage}
                          alt={productTitle}
                          className="w-14 h-14 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-input rounded shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-base text-foreground truncate">
                          {productTitle}
                        </p>
                        <p className="font-sans text-xs text-accent">Sold to {buyerLabel}</p>
                        <p className="font-sans text-sm text-foreground tabular-nums">
                          {formatNgnFromSats(order.totalSats)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted shrink-0" />
                    </div>

                    {/* Bottom row: relative date */}
                    <p className="font-sans text-xs text-muted">{rowDateLine(order)}</p>
                  </Link>

                  {/* Inline mark-as-shipped (only PAID) */}
                  {isPaid && !isConfirming && (
                    <div className="border-t border-border px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setShippingConfirm(order.id)}
                        className="w-full bg-primary text-primary-foreground py-2 px-3 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        Mark as shipped
                      </button>
                    </div>
                  )}

                  {/* Confirm state */}
                  {isPaid && isConfirming && (
                    <div className="border-t border-border bg-[#F5EFE3] px-4 py-3 space-y-3">
                      <p className="font-sans text-sm text-foreground">
                        Mark this order as shipped to {buyerLabel}? They&apos;ll see the status
                        update.
                      </p>
                      {shippingError && shippingConfirm === order.id && (
                        <p className="font-sans text-xs text-error">{shippingError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleConfirmShipped(order.id)}
                          disabled={shippingInProgress === order.id}
                          className="flex-1 bg-primary text-primary-foreground py-2 px-3 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {shippingInProgress === order.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Updating…
                            </>
                          ) : (
                            'Confirm'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShippingConfirm(null)
                            setShippingError(null)
                          }}
                          disabled={shippingInProgress === order.id}
                          className="flex-1 bg-transparent text-foreground py-2 px-3 rounded font-sans text-sm font-medium hover:bg-border transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
