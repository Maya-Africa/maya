/**
 * Client-side image upload helper.
 *
 * Two-step Cloudinary signed upload:
 *  1. POST /api/upload with {fileType, fileSize}. Server validates and
 *     returns the signed Cloudinary params (NEVER the api_secret).
 *  2. POST the file directly to Cloudinary using those params. The file
 *     bytes never pass through Maya's server.
 *
 * Use `uploadImage(file)` for the one-shot happy path; the lower-level
 * helpers are exposed for callers that need to fan out signature requests
 * (e.g., the product image picker that uploads multiple files in parallel).
 */

import { ApiError } from '@/lib/api-error';
import { postFetcher } from '@/lib/fetcher';

// Mirror the server's SignedUploadParams shape. Duplicated here so the
// client wrapper doesn't pull the Cloudinary node SDK into the bundle.
export interface SignedUploadParams {
  uploadUrl: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  transformation: string;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

/**
 * Throw an ApiError if the file is too large or the wrong type. Lets
 * callers fail fast in the UI before round-tripping to the server.
 */
export function validateImageFileClient(file: File): void {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Use a JPEG, PNG, WebP, or AVIF image.',
      400,
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new ApiError('VALIDATION_ERROR', 'Image must be 5 MB or smaller.', 400);
  }
}

/** Ask the server for a signed upload payload for this file. */
export function requestUploadSignature(file: File): Promise<SignedUploadParams> {
  return postFetcher('/api/upload', {
    fileType: file.type,
    fileSize: file.size,
  });
}

/**
 * POST the file to Cloudinary using the server-issued signature.
 * Returns the public Cloudinary URL.
 */
export async function uploadToCloudinary(
  file: File,
  params: SignedUploadParams,
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', params.apiKey);
  formData.append('timestamp', String(params.timestamp));
  formData.append('signature', params.signature);
  formData.append('folder', params.folder);
  formData.append('transformation', params.transformation);

  const res = await fetch(params.uploadUrl, {
    method: 'POST',
    body: formData,
    // No credentials — Cloudinary is a third-party host.
  });

  if (!res.ok) {
    let detail = `Cloudinary upload failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = body.error.message;
    } catch {
      // Cloudinary didn't return JSON; fall back to the status code.
    }
    throw new ApiError('INTERNAL_ERROR', detail, res.status);
  }

  const body = (await res.json()) as { secure_url: string };
  return body.secure_url;
}

/**
 * One-shot upload: validate, request signature, upload, return URL.
 * Throws ApiError on any failure — callers should catch and surface
 * the message inline.
 */
export async function uploadImage(file: File): Promise<string> {
  validateImageFileClient(file);
  const params = await requestUploadSignature(file);
  return uploadToCloudinary(file, params);
}
