import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

// PATCH /api/escrow/[id]/milestones/[milestoneId] — seller updates milestone status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { id, milestoneId } = await params

  const escrow = await prisma.escrow.findUnique({ where: { id } })
  if (!escrow) return NextResponse.json({ error: 'Escrow not found' }, { status: 404 })
  if (escrow.sellerId !== session.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { status } = await req.json() as { status: 'IN_PROGRESS' | 'SUBMITTED' }
  const allowed: Array<'IN_PROGRESS' | 'SUBMITTED'> = ['IN_PROGRESS', 'SUBMITTED']
  if (!allowed.includes(status)) {
    return NextResponse.json({ error: 'Invalid status. Seller can set IN_PROGRESS or SUBMITTED.' }, { status: 400 })
  }

  const updated = await prisma.milestone.update({
    where: { id: milestoneId, escrowId: id },
    data: { status },
  })

  return NextResponse.json(updated)
}
