import { get, post } from "@/api/client";
import type { ProductCreate, ProductOut } from "@/types";

export function createProduct(data: ProductCreate): Promise<ProductOut> {
  return post<ProductOut>("/products", data);
}

export function searchProducts(q: string): Promise<ProductOut[]> {
  return get<ProductOut[]>(`/products?q=${encodeURIComponent(q)}`);
}
