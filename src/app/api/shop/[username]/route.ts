import { NextRequest, NextResponse } from 'next/server';

import { getStorefront } from '@/services/catalog/service';
import { handleApiError } from '@/lib/api-error';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const storefront = await getStorefront(username);
    return NextResponse.json(storefront);
  } catch (err) {
    return handleApiError(err);
  }
}
