import { NextRequest, NextResponse } from 'next/server';

import {
  getProduct,
  updateProductForSeller,
  deleteProductForSeller,
} from '@/services/catalog/service';
import { getSession } from '@/lib/session';
import { requireSeller } from '@/services/auth/service';
import { handleApiError, ApiError } from '@/lib/api-error';
import { updateProductSchema } from '@/validators/product';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const product = await getProduct(id);
    return NextResponse.json({ product });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = requireSeller(await getSession());
    const { id } = await params;

    const parsed = updateProductSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ApiError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid input', 400);
    }

    const product = await updateProductForSeller(id, session.userId, parsed.data);
    return NextResponse.json({ product });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = requireSeller(await getSession());
    const { id } = await params;
    await deleteProductForSeller(id, session.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
