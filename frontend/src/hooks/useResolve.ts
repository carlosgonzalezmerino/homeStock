import { useQuery } from "@tanstack/react-query";
import { resolveProduct } from "@/api/resolve";
import { queryKeys } from "./queryKeys";

/**
 * Query that resolves an EAN to a product.
 *
 * The query is disabled for an empty EAN, and 404 responses are not retried because the
 * product simply does not exist.
 *
 * @param ean - The EAN to resolve.
 * @returns The react-query result holding the product.
 */
export function useResolve(ean: string) {
  return useQuery({
    queryKey: queryKeys.resolve(ean),
    queryFn: () => resolveProduct(ean),
    enabled: ean.length > 0,
    retry: false,
  });
}
