import type { ApiErrorResponse } from '@/types/shared';
import { ApiError } from './api-error';

/**
 * Default fetcher for SWR with typed error handling.
 * Throws ApiError on non-2xx responses so SWR's error state is structured.
 */
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorResponse | null;
    throw new ApiError(
      body?.error.code ?? 'INTERNAL_ERROR',
      body?.error.message ?? 'Request failed',
      res.status,
    );
  }

  return res.json() as Promise<T>;
}

export async function postFetcher<TBody, TResponse>(url: string, body: TBody): Promise<TResponse> {
  return bodyFetcher<TBody, TResponse>('POST', url, body);
}

export async function patchFetcher<TBody, TResponse>(url: string, body: TBody): Promise<TResponse> {
  return bodyFetcher<TBody, TResponse>('PATCH', url, body);
}

export async function deleteFetcher<TResponse>(url: string): Promise<TResponse> {
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!res.ok) {
    const responseBody = (await res.json().catch(() => null)) as ApiErrorResponse | null;
    throw new ApiError(
      responseBody?.error.code ?? 'INTERNAL_ERROR',
      responseBody?.error.message ?? 'Request failed',
      res.status,
    );
  }

  return res.json() as Promise<TResponse>;
}

async function bodyFetcher<TBody, TResponse>(
  method: 'POST' | 'PATCH' | 'PUT',
  url: string,
  body: TBody,
): Promise<TResponse> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const responseBody = (await res.json().catch(() => null)) as ApiErrorResponse | null;
    throw new ApiError(
      responseBody?.error.code ?? 'INTERNAL_ERROR',
      responseBody?.error.message ?? 'Request failed',
      res.status,
    );
  }

  return res.json() as Promise<TResponse>;
}
