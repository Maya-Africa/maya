import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { generateSignedUploadParams, validateImageUpload } from '@/lib/cloudinary';
import { getSession } from '@/lib/session';
import { requireUser } from '@/services/auth/service';
import { handleApiError, ApiError } from '@/lib/api-error';

const schema = z.object({
  fileType: z.string().min(1),
  fileSize: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  try {
    requireUser(await getSession());

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError('VALIDATION_ERROR', 'fileType and fileSize are required', 400);
    }

    validateImageUpload(parsed.data.fileType, parsed.data.fileSize);

    const params = generateSignedUploadParams();
    return NextResponse.json(params);
  } catch (err) {
    if (err instanceof Error && !('code' in err)) {
      return handleApiError(new ApiError('VALIDATION_ERROR', err.message, 400));
    }
    return handleApiError(err);
  }
}
