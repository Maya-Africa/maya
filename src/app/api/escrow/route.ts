import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/session'

// POST /api/escrow — create a new escrow
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const body = await req.json() as {
    sellerId: string
    title: string
    description?: string
    amountKobo: number
    orderId?: string
    milestones?: Array<{ title: string; description?: string; amountKobo: number; position: number }>
  }

  const { sellerId, title, description, amountKobo, orderId, milestones } = body

  if (!sellerId || !title || !amountKobo) {
    return NextResponse.json({ error: 'sellerId, title, and amountKobo are required' }, { status: 400 })
  }

  if (milestones) {
    const milestoneTotal = milestones.reduce((sum, m) => sum + m.amountKobo, 0)
    if (milestoneTotal !== amountKobo) {
      return NextResponse.json({ error: 'Milestone amounts must sum to total escrow amount' }, { status: 400 })
    }
  }

  const escrow = await prisma.escrow.create({
    data: {
      buyerId: session.userId,
      sellerId,
      title,
      description,
      amountKobo,
      orderId: orderId ?? null,
      milestones: milestones
        ? {
            create: milestones.map((m) => ({
              title: m.title,
              description: m.description,
              amountKobo: m.amountKobo,
              position: m.position,
            })),
          }
        : undefined,
    },
    include: { milestones: { orderBy: { position: 'asc' } } },
  })

  return NextResponse.json(escrow, { status: 201 })
}

// GET /api/escrow — list escrows for the current user
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.userId) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const role = req.nextUrl.searchParams.get('role') ?? 'buyer'

  const escrows = await prisma.escrow.findMany({
    where: role === 'seller' ? { sellerId: session.userId } : { buyerId: session.userId },
    include: { milestones: { orderBy: { position: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(escrows)
}
