import { readFileSync } from 'node:fs';
import { z } from 'zod';

export const articleSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
});

export const lightSchema = z.enum(['low', 'medium', 'bright']);
export const plantSchema = z.object({
  id: z.string(),
  name: z.string(),
  light: lightSchema,
  pet_safe: z.boolean(),
  price: z.number().nonnegative(),
});

export const orderStatusSchema = z.enum([
  'processing',
  'shipped',
  'delivered',
  'ready_for_pickup',
  'cancelled',
]);
const orderSchema = z.object({
  order_id: z.string(),
  email: z.email(),
  status: orderStatusSchema,
});

function loadFixture<T>(name: string, schema: z.ZodType<T>): T {
  const file = new URL(`../data/${name}.json`, import.meta.url);
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  return schema.parse(data);
}

export type Article = z.infer<typeof articleSchema>;
export const articles = loadFixture(
  'help-articles',
  z.array(articleSchema).nonempty(),
);
export const plants = loadFixture('plants', z.array(plantSchema));
export const orders = loadFixture('orders', z.array(orderSchema));
