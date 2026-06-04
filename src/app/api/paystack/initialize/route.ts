import { NextRequest, NextResponse } from 'next/server'
import { initializePayment } from '@/services/paystack/client'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
  }

  const { orderId, escrowId } = await req.json() as { orderId?: string; escrowId?: string }
  if (!orderId && !escrowId) {
    return NextResponse.json({ error: 'orderId or escrowId required' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  let amountKobo: number
  let email: string
  let reference: string
  let metadata: Record<string, unknown>

  if (orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { buyer: { select: { username: true } } },
    })
    if (!order || order.buyerId !== session.userId) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    amountKobo = Number(order.totalSats) * 100
    email = `${order.buyer.username}@maya.placeholder`
    reference = `ord_${orderId}_${randomUUID().slice(0, 8)}`
    metadata = { type: 'order', orderId }
  } else {
    const escrow = await prisma.escrow.findUnique({ where: { id: escrowId! } })
    if (!escrow || escrow.buyerId !== session.userId) {
      return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
    }
    const buyer = await prisma.user.findUnique({ where: { id: session.userId }, select: { username: true } })
    amountKobo = Number(escrow.amountKobo)
    email = `${buyer!.username}@maya.placeholder`
    reference = `esc_${escrowId}_${randomUUID().slice(0, 8)}`
    metadata = { type: 'escrow', escrowId }
  }

  const result = await initializePayment({
    email,
    amountKobo,
    reference,
    callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/verify?ref=${reference}`,
    metadata,
  })

  await prisma.paystackPayment.create({
    data: {
      reference,
      status: 'pending',
      amountKobo,
      orderId: orderId ?? null,
      escrowId: escrowId ?? null,
      buyerId: session.userId,
    },
  })

  return NextResponse.json({ authorizationUrl: result.authorization_url, reference })
}
