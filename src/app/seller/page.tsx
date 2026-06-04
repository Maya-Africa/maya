'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'

import { logout } from '@/lib/api/auth'
import {
  getWalletBalance,
  listOrders,
  markOrderShipped,
  type WalletBalance,
} from '@/lib/api/commerce'
import { listProducts } from '@/lib/api/products'
import { useSession } from '@/lib/auth/use-session'
import { clearSecretKey } from '@/lib/auth/storage'
import { useSessionStore } from '@/store/session-store'
import type { Order, OrderStatus, Product } from '@/types/shared'
import { VerifiedSellerBadge } from '@/components/seller/verified-seller-badge'

// Mirror the server's demo BTC/NGN rate for client-side sats → ₦ conversions
// (order totals, total-earned aggregate). Kept in sync with the rest of the
// app — see NGN_PER_BTC in /seller/products/new and /products/[id].
const NGN_PER_BTC = 145_000_000n
const SATS_PER_BTC = 100_000_000n

interface DashboardProduct {
  id: string
  title: string
  image: string
  priceDisplay: string // pre-formatted "₦25,000" from the backend
}

function toDashboardProduct(p: Product): DashboardProduct {
  return {
    id: p.id,
    title: p.title,
    image: p.images[0] ?? '',
    priceDisplay: p.priceNgnDisplay || '₦0',
  }
}

// Recent-orders viewmodel — adapts the wire-format Order to what the
// dashboard JSX consumes (single-item display, formatted totals, etc.).
interface SellerOrderVm {
  id: string
  product: string         // first item's title; quantity > 1 is rare in v1
  buyer: string           // pseudonymous label like "Buyer · abc1"
  totalDisplay: string    // "₦25,000"
  paidRelative: string    // "6h ago"
  shippedRelative?: string
  deliveredRelative?: string
  status: OrderStatus
}

function satsToNairaNumber(satsStr: string): number {
  try {
    const sats = BigInt(satsStr)
    const ngn = (sats * NGN_PER_BTC) / SATS_PER_BTC
    return Number(ngn)
  } catch {
    return 0
  }
}

function formatNgn(n: number): string {
  return `₦${n.toLocaleString('en-NG')}`
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

function toSellerOrderVm(o: Order): SellerOrderVm {
  const firstItem = o.items[0]
  return {
    id: o.id,
    product: firstItem?.productTitle ?? '(item)',
    // Buyer is pseudonymous to the seller. Last 4 chars of npub gives a
    // stable, distinguishable handle per buyer without leaking identity.
    buyer: `Buyer · ${o.buyerNpub.slice(-4)}`,
    totalDisplay: formatNgn(satsToNairaNumber(o.totalSats)),
    paidRelative: relativeTime(o.paidAt),
    shippedRelative: o.shippedAt ? relativeTime(o.shippedAt) : undefined,
    status: o.status,
  }
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  PAID: { bg: 'bg-primary', text: 'text-primary-foreground', label: 'New sale · Ready to ship' },
  SHIPPED: { bg: 'bg-gold', text: 'text-foreground', label: 'Shipped' },
  DELIVERED: { bg: 'bg-success', text: 'text-primary-foreground', label: 'Delivered' },
  CANCELLED: { bg: 'bg-border', text: 'text-muted', label: 'Cancelled' },
  PENDING: { bg: 'bg-input', text: 'text-muted', label: 'Awaiting payment' },
}

function SellerPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: isSessionLoading } = useSession()
  const setUser = useSessionStore(s => s.setUser)

  // Auth guard: kick unauthenticated visitors out once hydration settles.
  useEffect(() => {
    if (!isSessionLoading && !user) {
      router.push('/signin')
    }
  }, [isSessionLoading, user, router])

  // Loading covers session hydration AND a ?loading=1 design-time toggle.
  // Wallet / orders / products skeletons gate on this single flag plus
  // their own fetch states below.
  const isLoading = isSessionLoading || searchParams.get('loading') === '1'

  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [shippingConfirm, setShippingConfirm] = useState<string | null>(null)
  // Tracks optimistic status flips for the in-page "Mark as shipped"
  // quick-action. Populated from fetched orders below.
  const [orderStatuses, setOrderStatuses] = useState<Record<string, OrderStatus>>({})
  const [shipError, setShipError] = useState<string | null>(null)

  // Seller's product catalog — capped at 4 for the dashboard preview;
  // total count comes from the API response so "N products listed" stays
  // accurate even when the grid is truncated.
  const [fetchedProducts, setFetchedProducts] = useState<DashboardProduct[]>([])
  const [productTotal, setProductTotal] = useState(0)
  const [isProductsLoading, setIsProductsLoading] = useState(true)

  // Wallet balance from GET /api/wallet/balance.
  const [wallet, setWallet] = useState<WalletBalance | null>(null)
  const [isWalletLoading, setIsWalletLoading] = useState(true)

  // Orders from GET /api/orders (seller's sales).
  const [fetchedOrders, setFetchedOrders] = useState<Order[]>([])
  const [isOrdersLoading, setIsOrdersLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    setIsProductsLoading(true)
    listProducts({ sellerId: user.id, pageSize: 4 })
      .then(res => {
        if (cancelled) return
        setFetchedProducts(res.items.map(toDashboardProduct))
        setProductTotal(res.total)
      })
      .catch(err => {
        if (cancelled) return
        // Soft failure: keep the empty state, log for diagnosis. No user-
        // facing error pill on the dashboard since the rest of the page
        // still renders.
        console.warn('Failed to load seller products', err)
        setFetchedProducts([])
        setProductTotal(0)
      })
      .finally(() => {
        if (!cancelled) setIsProductsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  // Wallet balance — sellers only. Endpoint 403s for buyers; we don't
  // surface that since the auth guard already redirects non-sellers.
  useEffect(() => {
    if (!user || user.role !== 'SELLER') return
    let cancelled = false
    setIsWalletLoading(true)
    getWalletBalance()
      .then(res => {
        if (!cancelled) setWallet(res)
      })
      .catch(err => {
        if (cancelled) return
        console.warn('Failed to load wallet balance', err)
        setWallet(null)
      })
      .finally(() => {
        if (!cancelled) setIsWalletLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  // Orders — pull a wide page so totalSales / totalEarned can aggregate
  // accurately for any seller with <50 lifetime sales (true on demo day).
  // High-volume sellers would need a dedicated aggregate endpoint.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setIsOrdersLoading(true)
    listOrders({ pageSize: 50 })
      .then(res => {
        if (cancelled) return
        setFetchedOrders(res.items)
        setOrderStatuses(
          res.items.reduce<Record<string, OrderStatus>>((acc, o) => {
            acc[o.id] = o.status
            return acc
          }, {}),
        )
      })
      .catch(err => {
        if (cancelled) return
        console.warn('Failed to load orders', err)
        setFetchedOrders([])
        setOrderStatuses({})
      })
      .finally(() => {
        if (!cancelled) setIsOrdersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])
  // Banner stays unless the user manually dismisses it. Session-scoped
  // (no server-side "I dismissed this forever" persistence yet).
  const [profileBannerDismissed, setProfileBannerDismissed] = useState(false)
  // "Complete" matches the banner's own ask: "Add a photo and a sentence
  // about your work" — i.e., avatar + about. Location is an optional
  // bonus, not part of the completeness threshold.
  const isProfileComplete = !!(user?.avatar && user?.about?.trim())
  const profileBannerVisible = !profileBannerDismissed && !isProfileComplete

  // Identity values derived from the session user.
  const displayName = user?.displayName ?? user?.username ?? ''
  const initials = (displayName.trim()[0] ?? '').toUpperCase()
  const username = user?.username ?? ''
  const shopUrl = username ? `maya.com/shop/${username}` : ''
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  // Wallet display values. balanceNgn is pre-formatted ("₦12,345") so we
  // render it directly; balanceSats is a bigint-string that we just
  // number-format for the secondary line.
  const balanceNgnDisplay = wallet?.balanceNgn ?? '₦0'
  const balanceSatsDisplay = (() => {
    try {
      return Number(BigInt(wallet?.balanceSats ?? '0')).toLocaleString('en-NG')
    } catch {
      return '0'
    }
  })()
  // 0 balance state still drives the disabled-withdraw branch in the JSX.
  const hasBalance = (() => {
    try {
      return BigInt(wallet?.balanceSats ?? '0') > 0n
    } catch {
      return false
    }
  })()

  // Aggregate stats from the fetched orders. Lifetime-accurate when the
  // seller has ≤50 orders; truncated above that until we add a dedicated
  // /api/seller/stats endpoint.
  const completedOrders = useMemo(
    () =>
      fetchedOrders.filter(o => {
        const status = orderStatuses[o.id] ?? o.status
        return status === 'PAID' || status === 'SHIPPED' || status === 'DELIVERED'
      }),
    [fetchedOrders, orderStatuses],
  )
  const totalSales = completedOrders.length
  const totalEarned = useMemo(
    () => completedOrders.reduce((sum, o) => sum + satsToNairaNumber(o.totalSats), 0),
    [completedOrders],
  )

  // Recent orders for the right-hand panel. Cap at 5; "See all" goes to
  // /seller/orders for the full history.
  const orders = useMemo<SellerOrderVm[]>(
    () =>
      fetchedOrders
        .filter(o => (orderStatuses[o.id] ?? o.status) !== 'PENDING')
        .slice(0, 5)
        .map(toSellerOrderVm),
    [fetchedOrders, orderStatuses],
  )

  // Products come from the API directly.
  const products = fetchedProducts

  const handleCopyShopUrl = () => {
    if (!shopUrl) return
    navigator.clipboard.writeText(shopUrl)
    setCopiedText('shop')
    setTimeout(() => setCopiedText(null), 2000)
  }

  const handleMarkAsShipped = async (orderId: string) => {
    // Optimistic flip. If the server rejects, roll back and surface a
    // brief banner so the seller knows it didn't go through.
    const previous = orderStatuses[orderId] ?? 'PAID'
    setOrderStatuses(prev => ({ ...prev, [orderId]: 'SHIPPED' }))
    setShippingConfirm(null)
    setShipError(null)
    try {
      await markOrderShipped(orderId)
    } catch (err) {
      console.warn('Mark as shipped failed', err)
      setOrderStatuses(prev => ({ ...prev, [orderId]: previous }))
      setShipError('Could not mark this order as shipped. Try again.')
    }
  }

  const handleSignOut = async () => {
    // Clear the local nsec cache first — even if the server call fails,
    // the device shouldn't keep the unlocked key around.
    if (user?.npub) {
      try {
        await clearSecretKey(user.npub)
      } catch (err) {
        console.warn('Failed to clear cached secret key', err)
      }
    }
    try {
      await logout()
    } catch (err) {
      console.warn('Server logout call failed', err)
    }
    setUser(null)
    router.push('/')
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* TOP NAVIGATION */}
      <nav className="fixed top-0 z-50 w-full h-16 bg-background/80 backdrop-blur-sm border-b border-border flex items-center">
        <div className="w-full px-5 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Left: Logo */}
          <Link
            href="/"
            className="font-serif text-2xl font-normal hover:opacity-80 transition-opacity"
          >
            Maya
          </Link>

          {/* Right: Avatar + Settings + Sign out */}
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="w-11 h-11 rounded-full flex items-center justify-center font-serif text-lg font-normal hover:opacity-80 transition-opacity"
              style={{ backgroundColor: 'rgba(214, 121, 97, 0.2)', color: '#1F1410' }}
              aria-label="View profile"
            >
              {initials}
            </Link>
            <Link
              href="/seller/settings"
              className="text-sm text-muted hover:text-foreground transition-colors font-sans hidden sm:inline"
            >
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-muted hover:text-foreground transition-colors font-sans"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="pt-20 lg:pt-24">
        <div className="w-full px-5 sm:px-6 lg:px-8 pb-12">
          <div className="max-w-6xl mx-auto">
            {/* SHOP HEADER */}
            <div className="mb-8 lg:mb-12">
              <h1 className="font-serif text-3xl sm:text-4xl font-normal mb-2">
                {displayName}
              </h1>
              <p className="font-sans text-sm sm:text-base text-muted mb-4">
                {totalSales} sales · {productTotal} products listed
                {memberSince && ` · Member since ${memberSince}`}
              </p>

              {/* Shop URL Pill */}
              {username && (
                <div className="inline-flex items-center gap-3 bg-card border border-border px-4 py-2 rounded-full">
                  <Link
                    href={`/shop/${username}`}
                    className="font-sans text-xs sm:text-sm text-foreground tabular-nums hover:text-accent transition-colors"
                  >
                    {shopUrl}
                  </Link>
                  <button
                    onClick={handleCopyShopUrl}
                    className="text-xs sm:text-sm text-accent hover:opacity-80 transition-opacity font-sans font-medium"
                  >
                    {copiedText === 'shop' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}

              {/* Verified Seller — appears once the first sale settles and
                  publishes a kind 30052 event. Silent until then. */}
              {username && (
                <div className="mt-4">
                  <VerifiedSellerBadge username={username} variant="card" />
                </div>
              )}
            </div>

            {/* COMPLETE-YOUR-SHOP BANNER (shown when profile is incomplete) */}
            {profileBannerVisible && (
              <div className="bg-[#F5EFE3] border border-border rounded-lg p-4 sm:p-5 mb-6 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-lg sm:text-xl font-normal text-foreground mb-1">
                    Complete your shop.
                  </h3>
                  <p className="font-sans text-sm text-muted mb-3 sm:max-w-md">
                    Add a photo and a sentence about your work so buyers know who you are.
                  </p>
                  <Link
                    href="/seller/profile?incomplete=1"
                    className="inline-block font-sans text-sm text-accent font-medium hover:opacity-80 transition-opacity"
                  >
                    Complete your shop →
                  </Link>
                </div>
                <button
                  onClick={() => setProfileBannerDismissed(true)}
                  className="text-muted hover:text-foreground transition-colors p-1 -m-1 shrink-0"
                  aria-label="Dismiss"
                >
                  <span className="text-xs font-sans">Dismiss</span>
                </button>
              </div>
            )}

            {/* TWO COLUMN LAYOUT - Mobile stacked, Desktop side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-12">
              {/* LEFT COLUMN - Balance and Stats (60% on desktop) */}
              <div className="lg:col-span-2 space-y-6">
                {/* BALANCE CARD */}
                <div className="bg-card border border-border rounded-lg p-6">
                  {isLoading || isWalletLoading ? (
                    <div aria-busy="true" aria-label="Loading balance">
                      <div className="h-3 w-32 bg-input rounded mb-4 animate-pulse" />
                      <div className="h-14 w-56 bg-input rounded mb-2 animate-pulse" />
                      <div className="h-3 w-32 bg-input rounded mb-1 animate-pulse" />
                      <div className="h-3 w-24 bg-input rounded mb-6 animate-pulse" />
                      <div className="h-12 bg-input rounded animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <p className="font-sans text-xs uppercase tracking-widest text-muted mb-3">
                        Available balance
                      </p>
                      <div className="mb-1">
                        <p className={`font-serif text-5xl sm:text-6xl font-normal tabular-nums ${
                          hasBalance ? 'text-foreground' : 'text-muted'
                        }`}>
                          {balanceNgnDisplay}
                        </p>
                      </div>
                      <p className="font-sans text-sm text-muted mb-1 tabular-nums">
                        ≈ {balanceSatsDisplay} sats
                      </p>
                      <p className="font-sans text-xs text-muted mb-2">
                        {wallet?.rateStale ? 'Rate may be stale' : 'Updated just now'}
                        {' · '}
                        <Link
                          href="/seller/withdraw/history"
                          className="text-accent hover:opacity-80 transition-opacity"
                        >
                          View activity
                        </Link>
                      </p>
                      <p className="font-sans text-xs text-muted mb-6">
                        Held by Maya.{' '}
                        <Link
                          href="/seller/settings"
                          className="text-accent hover:opacity-80 transition-opacity"
                        >
                          Learn more →
                        </Link>
                      </p>
                      {!hasBalance ? (
                        <button
                          type="button"
                          disabled
                          className="block w-full text-center bg-primary text-primary-foreground py-3 px-4 rounded font-sans font-medium opacity-50 cursor-not-allowed"
                        >
                          Withdraw to bank
                        </button>
                      ) : (
                        <Link
                          href="/seller/withdraw"
                          className="block w-full text-center bg-primary text-primary-foreground py-3 px-4 rounded font-sans font-medium hover:opacity-90 transition-opacity"
                        >
                          Withdraw to bank
                        </Link>
                      )}
                    </>
                  )}
                </div>

                {/* STATS ROW */}
                <div className="grid grid-cols-2 gap-4">
                  {isLoading || isOrdersLoading ? (
                    <>
                      {[0, 1].map(i => (
                        <div key={i} className="bg-card border border-border rounded-lg p-4" aria-busy="true">
                          <div className="h-3 w-20 bg-input rounded mb-4 animate-pulse" />
                          <div className="h-10 w-24 bg-input rounded animate-pulse" />
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <div className="bg-card border border-border rounded-lg p-4">
                        <p className="font-sans text-xs uppercase tracking-widest text-muted mb-3">
                          Total sales
                        </p>
                        <p className={`font-serif text-4xl sm:text-5xl font-normal ${
                          totalSales === 0 ? 'text-muted' : 'text-foreground'
                        }`}>
                          {totalSales}
                        </p>
                      </div>
                      <div className="bg-card border border-border rounded-lg p-4">
                        <p className="font-sans text-xs uppercase tracking-widest text-muted mb-3">
                          Total earned
                        </p>
                        <p className={`font-serif text-2xl sm:text-3xl font-normal tabular-nums ${
                          totalEarned === 0 ? 'text-muted' : 'text-foreground'
                        }`}>
                          ₦{(totalEarned / 1000).toFixed(0)}k
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN - Recent Orders (40% on desktop) */}
              <div className="lg:col-span-1">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-serif text-2xl font-normal">Recent orders</h2>
                  <Link
                    href="/seller/orders"
                    className="text-sm text-accent hover:opacity-80 transition-opacity font-sans"
                  >
                    See all
                  </Link>
                </div>

                {shipError && (
                  <p role="alert" className="font-sans text-sm text-error mb-3">
                    {shipError}
                  </p>
                )}
                <div className="space-y-3">
                  {(isLoading || isOrdersLoading) &&
                    [0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="bg-card border border-border rounded-lg p-4 space-y-3"
                        aria-busy="true"
                      >
                        <div className="flex items-center justify-between">
                          <div className="h-3 w-24 bg-input rounded animate-pulse" />
                          <div className="h-5 w-28 bg-input rounded-full animate-pulse" />
                        </div>
                        <div className="h-4 w-3/4 bg-input rounded animate-pulse" />
                        <div className="h-3 w-1/2 bg-input rounded animate-pulse" />
                        <div className="h-4 w-1/3 bg-input rounded animate-pulse" />
                      </div>
                    ))}
                  {!isLoading && !isOrdersLoading && orders.length === 0 && (
                    <div className="bg-card border border-border rounded-lg p-6 text-center">
                      <div
                        className="w-12 h-12 rounded-full border-2 mx-auto mb-4"
                        style={{ borderColor: '#E8B43D' }}
                        aria-hidden="true"
                      />
                      <p className="font-serif text-lg font-normal mb-2">No orders yet.</p>
                      <p className="font-sans text-sm text-muted mb-4">
                        Share your shop link to make your first sale.
                      </p>
                      <button
                        type="button"
                        onClick={handleCopyShopUrl}
                        className="font-sans text-sm text-accent hover:opacity-80 transition-opacity font-medium"
                      >
                        {copiedText === 'shop' ? 'Copied' : 'Copy shop link'}
                      </button>
                    </div>
                  )}
                  {!isLoading && !isOrdersLoading && orders.map(order => {
                    const status = orderStatuses[order.id] ?? order.status
                    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING!

                    return (
                      <div key={order.id} className="bg-card border border-border rounded-lg overflow-hidden">
                        <Link
                          href={`/seller/orders/${order.id}`}
                          className="block p-4 space-y-3 hover:bg-input/30 transition-colors"
                        >
                          {/* Status Pill */}
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted font-sans tabular-nums">
                              {order.id}
                            </p>
                            <div className={`${config.bg} ${config.text} text-xs px-3 py-1 rounded-full font-sans font-medium`}>
                              {config.label}
                            </div>
                          </div>

                          {/* Order Info */}
                          <div>
                            <p className="font-serif text-sm font-normal text-foreground">
                              {order.product}
                            </p>
                            <p className="font-sans text-xs text-accent">
                              Sold to {order.buyer}
                            </p>
                            <p className="font-sans text-sm text-foreground tabular-nums">
                              {order.totalDisplay}
                            </p>
                          </div>

                          {/* Date Info */}
                          <p className="font-sans text-xs text-muted">
                            {order.paidRelative}
                          </p>
                        </Link>

                        {/* Mark as Shipped - Only for PAID orders */}
                        {status === 'PAID' && !shippingConfirm?.includes(order.id) && (
                          <div className="border-t border-border px-4 py-3">
                            <button
                              onClick={() => setShippingConfirm(order.id)}
                              className="w-full bg-primary text-primary-foreground py-2 px-3 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity"
                            >
                              Mark as shipped
                            </button>
                          </div>
                        )}

                        {/* Confirmation State */}
                        {shippingConfirm === order.id && (
                          <div className="border-t border-border bg-[#F5EFE3] px-4 py-3">
                            <p className="font-sans text-sm text-foreground mb-3">
                              Mark this order as shipped to {order.buyer}? They&apos;ll see the status update.
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleMarkAsShipped(order.id)}
                                className="flex-1 bg-primary text-primary-foreground py-2 px-3 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setShippingConfirm(null)}
                                className="flex-1 bg-transparent text-foreground py-2 px-3 rounded font-sans text-sm font-medium hover:bg-border transition-colors"
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
              </div>
            </div>

            {/* YOUR PRODUCTS SECTION */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-serif text-2xl font-normal">Your products</h2>
                <Link
                  href="/seller/products/new"
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity h-10"
                >
                  <Plus size={16} />
                  Add product
                </Link>
              </div>

              {isLoading || isProductsLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} aria-busy="true">
                      <div className="aspect-square rounded-lg mb-2 bg-input animate-pulse" />
                      <div className="h-3 w-3/4 bg-input rounded mb-1 animate-pulse" />
                      <div className="h-3 w-1/2 bg-input rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="bg-white border border-dashed border-border rounded-lg p-8 text-center mb-6">
                  <p className="font-serif text-2xl font-normal mb-2">Add your first piece.</p>
                  <p className="font-sans text-sm text-muted mb-5 max-w-sm mx-auto">
                    It takes 5 minutes. Photos, price, description, done.
                  </p>
                  <Link
                    href="/seller/products/new"
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-3 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    <Plus size={16} />
                    Add product
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {products.map(product => (
                    <Link
                      key={product.id}
                      href={`/seller/products/${product.id}/edit`}
                      className="group block text-left hover:opacity-80 transition-opacity"
                    >
                      <div className="aspect-square rounded-lg overflow-hidden mb-2 bg-muted">
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <h3 className="font-serif text-sm font-normal text-foreground line-clamp-1">
                        {product.title}
                      </h3>
                      <p className="font-sans text-xs text-muted tabular-nums">
                        {product.priceDisplay}
                      </p>
                    </Link>
                  ))}
                </div>
              )}

              {products.length > 0 && (
                <div className="text-center">
                  <Link
                    href="/seller/products"
                    className="font-sans text-sm text-accent hover:opacity-80 transition-opacity"
                  >
                    See all {productTotal} {productTotal === 1 ? 'product' : 'products'}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function SellerPage() {
  return (
    <Suspense fallback={<div className="bg-background min-h-screen" />}>
      <SellerPageContent />
    </Suspense>
  )
}
