import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/services/paystack/client'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-paystack-signature') ?? ''

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody) as { event: string; data: Record<string, unknown> }

  if (event.event === 'charge.success') {
    const data = event.data as {
      reference: string
      paid_at: string
      amount: number
      metadata?: { type?: string; escrowId?: string; orderId?: string }
    }

    const payment = await prisma.paystackPayment.findUnique({ where: { reference: data.reference } })
    if (!payment || payment.status === 'success') {
      return NextResponse.json({ received: true })
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.paystackPayment.update({
        where: { reference: data.reference },
        data: { status: 'success', paidAt: new Date(data.paid_at) },
      })

      if (payment.orderId) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID', paidAt: new Date(data.paid_at) },
        })
      }

      if (payment.escrowId) {
        await tx.escrow.update({
          where: { id: payment.escrowId },
          data: { status: 'FUNDED', fundedAt: new Date(data.paid_at) },
        })
      }
    })
  }

  return NextResponse.json({ received: true })
}
