'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Plus, Loader2 } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import { deleteProduct, listProducts, updateProduct } from '@/lib/api/products'
import { useSession } from '@/lib/auth/use-session'
import type { Product, ProductStatus } from '@/types/shared'

interface ManagedProduct {
  id: string
  title: string
  image: string
  priceDisplay: string // pre-formatted "₦25,000" from the backend
  status: ProductStatus
}

// Map the wire-format Product down to the shape the JSX expects.
function toManaged(p: Product): ManagedProduct {
  return {
    id: p.id,
    title: p.title,
    image: p.images[0] ?? '',
    priceDisplay: p.priceNgnDisplay || '₦0',
    status: p.status,
  }
}

const STATUS_OVERLAYS: Record<ProductStatus, { pillBg: string; pillText: string; label: string; dim: boolean } | null> = {
  ACTIVE: null,
  SOLD_OUT: { pillBg: 'bg-accent', pillText: 'text-primary-foreground', label: 'Sold out', dim: false },
  UNLISTED: { pillBg: 'bg-border', pillText: 'text-muted', label: 'Unlisted', dim: true },
}

export default function SellerProductsPage() {
  const router = useRouter()
  const { user, isLoading: isSessionLoading } = useSession()

  // Auth guard.
  useEffect(() => {
    if (!isSessionLoading && (!user || user.role !== 'SELLER')) {
      router.push('/signin')
    }
  }, [isSessionLoading, user, router])

  const [products, setProducts] = useState<ManagedProduct[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ id: string; kind: 'unlist' | 'restore' } | null>(null)
  const [actionInProgress, setActionInProgress] = useState(false)

  // Fetch the seller's full catalog (incl. unlisted) once the user loads.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    setIsFetching(true)
    setFetchError(null)
    listProducts({ sellerId: user.id, pageSize: 50 })
      .then(res => {
        if (cancelled) return
        setProducts(res.items.map(toManaged))
      })
      .catch(err => {
        if (cancelled) return
        setFetchError(
          err instanceof ApiError
            ? err.message
            : 'Could not load your products.',
        )
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const handleUnlist = async (productId: string) => {
    setActionInProgress(true)
    try {
      await deleteProduct(productId)
      setProducts(prev =>
        prev.map(p => (p.id === productId ? { ...p, status: 'UNLISTED' } : p)),
      )
      setConfirmAction(null)
    } catch (err) {
      setFetchError(
        err instanceof ApiError
          ? err.message
          : 'Could not unlist this piece. Try again.',
      )
    } finally {
      setActionInProgress(false)
    }
  }

  const handleRestore = async (productId: string) => {
    setActionInProgress(true)
    try {
      await updateProduct(productId, { status: 'ACTIVE' })
      setProducts(prev =>
        prev.map(p => (p.id === productId ? { ...p, status: 'ACTIVE' } : p)),
      )
      setConfirmAction(null)
    } catch (err) {
      setFetchError(
        err instanceof ApiError
          ? err.message
          : 'Could not restore this piece. Try again.',
      )
    } finally {
      setActionInProgress(false)
    }
  }

  return (
    <div className="bg-background min-h-screen text-foreground">
      {/* Back-arrow header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-5 py-3 flex items-center">
          <Link
            href="/seller"
            className="p-3 -m-3 hover:bg-input rounded transition-colors inline-flex"
            aria-label="Back to dashboard"
          >
            <ChevronLeft className="w-6 h-6 text-foreground" strokeWidth={2} />
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8 py-6 pb-12">
        {/* Title row */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h1 className="font-serif text-4xl sm:text-5xl font-normal mb-1">Your products.</h1>
            <p className="font-sans text-sm text-muted">
              {isFetching
                ? 'Loading…'
                : `${products.length} ${products.length === 1 ? 'product' : 'products'}`}
            </p>
          </div>
          <Link
            href="/seller/products/new"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded font-sans text-sm font-medium hover:opacity-90 transition-opacity h-10 shrink-0"
          >
            <Plus size={16} />
            Add product
          </Link>
        </div>

        {fetchError && (
          <p role="alert" className="font-sans text-sm text-error mt-4">
            {fetchError}
          </p>
        )}

        {isFetching ? (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-8"
            aria-busy="true"
            aria-label="Loading your products"
          >
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-border rounded-lg overflow-hidden">
                <div className="aspect-square bg-input animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-3 w-3/4 bg-input rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-input rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          /* Empty state */
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div
              className="w-20 h-20 rounded-full border-2 mb-6"
              style={{ borderColor: '#E8B43D' }}
              aria-hidden="true"
            />
            <h2 className="font-serif text-3xl font-normal mb-2">Nothing listed yet.</h2>
            <p className="font-sans text-base text-muted mb-6 max-w-sm">
              Your shop is ready. Add your first piece and share it with the world.
            </p>
            <Link
              href="/seller/products/new"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded font-sans font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={18} />
              Add your first piece
            </Link>
          </div>
        ) : (
          /* Product grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">
            {products.map(product => {
              const overlay = STATUS_OVERLAYS[product.status]
              const isUnlisted = product.status === 'UNLISTED'
              const isAction = confirmAction?.id === product.id

              return (
                <div key={product.id} className="bg-white border border-border rounded-lg overflow-hidden">
                  {/* Tap card → edit */}
                  <Link
                    href={`/seller/products/${product.id}/edit`}
                    className="block hover:opacity-90 transition-opacity"
                  >
                    {/* Thumbnail with optional overlay */}
                    <div className="relative aspect-square bg-input overflow-hidden">
                      <img
                        src={product.image}
                        alt={product.title}
                        className={`w-full h-full object-cover ${overlay?.dim ? 'opacity-50' : ''}`}
                      />
                      {overlay && (
                        <div className="absolute top-2 left-2">
                          <span
                            className={`${overlay.pillBg} ${overlay.pillText} text-xs px-3 py-1 rounded-full font-sans font-medium`}
                          >
                            {overlay.label}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Title + price */}
                    <div className="p-3">
                      <h3 className="font-serif text-sm sm:text-base text-foreground line-clamp-1 mb-1">
                        {product.title}
                      </h3>
                      <p className="font-sans text-xs text-muted tabular-nums">
                        {product.priceDisplay}
                      </p>
                    </div>
                  </Link>

                  {/* Inline confirm — replaces action button when active */}
                  {isAction ? (
                    <div className="border-t border-border bg-[#F5EFE3] px-3 py-3 space-y-2">
                      <p className="font-sans text-xs text-foreground">
                        {confirmAction.kind === 'unlist'
                          ? 'Hide this piece from buyers?'
                          : 'Make this piece visible to buyers again?'}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            confirmAction.kind === 'unlist'
                              ? handleUnlist(product.id)
                              : handleRestore(product.id)
                          }
                          disabled={actionInProgress}
                          className="flex-1 bg-primary text-primary-foreground py-1.5 rounded font-sans text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1"
                        >
                          {actionInProgress ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Confirm'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction(null)}
                          disabled={actionInProgress}
                          className="flex-1 bg-transparent text-foreground py-1.5 rounded font-sans text-xs font-medium hover:bg-border transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Inline action row — "View" jumps to the public
                       detail page; Unlist/Restore is the destructive /
                       restorative action. Tap card body for edit. */
                    <div className="border-t border-border px-3 py-2 flex items-center justify-between gap-2">
                      <Link
                        href={`/products/${product.id}`}
                        className="text-accent font-sans text-xs font-medium hover:opacity-80 transition-opacity py-1.5"
                      >
                        View
                      </Link>
                      {isUnlisted ? (
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ id: product.id, kind: 'restore' })}
                          className="text-accent font-sans text-xs font-medium hover:opacity-80 transition-opacity py-1.5"
                        >
                          Restore listing
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ id: product.id, kind: 'unlist' })}
                          className="text-muted hover:text-foreground font-sans text-xs font-medium transition-colors py-1.5"
                        >
                          Unlist
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
