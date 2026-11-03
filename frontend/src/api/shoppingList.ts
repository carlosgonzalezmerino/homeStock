import { del, get, patch, post } from "@/api/client";
import type {
  PurchaseSummary,
  ShoppingListItemCreate,
  ShoppingListItemOut,
  ShoppingListItemPatch,
} from "@/types";

/**
 * Fetches the shopping list: only what the user added, with the stock of each product.
 *
 * @returns The lines of the list, oldest first.
 */
export function getShoppingList(): Promise<ShoppingListItemOut[]> {
  return get<ShoppingListItemOut[]>("/shopping-list");
}

/**
 * Puts a catalogue product on the list. If it is already there, the quantity is summed.
 *
 * @param data - The product's EAN and, optionally, how much to buy (1 by default).
 * @returns The line.
 */
export function addToShoppingList(data: ShoppingListItemCreate): Promise<ShoppingListItemOut> {
  return post<ShoppingListItemOut>("/shopping-list", data);
}

/**
 * Changes the quantity to buy or the picked-up mark of a line.
 *
 * @param ean - EAN of the product.
 * @param data - Only the fields to change.
 * @returns The updated line.
 */
export function updateShoppingItem(ean: string, data: ShoppingListItemPatch): Promise<ShoppingListItemOut> {
  return patch<ShoppingListItemOut>(`/shopping-list/${encodeURIComponent(ean)}`, data);
}

/**
 * Takes a product off the list.
 *
 * @param ean - EAN of the product.
 * @returns A promise that resolves when the line is removed.
 */
export function removeFromShoppingList(ean: string): Promise<void> {
  return del(`/shopping-list/${encodeURIComponent(ean)}`);
}

/**
 * Puts every picked-up line into the stock and takes it off the list. All or nothing.
 *
 * @returns How many lines were registered and how many were new in the pantry.
 */
export function registerPurchase(): Promise<PurchaseSummary> {
  return post<PurchaseSummary>("/shopping-list/purchase");
}
