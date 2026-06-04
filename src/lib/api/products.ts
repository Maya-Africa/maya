/**
 * Typed wrappers around the Catalog product endpoints.
 *
 * Sat values cross the wire as decimal strings (JSON can't represent
 * bigint). Callers compute sats client-side; the server snapshots a
 * fresh NGN-equivalent and publishes the kind 30018 Nostr event.
 */

import {
  deleteFetcher,
  fetcher,
  patchFetcher,
  postFetcher,
} from '@/lib/fetcher';
import type { Product, ProductCategory, SellerInfo } from '@/types/shared';

export interface CreateProductInput {
  title: string;
  description: string;
  priceSats: string;
  shippingSats?: string; // defaults to '0' server-side
  category: ProductCategory;
  images: string[]; // 1-5 Cloudinary URLs
  isDigital?: boolean; // defaults false server-side
  digitalUrl?: string;
  stock?: number; // defaults 1 server-side
}

export interface UpdateProductInput {
  title?: string;
  description?: string;
  priceSats?: string;
  shippingSats?: string;
  category?: ProductCategory;
  images?: string[];
  stock?: number;
  status?: 'ACTIVE' | 'SOLD_OUT' | 'UNLISTED';
}

export interface ListProductsQuery {
  page?: number;
  pageSize?: number;
  category?: ProductCategory;
  sellerId?: string;
}

export interface ListProductsResponse {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export function createProduct(input: CreateProductInput): Promise<{ product: Product }> {
  return postFetcher('/api/products', input);
}

export function listProducts(query: ListProductsQuery = {}): Promise<ListProductsResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));
  if (query.category) params.set('category', query.category);
  if (query.sellerId) params.set('sellerId', query.sellerId);
  const qs = params.toString();
  return fetcher(`/api/products${qs ? `?${qs}` : ''}`);
}

export function getProduct(id: string): Promise<{ product: Product }> {
  return fetcher(`/api/products/${encodeURIComponent(id)}`);
}

export function updateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<{ product: Product }> {
  return patchFetcher(`/api/products/${encodeURIComponent(id)}`, input);
}

export function deleteProduct(id: string): Promise<{ ok: true }> {
  return deleteFetcher(`/api/products/${encodeURIComponent(id)}`);
}

// ============================================================================
// Storefront — public seller page
// ============================================================================

export interface StorefrontResponse {
  seller: SellerInfo;
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export function getShop(username: string): Promise<StorefrontResponse> {
  return fetcher(`/api/shop/${encodeURIComponent(username)}`);
}

// ============================================================================
// Verified Seller badge — sourced from the seller's ledger, mirrored as a
// kind 30052 Nostr event when the first sale settles.
// ============================================================================

export interface SellerBadgeResponse {
  sellerHexPubkey: string;
  firstSaleAt: number; // Unix seconds, not ms
  totalSales: number;
  nostr: { kind: number; dTag: string };
}

export function getSellerBadge(username: string): Promise<SellerBadgeResponse> {
  return fetcher(`/api/shop/${encodeURIComponent(username)}/badge`);
}
