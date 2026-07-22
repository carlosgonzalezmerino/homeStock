import { useQuery } from "@tanstack/react-query";
import { getShoppingList } from "@/api/shoppingList";
import { queryKeys } from "./queryKeys";

export function useShoppingList() {
  return useQuery({
    queryKey: queryKeys.shoppingList(),
    queryFn: getShoppingList,
  });
}
