'use client'

import { Suspense, use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ShieldCheck, Loader2, Package, Lock, CreditCard, Building2, Smartphone } from 'lucide-react'

import { ApiError } from '@/lib/api-error'
import { getOrder } from '@/lib/api/commerce'
import { useSession } from '@/lib/auth/use-session'
import type { Order } from '@/types/shared'

const NGN_PER_BTC = 145_000_000n
const SATS_PER_BTC = 100_000_000n

function fmtNgn(satsStr: string): string {
  try {
    const sats = BigInt(satsStr)
    return `₦${Number((sats * NGN_PER_BTC) / SATS_PER_BTC).toLocaleString('en-NG')}`
  } catch { return '₦0' }
}

function amountKobo(satsStr: string): number {
  try {
    const sats = BigInt(satsStr)
    const ngn = Number((sats * NGN_PER_BTC) / SATS_PER_BTC)
    return ngn * 100
  } catch { return 0 }
}

function CheckoutContent({ params }: { params: Promise<{ orderId: string }> }) {
  const router = useRouter()
  const { orderId } = use(params)
  const { user, isLoading: sessionLoading } = useSession()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionLoading && !user) router.push('/signin')
  }, [sessionLoading, user, router])

  useEffect(() => {
    if (!user) return
    getOrder(orderId)
      .then(setOrder)
      .catch(err => {
        if (err instanceof ApiError && err.statusCode === 401) router.push('/signin')
        else setError('Could not load your order. Please go back and try again.')
      })
      .finally(() => setLoading(false))
  }, [orderId, user, router])

  const handlePay = async () => {
    if (!order || paying) return
    setPaying(true)
    setError(null)
    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          amountKobo: amountKobo(order.totalSats),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Payment initialization failed')
      // Redirect to Paystack hosted page
      window.location.href = data.authorizationUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment. Try again.')
      setPaying(false)
    }
  }

  if (sessionLoading || loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-5 text-center gap-4">
        <p className="font-sans text-base text-muted">{error}</p>
        <Link href="/marketplace" className="font-sans text-sm text-primary underline">Back to marketplace</Link>
      </div>
    )
  }

  if (!order) return null

  const item = order.items[0]
  const totalNgn = fmtNgn(order.totalSats)

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* Nav */}
      <div className="bg-white border-b border-[#E8E4DE] sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-5 py-4 flex items-center gap-3">
          <Link href={item ? `/products/${item.productId}` : '/marketplace'} className="text-muted hover:text-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="font-serif text-primary-foreground text-sm">M</span>
            </div>
            <span className="font-serif text-lg">Maya · Checkout</span>
          </div>
          <div className="flex items-center gap-1 text-muted">
            <Lock className="w-3.5 h-3.5" />
            <span className="font-sans text-xs">Secure</span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-8 space-y-5">

        {/* Order summary card */}
        <div className="bg-white rounded-2xl border border-[#E8E4DE] overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-[#E8E4DE]">
            <p className="font-sans text-xs font-bold uppercase tracking-wider text-muted">Order summary</p>
          </div>
          {item && (
            <div className="flex gap-4 p-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#F0EDE8]">
                {item.productImage ? (
                  <img src={item.productImage} alt={item.productTitle} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-muted/30" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-sm font-semibold text-foreground line-clamp-2">{item.productTitle}</p>
                <p className="font-sans text-xs text-muted mt-1">Qty: {item.quantity}</p>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between font-sans text-xs text-muted">
                    <span>Subtotal</span>
                    <span>{fmtNgn((BigInt(item.priceSats) * BigInt(item.quantity)).toString())}</span>
                  </div>
                  {BigInt(order.shippingSats) > 0n && (
                    <div className="flex justify-between font-sans text-xs text-muted">
                      <span>Shipping</span>
                      <span>{fmtNgn(order.shippingSats)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-sans text-sm font-bold pt-1 border-t border-[#F0EDE8] mt-1">
                    <span>Total</span>
                    <span className="text-primary">{totalNgn}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Escrow notice */}
        <div className="bg-primary/8 border border-primary/20 rounded-2xl px-5 py-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-sans text-sm font-semibold text-foreground">Protected by escrow</p>
            <p className="font-sans text-xs text-muted mt-0.5 leading-relaxed">
              Your payment is held securely by Maya. It's released to the seller only after you confirm delivery.
            </p>
          </div>
        </div>

        {/* Payment methods */}
        <div className="bg-white rounded-2xl border border-[#E8E4DE] overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-[#E8E4DE]">
            <p className="font-sans text-xs font-bold uppercase tracking-wider text-muted">Pay with Paystack</p>
          </div>
          <div className="px-5 py-4 grid grid-cols-3 gap-3">
            {[
              { icon: CreditCard, label: 'Card' },
              { icon: Building2, label: 'Bank transfer' },
              { icon: Smartphone, label: 'USSD' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-[#F7F8FA] border border-[#E8E4DE]">
                <Icon className="w-5 h-5 text-primary" />
                <span className="font-sans text-[11px] font-semibold text-muted text-center">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-destructive/8 border border-destructive/20 rounded-xl px-4 py-3">
            <p className="font-sans text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Pay button */}
        <button
          onClick={handlePay}
          disabled={paying}
          className="w-full flex items-center justify-center gap-3 bg-primary text-primary-foreground py-4 rounded-2xl font-sans font-bold text-base hover:bg-primary/90 transition-colors disabled:opacity-60 shadow-lg shadow-primary/20"
        >
          {paying ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to Paystack…</>
          ) : (
            <><CreditCard className="w-5 h-5" /> Pay {totalNgn} securely</>
          )}
        </button>

        <p className="font-sans text-[11px] text-muted text-center">
          By paying you agree to Maya's terms · Powered by Paystack
        </p>
      </div>
    </div>
  )
}

export default function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <CheckoutContent params={params} />
    </Suspense>
  )
}
