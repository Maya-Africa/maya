'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Search, ShoppingBag } from 'lucide-react'
import { useSession } from '@/lib/auth/use-session'

export default function BrowseHeader() {
  const router = useRouter()
  const { user } = useSession()

  return (
    <header style={{ background: '#FAFAF8', borderBottom: '1px solid #E8E4DE', padding: '14px 20px 12px', position: 'sticky', top: 0, zIndex: 40 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Back */}
        <button
          onClick={() => router.back()}
          style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid #E8E4DE', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          aria-label="Go back"
        >
          <ArrowLeft style={{ width: 18, height: 18, color: '#1A2E44' }} />
        </button>

        {/* Search bar */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1.5px solid #E8E4DE', borderRadius: 12, padding: '10px 14px', minWidth: 0 }}>
          <Search style={{ width: 16, height: 16, color: '#7A7065', flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: '#B0A89E', fontFamily: 'inherit' }}>Search crafts, tailoring, repairs…</span>
        </div>

        {/* Orders bag icon — shown for buyers */}
        {user && user.role === 'BUYER' && (
          <Link
            href="/buyer/orders"
            aria-label="Your orders"
            style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid #E8E4DE', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}
          >
            <ShoppingBag style={{ width: 18, height: 18, color: '#1A2E44' }} />
          </Link>
        )}

        {/* Maya wordmark — taps back to home */}
        <Link href="/" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#1A2E44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-dm-serif)', color: '#fff', fontSize: 18, lineHeight: 1 }}>M</span>
          </div>
        </Link>
      </div>
    </header>
  )
}
