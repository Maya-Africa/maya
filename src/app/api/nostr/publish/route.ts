import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyEvent } from 'nostr-tools';

import { publishEvent } from '@/services/nostr/client';
import { getSession } from '@/lib/session';
import { requireUser } from '@/services/auth/service';
import { handleApiError, ApiError } from '@/lib/api-error';

const nostrEventSchema = z.object({
  id: z.string().length(64),
  pubkey: z.string().length(64),
  created_at: z.number().int(),
  kind: z.number().int(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: z.string().length(128),
});

const schema = z.object({
  event: nostrEventSchema,
});

export async function POST(req: NextRequest) {
  try {
    requireUser(await getSession());

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError('VALIDATION_ERROR', 'Invalid Nostr event shape', 400);
    }

    const event = parsed.data.event as Parameters<typeof verifyEvent>[0];
    if (!verifyEvent(event)) {
      throw new ApiError('VALIDATION_ERROR', 'Event signature is invalid', 400);
    }

    const accepted = await publishEvent(event);
    return NextResponse.json({ accepted });
  } catch (err) {
    return handleApiError(err);
  }
}
