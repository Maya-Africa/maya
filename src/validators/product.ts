import { z } from 'zod';

const ProductCategorySchema = z.enum([
  'paintings',
  'jewelry',
  'textiles',
  'leather',
  'pottery',
  'sculpture',
  'prints_digital',
  'other',
]);

// bigint-as-string for sat values; reject anything non-numeric
const SatsString = z.string().regex(/^\d+$/, 'Must be a positive integer string');

export const createProductSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().min(10).max(2000),
  priceSats: SatsString,
  shippingSats: SatsString.default('0'),
  category: ProductCategorySchema,
  images: z.array(z.string().url()).min(1).max(5),
  isDigital: z.boolean().default(false),
  digitalUrl: z.string().url().optional(),
  stock: z.number().int().positive().default(1),
});

export const updateProductSchema = createProductSchema.partial();

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
  category: ProductCategorySchema.optional(),
  sellerId: z.string().optional(),
});

export type CreateProductData = z.infer<typeof createProductSchema>;
export type UpdateProductData = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
