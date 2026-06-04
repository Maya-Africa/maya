'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import BrowseHeader from '@/components/browse-header'
import CategoryPills from '@/components/category-pills'
import ProductCard from '@/components/product-card'
import BottomNavigation from '@/components/bottom-navigation'

import { ApiError } from '@/lib/api-error'
import { listProducts } from '@/lib/api/products'
import type { Product as ApiProduct, ProductCategory } from '@/types/shared'

// Mirror the server's demo BTC/NGN rate so we can parse priceNgnDisplay
// or fall back to sats-based conversion. Same constants as elsewhere.
const NGN_PER_BTC = 145_000_000n
const SATS_PER_BTC = 100_000_000n

interface CardProduct {
  id: string
  image: string
  title: string
  priceNaira: number
  priceSats: number
}

// "₦25,000" → 25000. Fallback computes from priceSats if the formatted
// string is missing or unparseable.
function parseNgnDisplay(formatted: string, satsStr: string): number {
  const digits = formatted.replace(/[^\d]/g, '')
  if (digits) {
    const n = parseInt(digits, 10)
    if (Number.isFinite(n)) return n
  }
  try {
    const sats = BigInt(satsStr)
    return Number((sats * NGN_PER_BTC) / SATS_PER_BTC)
  } catch {
    return 0
  }
}

function parseSatsNumber(satsStr: string): number {
  try {
    return Number(BigInt(satsStr))
  } catch {
    return 0
  }
}

function toCardProduct(p: ApiProduct): CardProduct {
  return {
    id: p.id,
    image: p.images[0] ?? '',
    title: p.title,
    priceNaira: parseNgnDisplay(p.priceNgnDisplay ?? '', p.priceSats),
    priceSats: parseSatsNumber(p.priceSats),
  }
}

function BrowsePageContent() {
  const searchParams = useSearchParams()
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | null>(null)

  const [products, setProducts] = useState<CardProduct[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  // Design-time toggles still work for previewing the empty / loading /
  // error skins alongside the real fetch states.
  const previewLoading = searchParams.get('loading') === '1'
  const previewEmpty = searchParams.get('empty') === '1'
  const previewError = searchParams.get('error') === '1'

  useEffect(() => {
    let cancelled = false
    setIsFetching(true)
    setFetchError(false)
    listProducts({
      pageSize: 50,
      ...(selectedCategory ? { category: selectedCategory } : {}),
    })
      .then(res => {
        if (cancelled) return
        setProducts(res.items.map(toCardProduct))
      })
      .catch(err => {
        if (cancelled) return
        // ApiError or network — both render the same "Connection issue"
        // page. Don't differentiate to a casual browser.
        console.warn('Marketplace fetch failed', err)
        if (err instanceof ApiError || err instanceof Error) {
          setFetchError(true)
        } else {
          setFetchError(true)
        }
        setProducts([])
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedCategory])

  const isLoading = previewLoading || isFetching
  const hasError = previewError || (!isLoading && fetchError)
  const isEmpty =
    previewEmpty || (!isLoading && !hasError && products.length === 0)

  return (
    <div className="flex flex-col min-h-screen bg-maya-background">
      <BrowseHeader />
      <CategoryPills onCategoryChange={setSelectedCategory} />

      <main className="flex-1 px-5 pt-4 pb-20 bg-maya-background">
        <div className="mx-auto max-w-7xl">
          {/* LOADING */}
          {isLoading && (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
              aria-busy="true"
              aria-label="Loading products"
            >
              {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                <div key={i} className="bg-white rounded-lg overflow-hidden">
                  <div className="aspect-square bg-input animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 w-3/4 bg-input rounded animate-pulse" />
                    <div className="h-5 w-1/2 bg-input rounded animate-pulse" />
                    <div className="h-3 w-1/3 bg-input rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ERROR */}
          {hasError && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div
                className="w-16 h-16 rounded-full border-2 mb-5 flex items-center justify-center"
                style={{ borderColor: '#B85049' }}
                aria-hidden="true"
              >
                <span className="text-error text-2xl">!</span>
              </div>
              <h2 className="font-serif text-3xl font-normal mb-2">Connection issue.</h2>
              <p className="font-sans text-base text-muted mb-6 max-w-sm">
                We couldn&apos;t load the marketplace. Check your connection and try again.
              </p>
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
              >
                <Loader2 className="w-4 h-4" />
                Try again
              </Link>
            </div>
          )}

          {/* EMPTY */}
          {isEmpty && !hasError && !isLoading && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div
                className="w-20 h-20 rounded-full border-2 mb-6"
                style={{ borderColor: '#E8B43D' }}
                aria-hidden="true"
              />
              <h2 className="font-serif text-3xl font-normal mb-2">
                {selectedCategory ? 'Nothing here yet.' : 'Nothing listed yet.'}
              </h2>
              <p className="font-sans text-base text-muted mb-6 max-w-sm">
                {selectedCategory
                  ? "No pieces in this category yet. Try another, or be the first to list one."
                  : 'The marketplace is brand new. Be one of the first sellers to list your work.'}
              </p>
              <Link
                href="/sell"
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
              >
                Open your shop
              </Link>
            </div>
          )}

          {/* POPULATED */}
          {!isLoading && !hasError && !isEmpty && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map(product => (
                <Link key={product.id} href={`/products/${product.id}`}>
                  <ProductCard
                    image={product.image}
                    title={product.title}
                    priceNaira={product.priceNaira}
                    priceSats={product.priceSats}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNavigation />
    </div>
  )
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="bg-maya-background min-h-screen" />}>
      <BrowsePageContent />
    </Suspense>
  )
}
