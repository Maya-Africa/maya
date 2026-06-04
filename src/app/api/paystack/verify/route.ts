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

        // Auto-create escrow for this order if it doesn't exist yet
        const order = await tx.order.findUnique({
          where: { id: payment.orderId },
          include: { items: { include: { product: true } } },
        })
        const existingEscrow = order
          ? await tx.escrow.findUnique({ where: { orderId: payment.orderId } })
          : null
        if (order && !existingEscrow) {
          const title = order.items[0]?.product.title
            ? `Order: ${order.items[0].product.title}`
            : `Order #${order.id.slice(0, 8)}`
          await tx.escrow.create({
            data: {
              buyerId: order.buyerId,
              sellerId: order.sellerId,
              orderId: order.id,
              title,
              amountKobo: BigInt(payment.amountKobo),
              status: 'FUNDED',
              fundedAt: new Date(result.paid_at!),
            },
          })
        }
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
