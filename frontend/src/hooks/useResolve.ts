import { useQuery } from "@tanstack/react-query";
import { resolveProduct } from "@/api/resolve";

export function useResolve(ean: string) {
  return useQuery({
    queryKey: ["resolve", ean],
    queryFn: () => resolveProduct(ean),
    enabled: !!ean,
    retry: false,
  });
}
