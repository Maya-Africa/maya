import { NextRequest, NextResponse } from 'next/server'
import { verifyPayment } from '@/services/paystack/client'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference')
  if (!reference) return NextResponse.json({ error: 'reference required' }, { status: 400 })

  const payment = await prisma.paystackPayment.findUnique({ where: { reference } })
  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

  if (payment.status === 'success') {
    return NextResponse.json({ status: 'success', payment })
  }

  const result = await verifyPayment(reference)

  if (result.status === 'success') {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.paystackPayment.update({
        where: { reference },
        data: { status: 'success', paidAt: new Date(result.paid_at!) },
      })

      if (payment.orderId) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { status: 'PAID', paidAt: new Date(result.paid_at!) },
        })
      }

      if (payment.escrowId) {
        await tx.escrow.update({
          where: { id: payment.escrowId },
          data: { status: 'FUNDED', fundedAt: new Date(result.paid_at!) },
        })
      }
    })
  } else if (result.status === 'failed' || result.status === 'abandoned') {
    await prisma.paystackPayment.update({
      where: { reference },
      data: { status: result.status },
    })
  }

  return NextResponse.json({ status: result.status })
}
