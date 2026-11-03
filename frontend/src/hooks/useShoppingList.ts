import { useQuery } from "@tanstack/react-query";
import { getShoppingList } from "@/api/shoppingList";
import { queryKeys } from "./queryKeys";

/**
 * Query for the shopping list.
 *
 * @returns The react-query result holding the shopping list items.
 */
export function useShoppingList() {
  return useQuery({
    queryKey: queryKeys.shoppingList(),
    queryFn: getShoppingList,
  });
}
