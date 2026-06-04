import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { listProducts, createProductForSeller } from '@/services/catalog/service';
import { getSession } from '@/lib/session';
import { requireSeller } from '@/services/auth/service';
import { handleApiError, ApiError } from '@/lib/api-error';
import { createProductSchema, listProductsQuerySchema } from '@/validators/product';

export async function GET(req: NextRequest) {
  try {
    const params = listProductsQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!params.success) {
      throw new ApiError('VALIDATION_ERROR', 'Invalid query parameters', 400, params.error.flatten());
    }

    const result = await listProducts(params.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return handleApiError(new ApiError('VALIDATION_ERROR', 'Invalid query parameters', 400));
    }
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = requireSeller(await getSession());

    const body = createProductSchema.safeParse(await req.json());
    if (!body.success) {
      throw new ApiError('VALIDATION_ERROR', body.error.issues[0]?.message ?? 'Invalid input', 400, body.error.flatten());
    }

    const product = await createProductForSeller(body.data, session.userId);
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return handleApiError(new ApiError('VALIDATION_ERROR', 'Invalid product data', 400));
    }
    return handleApiError(err);
  }
}
