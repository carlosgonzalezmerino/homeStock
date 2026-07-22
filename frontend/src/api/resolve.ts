import { get } from "@/api/client";
import type { ProductOut } from "@/types";

export function resolveProduct(ean: string): Promise<ProductOut> {
  return get<ProductOut>(`/resolve/${encodeURIComponent(ean)}`);
}
