import { get } from "@/api/client";
import type { ProductOut } from "@/types";

/**
 * Resolves an EAN to a product, looking it up in the catalogue or an external source.
 *
 * @param ean - The EAN to resolve. It is URL-encoded before being sent.
 * @returns The matching product.
 * @throws {ApiError} With status 404 when the EAN is unknown.
 */
export function resolveProduct(ean: string): Promise<ProductOut> {
  return get<ProductOut>(`/resolve/${encodeURIComponent(ean)}`);
}
