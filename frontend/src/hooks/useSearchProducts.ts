import { useQuery } from "@tanstack/react-query";
import { searchProducts } from "@/api/products";
import { queryKeys } from "./queryKeys";

export function useSearchProducts(q: string) {
  return useQuery({
    queryKey: queryKeys.products(q),
    queryFn: () => searchProducts(q),
    enabled: q.length >= 2,
  });
}
