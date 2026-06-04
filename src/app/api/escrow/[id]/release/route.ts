import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import type { Prisma } from '@prisma/client'

// POST /api/escrow/[id]/release — buyer releases ALL remaining funds to seller
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { id } = await params

  const escrow = await prisma.escrow.findUnique({
    where: { id },
    include: { milestones: true },
  })

  if (!escrow) return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
  if (escrow.buyerId !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (escrow.status !== 'FUNDED' && escrow.status !== 'PARTIAL') {
    return NextResponse.json({ error: `Cannot release escrow in status ${escrow.status}` }, { status: 400 })
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.milestone.updateMany({
      where: { escrowId: id, status: { in: ['PENDING', 'IN_PROGRESS', 'SUBMITTED'] } },
      data: { status: 'RELEASED', releasedAt: new Date() },
    })

    return tx.escrow.update({
      where: { id },
      data: { status: 'RELEASED', releasedAt: new Date() },
      include: { milestones: { orderBy: { position: 'asc' } } },
    })
  })

  return NextResponse.json(updated)
}
