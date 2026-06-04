'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, X, Loader2 } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import {
  deleteProduct,
  getProduct,
  updateProduct,
} from '@/lib/api/products'
import { uploadImage } from '@/lib/api/upload'
import { useSession } from '@/lib/auth/use-session'
import type { Product, ProductCategory, ProductStatus } from '@/types/shared'

// Mirror the server's DEMO_BTC_NGN_RATE so prices round-trip cleanly.
const NGN_PER_BTC = 145_000_000
const SATS_PER_BTC = 100_000_000

const CATEGORIES: { label: string; value: ProductCategory }[] = [
  { label: 'Tailoring', value: 'tailoring' },
  { label: 'Carpentry', value: 'carpentry' },
  { label: 'Jewellery', value: 'jewelry' },
  { label: 'Art & Painting', value: 'art' },
  { label: 'Ceramics', value: 'ceramics' },
  { label: 'Leather & Bags', value: 'leather' },
  { label: 'Repairs', value: 'repairs' },
  { label: 'Handmade Crafts', value: 'crafts' },
  { label: 'Other', value: 'other' },
]

const STATUS_PILLS: Record<ProductStatus, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-success', text: 'text-primary-foreground', label: 'Active' },
  SOLD_OUT: { bg: 'bg-accent', text: 'text-primary-foreground', label: 'Sold out' },
  UNLISTED: { bg: 'bg-border', text: 'text-muted', label: 'Unlisted' },
}

// Convert a NGN input string to sats at the demo rate. Mirrors /new.
function nairaToSats(naira: string | number): number {
  const num = typeof naira === 'number' ? naira : parseInt(naira || '0', 10)
  if (!Number.isFinite(num) || num <= 0) return 0
  return Math.round((num * SATS_PER_BTC) / NGN_PER_BTC)
}

// Convert a sats bigint-string back to a plain NGN number for prefilling
// the price/shipping fields. Inverse of nairaToSats at the same demo rate.
function satsToNaira(satsStr: string): number {
  try {
    const sats = BigInt(satsStr)
    const ngn = (sats * BigInt(NGN_PER_BTC)) / BigInt(SATS_PER_BTC)
    return Number(ngn)
  } catch {
    return 0
  }
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const { user, isLoading: isSessionLoading } = useSession()

  // Fetched product + load state.
  const [product, setProduct] = useState<Product | null>(null)
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState<'not-found' | 'load-failed' | null>(null)

  // Form state — initialised empty, hydrated from the fetched product.
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | ''>('')
  const [price, setPrice] = useState('')
  const [shipping, setShipping] = useState('')
  const [stock, setStock] = useState('1')
  const [status, setStatus] = useState<ProductStatus>('ACTIVE')

  // 5 photo slots; populate from product.images, leave the rest empty.
  const [photoStates, setPhotoStates] = useState<string[]>([
    'empty', 'empty', 'empty', 'empty', 'empty',
  ])
  const [photoUrls, setPhotoUrls] = useState<(string | null)[]>([
    null, null, null, null, null,
  ])

  const [showValidationErrors, setShowValidationErrors] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showUnlistConfirm, setShowUnlistConfirm] = useState(false)
  const [isUnlisting, setIsUnlisting] = useState(false)

  // Auth guard. Must be a seller; ownership is enforced below once the
  // product loads.
  useEffect(() => {
    if (!isSessionLoading && (!user || user.role !== 'SELLER')) {
      router.push('/signin')
    }
  }, [isSessionLoading, user, router])

  // Fetch + hydrate form.
  useEffect(() => {
    let cancelled = false
    setIsFetching(true)
    setFetchError(null)
    getProduct(id)
      .then(res => {
        if (cancelled) return
        const p = res.product
        setProduct(p)
        setTitle(p.title)
        setDescription(p.description)
        setSelectedCategory(p.category)
        setPrice(String(satsToNaira(p.priceSats)))
        setShipping(String(satsToNaira(p.shippingSats)))
        setStock(String(p.stock))
        setStatus(p.status)

        const nextUrls: (string | null)[] = [null, null, null, null, null]
        const nextStates: string[] = ['empty', 'empty', 'empty', 'empty', 'empty']
        p.images.slice(0, 5).forEach((url, i) => {
          nextUrls[i] = url
          nextStates[i] = 'uploaded'
        })
        setPhotoUrls(nextUrls)
        setPhotoStates(nextStates)
      })
      .catch(err => {
        if (cancelled) return
        const code = err instanceof ApiError ? err.statusCode : 0
        setFetchError(code === 404 ? 'not-found' : 'load-failed')
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // Once both user and product are loaded, verify ownership.
  useEffect(() => {
    if (!product || !user) return
    if (product.sellerId !== user.id) {
      // Not your product — kick back to your catalog.
      router.push('/seller/products')
    }
  }, [product, user, router])

  const sats = nairaToSats(price)
  const shippingSats = nairaToSats(shipping)

  const hasAtLeastOnePhoto = photoStates.some(s => s === 'uploaded')
  const anyPhotoUploading = photoStates.some(s => s === 'uploading')
  const isTitleValid = title.trim().length >= 2 && title.trim().length <= 100
  const isDescriptionValid = description.trim().length >= 10 && description.trim().length <= 2000
  const isCategorySelected = selectedCategory !== ''
  const isPriceValid = parseInt(price || '0', 10) > 0 && sats > 0
  const parsedStock = Math.max(1, parseInt(stock || '1', 10) || 1)
  const isFormValid =
    hasAtLeastOnePhoto &&
    !anyPhotoUploading &&
    isTitleValid &&
    isDescriptionValid &&
    isCategorySelected &&
    isPriceValid

  // Real photo upload via the signed-Cloudinary helper.
  const handlePhotoFileChange = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setPhotoStates(prev => {
      const next = [...prev]
      next[index] = 'uploading'
      return next
    })
    setErrorMessage(null)

    try {
      const url = await uploadImage(file)
      setPhotoUrls(prev => {
        const next = [...prev]
        next[index] = url
        return next
      })
      setPhotoStates(prev => {
        const next = [...prev]
        next[index] = 'uploaded'
        return next
      })
    } catch (err) {
      setPhotoStates(prev => {
        const next = [...prev]
        next[index] = 'empty'
        return next
      })
      if (err instanceof ApiError) {
        setErrorMessage(err.message)
      }
    }
  }

  const handlePhotoRemove = (index: number) => {
    setPhotoStates(prev => {
      const next = [...prev]
      next[index] = 'empty'
      return next
    })
    setPhotoUrls(prev => {
      const next = [...prev]
      next[index] = null
      return next
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isFormValid) {
      setShowValidationErrors(true)
      return
    }
    if (isSaving) return

    setIsSaving(true)
    setErrorMessage(null)

    try {
      const images = photoUrls.filter((url): url is string => !!url)
      await updateProduct(id, {
        title: title.trim(),
        description: description.trim(),
        priceSats: String(sats),
        shippingSats: String(shippingSats),
        category: selectedCategory as ProductCategory,
        images,
        stock: parsedStock,
      })
      router.push('/seller/products')
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message || 'Could not save your changes. Try again.'
          : 'Connection issue. Check your network and try again.',
      )
      setIsSaving(false)
    }
  }

  // Unlist = DELETE (soft-delete to UNLISTED). Restore = PATCH status.
  const handleConfirmUnlist = async () => {
    setIsUnlisting(true)
    setErrorMessage(null)
    try {
      if (status === 'UNLISTED') {
        await updateProduct(id, { status: 'ACTIVE' })
        setStatus('ACTIVE')
      } else {
        await deleteProduct(id)
        setStatus('UNLISTED')
      }
      setShowUnlistConfirm(false)
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message || 'Could not update the listing. Try again.'
          : 'Connection issue. Check your network and try again.',
      )
    } finally {
      setIsUnlisting(false)
    }
  }

  // LOADING state
  if (isFetching || isSessionLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
            <Link
              href="/seller/products"
              className="flex items-center justify-center w-11 h-11 hover:bg-border rounded transition-colors"
              aria-label="Back to products"
            >
              <ChevronLeft className="w-6 h-6 text-foreground" />
            </Link>
          </div>
        </div>
        <div
          className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8 py-8 pb-24 space-y-8"
          aria-busy="true"
          aria-label="Loading your product"
        >
          <div className="space-y-3">
            <div className="h-10 w-2/3 bg-input rounded animate-pulse" />
            <div className="h-5 w-20 bg-input rounded-full animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-square bg-input rounded-lg animate-pulse" />
            ))}
          </div>
          <div className="h-12 bg-input rounded animate-pulse" />
          <div className="h-32 bg-input rounded animate-pulse" />
          <div className="h-12 bg-input rounded animate-pulse" />
        </div>
      </div>
    )
  }

  // NOT-FOUND or ERROR
  if (fetchError) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 bg-background border-b border-border">
          <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
            <Link
              href="/seller/products"
              className="flex items-center justify-center w-11 h-11 hover:bg-border rounded transition-colors"
              aria-label="Back to products"
            >
              <ChevronLeft className="w-6 h-6 text-foreground" />
            </Link>
          </div>
        </div>
        <main className="mx-auto max-w-xl px-5 py-20 text-center">
          <h1 className="font-serif text-3xl font-normal mb-2">We couldn&apos;t find that.</h1>
          <p className="font-sans text-base text-muted mb-6 max-w-sm mx-auto">
            This piece may have been removed, or your connection dropped.
          </p>
          <Link
            href="/seller/products"
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
          >
            Back to your products
          </Link>
        </main>
      </div>
    )
  }

  const statusPill = STATUS_PILLS[status]
  const isUnlisted = status === 'UNLISTED'

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link
            href="/seller/products"
            className="flex items-center justify-center w-11 h-11 hover:bg-border rounded transition-colors"
            aria-label="Back to products"
          >
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </Link>
        </div>
      </div>

      <form onSubmit={handleSave} className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8 py-8 pb-24">
        {/* Title row */}
        <div className="mb-12">
          <h1 className="font-serif text-4xl sm:text-5xl font-normal text-foreground mb-3">
            Edit your piece.
          </h1>
          <div className={`${statusPill.bg} ${statusPill.text} inline-block text-xs px-3 py-1 rounded-full font-sans font-medium`}>
            {statusPill.label}
          </div>
        </div>

        {/* 1. PHOTOS */}
        <div className="mb-12">
          <h2 className="font-serif text-xl font-normal mb-1">Photos.</h2>
          <p className="text-sm text-muted mb-6">Up to 5. First photo is the cover.</p>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
            {photoStates.map((state, index) => (
              <div key={index} className="relative">
                {index === 0 && (
                  <div className="absolute top-0 left-0 z-10 bg-white/90 px-2 py-1 rounded-full">
                    <span className="font-medium text-xs text-accent">Cover</span>
                  </div>
                )}

                {state === 'empty' && (
                  <label className="w-full aspect-square bg-white border border-dashed border-border rounded-lg flex flex-col items-center justify-center hover:bg-border/10 transition-colors cursor-pointer">
                    <Plus className="w-6 h-6 text-muted mb-2" />
                    <span className="text-xs text-muted">Add photo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={(e) => handlePhotoFileChange(index, e)}
                      className="sr-only"
                    />
                  </label>
                )}

                {state === 'uploading' && (
                  <div className="w-full aspect-square bg-gray-100 border border-border rounded-lg flex flex-col items-center justify-center">
                    <Loader2 className="w-5 h-5 text-muted animate-spin mb-2" />
                    <span className="text-xs text-muted">Uploading…</span>
                  </div>
                )}

                {state === 'uploaded' && photoUrls[index] && (
                  <div className="w-full aspect-square relative rounded-lg overflow-hidden bg-white">
                    <img
                      src={photoUrls[index]!}
                      alt={`Product photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handlePhotoRemove(index)}
                      className="absolute top-2 right-2 bg-white rounded-full w-7 h-7 flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors"
                      aria-label="Remove photo"
                    >
                      <X className="w-4 h-4 text-foreground" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {showValidationErrors && !hasAtLeastOnePhoto && (
            <p className="text-sm text-error mb-3">Add at least one photo.</p>
          )}
          <p className="text-xs text-muted">Photos look best square. Maya will resize automatically.</p>
        </div>

        {/* 2. TITLE */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-normal mb-3">Title.</h2>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What's this called?"
            className={`w-full px-4 py-3 bg-white rounded border text-base font-normal text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
              showValidationErrors && !isTitleValid ? 'border-error' : 'border-border'
            }`}
            style={{ minHeight: '48px', fontSize: '16px' }}
          />
          {showValidationErrors && !isTitleValid && (
            <p className="text-sm text-error mt-2">Title must be 2–100 characters.</p>
          )}
        </div>

        {/* 3. DESCRIPTION */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-normal mb-3">Description.</h2>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Tell buyers what makes this piece special."
            className={`w-full px-4 py-3 bg-white rounded border text-base font-normal text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none ${
              showValidationErrors && !isDescriptionValid ? 'border-error' : 'border-border'
            }`}
            rows={5}
            style={{ fontSize: '16px' }}
          />
          {showValidationErrors && !isDescriptionValid && (
            <p className="text-sm text-error mt-2">Description must be 10–2000 characters.</p>
          )}
        </div>

        {/* 4. CATEGORY */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-normal mb-3">Category.</h2>
          <div className="flex flex-wrap gap-3 mb-3">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat.value
                    ? 'bg-primary text-primary-foreground border-0'
                    : 'bg-white border border-border text-foreground hover:border-primary'
                }`}
                style={{ minHeight: '32px' }}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {showValidationErrors && !isCategorySelected && (
            <p className="text-sm text-error">Pick a category.</p>
          )}
        </div>

        {/* 5. PRICE */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-normal mb-3">Price.</h2>
          <div className="relative">
            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-foreground font-medium">₦</span>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="0"
              className={`w-full pl-8 pr-4 py-3 bg-white rounded border text-base font-medium text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition-all tabular-nums ${
                showValidationErrors && !isPriceValid ? 'border-error' : 'border-border'
              }`}
              style={{ minHeight: '48px', fontSize: '16px' }}
            />
          </div>
          <p className="text-sm text-muted mt-2 tabular-nums">
            {price ? `≈ ${sats.toLocaleString('en-NG')} sats at today's rate` : '≈ 0 sats at today\'s rate'}
          </p>
        </div>

        {/* 6. SHIPPING */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-normal mb-3">Shipping.</h2>
          <div className="relative">
            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-foreground font-medium">₦</span>
            <input
              type="number"
              value={shipping}
              onChange={e => setShipping(e.target.value)}
              placeholder="0"
              className="w-full pl-8 pr-4 py-3 bg-white rounded border border-border text-base font-medium text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              style={{ minHeight: '48px', fontSize: '16px' }}
            />
          </div>
        </div>

        {/* 7. STOCK */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-normal mb-3">Stock.</h2>
          <input
            type="number"
            value={stock}
            onChange={e => setStock(e.target.value)}
            className="w-full px-4 py-3 bg-white rounded border border-border text-base font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all tabular-nums"
            style={{ minHeight: '48px', fontSize: '16px' }}
            min="1"
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-gold mb-8" />

        {/* Inline error */}
        {errorMessage && (
          <p role="alert" className="font-sans text-sm text-error mb-4">
            {errorMessage}
          </p>
        )}

        {/* Save changes */}
        <button
          type="submit"
          disabled={!isFormValid || isSaving}
          className="w-full bg-primary text-primary-foreground py-4 px-6 rounded font-serif text-lg font-normal transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 flex items-center justify-center gap-2"
          style={{ minHeight: '56px' }}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving…
            </>
          ) : (
            'Save changes'
          )}
        </button>

        {/* Cancel */}
        <div className="text-center mt-4">
          <Link
            href="/seller/products"
            className="font-sans text-sm text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </Link>
        </div>

        {/* Unlist / Restore destructive action */}
        <div className="mt-12 pt-8 border-t border-border">
          {!showUnlistConfirm ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowUnlistConfirm(true)}
                className={`font-sans text-sm transition-colors ${
                  isUnlisted
                    ? 'text-accent hover:opacity-80'
                    : 'text-error hover:opacity-80'
                }`}
              >
                {isUnlisted ? 'Restore listing' : 'Unlist this piece'}
              </button>
              <p className="font-sans text-xs text-muted mt-2 max-w-md mx-auto">
                {isUnlisted
                  ? 'Make this piece visible to buyers again.'
                  : 'Hide this piece from buyers. You can restore it later.'}
              </p>
            </div>
          ) : (
            <div className="bg-[#F5EFE3] rounded-lg p-4 space-y-4">
              <p className="font-sans text-sm text-foreground">
                {isUnlisted
                  ? 'Make this piece visible to buyers again?'
                  : 'Hide this piece from buyers? You can restore it later from the products list.'}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleConfirmUnlist}
                  disabled={isUnlisting}
                  className={`flex-1 text-primary-foreground py-3 rounded font-sans text-sm font-medium transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 ${
                    isUnlisted ? 'bg-primary hover:opacity-90' : 'bg-error hover:opacity-90'
                  }`}
                >
                  {isUnlisting ? (
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
                  onClick={() => setShowUnlistConfirm(false)}
                  disabled={isUnlisting}
                  className="flex-1 bg-transparent text-foreground py-3 rounded font-sans text-sm font-medium hover:bg-border transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
