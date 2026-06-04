'use client'

import { useEffect, useState } from 'react'

import { ApiError } from '@/lib/api-error'
import { getSellerBadge, type SellerBadgeResponse } from '@/lib/api/products'

interface Props {
  /** Seller's URL slug — passed to GET /api/shop/<username>/badge. */
  username: string
  /**
   * Visual variant.
   * - 'chip': inline "✓ Verified Seller · N sales since <date>" line. Used on the storefront.
   * - 'card': framed "Your Nostr presence" card. Used on the seller's own dashboard.
   */
  variant?: 'chip' | 'card'
}

function formatSince(firstSaleAtSeconds: number): string {
  if (!firstSaleAtSeconds || Number.isNaN(firstSaleAtSeconds)) return ''
  const ms = firstSaleAtSeconds * 1000
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function VerifiedSellerBadge({ username, variant = 'chip' }: Props) {
  const [badge, setBadge] = useState<SellerBadgeResponse | null>(null)
  const [isFetching, setIsFetching] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsFetching(true)
    getSellerBadge(username)
      .then(res => {
        if (!cancelled) setBadge(res)
      })
      .catch(err => {
        if (cancelled) return
        // 404 means the seller has no completed sales yet — silent skip.
        // Any other error is also treated as "no badge" so we never crash
        // the parent page over a non-critical fetch.
        if (err instanceof ApiError && err.statusCode === 404) {
          setBadge(null)
        } else {
          console.warn('[verified-seller-badge] fetch failed:', err)
          setBadge(null)
        }
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false)
      })
    return () => {
      cancelled = true
    }
  }, [username])

  // While fetching the chip variant, render nothing (avoid layout shift on
  // the storefront hero). The card variant is allowed to be absent until
  // the response lands — dashboard tolerates the small reflow.
  if (isFetching || !badge) return null

  const since = formatSince(badge.firstSaleAt)
  const salesLabel = `${badge.totalSales} ${badge.totalSales === 1 ? 'sale' : 'sales'}`

  if (variant === 'card') {
    return (
      <section className="bg-white border border-border rounded-lg p-4 space-y-2">
        <p className="font-sans text-xs text-muted uppercase tracking-widest">
          Your Nostr presence
        </p>
        <p className="font-sans text-sm text-success font-medium">
          ✓ Verified Seller · {salesLabel}{since ? ` since ${since}` : ''}
        </p>
        <p className="font-sans text-xs text-muted">
          A kind 30052 event is published to public relays each time you
          complete a sale, so your reputation is portable and verifiable
          outside Maya.
        </p>
      </section>
    )
  }

  return (
    <p className="font-sans text-sm text-success font-medium mb-2">
      ✓ Verified Seller · {salesLabel}{since ? ` since ${since}` : ''}
    </p>
  )
}
