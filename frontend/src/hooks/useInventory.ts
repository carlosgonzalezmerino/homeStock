import { useQuery } from "@tanstack/react-query";
import { listInventory } from "@/api/inventory";
import { queryKeys } from "./queryKeys";

/**
 * Query for the inventory list.
 *
 * @param low - When set, restricts the result to low-stock (`true`) or non-low (`false`) items.
 * @returns The react-query result holding the inventory items.
 */
export function useInventory(low?: boolean) {
  return useQuery({
    queryKey: queryKeys.inventory(low),
    queryFn: () => listInventory(low),
  });
}
