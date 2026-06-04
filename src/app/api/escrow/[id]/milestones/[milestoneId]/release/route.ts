import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'
import type { Prisma } from '@prisma/client'

// POST /api/escrow/[id]/milestones/[milestoneId]/release — buyer releases a single milestone
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { id, milestoneId } = await params

  const escrow = await prisma.escrow.findUnique({
    where: { id },
    include: { milestones: { orderBy: { position: 'asc' } } },
  })

  if (!escrow) return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
  if (escrow.buyerId !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (escrow.status !== 'FUNDED' && escrow.status !== 'PARTIAL') {
    return NextResponse.json({ error: `Cannot release milestone on escrow in status ${escrow.status}` }, { status: 400 })
  }

  const milestone = escrow.milestones.find((m) => m.id === milestoneId)
  if (!milestone) return NextResponse.json({ error: 'Milestone not found' }, { status: 404 })
  if (milestone.status === 'RELEASED') {
    return NextResponse.json({ error: 'Milestone already released' }, { status: 400 })
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.milestone.update({
      where: { id: milestoneId },
      data: { status: 'RELEASED', releasedAt: new Date() },
    })

    const remaining = await tx.milestone.count({
      where: { escrowId: id, status: { not: 'RELEASED' } },
    })

    const newStatus = remaining === 0 ? 'RELEASED' : 'PARTIAL'
    return tx.escrow.update({
      where: { id },
      data: {
        status: newStatus,
        releasedAt: newStatus === 'RELEASED' ? new Date() : null,
      },
      include: { milestones: { orderBy: { position: 'asc' } } },
    })
  })

  return NextResponse.json(updated)
}
