/**
 * /api/notifications/subscribe
 *
 * POST — register a Web Push subscription for the authenticated user.
 * Called by the PWA after the user grants notification permission.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { handleApiError, ApiError } from '@/lib/api-error';
import { getSession } from '@/lib/session';
import * as commerceService from '@/services/commerce/service';
import { pushSubscribeSchema } from '@/validators/order';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('UNAUTHORIZED', 'Sign in to enable notifications', 401);

    const body = pushSubscribeSchema.parse(await request.json());
    await commerceService.subscribeToNotifications(
      session.userId,
      body.endpoint,
      body.keys.p256dh,
      body.keys.auth,
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ApiError('VALIDATION_ERROR', 'Invalid subscription data', 400, error.flatten()));
    }
    return handleApiError(error);
  }
}
