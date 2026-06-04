'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import { listOrders } from '@/lib/api/commerce'
import { useSession } from '@/lib/auth/use-session'
import type { Order, OrderStatus } from '@/types/shared'

// Demo BTC/NGN rate, mirrored from the server, for the secondary NGN display.
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

export default function BuyerOrdersPage() {
  const router = useRouter()
  const { user, isLoading: isSessionLoading } = useSession()

  useEffect(() => {
    if (!isSessionLoading && !user) {
      router.push('/signin')
    }
  }, [isSessionLoading, user, router])

  const [orders, setOrders] = useState<Order[] | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    if (!user) return
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

  // Header is rendered in every state so the page never has a frame where
  // nothing is visible — including the brief window between session-hydrate
  // resolving and the redirect to /signin actually unmounting this page.
  const Header = (
    <div className="sticky top-0 z-40 bg-background border-b border-border">
      <div className="px-5 py-3 flex items-center">
        <Link
          href="/marketplace"
          className="p-3 -m-3 hover:bg-input rounded transition-colors inline-flex"
          aria-label="Back to marketplace"
        >
          <ChevronLeft className="w-6 h-6 text-foreground" strokeWidth={2} />
        </Link>
      </div>
    </div>
  )

  // Show the loading view for both session hydration and the orders fetch.
  // When the user is unauthenticated the redirect effect above will fire on
  // the next render; this view keeps the screen populated until it does.
  if (isSessionLoading || isFetching) {
    return (
      <div className="bg-background min-h-screen text-foreground">
        {Header}
        <main className="mx-auto max-w-2xl px-5 sm:px-6 lg:px-8 py-6 pb-24" aria-busy="true">
          <div className="h-12 w-2/3 bg-input rounded mb-3 animate-pulse" />
          <div className="h-4 w-1/2 bg-input rounded mb-8 animate-pulse" />
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="bg-white border border-border rounded-lg p-4 flex gap-4 animate-pulse"
              >
                <div className="w-20 h-20 rounded bg-input shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-input rounded w-2/3" />
                  <div className="h-3 bg-input rounded w-1/3" />
                  <div className="h-3 bg-input rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen text-foreground">
      {Header}

      <main className="mx-auto max-w-2xl px-5 sm:px-6 lg:px-8 py-6 pb-24">
        <h1 className="font-serif text-4xl sm:text-5xl font-normal mb-2">Your orders.</h1>
        <p className="font-sans text-base text-muted mb-8">
          Everything you&apos;ve bought on Maya.
        </p>

        {fetchError && (
          <div className="text-center py-12">
            <p className="font-sans text-base text-muted mb-4">
              We couldn&apos;t load your orders.
            </p>
            <button
              onClick={() => router.refresh()}
              className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
          </div>
        )}

        {!fetchError && orders && orders.length === 0 && (
          <div className="text-center py-16">
            <p className="font-serif text-2xl font-normal mb-2">No orders yet.</p>
            <p className="font-sans text-base text-muted mb-6">
              When you buy a piece, it&apos;ll show up here.
            </p>
            <Link
              href="/marketplace"
              className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
            >
              Browse the marketplace
            </Link>
          </div>
        )}

        {!fetchError && orders && orders.length > 0 && (
          <ul className="space-y-3">
            {orders.map(order => {
              const pill = STATUS_PILLS[order.status]!
              const firstItem = order.items[0]
              const productTitle = firstItem?.productTitle ?? '(item)'
              const productImage = firstItem?.productImage ?? ''
              const dateRef = order.paidAt ?? order.createdAt
              return (
                <li key={order.id}>
                  <Link
                    href={`/buyer/orders/${encodeURIComponent(order.id)}`}
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
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="font-serif text-base text-foreground truncate">
                          {productTitle}
                        </p>
                        <span
                          className={`${pill.bg} ${pill.text} text-xs px-2 py-1 rounded-full font-sans font-medium shrink-0 whitespace-nowrap`}
                        >
                          {pill.label}
                        </span>
                      </div>
                      <p className="font-sans text-sm text-foreground tabular-nums mb-1">
                        {formatNgnFromSats(order.totalSats)}
                      </p>
                      <p className="font-sans text-xs text-muted">
                        {relativeTime(dateRef)} · {order.id}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
