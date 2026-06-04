'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronUp, Copy, Loader2, Settings, X } from 'lucide-react'

const BUYER = {
  name: 'Tobi Akinwale',
  initials: 'TA',
  memberSince: 'May 2026',
}

interface Order {
  id: string
  product: {
    title: string
    artist: string
    image: string
  }
  total: number
  paidDate: string | null
  paidRelative?: string
  shippedDate?: string | null
  shippedRelative?: string
  deliveredDate?: string | null
  deliveredRelative?: string
  cancelledDate?: string | null
  cancelledRelative?: string
  status: 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
}

const ORDERS: Order[] = [
  {
    id: 'BTS-7K3M-9P2X',
    product: {
      title: 'Indigo Dyed Fabric',
      artist: 'Adaeze',
      image: '/artwork-2.jpg',
    },
    total: 28000,
    paidDate: '2026-05-23',
    paidRelative: '2 days ago',
    shippedDate: null,
    deliveredDate: null,
    cancelledDate: null,
    status: 'PAID',
  },
  {
    id: 'BTS-4N8R-2W1Y',
    product: {
      title: 'Brass Geometric Pendant',
      artist: 'Ama Mensah',
      image: '/artwork-6.jpg',
    },
    total: 48500,
    paidDate: '2026-05-20',
    paidRelative: '5 days ago',
    shippedDate: '2026-05-25',
    shippedRelative: 'yesterday',
    deliveredDate: null,
    cancelledDate: null,
    status: 'SHIPPED',
  },
  {
    id: 'BTS-9X2P-5T6Q',
    product: {
      title: 'Hand Thrown Vase',
      artist: 'Fatima Hassan',
      image: '/artwork-3.jpg',
    },
    total: 88000,
    paidDate: '2026-05-11',
    paidRelative: '2 weeks ago',
    shippedDate: '2026-05-18',
    shippedRelative: '1 week ago',
    deliveredDate: '2026-05-25',
    deliveredRelative: '3 days ago',
    cancelledDate: null,
    status: 'DELIVERED',
  },
  {
    id: 'BTS-3F5J-8K2M',
    product: {
      title: 'Tooled Leather Journal',
      artist: 'Zainab Okafor',
      image: '/artwork-5.jpg',
    },
    total: 25000,
    paidDate: null,
    cancelledDate: '2026-04-15',
    cancelledRelative: '1 month ago',
    status: 'CANCELLED',
  },
]

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  PAID: { bg: 'bg-primary', text: 'text-primary-foreground', label: 'Paid · Awaiting shipment' },
  SHIPPED: { bg: 'bg-gold', text: 'text-foreground', label: 'Shipped' },
  DELIVERED: { bg: 'bg-success', text: 'text-primary-foreground', label: 'Delivered' },
  CANCELLED: { bg: 'bg-border', text: 'text-muted', label: 'Cancelled' },
}

function ProfilePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Design-time toggles. Real implementation derives these from SWR /
  // fetch state on a GET /api/orders call.
  const isLoading = searchParams.get('loading') === '1'
  const isEmpty = searchParams.get('empty') === '1'
  const hasError = searchParams.get('error') === '1'
  const orders = isEmpty || hasError ? [] : ORDERS

  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [pwaBannerVisible, setPwaBannerVisible] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyOrderId = (orderId: string) => {
    navigator.clipboard.writeText(orderId)
    setCopiedId(orderId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleInstallPWA = () => {
    // Stub: would trigger actual install prompt in production
    alert('Install prompt would appear here')
  }

  const handleSignOut = () => {
    router.push('/')
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      {/* TOP NAVIGATION */}
      <nav className="fixed top-0 z-50 w-full h-16 bg-background/80 backdrop-blur-sm border-b border-border flex items-center">
        <div className="w-full px-5 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="font-serif text-2xl font-normal hover:opacity-80 transition-opacity">
            Maya
          </Link>

          {/* Right: Avatar + Settings + Sign out */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center font-serif text-lg font-normal" style={{ backgroundColor: 'rgba(214, 121, 97, 0.2)', color: '#1F1410' }}>
              {BUYER.initials}
            </div>
            <Link
              href="/buyer/settings"
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

      {/* PWA BANNER */}
      {pwaBannerVisible && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-[#F5EFE3] px-5 sm:px-6 lg:px-8 py-3 border-b border-border/50">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-5 h-5 flex items-center justify-center text-primary text-sm font-bold">📱</div>
              <p className="font-sans text-sm text-foreground">
                Install Maya on your phone for faster checkout.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleInstallPWA}
                className="text-sm font-sans text-accent hover:opacity-80 transition-opacity whitespace-nowrap"
              >
                Install
              </button>
              <button
                onClick={() => setPwaBannerVisible(false)}
                className="text-sm font-sans text-muted hover:text-foreground transition-colors"
              >
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
              {/* Avatar */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 font-serif text-2xl font-normal"
                style={{ backgroundColor: 'rgba(214, 121, 97, 0.2)', color: '#1F1410' }}
              >
                {BUYER.initials}
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                <h1 className="font-serif text-2xl font-normal">{BUYER.name}</h1>
                <p className="font-sans text-sm text-muted">Member since {BUYER.memberSince}</p>
              </div>

              {/* Edit Icon (affordance only) */}
              <Settings className="w-4 h-4 text-muted shrink-0" />
            </div>

            {/* YOUR ORDERS SECTION */}
            <div className="mt-8">
              <h2 className="font-serif text-3xl font-normal mb-1">Your orders</h2>
              <p className="font-sans text-sm text-muted mb-4">
                {isLoading
                  ? 'Loading…'
                  : hasError
                  ? 'Couldn\'t load your orders.'
                  : `${orders.length} order${orders.length !== 1 ? 's' : ''}`}
              </p>

              {isLoading ? (
                /* LOADING SKELETON */
                <div className="space-y-3" aria-busy="true" aria-label="Loading orders">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="bg-white rounded-lg border border-border p-4 space-y-3"
                    >
                      <div className="flex justify-end">
                        <div className="h-5 w-32 bg-input rounded-full animate-pulse" />
                      </div>
                      <div className="flex gap-3">
                        <div className="w-16 h-16 rounded bg-input animate-pulse shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-3/4 bg-input rounded animate-pulse" />
                          <div className="h-3 w-1/2 bg-input rounded animate-pulse" />
                          <div className="h-4 w-1/3 bg-input rounded animate-pulse" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <div className="h-3 w-24 bg-input rounded animate-pulse" />
                        <div className="h-3 w-16 bg-input rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : hasError ? (
                /* ERROR STATE */
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div
                    className="w-16 h-16 rounded-full border-2 mb-5 flex items-center justify-center"
                    style={{ borderColor: '#B85049' }}
                    aria-hidden="true"
                  >
                    <span className="text-error text-2xl">!</span>
                  </div>
                  <h3 className="font-serif text-2xl font-normal mb-2">Connection issue.</h3>
                  <p className="font-sans text-base text-muted mb-6 max-w-sm">
                    We couldn&apos;t load your orders. Check your connection and try again.
                  </p>
                  <Link
                    href="/profile"
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
                  >
                    <Loader2 className="w-4 h-4" />
                    Try again
                  </Link>
                </div>
              ) : orders.length === 0 ? (
                /* EMPTY STATE */
                <div className="py-20 flex flex-col items-center justify-center">
                  <div
                    className="w-20 h-20 rounded-full border-2 border-gold mb-6"
                    style={{ borderColor: '#E8B43D' }}
                  />
                  <h3 className="font-serif text-3xl font-normal mb-2">No orders yet</h3>
                  <p className="font-sans text-base text-muted mb-6">
                    Your first purchase is one tap away.
                  </p>
                  <Link
                    href="/marketplace"
                    className="bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
                  >
                    Browse the marketplace
                  </Link>
                </div>
              ) : (
                /* ORDER ROWS */
                <div className="space-y-3">
                  {orders.map((order) => {
                    const isExpanded = expandedOrder === order.id
                    const config = STATUS_CONFIG[order.status]!

                    return (
                      <div
                        key={order.id}
                        className="bg-white rounded-lg border border-border overflow-hidden transition-all"
                      >
                        {/* COLLAPSED VIEW */}
                        <button
                          onClick={() =>
                            setExpandedOrder(isExpanded ? null : order.id)
                          }
                          className="w-full p-4 text-left hover:bg-[#FAFAF8] transition-colors"
                        >
                          {/* Top row: Status pill on right */}
                          <div className="flex items-center justify-between mb-3">
                            <div />
                            <div className={`${config.bg} ${config.text} rounded-full px-3 py-1 font-sans text-xs font-medium`}>
                              {config.label}
                            </div>
                          </div>

                          {/* Middle row: Product info */}
                          <div className="flex gap-3 mb-3">
                            <img
                              src={order.product.image}
                              alt={order.product.title}
                              className="w-16 h-16 rounded object-cover shrink-0"
                            />
                            <div className="flex-1">
                              <h3 className="font-serif text-lg font-normal">
                                {order.product.title}
                              </h3>
                              <p className="font-sans text-sm text-accent">
                                by {order.product.artist}
                              </p>
                              <p className="font-sans text-base font-medium mt-1 tabular-nums">
                                ₦{order.total.toLocaleString('en-NG')}
                              </p>
                            </div>
                          </div>

                          {/* Bottom row: Order ref + date */}
                          <div className="flex items-center justify-between pt-2 border-t border-border/30">
                            <p className="font-sans text-xs text-muted tabular-nums">
                              {order.id}
                            </p>
                            <div className="flex items-center gap-1 text-muted">
                              <p className="font-sans text-xs">
                                {order.status === 'CANCELLED'
                                  ? order.cancelledRelative
                                  : order.paidRelative}
                              </p>
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </div>
                        </button>

                        {/* EXPANDED VIEW */}
                        {isExpanded && (
                          <div className="border-t border-gold px-4 py-4 bg-[#FFFBF7] space-y-4">
                            {/* Timeline */}
                            <div>
                              <h4 className="font-serif text-base font-normal mb-3">
                                Order timeline
                              </h4>
                              <div className="space-y-2 text-sm font-sans">
                                {/* Paid */}
                                {order.paidDate && (
                                  <div className="flex gap-3">
                                    <div className="w-3 h-3 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <div>
                                      <p className="text-foreground font-medium">
                                        Paid · {new Date(order.paidDate).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                        })} · 2:14 PM
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Shipped (if applicable) */}
                                {(order.status === 'SHIPPED' || order.status === 'DELIVERED') && order.shippedDate && (
                                  <div className="flex gap-3">
                                    <div className="w-3 h-3 rounded-full bg-primary mt-1.5 shrink-0" />
                                    <div>
                                      <p className="text-foreground font-medium">
                                        Shipped · {new Date(order.shippedDate).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                        })}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Delivered (if applicable) */}
                                {order.status === 'DELIVERED' && order.deliveredDate && (
                                  <div className="flex gap-3">
                                    <div className="w-3 h-3 rounded-full bg-success mt-1.5 shrink-0" />
                                    <div>
                                      <p className="text-foreground font-medium">
                                        Delivered · {new Date(order.deliveredDate).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                        })}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Cancelled (if applicable) */}
                                {order.status === 'CANCELLED' && order.cancelledDate && (
                                  <div className="flex gap-3">
                                    <div className="w-3 h-3 mt-1.5 shrink-0 flex items-center justify-center">
                                      <X className="w-2.5 h-2.5 text-muted" />
                                    </div>
                                    <div>
                                      <p className="text-muted font-medium">
                                        Cancelled · {new Date(order.cancelledDate).toLocaleDateString('en-US', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                        })}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Order Reference */}
                            <div className="bg-white rounded p-3 flex items-center justify-between">
                              <div>
                                <p className="font-sans text-xs text-muted mb-1">Order reference</p>
                                <p className="font-sans text-sm font-medium tabular-nums">
                                  {order.id}
                                </p>
                              </div>
                              <button
                                onClick={() => handleCopyOrderId(order.id)}
                                className="text-xs text-accent hover:text-primary transition-colors font-sans font-medium flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" />
                                {copiedId === order.id ? 'Copied' : 'Copy'}
                              </button>
                            </div>

                            {/* View full order */}
                            <Link
                              href={`/buyer/orders/${order.id}`}
                              className="block w-full text-center bg-primary text-primary-foreground py-2.5 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity"
                            >
                              View full order
                            </Link>

                            {/* Help Text */}
                            <p className="font-sans text-xs text-muted">
                              Need help with this order?{' '}
                              <button className="text-accent hover:text-primary transition-colors">
                                Contact the seller
                              </button>
                              .
                            </p>
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
