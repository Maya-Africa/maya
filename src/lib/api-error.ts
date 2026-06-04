import { NextResponse } from 'next/server';
import type { ApiErrorCode, ApiErrorResponse } from '@/types/shared';

/**
 * Typed API error. Throw this from service functions and handle it
 * in API routes via `handleApiError(error)`.
 */
export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public statusCode: number = 400,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const STATUS_CODES: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  LIGHTNING_FAILED: 502,
  PAYOUT_FAILED: 502,
  INSUFFICIENT_BALANCE: 400,
  OUT_OF_STOCK: 409,
  BANK_ACCOUNT_IN_USE: 409,
  ORDER_NOT_RETRYABLE: 400,
};

/**
 * Convert any error to a typed JSON response.
 * Use this in every API route's catch block.
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode || STATUS_CODES[error.code] },
    );
  }

  console.error('Unhandled API error:', error);
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    },
    { status: 500 },
  );
}
