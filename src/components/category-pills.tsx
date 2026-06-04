'use client'

import { useState } from 'react'

import type { ProductCategory } from '@/types/shared'

// First entry is the catch-all (no filter). The rest map UI labels to
// the API's ProductCategory enum so the marketplace can pass `value`
// straight through to listProducts().
const CATEGORIES: { label: string; value: ProductCategory | null }[] = [
  { label: 'All', value: null },
  { label: 'Tailoring', value: 'tailoring' },
  { label: 'Carpentry', value: 'carpentry' },
  { label: 'Jewellery', value: 'jewelry' },
  { label: 'Art', value: 'art' },
  { label: 'Ceramics', value: 'ceramics' },
  { label: 'Leather', value: 'leather' },
  { label: 'Repairs', value: 'repairs' },
  { label: 'Crafts', value: 'crafts' },
  { label: 'Other', value: 'other' },
]

interface CategoryPillsProps {
  onCategoryChange?: (category: ProductCategory | null) => void
}

export default function CategoryPills({ onCategoryChange }: CategoryPillsProps) {
  const [selectedLabel, setSelectedLabel] = useState('All')

  const handleCategoryChange = (label: string, value: ProductCategory | null) => {
    setSelectedLabel(label)
    onCategoryChange?.(value)
  }

  return (
    <div className="sticky top-0 z-10 bg-background pt-4 pb-4 border-b border-border">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide pl-5 pr-5">
        {CATEGORIES.map((category) => (
          <button
            key={category.label}
            onClick={() => handleCategoryChange(category.label, category.value)}
            className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-semibold transition-all min-h-[36px] flex items-center uppercase tracking-wide ${
              selectedLabel === category.label
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-card border border-border text-muted hover:border-primary/40 hover:text-foreground'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  )
}
