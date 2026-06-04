'use client'

import { Suspense, use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Copy } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import { getOrder } from '@/lib/api/commerce'
import { useSession } from '@/lib/auth/use-session'
import type { Order } from '@/types/shared'

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

// The shared Order type doesn't yet include the seller summary block
// that the buyer view of /api/orders/[id] returns. Read it via index
// access so we pick it up if/when the type is updated.
function getSellerLabel(order: Order): string {
  const seller = (order as unknown as { seller?: { displayName?: string; username?: string } }).seller
  if (seller?.displayName) return seller.displayName
  if (seller?.username) return seller.username
  return 'the artist'
}

function SuccessPageContent({ params }: { params: Promise<{ orderId: string }> }) {
  const router = useRouter()
  const { orderId } = use(params)
  const { user, isLoading: isSessionLoading } = useSession()

  useEffect(() => {
    if (!isSessionLoading && !user) {
      router.push('/signin')
    }
  }, [isSessionLoading, user, router])

  const [order, setOrder] = useState<Order | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setIsFetching(true)
    getOrder(orderId)
      .then(res => {
        if (!cancelled) setOrder(res)
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
  }, [orderId, user, router])

  const handleCopyOrderId = () => {
    if (!order) return
    navigator.clipboard.writeText(order.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isSessionLoading || isFetching) {
    return (
      <div className="bg-background min-h-screen text-foreground">
        <main className="mx-auto max-w-2xl px-5 py-20 text-center" aria-busy="true">
          <div className="w-16 h-16 rounded-full bg-input animate-pulse mx-auto mb-6" />
          <div className="h-10 w-3/4 bg-input rounded mx-auto mb-3 animate-pulse" />
          <div className="h-4 w-1/2 bg-input rounded mx-auto animate-pulse" />
        </main>
      </div>
    )
  }

  if (fetchError || !order) {
    return (
      <div className="bg-background min-h-screen text-foreground">
        <main className="mx-auto max-w-2xl px-5 py-20 text-center">
          <h1 className="font-serif text-3xl font-normal mb-2">We couldn’t load your order.</h1>
          <p className="font-sans text-base text-muted mb-6 max-w-sm mx-auto">
            Your payment may still have succeeded — check your order history.
          </p>
          <Link
            href="/buyer/orders"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
          >
            View your orders
          </Link>
        </main>
      </div>
    )
  }

  const sellerLabel = getSellerLabel(order)
  const item = order.items[0]
  const totalDisplay = formatNgnFromSats(order.totalSats)

  return (
    <div className="bg-background min-h-screen text-foreground">
      <main className="mx-auto max-w-2xl px-5 sm:px-6 lg:px-8 py-12 sm:py-20">
        {/* Success ornament */}
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
            <Check className="w-8 h-8 text-success" strokeWidth={3} />
          </div>
        </div>

        <div className="text-center">
          <h1 className="font-serif text-4xl sm:text-5xl font-normal mb-2 leading-tight">
            You just supported {sellerLabel}.
          </h1>
          <p className="font-sans text-base text-muted mb-10">Your order is on its way.</p>
        </div>

        {/* Order summary card */}
        <div className="bg-white border border-border rounded-lg p-6 mb-8">
          {item && (
            <div className="flex gap-4 mb-6">
              {item.productImage && (
                <img
                  src={item.productImage}
                  alt={item.productTitle}
                  className="w-16 h-16 rounded object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-serif text-lg font-medium truncate">{item.productTitle}</p>
                <p className="font-sans text-sm text-muted">by {sellerLabel}</p>
                <p className="font-serif text-lg text-accent mt-2 tabular-nums">
                  {totalDisplay}
                </p>
              </div>
            </div>
          )}

          <div className="border-t border-border pt-4 font-sans text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted">Order ID</span>
              <div className="flex items-center gap-2">
                <code className="text-foreground tabular-nums break-all">{order.id}</code>
                <button
                  onClick={handleCopyOrderId}
                  className="text-accent hover:text-primary transition-colors shrink-0"
                  aria-label="Copy order ID"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <Link
            href={`/buyer/orders/${order.id}`}
            className="block w-full text-center bg-primary text-primary-foreground py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
          >
            Track your order
          </Link>
          <Link
            href="/marketplace"
            className="block w-full text-center text-primary font-sans font-medium hover:text-primary/80 transition-colors py-3"
          >
            Keep browsing
          </Link>
        </div>
      </main>
    </div>
  )
}

export default function CheckoutSuccessPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  return (
    <Suspense fallback={<div className="bg-background min-h-screen" />}>
      <SuccessPageContent params={params} />
    </Suspense>
  )
}
