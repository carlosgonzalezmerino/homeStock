import { post } from "@/api/client";
import type { ProductCreate, ProductOut } from "@/types";

export function createProduct(data: ProductCreate): Promise<ProductOut> {
  return post<ProductOut>("/products", data);
}
