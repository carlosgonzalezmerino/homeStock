import { get, post } from "@/api/client";
import type { ProductCreate, ProductOut } from "@/types";

/**
 * Creates a product in the catalogue.
 *
 * @param data - The product to create, including its EAN and name.
 * @returns The created product.
 */
export function createProduct(data: ProductCreate): Promise<ProductOut> {
  return post<ProductOut>("/products", data);
}

/**
 * Searches the catalogue by name or brand.
 *
 * @param query - Text to search for. It is URL-encoded before being sent.
 * @returns The products that match the query.
 */
export function searchProducts(query: string): Promise<ProductOut[]> {
  return get<ProductOut[]>(`/products?q=${encodeURIComponent(query)}`);
}
