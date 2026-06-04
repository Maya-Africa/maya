'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, X, Loader2 } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import { createProduct } from '@/lib/api/products'
import { uploadImage } from '@/lib/api/upload'
import { useSession } from '@/lib/auth/use-session'
import type { ProductCategory } from '@/types/shared'

// Demo exchange rate — must match the server's DEMO_BTC_NGN_RATE so the
// sats we submit round-trip to the same NGN the seller typed. Server
// default is ₦145,000,000 per BTC (1 BTC = 100,000,000 sats). If the
// server-side rate changes, mirror it here.
const NGN_PER_BTC = 145_000_000
const SATS_PER_BTC = 100_000_000

// UI labels paired with their API enum values. Order drives the chip row.
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

export default function NewProductPage() {
  const router = useRouter()
  const { user, isLoading: isSessionLoading } = useSession()

  // Auth guard — only authenticated sellers can list products.
  useEffect(() => {
    if (!isSessionLoading && (!user || user.role !== 'SELLER')) {
      router.push('/signin')
    }
  }, [isSessionLoading, user, router])

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | ''>('')
  const [price, setPrice] = useState('')
  const [shipping, setShipping] = useState('')
  const [stock, setStock] = useState('1')
  const [dimensions, setDimensions] = useState('')

  // Photo states: 'empty' | 'uploading' | 'uploaded' | 'error'
  const [photoStates, setPhotoStates] = useState<string[]>(['empty', 'empty', 'empty', 'empty', 'empty'])
  const [photoUrls, setPhotoUrls] = useState<(string | null)[]>([null, null, null, null, null])

  // Form validation & submission states
  const [showValidationErrors, setShowValidationErrors] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Calculate sats from naira at the demo rate. Backend stores priceSats
  // verbatim and recomputes its own priceNgnDisplay using the same rate.
  const calculateSats = (naira: string) => {
    if (!naira) return 0
    const numNaira = parseInt(naira, 10)
    if (!Number.isFinite(numNaira) || numNaira <= 0) return 0
    return Math.round((numNaira * SATS_PER_BTC) / NGN_PER_BTC)
  }

  const sats = calculateSats(price)
  const shippingSats = calculateSats(shipping)

  // Validation
  const hasAtLeastOnePhoto = photoStates.some(state => state === 'uploaded')
  const anyPhotoUploading = photoStates.some(state => state === 'uploading')
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

  // Real photo upload: server issues signed Cloudinary params, browser
  // POSTs the file direct to Cloudinary. File bytes never touch our server.
  const handlePhotoFileChange = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    // Reset so re-selecting the same file fires another change event.
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
        next[index] = 'error'
        return next
      })
      // Surface the most actionable message (validation failures from
      // the Cloudinary helper carry a useful reason).
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

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isFormValid) {
      setShowValidationErrors(true)
      return
    }
    if (isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const images = photoUrls.filter((url): url is string => !!url)
      // Append dimensions (if provided) to the description rather than as
      // its own field — the API doesn't model dimensions separately. Keeps
      // the info searchable in the product detail page.
      const fullDescription = dimensions.trim()
        ? `${description.trim()}\n\nDimensions: ${dimensions.trim()}`
        : description.trim()

      const { product } = await createProduct({
        title: title.trim(),
        description: fullDescription,
        priceSats: String(sats),
        shippingSats: String(shippingSats),
        category: selectedCategory as ProductCategory,
        images,
        isDigital: false,
        stock: parsedStock,
      })

      router.push(`/products/${product.id}?justPublished=1`)
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError
          ? err.message || 'Could not publish your piece. Try again.'
          : 'Connection issue. Check your network and try again.',
      )
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-11 h-11 hover:bg-border rounded transition-colors"
            aria-label="Go back"
          >
            <ChevronLeft className="w-6 h-6 text-foreground" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <form onSubmit={handlePublish} className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8 py-8 pb-24">
        {/* Title */}
        <h1 className="font-serif text-4xl sm:text-5xl font-normal mb-12 text-foreground">
          List a new piece.
        </h1>

        {/* 1. PHOTOS BLOCK */}
        <div className="mb-12">
          <h2 className="font-serif text-xl font-normal mb-1 text-foreground">Photos.</h2>
          <p className="text-sm text-muted mb-6">Up to 5. First photo is the cover.</p>

          {/* Photo grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
            {photoStates.map((state, index) => (
              <div key={index} className="relative">
                {/* Cover label */}
                {index === 0 && (
                  <div className="absolute top-0 left-0 z-10 bg-white/90 px-2 py-1 rounded-full">
                    <span className="font-medium text-xs text-accent">Cover</span>
                  </div>
                )}

                {/* Empty slot */}
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

                {/* Uploading state */}
                {state === 'uploading' && (
                  <div className="w-full aspect-square bg-gray-100 border border-border rounded-lg flex flex-col items-center justify-center">
                    <Loader2 className="w-5 h-5 text-muted animate-spin mb-2" />
                    <span className="text-xs text-muted">Uploading…</span>
                  </div>
                )}

                {/* Uploaded state */}
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

                {/* Error state — clicking opens the file picker again. */}
                {state === 'error' && (
                  <label className="w-full aspect-square bg-error/10 border border-error rounded-lg flex flex-col items-center justify-center hover:bg-error/20 transition-colors cursor-pointer">
                    <span className="text-xs text-error text-center px-2">
                      Couldn&apos;t upload. Tap to retry.
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={(e) => handlePhotoFileChange(index, e)}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>
            ))}
          </div>

          {/* Error message */}
          {showValidationErrors && !hasAtLeastOnePhoto && (
            <p className="text-sm text-error mb-3">Add at least one photo.</p>
          )}

          <p className="text-xs text-muted">Photos look best square. Maya will resize automatically.</p>
        </div>

        {/* 2. TITLE */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-normal mb-3 text-foreground">Title.</h2>
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
            <p className="text-sm text-error mt-2">Title is required.</p>
          )}
        </div>

        {/* 3. DESCRIPTION */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-normal mb-3 text-foreground">Description.</h2>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Tell buyers what makes this piece special. Materials, dimensions, story, care instructions."
            className="w-full px-4 py-3 bg-white rounded border border-border text-base font-normal text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
            rows={5}
            style={{ fontSize: '16px' }}
          />
        </div>

        {/* 4. CATEGORY */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-normal mb-3 text-foreground">Category.</h2>
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

        {/* 5. PRICE + SATS */}
        <div className="mb-8">
          <h2 className="font-serif text-xl font-normal mb-3 text-foreground">Price.</h2>
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
          <h2 className="font-serif text-xl font-normal mb-3 text-foreground">Shipping.</h2>
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
          <p className="text-xs text-muted mt-2">What you charge the buyer for shipping. Set to ₦0 if shipping is included.</p>
        </div>

        {/* 7. STOCK + DIMENSIONS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
          <div>
            <h2 className="font-serif text-xl font-normal mb-3 text-foreground">Stock.</h2>
            <input
              type="number"
              value={stock}
              onChange={e => setStock(e.target.value)}
              className="w-full px-4 py-3 bg-white rounded border border-border text-base font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all tabular-nums"
              style={{ minHeight: '48px', fontSize: '16px' }}
              min="1"
            />
            <p className="text-xs text-muted mt-2">How many of this exact piece are available.</p>
          </div>

          <div>
            <h2 className="font-serif text-xl font-normal mb-3 text-foreground">Dimensions (optional).</h2>
            <input
              type="text"
              value={dimensions}
              onChange={e => setDimensions(e.target.value)}
              placeholder="90 × 120 cm"
              className="w-full px-4 py-3 bg-white rounded border border-border text-base font-medium text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              style={{ minHeight: '48px', fontSize: '16px' }}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gold mb-8" />

        {/* Inline error (network / server failures during publish or upload) */}
        {errorMessage && (
          <p role="alert" className="font-sans text-sm text-error mb-4">
            {errorMessage}
          </p>
        )}

        {/* 8. PUBLISH BUTTON */}
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className={`w-full py-4 px-6 rounded font-serif text-lg font-normal text-primary-foreground transition-all flex items-center justify-center gap-2 ${
            isFormValid && !isSubmitting
              ? 'bg-primary hover:opacity-90 cursor-pointer'
              : 'bg-primary opacity-50 cursor-not-allowed'
          }`}
          style={{ minHeight: '56px' }}
        >
          {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
          {isSubmitting ? 'Publishing…' : 'Publish'}
        </button>

        <p className="text-xs text-muted text-center mt-4">Maya takes 2% when you sell.</p>
      </form>
    </div>
  )
}
