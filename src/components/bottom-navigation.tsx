'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from '@/lib/auth/use-session'

export default function BottomNavigation() {
  const pathname = usePathname()
  const { user } = useSession()
  const isSeller = user?.role === 'SELLER'

  const tabs = isSeller
    ? [
        { id: 'explore', label: 'Explore', href: '/' },
        { id: 'products', label: 'Products', href: '/seller' },
        { id: 'profile', label: 'Profile', href: '/profile' },
      ]
    : [
        { id: 'explore', label: 'Explore', href: '/' },
        { id: 'orders', label: 'Orders', href: '/buyer/orders' },
        { id: 'profile', label: 'Profile', href: '/profile' },
      ]

  const getActiveTab = () => {
    if (pathname === '/') return 'explore'
    if (pathname.startsWith('/seller')) return 'products'
    if (pathname.startsWith('/products')) return 'products'
    if (pathname.startsWith('/buyer/orders')) return 'orders'
    if (pathname.startsWith('/profile')) return 'profile'
    return 'explore'
  }

  const activeTab = getActiveTab()

  return (
    <nav className="bg-white border-t border-[#E8D4C5] px-4 py-2 fixed bottom-0 left-0 right-0 h-16">
      <div className="flex justify-around items-center max-w-md mx-auto h-full">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={`flex flex-col items-center justify-center min-h-[56px] min-w-[56px] rounded-lg transition-all ${
              activeTab === tab.id
                ? 'text-maya-primary'
                : 'text-maya-muted hover:text-maya-text'
            }`}
            aria-label={tab.label}
          >
            {/* Icon representation */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mb-1"
            >
              {tab.id === 'explore' && (
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                  fill="currentColor"
                />
              )}
              {tab.id === 'products' && (
                <g fill="currentColor" opacity={activeTab === 'products' ? '1' : '0.6'}>
                  <rect x="4" y="4" width="7" height="7" />
                  <rect x="13" y="4" width="7" height="7" />
                  <rect x="4" y="13" width="7" height="7" />
                  <rect x="13" y="13" width="7" height="7" />
                </g>
              )}
              {tab.id === 'orders' && (
                <path
                  d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"
                  fill="currentColor"
                />
              )}
              {tab.id === 'profile' && (
                <path
                  d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                  fill="currentColor"
                />
              )}
            </svg>
            <span className="text-[11px] font-medium">{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
