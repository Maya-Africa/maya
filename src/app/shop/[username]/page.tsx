'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Share2, Shield, Star, MapPin, Package, Heart, ChevronRight, MessageCircle } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import { getShop, type StorefrontResponse } from '@/lib/api/products'
import { getShopAbout, getShopReviews, type ShopAboutResponse, type ShopReview } from '@/lib/api/seller'
import { VerifiedSellerBadge } from '@/components/seller/verified-seller-badge'

const NGN_PER_BTC = 145_000_000n
const SATS_PER_BTC = 100_000_000n

function fmtNgn(satsStr: string): string {
  try {
    const sats = BigInt(satsStr)
    return `₦${Number((sats * NGN_PER_BTC) / SATS_PER_BTC).toLocaleString('en-NG')}`
  } catch { return '₦0' }
}

function initials(name: string | null, fallback: string): string {
  const s = (name?.trim()) || fallback
  return s.slice(0, 2).toUpperCase()
}

function relTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days < 1) return 'today'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return new Date(iso).toLocaleDateString()
}

// ── Cover gradient based on seller name (deterministic, always on-brand) ─────
const COVER_GRADIENTS = [
  'linear-gradient(135deg, #1A2E44 0%, #2D4A6B 50%, #C2692F 100%)',
  'linear-gradient(135deg, #2C1A0E 0%, #8B4513 50%, #D4983A 100%)',
  'linear-gradient(135deg, #1A3A1A 0%, #2D5F2D 50%, #4A9A4A 100%)',
  'linear-gradient(135deg, #2E1A3A 0%, #5A3A6B 50%, #C269A3 100%)',
  'linear-gradient(135deg, #0E2233 0%, #1A4A6B 50%, #269BD4 100%)',
  'linear-gradient(135deg, #33200E 0%, #8B5A2B 50%, #D4A43A 100%)',
]

function coverGradient(username: string): string {
  let hash = 0
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) & 0xFFFFFF
  return COVER_GRADIENTS[Math.abs(hash) % COVER_GRADIENTS.length]!
}

// ── Stars ──────────────────────────────────────────────────────────────────
function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const filled = Math.round(Math.max(0, Math.min(5, rating)))
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating.toFixed(1)} out of 5`} role="img">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ fontSize: size, color: i < filled ? '#D4983A' : '#E8E4DE' }} aria-hidden>
          {i < filled ? '★' : '★'}
        </span>
      ))}
    </span>
  )
}

// ── Long bio ───────────────────────────────────────────────────────────────
function LongBioBlock({ username }: { username: string }) {
  const [data, setData] = useState<ShopAboutResponse | null>(null)
  useEffect(() => {
    let cancelled = false
    getShopAbout(username).then(r => { if (!cancelled) setData(r) }).catch(() => {})
    return () => { cancelled = true }
  }, [username])
  if (!data?.longBio) return null
  return (
    <div className="mt-5 pt-5 border-t border-[#E8E4DE]">
      <p className="text-xs font-bold uppercase tracking-widest text-[#7A7065] mb-3">About this shop</p>
      <p className="text-sm text-[#3A3530] leading-relaxed whitespace-pre-wrap">{data.longBio}</p>
    </div>
  )
}

// ── Reviews ────────────────────────────────────────────────────────────────
function ReviewsSection({ username }: { username: string }) {
  const [data, setData] = useState<{ averageRating: number; count: number; reviews: ShopReview[] } | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    getShopReviews(username)
      .then(r => { if (!cancelled) setData(r) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [username])
  if (loading || !data || data.count === 0) return null

  return (
    <section style={{ background: '#fff', borderTop: '1px solid #E8E4DE', padding: '48px 20px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 32, margin: 0, color: '#0F1923' }}>Reviews</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Stars rating={data.averageRating} size={22} />
            <span style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 28, color: '#1A2E44' }}>{data.averageRating.toFixed(1)}</span>
            <span style={{ fontSize: 14, color: '#7A7065' }}>· {data.count} {data.count === 1 ? 'review' : 'reviews'}</span>
          </div>
        </div>

        {/* Review cards */}
        <div style={{ display: 'grid', gap: 16 }}>
          {data.reviews.map(r => (
            <div key={r.id} style={{ background: '#FAFAF8', border: '1px solid #E8E4DE', borderRadius: 16, padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <Stars rating={r.rating} size={16} />
                <span style={{ fontSize: 12, color: '#7A7065' }}>{relTime(r.createdAt)}</span>
              </div>
              <p style={{ fontSize: 14, color: '#3A3530', lineHeight: 1.7, margin: 0 }}>{r.content}</p>
              {r.nostrEventId && (
                <a href={`https://njump.me/${r.nostrEventId}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 11, color: '#C2692F', marginTop: 10, display: 'inline-block', textDecoration: 'none' }}>
                  Verified on Nostr ↗
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Product card ────────────────────────────────────────────────────────────
function ShopProductCard({ product, isClosed }: {
  product: StorefrontResponse['products'][number]
  isClosed: boolean
}) {
  const [saved, setSaved] = useState(false)
  const cover = product.images?.[0] ?? ''
  const price = product.priceNgnDisplay || fmtNgn(product.priceSats)

  const inner = (
    <div style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', border: '1px solid #E8E4DE', transition: 'transform 0.2s, box-shadow 0.2s', opacity: isClosed ? 0.6 : 1 }}
      className="group hover:shadow-xl hover:shadow-[#1A2E44]/8 hover:-translate-y-1">
      {/* Image */}
      <div style={{ position: 'relative', aspectRatio: '1', background: '#F2EFE9', overflow: 'hidden' }}>
        {cover ? (
          <img src={cover} alt={product.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s' }}
            className="group-hover:scale-105" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Package style={{ width: 36, height: 36, color: '#C8C0B5' }} />
          </div>
        )}
        {/* Escrow badge */}
        <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(26,46,68,0.85)', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, backdropFilter: 'blur(8px)' }}>
          <Shield style={{ width: 10, height: 10, color: '#fff' }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>ESCROW</span>
        </div>
        {/* Save heart */}
        {!isClosed && (
          <button
            type="button"
            onClick={e => { e.preventDefault(); setSaved(v => !v) }}
            style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: '50%', background: saved ? '#C2692F' : 'rgba(255,255,255,0.92)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', transition: 'all 0.2s' }}
          >
            <Heart style={{ width: 14, height: 14, color: saved ? '#fff' : '#7A7065', fill: saved ? '#fff' : 'none' }} />
          </button>
        )}
        {product.stock <= 3 && product.stock > 0 && !isClosed && (
          <div style={{ position: 'absolute', top: 10, left: 10, background: '#C2692F', color: '#fff', fontSize: 9, fontWeight: 700, padding: '4px 8px', borderRadius: 999, letterSpacing: '0.05em' }}>
            {product.stock === 1 ? 'LAST ONE' : `${product.stock} LEFT`}
          </div>
        )}
      </div>
      {/* Body */}
      <div style={{ padding: '14px 16px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#0F1923', margin: '0 0 4px', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {product.title}
        </p>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#C2692F', margin: 0 }}>{price}</p>
      </div>
    </div>
  )

  if (isClosed) return <div className="cursor-not-allowed">{inner}</div>
  return <Link href={`/products/${product.id}`} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ShopPage({ params }: { params: Promise<{ username: string }> }) {
  const router = useRouter()
  const { username } = use(params)

  const [shop, setShop] = useState<StorefrontResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'not_found' | 'other' | null>(null)
  const [copied, setCopied] = useState(false)
  const [activeFilter, setActiveFilter] = useState<string>('all')

  useEffect(() => {
    let cancelled = false
    getShop(username)
      .then(r => { if (!cancelled) setShop(r) })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof ApiError && err.statusCode === 404 ? 'not_found' : 'other')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [username])

  const handleCopy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/shop/${username}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: '#FAFAF8', minHeight: '100vh' }}>
        {/* Cover skeleton */}
        <div style={{ height: 280, background: '#E8E4DE', animation: 'pulse 2s infinite' }} className="animate-pulse" />
        <div style={{ maxWidth: 900, margin: '-48px auto 0', padding: '0 20px 60px' }}>
          <div style={{ width: 96, height: 96, borderRadius: '50%', background: '#D8D4CE', border: '4px solid #FAFAF8', marginBottom: 20 }} className="animate-pulse" />
          <div style={{ height: 36, width: '50%', background: '#E8E4DE', borderRadius: 8, marginBottom: 12 }} className="animate-pulse" />
          <div style={{ height: 16, width: '70%', background: '#E8E4DE', borderRadius: 8, marginBottom: 32 }} className="animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[0,1,2,3,4,5,6,7].map(i => (
              <div key={i} style={{ background: '#fff', borderRadius: 20, overflow: 'hidden', border: '1px solid #E8E4DE' }}>
                <div style={{ aspectRatio: '1', background: '#F0EDE8' }} className="animate-pulse" />
                <div style={{ padding: 14 }}>
                  <div style={{ height: 13, background: '#F0EDE8', borderRadius: 6, marginBottom: 8 }} className="animate-pulse" />
                  <div style={{ height: 15, width: '60%', background: '#F0EDE8', borderRadius: 6 }} className="animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Errors ────────────────────────────────────────────────────────────────
  if (error || !shop) {
    return (
      <div style={{ background: '#FAFAF8', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: '#F2EFE9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <Package style={{ width: 28, height: 28, color: '#7A7065' }} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 28, marginBottom: 8 }}>
          {error === 'not_found' ? `@${username} not found` : 'Could not load this shop'}
        </h1>
        <p style={{ fontSize: 14, color: '#7A7065', marginBottom: 24 }}>
          {error === 'not_found' ? "We couldn't find this shop on Maya." : 'Check your connection and try again.'}
        </p>
        <Link href="/marketplace" style={{ background: '#1A2E44', color: '#fff', padding: '12px 24px', borderRadius: 12, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
          Back to marketplace
        </Link>
      </div>
    )
  }

  const { seller, products } = shop
  const displayName = seller.displayName ?? seller.username
  const isClosed = seller.stallStatus === 'closed'
  const isVacation = seller.stallStatus === 'vacation'
  const gradient = coverGradient(seller.username)

  // Unique categories from products
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category as string).filter(Boolean)))]
  const filtered = activeFilter === 'all' ? products : products.filter(p => p.category === activeFilter)

  const CATEGORY_LABELS: Record<string, string> = {
    tailoring: 'Tailoring', carpentry: 'Carpentry', jewelry: 'Jewellery',
    art: 'Art', ceramics: 'Ceramics', leather: 'Leather', repairs: 'Repairs',
    crafts: 'Crafts', other: 'Other',
  }

  return (
    <div style={{ background: '#FAFAF8', minHeight: '100vh', fontFamily: 'var(--font-inter, system-ui)' }}>

      {/* ── COVER ──────────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', height: 280, background: gradient, overflow: 'hidden' }}>
        {/* Subtle texture overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'1\' fill=\'rgba(255,255,255,0.04)\'/%3E%3C/svg%3E")', backgroundSize: '60px 60px' }} />
        {/* Blur glow */}
        <div style={{ position: 'absolute', top: '20%', left: '30%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', filter: 'blur(60px)' }} />

        {/* Floating back button */}
        <button onClick={() => router.back()}
          style={{ position: 'absolute', top: 20, left: 20, width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          aria-label="Go back">
          <ArrowLeft style={{ width: 18, height: 18, color: '#fff' }} />
        </button>

        {/* Share button */}
        <button onClick={handleCopy}
          style={{ position: 'absolute', top: 20, right: 20, display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', color: '#fff', padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {copied ? <Check style={{ width: 14, height: 14 }} /> : <Share2 style={{ width: 14, height: 14 }} />}
          {copied ? 'Copied!' : 'Share'}
        </button>

        {/* Status badge */}
        {(isClosed || isVacation) && (
          <div style={{ position: 'absolute', bottom: 20, right: 20, background: isClosed ? 'rgba(192,57,43,0.85)' : 'rgba(212,152,58,0.85)', backdropFilter: 'blur(12px)', color: '#fff', padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
            {isClosed ? '● Closed' : '● On a break'}
          </div>
        )}
      </div>

      {/* ── SELLER INFO ─────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -48 }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {seller.avatar ? (
              <img src={seller.avatar} alt={displayName}
                style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '4px solid #FAFAF8', boxShadow: '0 4px 20px rgba(15,25,35,0.15)' }} />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: '50%', background: gradient, border: '4px solid #FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(15,25,35,0.15)' }}>
                <span style={{ fontFamily: 'var(--font-dm-serif)', color: '#fff', fontSize: 32, fontWeight: 400 }}>
                  {initials(seller.displayName, seller.username)}
                </span>
              </div>
            )}
            {/* Online dot */}
            {!isClosed && !isVacation && (
              <div style={{ position: 'absolute', bottom: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#2A7D4F', border: '3px solid #FAFAF8' }} />
            )}
          </div>

          {/* Quick actions */}
          <div style={{ display: 'flex', gap: 10, paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #E8E4DE', borderRadius: 999, padding: '6px 12px', fontSize: 12, color: '#7A7065' }}>
              <MapPin style={{ width: 12, height: 12 }} />
              Nigeria
            </div>
          </div>
        </div>

        {/* Name + badge + info */}
        <div style={{ paddingTop: 16, paddingBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
            <h1 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 'clamp(28px, 5vw, 40px)', margin: 0, color: '#0F1923', lineHeight: 1.1 }}>
              {displayName}
            </h1>
            <VerifiedSellerBadge username={seller.username} variant="chip" />
          </div>

          <p style={{ fontSize: 13, color: '#7A7065', marginBottom: 14 }}>
            @{seller.username} · {products.length} {products.length === 1 ? 'listing' : 'listings'}
          </p>

          {seller.about && (
            <p style={{ fontSize: 15, color: '#3A3530', lineHeight: 1.7, maxWidth: 560, marginBottom: 0 }}>
              {seller.about}
            </p>
          )}

          <LongBioBlock username={seller.username} />

          {/* Status message */}
          {(isClosed || isVacation) && seller.stallStatusMessage && (
            <div style={{ marginTop: 16, background: isClosed ? 'rgba(192,57,43,0.07)' : 'rgba(212,152,58,0.1)', border: `1px solid ${isClosed ? 'rgba(192,57,43,0.25)' : 'rgba(212,152,58,0.35)'}`, borderRadius: 12, padding: '12px 16px' }}>
              <p style={{ fontSize: 13, color: isClosed ? '#C0392B' : '#8B6914', margin: 0 }}>
                <strong>{isVacation ? 'On a break: ' : 'Shop closed: '}</strong>
                {seller.stallStatusMessage}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── DIVIDER LINE ────────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #E8E4DE' }} />

      {/* ── PRODUCTS ────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px 60px' }}>

        {products.length > 0 ? (
          <>
            {/* Section header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 28, margin: 0, color: '#0F1923' }}>
                {isClosed ? 'Catalog' : 'Available now'}
              </h2>
              <p style={{ fontSize: 13, color: '#7A7065', margin: 0 }}>{filtered.length} {filtered.length === 1 ? 'item' : 'items'}</p>
            </div>

            {/* Category filter pills */}
            {categories.length > 2 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 20, scrollbarWidth: 'none' }}>
                {categories.map(cat => (
                  <button key={cat} type="button" onClick={() => setActiveFilter(cat)}
                    style={{ flexShrink: 0, padding: '7px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: activeFilter === cat ? '1.5px solid #1A2E44' : '1.5px solid #E8E4DE', background: activeFilter === cat ? '#1A2E44' : '#fff', color: activeFilter === cat ? '#fff' : '#7A7065', transition: 'all 0.15s' }}>
                    {cat === 'all' ? 'All' : CATEGORY_LABELS[cat] ?? cat}
                  </button>
                ))}
              </div>
            )}

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map(product => (
                <ShopProductCard key={product.id} product={product} isClosed={isClosed} />
              ))}
            </div>

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <p style={{ fontSize: 14, color: '#7A7065' }}>No items in this category yet.</p>
                <button onClick={() => setActiveFilter('all')} style={{ marginTop: 12, fontSize: 13, color: '#C2692F', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                  View all listings →
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty state */
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg, #F2EFE9, #E8E4DE)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Package style={{ width: 32, height: 32, color: '#7A7065' }} />
            </div>
            <h3 style={{ fontFamily: 'var(--font-dm-serif)', fontSize: 26, margin: '0 0 8px', color: '#0F1923' }}>Nothing listed yet.</h3>
            <p style={{ fontSize: 14, color: '#7A7065', marginBottom: 24 }}>{displayName} hasn't listed anything yet. Check back soon.</p>
            <Link href="/marketplace" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1A2E44', color: '#fff', padding: '12px 22px', borderRadius: 12, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              Browse other sellers <ChevronRight style={{ width: 16, height: 16 }} />
            </Link>
          </div>
        )}
      </div>

      {/* ── TRUST STRIP ────────────────────────────────────────────────────── */}
      {products.length > 0 && (
        <div style={{ borderTop: '1px solid #E8E4DE', background: '#fff', padding: '20px' }}>
          <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '8px 32px' }}>
            {[
              [Shield, 'Escrow on every order'],
              [Star, 'Buyer protection'],
              [MessageCircle, 'Contact seller'],
            ].map(([Icon, label]) => (
              <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {/* @ts-expect-error icon component */}
                <Icon style={{ width: 14, height: 14, color: '#7A7065' }} />
                <span style={{ fontSize: 13, color: '#7A7065' }}>{label as string}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── REVIEWS ────────────────────────────────────────────────────────── */}
      <ReviewsSection username={seller.username} />

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <div style={{ borderTop: '1px solid #E8E4DE', padding: '24px 20px', textAlign: 'center' }}>
        <Link href="/marketplace" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#7A7065', textDecoration: 'none' }}>
          <ArrowLeft style={{ width: 14, height: 14 }} />
          Back to marketplace
        </Link>
      </div>
    </div>
  )
}
