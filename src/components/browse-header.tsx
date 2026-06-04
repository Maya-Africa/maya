'use client'

import { Search } from 'lucide-react'

export default function BrowseHeader() {
  return (
    <header className="bg-[#FBF7F0] border-b border-[#E5DDD0]" style={{ paddingLeft: '20px', paddingRight: '20px', paddingTop: '16px', paddingBottom: '16px' }}>
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-serif text-[28px] text-maya-text font-normal">
          Maya
        </h1>
        <button
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#F5EDE0] transition-colors"
          aria-label="Search"
        >
          <Search size={24} className="text-maya-text" />
        </button>
      </div>
      <p className="text-maya-muted text-sm font-normal">
        Crafted by hand. Paid in Lightning.
      </p>
    </header>
  )
}
