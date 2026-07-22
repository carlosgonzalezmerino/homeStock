import { get } from "@/api/client";
import type { ShoppingListItemOut } from "@/types";

export function getShoppingList(): Promise<ShoppingListItemOut[]> {
  return get<ShoppingListItemOut[]>("/shopping-list");
}
