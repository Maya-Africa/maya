'use client'

import { useState } from 'react'

import type { ProductCategory } from '@/types/shared'

// First entry is the catch-all (no filter). The rest map UI labels to
// the API's ProductCategory enum so the marketplace can pass `value`
// straight through to listProducts().
const CATEGORIES: { label: string; value: ProductCategory | null }[] = [
  { label: 'All', value: null },
  { label: 'Paintings', value: 'paintings' },
  { label: 'Jewelry', value: 'jewelry' },
  { label: 'Textiles', value: 'textiles' },
  { label: 'Leather', value: 'leather' },
  { label: 'Pottery', value: 'pottery' },
  { label: 'Sculpture', value: 'sculpture' },
  { label: 'Prints', value: 'prints_digital' },
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
    <div className="sticky top-0 z-10 bg-maya-background pt-6 pb-6 border-b border-[#E5DDD0]">
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide pl-5 pr-5">
        {CATEGORIES.map((category) => (
          <button
            key={category.label}
            onClick={() => handleCategoryChange(category.label, category.value)}
            className={`px-3 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all min-h-[44px] flex items-center ${
              selectedLabel === category.label
                ? 'bg-[#2D5F5D] text-white border-none'
                : 'bg-white border-[1.5px] border-[#2D5F5D] text-[#2D5F5D]'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  )
}
