'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2, ShieldCheck, Package } from 'lucide-react'

type VerifyState = 'loading' | 'success' | 'failed' | 'pending'

function VerifyContent() {
  const searchParams = useSearchParams()
  const reference = searchParams.get('reference') ?? searchParams.get('ref')
  const [state, setState] = useState<VerifyState>('loading')
  const [orderId, setOrderId] = useState<string | null>(null)

  useEffect(() => {
    if (!reference) { setState('failed'); return }

    let attempts = 0
    const maxAttempts = 8

    async function poll() {
      try {
        const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference!)}`)
        const data = await res.json()

        if (data.status === 'success') {
          setOrderId(data.payment?.orderId ?? null)
          setState('success')
        } else if (data.status === 'failed' || data.status === 'abandoned') {
          setState('failed')
        } else {
          // still pending — try again
          attempts++
          if (attempts < maxAttempts) {
            setTimeout(poll, 2000)
          } else {
            setState('pending')
          }
        }
      } catch {
        setState('failed')
      }
    }

    poll()
  }, [reference])

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center gap-5 px-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
        </div>
        <div>
          <p className="font-serif text-2xl text-foreground">Confirming payment…</p>
          <p className="font-sans text-sm text-muted mt-1">This takes just a moment</p>
        </div>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-5 text-center gap-6">
        {/* Success illustration */}
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-success/15 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-success" />
          </div>
          <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-primary-foreground" />
          </div>
        </div>

        <div>
          <h1 className="font-serif text-4xl text-foreground">Payment received!</h1>
          <p className="font-sans text-base text-muted mt-2 max-w-sm leading-relaxed">
            Your money is safely held in escrow. The seller has been notified and will prepare your order.
          </p>
        </div>

        {/* Escrow explanation */}
        <div className="w-full max-w-sm bg-white rounded-2xl border border-[#E8E4DE] p-5 text-left space-y-3">
          <p className="font-sans text-xs font-bold uppercase tracking-wider text-muted">What happens next</p>
          {[
            { step: '1', text: 'Seller prepares and ships your order' },
            { step: '2', text: 'You receive a notification when it\'s shipped' },
            { step: '3', text: 'Confirm delivery to release payment to seller' },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="font-sans text-xs font-bold text-primary">{step}</span>
              </div>
              <p className="font-sans text-sm text-foreground">{text}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 w-full max-w-sm">
          {orderId && (
            <Link href={`/buyer/orders/${orderId}`}
              className="flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-sans font-bold text-sm hover:bg-primary/90 transition-colors"
            >
              <Package className="w-4 h-4" /> Track your order
            </Link>
          )}
          <Link href="/buyer/orders"
            className="flex items-center justify-center py-3 rounded-xl border border-[#E8E4DE] font-sans text-sm font-semibold text-muted hover:text-foreground transition-colors"
          >
            View all orders
          </Link>
        </div>
      </div>
    )
  }

  if (state === 'pending') {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-5 text-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gold/15 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-gold" />
        </div>
        <div>
          <h1 className="font-serif text-3xl text-foreground">Payment is processing</h1>
          <p className="font-sans text-sm text-muted mt-2 max-w-sm leading-relaxed">
            Your payment is being processed by Paystack. This can take a few minutes. Check your orders for the latest status.
          </p>
        </div>
        <Link href="/buyer/orders"
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-sans font-bold text-sm hover:bg-primary/90 transition-colors"
        >
          View my orders
        </Link>
      </div>
    )
  }

  // Failed
  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-5 text-center gap-5">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <XCircle className="w-8 h-8 text-destructive" />
      </div>
      <div>
        <h1 className="font-serif text-3xl text-foreground">Payment not completed</h1>
        <p className="font-sans text-sm text-muted mt-2 max-w-sm leading-relaxed">
          Your payment didn't go through. No money was charged. You can try again from your order.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Link href="/buyer/orders"
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl font-sans font-bold text-sm hover:bg-primary/90 transition-colors"
        >
          View my orders
        </Link>
        <Link href="/marketplace"
          className="flex items-center justify-center py-3 rounded-xl border border-[#E8E4DE] font-sans text-sm font-semibold text-muted hover:text-foreground transition-colors"
        >
          Back to marketplace
        </Link>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}
