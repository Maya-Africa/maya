'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp, Copy, Loader2, Settings, X } from 'lucide-react'

import { useSession } from '@/lib/auth/use-session'
import { useSessionStore } from '@/store/session-store'
import { listOrders } from '@/lib/api/commerce'
import { logout } from '@/lib/api/auth'
import { ApiError } from '@/lib/api-error'
import type { Order, OrderStatus } from '@/types/shared'

const NGN_PER_BTC = 145_000_000n
const SATS_PER_BTC = 100_000_000n

function formatNgn(satsStr: string): string {
  try {
    const sats = BigInt(satsStr)
    const ngn = (sats * NGN_PER_BTC) / SATS_PER_BTC
    return `₦${Number(ngn).toLocaleString('en-NG')}`
  } catch {
    return '₦0'
  }
}

function getInitials(name: string | null, username: string): string {
  const src = name ?? username
  return src
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_CONFIG: Record<OrderStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: 'bg-input', text: 'text-muted', label: 'Awaiting payment' },
  PAID: { bg: 'bg-primary', text: 'text-primary-foreground', label: 'Paid · Awaiting shipment' },
  SHIPPED: { bg: 'bg-gold', text: 'text-foreground', label: 'Shipped' },
  DELIVERED: { bg: 'bg-success', text: 'text-primary-foreground', label: 'Delivered' },
  CANCELLED: { bg: 'bg-border', text: 'text-muted', label: 'Cancelled' },
}

function ProfilePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: isSessionLoading } = useSession()
  const storeLogout = useSessionStore(s => s.logout)

  const [orders, setOrders] = useState<Order[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [pwaBannerVisible, setPwaBannerVisible] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isSessionLoading && !user) router.push('/signin')
  }, [isSessionLoading, user, router])

  // Fetch real orders
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setIsFetching(true)
    setFetchError(false)
    listOrders({ page: 1, pageSize: 50 })
      .then(res => { if (!cancelled) setOrders(res.items) })
      .catch(err => {
        if (cancelled) return
        if (err instanceof ApiError && err.statusCode === 401) { router.push('/signin'); return }
        setFetchError(true)
      })
      .finally(() => { if (!cancelled) setIsFetching(false) })
    return () => { cancelled = true }
  }, [user, router])

  const handleCopyOrderId = (orderId: string) => {
    navigator.clipboard.writeText(orderId)
    setCopiedId(orderId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await logout()
    } catch {
      // best-effort
    } finally {
      storeLogout()
      router.push('/')
    }
  }

  // Design-time preview toggles
  const isLoading = searchParams.get('loading') === '1' || isSessionLoading || isFetching
  const hasError = searchParams.get('error') === '1' || fetchError

  const initials = user ? getInitials(user.displayName, user.username) : ''
  const displayName = user?.displayName ?? user?.username ?? ''

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* TOP NAVIGATION */}
      <nav className="fixed top-0 z-50 w-full h-16 bg-background/80 backdrop-blur-sm border-b border-border flex items-center">
        <div className="w-full px-5 sm:px-6 lg:px-8 flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl font-normal hover:opacity-80 transition-opacity">
            Maya
          </Link>
          <div className="flex items-center gap-3">
            {user?.avatar ? (
              <img src={user.avatar} alt={displayName} className="w-11 h-11 rounded-full object-cover" />
            ) : (
              <div className="w-11 h-11 rounded-full flex items-center justify-center font-serif text-lg font-normal" style={{ backgroundColor: 'rgba(214, 121, 97, 0.2)', color: '#1F1410' }}>
                {initials}
              </div>
            )}
            <Link href="/buyer/settings" className="text-sm text-muted hover:text-foreground transition-colors font-sans hidden sm:inline">
              Settings
            </Link>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="text-sm text-muted hover:text-foreground transition-colors font-sans disabled:opacity-50"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </nav>

      {/* PWA BANNER */}
      {pwaBannerVisible && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-[#F5EFE3] px-5 sm:px-6 lg:px-8 py-3 border-b border-border/50">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-sm">📱</span>
              <p className="font-sans text-sm text-foreground">Install Maya on your phone for faster checkout.</p>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setPwaBannerVisible(false)} className="text-sm font-sans text-muted hover:text-foreground transition-colors">
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`pt-16 ${pwaBannerVisible ? 'lg:pt-28' : 'lg:pt-20'}`}>
        <div className="w-full px-5 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto">

            {/* PROFILE HEADER CARD */}
            <div className="mt-8 bg-white rounded-lg border border-border p-5 flex items-center gap-4 relative">
              {user?.avatar ? (
                <img src={user.avatar} alt={displayName} className="w-16 h-16 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 font-serif text-2xl font-normal" style={{ backgroundColor: 'rgba(214, 121, 97, 0.2)', color: '#1F1410' }}>
                  {initials}
                </div>
              )}
              <div className="flex-1">
                <h1 className="font-serif text-2xl font-normal">{displayName}</h1>
                <p className="font-sans text-sm text-muted">
                  {user ? `Member since ${memberSince(user.createdAt)}` : ''}
                </p>
              </div>
              <Link href="/buyer/settings" aria-label="Settings">
                <Settings className="w-4 h-4 text-muted shrink-0" />
              </Link>
            </div>

            {/* ORDERS SECTION */}
            <div className="mt-8 pb-24">
              <h2 className="font-serif text-3xl font-normal mb-1">Your orders</h2>
              <p className="font-sans text-sm text-muted mb-4">
                {isLoading ? 'Loading…' : hasError ? "Couldn't load your orders." : `${orders.length} order${orders.length !== 1 ? 's' : ''}`}
              </p>

              {isLoading ? (
                <div className="space-y-3" aria-busy="true">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="bg-white rounded-lg border border-border p-4 space-y-3 animate-pulse">
                      <div className="flex justify-end"><div className="h-5 w-32 bg-input rounded-full" /></div>
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded bg-input shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 bg-input rounded" />
                          <div className="h-3 w-1/2 bg-input rounded" />
                          <div className="h-4 w-1/3 bg-input rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : hasError ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <h3 className="font-serif text-2xl font-normal mb-2">Connection issue.</h3>
                  <p className="font-sans text-base text-muted mb-6 max-w-sm">We couldn&apos;t load your orders. Check your connection and try again.</p>
                  <Link href="/profile" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity">
                    <Loader2 className="w-4 h-4" /> Try again
                  </Link>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center">
                  <h3 className="font-serif text-3xl font-normal mb-2">No orders yet</h3>
                  <p className="font-sans text-base text-muted mb-6">Your first purchase is one tap away.</p>
                  <Link href="/marketplace" className="bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity">
                    Browse the marketplace
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map(order => {
                    const isExpanded = expandedOrder === order.id
                    const config = STATUS_CONFIG[order.status]!
                    const firstItem = order.items[0]
                    const productTitle = firstItem?.productTitle ?? '(item)'
                    const productImage = firstItem?.productImage ?? ''
                    const dateRef = order.status === 'CANCELLED' ? order.createdAt : (order.paidAt ?? order.createdAt)

                    return (
                      <div key={order.id} className="bg-white rounded-lg border border-border overflow-hidden transition-all">
                        <button
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                          className="w-full p-4 text-left hover:bg-[#FAFAF8] transition-colors"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div />
                            <div className={`${config.bg} ${config.text} rounded-full px-3 py-1 font-sans text-xs font-medium`}>
                              {config.label}
                            </div>
                          </div>
                          <div className="flex gap-3 mb-3">
                            {productImage ? (
                              <img src={productImage} alt={productTitle} className="w-16 h-16 rounded object-cover shrink-0" />
                            ) : (
                              <div className="w-16 h-16 rounded bg-input shrink-0" />
                            )}
                            <div className="flex-1">
                              <h3 className="font-serif text-lg font-normal">{productTitle}</h3>
                              <p className="font-sans text-base font-medium mt-1 tabular-nums">{formatNgn(order.totalSats)}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-border/30">
                            <p className="font-sans text-xs text-muted tabular-nums">{order.id}</p>
                            <div className="flex items-center gap-1 text-muted">
                              <p className="font-sans text-xs">{relativeTime(dateRef)}</p>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-gold px-4 py-4 bg-[#FFFBF7] space-y-4">
                            <div>
                              <h4 className="font-serif text-base font-normal mb-3">Order timeline</h4>
                              <div className="space-y-2 text-sm font-sans">
                                {order.paidAt && (
                                  <div className="flex gap-3">
                                    <div className="w-3 h-3 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <p className="text-foreground font-medium">Paid · {formatDate(order.paidAt)}</p>
                                  </div>
                                )}
                                {(order.status === 'SHIPPED' || order.status === 'DELIVERED') && order.shippedAt && (
                                  <div className="flex gap-3">
                                    <div className="w-3 h-3 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <p className="text-foreground font-medium">Shipped · {formatDate(order.shippedAt)}</p>
                                  </div>
                                )}
                                {order.status === 'DELIVERED' && (
                                  <div className="flex gap-3">
                                    <div className="w-3 h-3 rounded-full bg-success mt-1.5 shrink-0" />
                                    <p className="text-foreground font-medium">Delivered</p>
                                  </div>
                                )}
                                {order.status === 'CANCELLED' && (
                                  <div className="flex gap-3">
                                    <div className="w-3 h-3 mt-1.5 shrink-0 flex items-center justify-center">
                                      <X className="w-2.5 h-2.5 text-muted" />
                                    </div>
                                    <p className="text-muted font-medium">Cancelled · {formatDate(order.createdAt)}</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="bg-white rounded p-3 flex items-center justify-between">
                              <div>
                                <p className="font-sans text-xs text-muted mb-1">Order reference</p>
                                <p className="font-sans text-sm font-medium tabular-nums">{order.id}</p>
                              </div>
                              <button
                                onClick={() => handleCopyOrderId(order.id)}
                                className="text-xs text-accent hover:text-primary transition-colors font-sans font-medium flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" />
                                {copiedId === order.id ? 'Copied' : 'Copy'}
                              </button>
                            </div>

                            <Link
                              href={`/buyer/orders/${encodeURIComponent(order.id)}`}
                              className="block w-full text-center bg-primary text-primary-foreground py-2.5 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity"
                            >
                              View full order
                            </Link>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="bg-background min-h-screen" />}>
      <ProfilePageContent />
    </Suspense>
  )
}
