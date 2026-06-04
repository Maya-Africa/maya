'use client'

import { Suspense, use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, Copy, Flame, X } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import { createOrder } from '@/lib/api/commerce'
import { getProduct } from '@/lib/api/products'
import { useSession } from '@/lib/auth/use-session'
import type { Product, ProductCategory } from '@/types/shared'

// Server uses ₦145M per BTC for the demo rate. Mirror it here so the
// shipping NGN we compute matches what `satsToNgn` produces server-side.
// (priceNgnDisplay already arrives pre-formatted; shipping does not.)
const NGN_PER_BTC = 145_000_000
const SATS_PER_BTC = 100_000_000

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  paintings: 'Paintings',
  jewelry: 'Jewelry',
  textiles: 'Textiles',
  leather: 'Leather',
  pottery: 'Pottery',
  sculpture: 'Sculpture',
  prints_digital: 'Prints & Digital',
  other: 'Other',
}

function satsToNgnFormatted(satsStr: string): string {
  try {
    const sats = BigInt(satsStr)
    const ngn = (sats * BigInt(NGN_PER_BTC)) / BigInt(SATS_PER_BTC)
    return `₦${Number(ngn).toLocaleString('en-NG')}`
  } catch {
    return '₦0'
  }
}

function formatSatsCount(satsStr: string): string {
  try {
    return Number(BigInt(satsStr)).toLocaleString('en-NG')
  } catch {
    return '0'
  }
}

function ProductPageContent({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { id } = use(params)
  const { user } = useSession()

  // Real fetch state.
  const [product, setProduct] = useState<Product | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  // 'not-found' = 404 from server; 'load-failed' = network / 5xx; null = OK.
  const [fetchError, setFetchError] = useState<'not-found' | 'load-failed' | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsFetching(true)
    setFetchError(null)
    getProduct(id)
      .then(res => {
        if (!cancelled) setProduct(res.product)
      })
      .catch(err => {
        if (cancelled) return
        const status =
          err instanceof ApiError ? err.statusCode : 0
        setFetchError(status === 404 ? 'not-found' : 'load-failed')
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isSticky, setIsSticky] = useState(false)
  const [buyButtonRef, setBuyButtonRef] = useState<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // ?justPublished=1 is set by /seller/products/new after a successful
  // publish. Show a one-shot "Your product is live." banner with share
  // URL + Copy + dashboard / list-another CTAs. Dismissible per-session.
  const justPublished = searchParams.get('justPublished') === '1'
  const [bannerVisible, setBannerVisible] = useState(justPublished)
  const [urlCopied, setUrlCopied] = useState(false)

  // Design-time toggles still work for preview alongside the real states.
  const isLoading = isFetching || searchParams.get('loading') === '1'
  const isErrorState =
    fetchError === 'load-failed' || searchParams.get('error') === '1'
  const isNotFound = fetchError === 'not-found'

  const shareUrl = product
    ? typeof window !== 'undefined'
      ? `${window.location.origin}/products/${product.id}`
      : `maya.com/products/${product.id}`
    : ''

  const handleCopyShareUrl = () => {
    if (!shareUrl) return
    navigator.clipboard.writeText(shareUrl)
    setUrlCopied(true)
    setTimeout(() => setUrlCopied(false), 2000)
  }

  // Handle sticky buy bar on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (buyButtonRef) {
        const rect = buyButtonRef.getBoundingClientRect()
        setIsSticky(rect.bottom < 0)
      }
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [buyButtonRef])

  // Buy flow state. `buyError` surfaces server errors (out of stock,
  // network, etc.) inline above the Buy CTA.
  const [isBuying, setIsBuying] = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)

  const handleBuy = async () => {
    if (!product || isBuying) return

    // Auth gate. First-time buyers go to /buyer/signup; returning buyers
    // tap "Already have an account? Sign in" from there. Both flows carry
    // ?buyProductId so the auth pages auto-create the order and route to
    // /checkout once the buyer is authenticated — no second Buy click.
    if (!user) {
      router.push(`/buyer/signup?buyProductId=${encodeURIComponent(product.id)}`)
      return
    }

    setIsBuying(true)
    setBuyError(null)
    try {
      const order = await createOrder({ productId: product.id, quantity: 1 })
      router.push(`/checkout/${order.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'OUT_OF_STOCK') {
        setBuyError('This piece just sold — it’s no longer available.')
      } else if (err instanceof ApiError) {
        setBuyError(err.message || 'Could not create the order. Try again.')
      } else {
        setBuyError('Connection issue. Check your network and try again.')
      }
      setIsBuying(false)
    }
  }

  // Sync the dot indicator with native scroll position. Fires on every
  // scroll frame; we just round to the nearest slide.
  const handleCarouselScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (el.clientWidth === 0) return
    const idx = Math.round(el.scrollLeft / el.clientWidth)
    if (idx !== currentImageIndex) setCurrentImageIndex(idx)
  }

  // Programmatic navigation (dots, arrows, thumbnails) — scroll the
  // container to the target slide and let native scroll-snap handle the
  // animation + snapping.
  const scrollToImage = (idx: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: idx * el.clientWidth, behavior: 'smooth' })
  }

  const handlePrevImage = () => {
    if (!product) return
    scrollToImage((currentImageIndex - 1 + product.images.length) % product.images.length)
  }

  const handleNextImage = () => {
    if (!product) return
    scrollToImage((currentImageIndex + 1) % product.images.length)
  }

  // LOADING state — skeleton of the populated page
  if (isLoading) {
    return (
      <div className="bg-background min-h-screen text-foreground">
        <div className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="px-5 py-3 flex items-center">
            <button
              onClick={() => router.back()}
              className="p-3 -m-3 hover:bg-input rounded transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6 text-foreground" strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className="lg:flex lg:gap-12 lg:max-w-7xl lg:mx-auto lg:px-10" aria-busy="true">
          <div className="lg:w-3/5 lg:py-12">
            <div className="aspect-square bg-input animate-pulse lg:rounded-lg" />
            <div className="lg:hidden flex justify-center gap-2 mt-4">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-input animate-pulse" />
              ))}
            </div>
          </div>
          <div className="px-6 py-8 lg:w-2/5 lg:py-12 lg:px-0 space-y-8">
            <div className="space-y-3">
              <div className="h-8 w-3/4 bg-input rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-input rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-10 w-40 bg-input rounded animate-pulse" />
              <div className="h-3 w-24 bg-input rounded animate-pulse" />
            </div>
            <div className="h-4 w-1/3 bg-input rounded animate-pulse" />
            <div className="h-14 bg-input rounded animate-pulse" />
            <div className="h-px bg-input animate-pulse" />
            <div className="space-y-3">
              <div className="h-6 w-1/2 bg-input rounded animate-pulse" />
              <div className="h-3 w-full bg-input rounded animate-pulse" />
              <div className="h-3 w-full bg-input rounded animate-pulse" />
              <div className="h-3 w-2/3 bg-input rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // NOT-FOUND or ERROR — both render the "couldn't find that" UI.
  // The copy hedges the cause (unlisted / connection drop) since we
  // don't differentiate to the user.
  if (isNotFound || isErrorState || !product) {
    return (
      <div className="bg-background min-h-screen text-foreground">
        <div className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="px-5 py-3 flex items-center">
            <button
              onClick={() => router.back()}
              className="p-3 -m-3 hover:bg-input rounded transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6 text-foreground" strokeWidth={2} />
            </button>
          </div>
        </div>
        <main className="mx-auto max-w-xl px-5 py-20 text-center">
          <div
            className="w-16 h-16 rounded-full border-2 mb-5 mx-auto flex items-center justify-center"
            style={{ borderColor: '#B85049' }}
            aria-hidden="true"
          >
            <span className="text-error text-2xl">!</span>
          </div>
          <h1 className="font-serif text-3xl font-normal mb-2">We couldn&apos;t find that.</h1>
          <p className="font-sans text-base text-muted mb-6 max-w-sm mx-auto">
            The piece may have been unlisted, or your connection dropped. Try going back to
            the marketplace.
          </p>
          <Link
            href="/marketplace"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
          >
            Back to marketplace
          </Link>
        </main>
      </div>
    )
  }

  // POPULATED — derive display values from the real product.
  const isOwnProduct = !!user && user.id === product.sellerId
  const isSoldOut = product.stock === 0
  const sellerName = product.sellerDisplayName ?? product.sellerUsername
  const priceDisplay = product.priceNgnDisplay || '₦0'
  const satsDisplay = formatSatsCount(product.priceSats)
  const shippingDisplay = satsToNgnFormatted(product.shippingSats)
  const categoryDisplay =
    CATEGORY_LABELS[product.category] ?? String(product.category)

  return (
    <div className="bg-background min-h-screen text-foreground">
      {/* Back Arrow Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-5 py-3 flex items-center">
          <button
            onClick={() => router.back()}
            className="p-3 -m-3 hover:bg-input rounded transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6 text-foreground" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* "Your product is live" banner — shown once after publish */}
      {bannerVisible && (
        <div className="bg-[#F5EFE3] border-b border-border">
          <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8 py-4 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="font-serif text-xl sm:text-2xl font-normal text-foreground mb-1">
                Your product is live.
              </h2>
              <p className="font-sans text-sm text-muted mb-3">
                Share the link to bring buyers to this piece.
              </p>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="inline-flex items-center gap-3 bg-white border border-border px-3 py-1.5 rounded-full">
                  <span className="font-sans text-xs sm:text-sm text-foreground tabular-nums truncate max-w-[200px] sm:max-w-none">
                    {shareUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyShareUrl}
                    className="text-accent hover:opacity-80 transition-opacity font-sans text-xs sm:text-sm font-medium flex items-center gap-1"
                  >
                    {urlCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/seller/products/new"
                  className="inline-flex items-center justify-center bg-primary text-primary-foreground px-4 py-2 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  List another piece
                </Link>
                <Link
                  href="/seller"
                  className="inline-flex items-center justify-center font-sans text-sm text-foreground hover:text-accent transition-colors px-2 py-2"
                >
                  Back to dashboard
                </Link>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBannerVisible(false)}
              className="text-muted hover:text-foreground transition-colors p-1 -m-1 shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      <div className="lg:flex lg:gap-12 lg:max-w-7xl lg:mx-auto lg:px-10">
        {/* IMAGE CAROUSEL SECTION — native horizontal scroll-snap, so a
            mobile user gets the expected drag-to-scroll gesture. On
            desktop, arrows and the thumbnail strip drive scroll instead. */}
        <div className="lg:w-3/5 lg:py-12">
          <div className="relative w-full bg-input overflow-hidden lg:rounded-lg">
            <div
              ref={scrollRef}
              onScroll={handleCarouselScroll}
              className="flex w-full aspect-square overflow-x-auto snap-x snap-mandatory scrollbar-hide"
              style={{ scrollbarWidth: 'none' }}
            >
              {product.images.map((image, idx) => (
                <img
                  key={idx}
                  src={image}
                  alt={`${product.title} image ${idx + 1}`}
                  className="w-full h-full shrink-0 object-cover snap-start"
                />
              ))}
            </div>

            {/* Navigation Arrows - Desktop, only when there's more than one image */}
            {product.images.length > 1 && (
              <div className="hidden lg:flex absolute inset-0 items-center justify-between px-4 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                <button
                  onClick={handlePrevImage}
                  className="bg-white/90 hover:bg-white p-2 rounded transition-colors pointer-events-auto"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6 text-foreground" strokeWidth={2} />
                </button>
                <button
                  onClick={handleNextImage}
                  className="bg-white/90 hover:bg-white p-2 rounded transition-colors pointer-events-auto"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6 text-foreground" strokeWidth={2} />
                </button>
              </div>
            )}
          </div>

          {/* Pagination dots — mobile, only when multi-image. The button
              has generous padding so the tap target meets the 44×44 min
              while the visual dot stays small. */}
          {product.images.length > 1 && (
            <div className="lg:hidden flex justify-center gap-1 mt-2">
              {product.images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => scrollToImage(idx)}
                  className="p-3"
                  aria-label={`Go to image ${idx + 1}`}
                >
                  <div
                    className={`w-2 h-2 rounded-full transition-colors ${
                      idx === currentImageIndex ? 'bg-accent' : 'bg-muted'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}

          {/* Thumbnail strip — desktop, only when multi-image */}
          {product.images.length > 1 && (
            <div className="hidden lg:grid grid-cols-5 gap-2 mt-4">
              {product.images.map((image, idx) => (
                <button
                  key={idx}
                  onClick={() => scrollToImage(idx)}
                  className={`aspect-square rounded overflow-hidden border-2 transition-colors ${
                    idx === currentImageIndex ? 'border-accent' : 'border-border'
                  }`}
                >
                  <img src={image} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* PRODUCT INFO SECTION */}
        <div className="px-6 py-8 lg:w-2/5 lg:py-12 lg:px-0">
          {/* Title Block */}
          <div className="mb-6 space-y-2">
            <h1 className="font-serif text-4xl font-normal leading-tight">{product.title}</h1>
            <p className="font-sans text-sm text-muted">
              by{' '}
              <Link
                href={`/shop/${product.sellerUsername}`}
                className="text-accent hover:opacity-80 transition-opacity"
              >
                {sellerName}
              </Link>
            </p>
            {product.nostrEventId && (
              <a
                href={`https://njump.me/${product.nostrEventId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-sans text-xs text-muted hover:text-accent transition-colors"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                View on Nostr
              </a>
            )}
          </div>

          {/* Price Block */}
          <div className="mb-6 space-y-1">
            <p className="font-serif text-5xl font-normal text-accent">{priceDisplay}</p>
            <p className="font-sans text-sm text-muted">{satsDisplay} sats</p>
          </div>

          {/* Stock / Scarcity Line */}
          <div className="mb-6">
            {product.stock === 0 ? (
              <p className="font-sans text-sm text-error font-medium">Sold out</p>
            ) : product.stock === 1 ? (
              <div className="flex items-center gap-2 text-sm text-accent font-medium">
                <Flame className="w-4 h-4" strokeWidth={2} />
                <span>Last one — once it&apos;s gone, it&apos;s gone</span>
              </div>
            ) : (
              <p className="font-sans text-sm text-muted">{product.stock} available</p>
            )}
          </div>

          {/* Buy Button — hidden for the product's own seller, who can't
              buy from themselves. Shows a "manage" CTA instead so they
              still have an action here. */}
          <div ref={setBuyButtonRef} className="mb-8">
            {isOwnProduct ? (
              <Link
                href={`/seller/products/${product.id}/edit`}
                className="block w-full text-center py-4 px-6 rounded font-sans text-lg font-medium bg-white border border-border text-foreground hover:bg-input/30 transition-colors"
              >
                Manage listing
              </Link>
            ) : isSoldOut ? (
              <button
                disabled
                className="w-full py-4 px-6 rounded font-sans text-lg font-medium bg-muted text-muted-foreground cursor-not-allowed"
              >
                Sold out
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBuy}
                disabled={isBuying}
                className="block w-full text-center py-4 px-6 rounded font-sans text-lg font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isBuying ? 'Creating order…' : `Buy ${priceDisplay}`}
              </button>
            )}
            {buyError && (
              <p role="alert" className="font-sans text-sm text-error mt-3">
                {buyError}
              </p>
            )}
          </div>

          {/* Gold Divider */}
          <div className="h-px bg-gold mb-8" />

          {/* Description */}
          <div className="mb-8 space-y-5">
            <h3 className="font-serif text-2xl font-normal">About this piece</h3>
            {product.description.split('\n\n').map((paragraph, idx) => (
              <p key={idx} className="font-sans text-base text-foreground leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Details Strip */}
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <p className="font-sans text-sm text-muted">Category</p>
              <div className="bg-accent text-primary-foreground px-3 py-1 rounded text-xs font-medium">
                {categoryDisplay}
              </div>
            </div>

            <div className="flex justify-between">
              <p className="font-sans text-sm text-muted">Shipping</p>
              <p className="font-sans text-base font-medium text-foreground">{shippingDisplay}</p>
            </div>

            {product.isDigital && (
              <div className="flex justify-between">
                <p className="font-sans text-sm text-muted">Format</p>
                <p className="font-sans text-base font-medium text-foreground">Digital download</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* STICKY BOTTOM BUY BAR — mobile, hidden for the product's own seller */}
      {isSticky && !isOwnProduct && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border px-6 py-4 z-50 animate-in slide-in-from-bottom-2">
          {isSoldOut ? (
            <button
              disabled
              className="w-full py-3 px-6 rounded font-sans text-base font-medium bg-muted text-muted-foreground cursor-not-allowed"
            >
              Sold out
            </button>
          ) : (
            <button
              type="button"
              onClick={handleBuy}
              disabled={isBuying}
              className="block w-full text-center py-3 px-6 rounded font-sans text-base font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isBuying ? 'Creating order…' : `Buy ${priceDisplay}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="bg-background min-h-screen" />}>
      <ProductPageContent params={params} />
    </Suspense>
  )
}
