import { useQuery } from "@tanstack/react-query";
import { listInventory } from "@/api/inventory";
import { queryKeys } from "./queryKeys";

export function useInventory(low?: boolean) {
  return useQuery({
    queryKey: queryKeys.inventory(low),
    queryFn: () => listInventory(low),
  });
}
