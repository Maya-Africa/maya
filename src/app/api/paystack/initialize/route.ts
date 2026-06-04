import { NextRequest, NextResponse } from 'next/server'
import { initializePayment } from '@/services/paystack/client'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Please sign in to continue' }, { status: 401 })
  }

  const body = await req.json() as {
    orderId?: string
    escrowId?: string
    amountKobo?: number
  }
  const { orderId, escrowId, amountKobo: bodyKobo } = body

  if (!orderId && !escrowId) {
    return NextResponse.json({ error: 'orderId or escrowId required' }, { status: 400 })
  }

  const buyer = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, displayName: true },
  })
  if (!buyer) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Use email from session or derive a placeholder — Paystack requires an email field
  const email = `${buyer.username}@maya-user.com`

  let amountKobo: number
  let reference: string
  let metadata: Record<string, unknown>

  if (orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId } })
    if (!order || order.buyerId !== session.userId) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.status !== 'PENDING') {
      return NextResponse.json({ error: 'Order has already been paid' }, { status: 400 })
    }
    // Accept caller-supplied kobo (already computed from NGN) or fall back to sats * demo rate
    const NGN_PER_BTC = 145_000_000n
    const SATS_PER_BTC = 100_000_000n
    const ngnAmount = Number((order.totalSats * NGN_PER_BTC) / SATS_PER_BTC)
    amountKobo = bodyKobo ?? ngnAmount * 100
    reference = `ord_${orderId}_${randomUUID().slice(0, 8)}`
    metadata = { type: 'order', orderId, buyerName: buyer.displayName ?? buyer.username }
  } else {
    const escrow = await prisma.escrow.findUnique({ where: { id: escrowId! } })
    if (!escrow || escrow.buyerId !== session.userId) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }
    amountKobo = bodyKobo ?? Number(escrow.amountKobo)
    reference = `esc_${escrowId}_${randomUUID().slice(0, 8)}`
    metadata = { type: 'escrow', escrowId }
  }

  if (amountKobo < 10000) {
    return NextResponse.json({ error: 'Minimum order amount is ₦100' }, { status: 400 })
  }

  const result = await initializePayment({
    email,
    amountKobo,
    reference,
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/checkout/verify?reference=${reference}`,
    metadata,
  })

  // Track this payment attempt
  await prisma.paystackPayment.create({
    data: {
      reference,
      status: 'pending',
      amountKobo: BigInt(amountKobo),
      orderId: orderId ?? null,
      escrowId: escrowId ?? null,
      buyerId: session.userId,
    },
  })

  return NextResponse.json({ authorizationUrl: result.authorization_url, reference })
}
