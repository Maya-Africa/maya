'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, Copy } from 'lucide-react'

// Sample product data
const PRODUCTS: Record<string, any> = {
  '1': { title: 'Geometric Abstract Composition', priceNaira: 45000, priceSats: 125000 },
  '2': { title: 'Indigo Woven Textile', priceNaira: 28000, priceSats: 85000 },
  '3': { title: 'Handthrown Ceramic Vessel', priceNaira: 35000, priceSats: 95000 },
  '4': { title: 'Contemporary Color Field', priceNaira: 52000, priceSats: 145000 },
  '5': { title: 'Tooled Leather Journal', priceNaira: 22000, priceSats: 65000 },
  '6': { title: 'Beaded Statement Collar', priceNaira: 38000, priceSats: 110000 },
  '7': { title: 'Bronze Sculptural Form', priceNaira: 88000, priceSats: 280000 },
  '8': { title: 'Woodcut Print Series', priceNaira: 18000, priceSats: 55000 },
}

const PlaceholderQRCode = ({ size = 280 }: { size?: number }) => (
  <svg viewBox="0 0 200 200" width={size} height={size} className="w-full h-full">
    <rect width="200" height="200" fill="white" />
    <rect x="10" y="10" width="40" height="40" fill="black" />
    <rect x="150" y="10" width="40" height="40" fill="black" />
    <rect x="10" y="150" width="40" height="40" fill="black" />
    <rect x="50" y="50" width="10" height="10" fill="black" />
    <rect x="70" y="50" width="10" height="10" fill="black" />
    <rect x="90" y="50" width="10" height="10" fill="black" />
    <rect x="50" y="70" width="10" height="10" fill="black" />
    <rect x="90" y="70" width="10" height="10" fill="black" />
    <rect x="50" y="90" width="10" height="10" fill="black" />
    <rect x="70" y="90" width="10" height="10" fill="black" />
    <rect x="90" y="90" width="10" height="10" fill="black" />
    <rect x="110" y="70" width="10" height="10" fill="black" />
    <rect x="130" y="50" width="10" height="10" fill="black" />
    <rect x="70" y="110" width="10" height="10" fill="black" />
    <rect x="110" y="110" width="10" height="10" fill="black" />
    <rect x="130" y="130" width="10" height="10" fill="black" />
  </svg>
)

export default function CheckoutClient({ orderId }: { orderId: string }) {
  const [copied, setCopied] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(864)

  // For demo, use product 1
  const product = PRODUCTS['1']
  const shippingCost = 300
  const totalNaira = product.priceNaira + shippingCost

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => (prev <= 0 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60

  const handleCopyInvoice = () => {
    const invoiceText = `Lightning Invoice for ${product.title}\nAmount: ${totalNaira} NGN (${product.priceSats} sats)\nOrder: ${orderId}`
    navigator.clipboard.writeText(invoiceText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#FBF7F0] flex flex-col">
      {/* Back Button */}
      <div className="fixed top-0 left-0 z-20 px-5 py-4">
        <Link
          href="/products/1"
          className="flex items-center justify-center w-11 h-11 rounded-lg hover:bg-[#F5EDE0] transition-colors"
          aria-label="Back"
        >
          <ChevronLeft size={24} className="text-[#2D5F5D]" />
        </Link>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 py-8 lg:px-10">
        <div className="w-full max-w-md lg:max-w-[600px]">
          {/* Header Section */}
          <div className="text-center mb-12 lg:mb-16">
            <h1 className="font-serif text-[28px] text-[#1F1410] font-normal mb-3">
              Pay with Lightning
            </h1>
            <p className="text-[#7D6F66] text-base font-normal">
              Scan with any Lightning wallet
            </p>
          </div>

          {/* QR Code Card */}
          <div className="bg-white rounded-lg shadow-sm p-7 lg:p-9 mb-8 flex justify-center">
            <div className="w-72 h-72 lg:w-80 lg:h-80">
              <PlaceholderQRCode size={280} />
            </div>
          </div>

          {/* Amount Section */}
          <div className="text-center mb-8">
            <p
              className="font-serif text-[36px] text-[#D67961] font-normal mb-2"
              style={{ textDecoration: 'none' }}
            >
              ₦{totalNaira.toLocaleString('en-US')}
            </p>
            <p className="text-[#7D6F66] text-sm font-normal">
              {product.priceSats.toLocaleString('en-US')} sats · includes ₦{shippingCost} shipping
            </p>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-2 h-2 rounded-full bg-[#E8B43D] animate-pulse" />
            <span className="text-[#7D6F66] text-sm font-normal">
              Waiting for payment…
            </span>
          </div>

          {/* Copy Invoice Button */}
          <div className="flex justify-center mb-8">
            <button
              onClick={handleCopyInvoice}
              className="flex items-center gap-2 text-[#2D5F5D] font-medium text-sm hover:text-[#1F4A48] transition-colors"
              type="button"
            >
              <Copy size={16} />
              {copied ? 'Copied!' : 'Copy invoice'}
            </button>
          </div>

          {/* Expiry Hint */}
          <div className="text-center">
            <p className="text-[#7D6F66] text-xs font-normal">
              Invoice expires in {minutes}:{seconds.toString().padStart(2, '0')}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
