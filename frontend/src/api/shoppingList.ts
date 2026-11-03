import { get } from "@/api/client";
import type { ShoppingListItemOut } from "@/types";

/**
 * Fetches the items that need to be bought again.
 *
 * @returns The shopping list items.
 */
export function getShoppingList(): Promise<ShoppingListItemOut[]> {
  return get<ShoppingListItemOut[]>("/shopping-list");
}
