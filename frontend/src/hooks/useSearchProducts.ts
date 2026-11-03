import { useQuery } from "@tanstack/react-query";
import { searchProducts } from "@/api/products";
import { queryKeys } from "./queryKeys";

/** Shortest query that is sent to the catalogue search. */
const MIN_SEARCH_LENGTH = 2;

/**
 * Query that searches the catalogue. It stays idle until the text is long enough to be useful.
 *
 * @param query - The search text.
 * @returns The react-query result holding the matching products.
 */
export function useSearchProducts(query: string) {
  return useQuery({
    queryKey: queryKeys.products(query),
    queryFn: () => searchProducts(query),
    enabled: query.length >= MIN_SEARCH_LENGTH,
  });
}
