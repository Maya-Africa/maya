import type { Product, CreateProductInput, UpdateProductInput, SellerInfo } from '@/types/shared';
import { ApiError } from '@/lib/api-error';
import { satsToNgn, formatNgn } from '@/lib/currency';
import { signEventWithSystemKey, signEventWithKey } from '../nostr/signing';
import { publishEvent } from '../nostr/publisher';
import { buildProductEventTemplate, buildStallEventTemplate, buildClassifiedListingEventTemplate, buildStallStatusEventTemplate } from '../nostr/events';
import { publishReview } from '../nostr/reviews';
import { readBadgeData } from '../nostr/badge';
import type { StallStatusValue } from '@/types/nostr';
import type { Order } from '@/types/shared';
import * as repository from './repository';

/**
 * Catalog service — public API for product and seller operations.
 *
 * Owned by the Catalog Engineer.
 *
 * Pattern: API routes call this. This calls repository (DB) and Nostr client
 * (side effect). Never call repository directly from an API route.
 */

function toSellerInfo(user: NonNullable<Awaited<ReturnType<typeof repository.findUserById>>>): SellerInfo {
  return {
    id: user.id,
    username: user.username,
    npub: user.npub,
    lightningAddress: user.lightningAddr ?? `${user.username}@maya.com`,
    displayName: user.displayName,
    avatar: user.avatar,
    about: user.about,
    stallStatus: user.stallStatus,
    stallStatusMessage: user.stallStatusMessage,
  };
}

// Cross-role helper: Commerce uses this to look up a seller's Lightning Address.
export async function getSellerByUsername(username: string): Promise<SellerInfo | null> {
  const user = await repository.findUserByUsername(username);
  if (!user || user.role !== 'SELLER') return null;
  return toSellerInfo(user);
}

export async function getSellerById(id: string): Promise<SellerInfo | null> {
  const user = await repository.findUserById(id);
  if (!user || user.role !== 'SELLER') return null;
  return toSellerInfo(user);
}

export async function updateStallStatus(
  sellerId: string,
  status: StallStatusValue,
  message: string | undefined,
  secretKey: Uint8Array,
): Promise<{ stallStatus: string; stallStatusMessage: string | null; nostrEventId: string }> {
  const user = await repository.findUserById(sellerId);
  if (!user || user.role !== 'SELLER') throw new ApiError('FORBIDDEN', 'Seller not found', 403);

  const template = buildStallStatusEventTemplate({
    stallId: sellerId,
    sellerHexPubkey: user.npub,
    status,
    message,
  });

  const signed = signEventWithKey(template, secretKey);
  void publishEvent(signed).catch((err) =>
    console.error('[catalog] stall:status publish failed for seller', sellerId, err),
  );

  const updated = await repository.updateUser(sellerId, {
    stallStatus: status,
    stallStatusMessage: message ?? null,
  });

  return {
    stallStatus: updated.stallStatus,
    stallStatusMessage: updated.stallStatusMessage,
    nostrEventId: signed.id,
  };
}

type ProductRow = NonNullable<Awaited<ReturnType<typeof repository.findProductById>>>;

function toProduct(p: ProductRow): Product {
  return {
    id: p.id,
    sellerId: p.sellerId,
    sellerUsername: p.seller.username,
    sellerDisplayName: p.seller.displayName,
    title: p.title,
    description: p.description,
    priceSats: p.priceSats.toString(),
    priceNgnDisplay: formatNgn(satsToNgn(p.priceSats)),
    shippingSats: p.shippingSats.toString(),
    category: p.category as Product['category'],
    images: p.images,
    isDigital: p.isDigital,
    stock: p.stock,
    status: p.status as Product['status'],
    nostrEventId: p.nostrEventId,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function getProduct(id: string): Promise<Product> {
  const product = await repository.findProductById(id);
  if (!product) throw new ApiError('NOT_FOUND', 'Product not found', 404);
  return toProduct(product);
}

export async function listProducts(params: {
  page?: number;
  pageSize?: number;
  category?: string;
  sellerId?: string;
}): Promise<{ items: Product[]; total: number; page: number; pageSize: number }> {
  const page = params.page ?? 1;
  const pageSize = Math.min(params.pageSize ?? 20, 50);

  const { items, total } = await repository.listActiveProducts({
    page,
    pageSize,
    category: params.category,
    sellerId: params.sellerId,
  });

  return {
    items: items.map(toProduct),
    total,
    page,
    pageSize,
  };
}

export async function createProductForSeller(
  input: CreateProductInput,
  sellerId: string,
): Promise<Product> {
  const product = await repository.createProduct({
    seller: { connect: { id: sellerId } },
    title: input.title,
    description: input.description,
    priceSats: BigInt(input.priceSats),
    shippingSats: BigInt(input.shippingSats),
    category: input.category,
    images: input.images,
    isDigital: input.isDigital,
    digitalUrl: input.digitalUrl,
    stock: input.stock,
  });

  const productData = toProduct(product);

  // Publish to Nostr — best-effort; never fails the product creation.
  try {
    const seller = await getSellerById(sellerId);
    if (seller) {
      const stallEvent = signEventWithSystemKey(buildStallEventTemplate(seller));
      await publishEvent(stallEvent);
    }
    const signedProduct = signEventWithSystemKey(buildProductEventTemplate(productData));
    await publishEvent(signedProduct);
    // NIP-99: dual-publish as classified listing; failure does not block the NIP-15 event.
    void publishEvent(signEventWithSystemKey(buildClassifiedListingEventTemplate(productData))).catch(
      (err) => console.error('NIP-99 publish failed for product', product.id, err),
    );
    const updated = await repository.updateProduct(product.id, { nostrEventId: signedProduct.id });
    return toProduct(updated);
  } catch (err) {
    console.error('Nostr publish failed for product', product.id, err);
    return productData;
  }
}

export async function updateProductForSeller(
  productId: string,
  sellerId: string,
  input: UpdateProductInput,
): Promise<Product> {
  const existing = await repository.findProductById(productId);
  if (!existing) throw new ApiError('NOT_FOUND', 'Product not found', 404);
  if (existing.sellerId !== sellerId) throw new ApiError('FORBIDDEN', 'Not your product', 403);

  const updated = await repository.updateProduct(productId, {
    ...(input.title !== undefined && { title: input.title }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.priceSats !== undefined && { priceSats: BigInt(input.priceSats) }),
    ...(input.shippingSats !== undefined && { shippingSats: BigInt(input.shippingSats) }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.images !== undefined && { images: input.images }),
    ...(input.stock !== undefined && { stock: input.stock }),
    ...(input.status !== undefined && { status: input.status }),
  });

  const productData = toProduct(updated);

  // Re-publish to Nostr (replaceable event — same `d` tag replaces the old one).
  try {
    const seller = await getSellerById(sellerId);
    if (seller) {
      const stallEvent = signEventWithSystemKey(buildStallEventTemplate(seller));
      await publishEvent(stallEvent);
    }
    const signedProduct = signEventWithSystemKey(buildProductEventTemplate(productData));
    await publishEvent(signedProduct);
    // NIP-99: dual-publish as classified listing; failure does not block the NIP-15 event.
    void publishEvent(signEventWithSystemKey(buildClassifiedListingEventTemplate(productData))).catch(
      (err) => console.error('NIP-99 re-publish failed for product', productId, err),
    );
    const withEventId = await repository.updateProduct(productId, { nostrEventId: signedProduct.id });
    return toProduct(withEventId);
  } catch (err) {
    console.error('Nostr re-publish failed for product', productId, err);
    return productData;
  }
}

export async function deleteProductForSeller(productId: string, sellerId: string): Promise<void> {
  const existing = await repository.findProductById(productId);
  if (!existing) throw new ApiError('NOT_FOUND', 'Product not found', 404);
  if (existing.sellerId !== sellerId) throw new ApiError('FORBIDDEN', 'Not your product', 403);

  await repository.unlistProduct(productId);
}

export async function getStorefront(username: string): Promise<{
  seller: SellerInfo;
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const seller = await getSellerByUsername(username);
  if (!seller) throw new ApiError('NOT_FOUND', `No seller found for @${username}`, 404);

  const { items, total } = await repository.listActiveProducts({
    page: 1,
    pageSize: 50,
    sellerId: seller.id,
  });

  return {
    seller,
    products: items.map(toProduct),
    total,
    page: 1,
    pageSize: 50,
  };
}

export interface SavedReview {
  id: string;
  orderId: string;
  rating: number;
  content: string;
  nostrEventId: string;
  createdAt: string;
}

export async function saveReview(
  order: Order,
  rating: number,
  content: string,
  buyerSecretKey: Uint8Array,
): Promise<SavedReview> {
  const productIds = [...new Set(order.items.map((i) => i.productId))];

  const signed = await publishReview(
    {
      orderId: order.id,
      orderNostrEventId: order.nostrEventId,
      sellerHexPubkey: order.sellerNpub,
      productIds,
      rating,
      content,
    },
    buyerSecretKey,
  );

  const saved = await repository.upsertReview({
    orderId: order.id,
    buyerId: order.buyerId,
    sellerId: order.sellerId,
    rating,
    content,
    nostrEventId: signed.id,
  });

  return {
    id: saved.id,
    orderId: saved.orderId,
    rating: saved.rating,
    content: saved.content,
    nostrEventId: saved.nostrEventId ?? signed.id,
    createdAt: saved.createdAt.toISOString(),
  };
}

export async function getSellerReviews(username: string): Promise<{
  averageRating: number;
  count: number;
  reviews: SavedReview[];
}> {
  const seller = await getSellerByUsername(username);
  if (!seller) throw new ApiError('NOT_FOUND', `No seller found for @${username}`, 404);

  const { reviews, averageRating, count } = await repository.listReviewsBySeller(seller.id);

  return {
    averageRating: Math.round(averageRating * 10) / 10,
    count,
    reviews: reviews.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      rating: r.rating,
      content: r.content,
      nostrEventId: r.nostrEventId ?? '',
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function listSellers(): Promise<
  Array<{ id: string; username: string; displayName: string | null; npub: string }>
> {
  const users = await repository.listAllSellers();
  return users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    npub: u.npub,
  }));
}

export async function getSellerBadge(username: string): Promise<{
  sellerHexPubkey: string;
  firstSaleAt: number;
  totalSales: number;
} | null> {
  const seller = await getSellerByUsername(username);
  if (!seller) throw new ApiError('NOT_FOUND', `No seller found for @${username}`, 404);
  return readBadgeData(seller.id);
}
