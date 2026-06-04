'use client'

import { useState } from 'react'
import Header from '@/components/header'
import EmptyState from '@/components/empty-state'
import BottomNavigation from '@/components/bottom-navigation'

export default function ProductsPage() {
  return (
    <div className="flex flex-col h-screen bg-maya-background">
      {/* Header */}
      <Header />

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-auto">
        <EmptyState />
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  )
}
