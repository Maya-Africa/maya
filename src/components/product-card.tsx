'use client'

import { useState } from 'react'
import { Heart, ShieldCheck, Star } from 'lucide-react'

interface ProductCardProps {
  image: string
  title: string
  sellerName?: string
  sellerAvatar?: string
  priceNaira: number
  priceSats: number
  category?: string
  rating?: number
  reviewCount?: number
  freeShipping?: boolean
  isNew?: boolean
  href?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  tailoring: 'Tailoring',
  carpentry: 'Carpentry',
  jewelry: 'Jewellery',
  art: 'Art',
  ceramics: 'Ceramics',
  leather: 'Leather',
  repairs: 'Repairs',
  crafts: 'Crafts',
  other: 'Other',
}

export default function ProductCard({
  image,
  title,
  sellerName,
  priceNaira,
  category,
  rating,
  reviewCount,
  freeShipping,
  isNew,
}: ProductCardProps) {
  const [saved, setSaved] = useState(false)

  return (
    <div className="group relative flex flex-col bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer">

      {/* Image container */}
      <div className="relative aspect-square overflow-hidden bg-border/20">
        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-border/30 to-border/10 flex items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-border/40 flex items-center justify-center">
              <span className="text-muted text-xl">✦</span>
            </div>
          </div>
        )}

        {/* Top badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {category && (
            <span className="bg-background/90 backdrop-blur-sm text-foreground text-[10px] font-sans font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
              {CATEGORY_LABELS[category] ?? category}
            </span>
          )}
          {isNew && (
            <span className="bg-accent text-white text-[10px] font-sans font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
              New
            </span>
          )}
        </div>

        {/* Save / wishlist button */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSaved(v => !v) }}
          aria-label={saved ? 'Remove from saved' : 'Save'}
          className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${
            saved
              ? 'bg-accent text-white'
              : 'bg-background/90 backdrop-blur-sm text-muted hover:text-accent hover:bg-background'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${saved ? 'fill-current' : ''}`} />
        </button>

        {/* Escrow badge */}
        <div className="absolute bottom-2.5 right-2.5">
          <div className="flex items-center gap-1 bg-primary/90 backdrop-blur-sm text-primary-foreground text-[9px] font-sans font-semibold px-2 py-1 rounded-full uppercase tracking-wide">
            <ShieldCheck className="w-2.5 h-2.5" />
            Escrow
          </div>
        </div>

        {/* Free shipping banner */}
        {freeShipping && (
          <div className="absolute bottom-2.5 left-2.5 bg-success/90 backdrop-blur-sm text-white text-[9px] font-sans font-bold px-2 py-1 rounded-full uppercase tracking-wide">
            Free delivery
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-3.5 gap-1.5">
        {/* Seller */}
        {sellerName && (
          <p className="font-sans text-[11px] text-muted truncate">{sellerName}</p>
        )}

        {/* Title */}
        <h3 className="font-sans text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </h3>

        {/* Rating */}
        {typeof rating === 'number' && rating > 0 && (
          <div className="flex items-center gap-1">
            <div className="flex">
              {[1,2,3,4,5].map(n => (
                <Star
                  key={n}
                  className={`w-3 h-3 ${n <= Math.round(rating) ? 'text-gold fill-gold' : 'text-border'}`}
                />
              ))}
            </div>
            {reviewCount != null && reviewCount > 0 && (
              <span className="font-sans text-[10px] text-muted">({reviewCount})</span>
            )}
          </div>
        )}

        {/* Price row */}
        <div className="mt-auto pt-1.5">
          <p className="font-sans text-base font-bold text-foreground">
            ₦{priceNaira.toLocaleString('en-NG')}
          </p>
        </div>
      </div>
    </div>
  )
}
