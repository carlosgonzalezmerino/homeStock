import type { Location } from "@/types";

/** Stock level shown to the user for one inventory item. */
export type StockStatus = "ok" | "low" | "empty";

/**
 * Derives the stock status of an item from its quantity and alert threshold.
 *
 * Nothing left is always `empty`. Below the threshold is `low`. Exactly at the threshold is `ok`.
 *
 * @param quantity - Units currently in stock.
 * @param threshold - Quantity below which the item is considered low.
 * @returns `"empty"` when nothing is left, `"low"` when below the threshold, otherwise `"ok"`.
 */
export function computeStockStatus(quantity: number, threshold: number): StockStatus {
  if (quantity === 0) return "empty";
  return quantity < threshold ? "low" : "ok";
}

/**
 * Returns the Spanish display label for a storage location.
 *
 * @param location - The storage location of an inventory item.
 * @returns "Congelador" for freezer, "Despensa" for every other value.
 */
export function locationLabel(location: Location): string {
  return location === "freezer" ? "Congelador" : "Despensa";
}

/**
 * Tells whether an inventory item is stored in the pantry.
 *
 * Items without a stored location are treated as pantry items, which matches
 * how the backend defaults the field.
 *
 * @param location - The stored location, which may be missing.
 * @returns `true` when the location is null, undefined or `"pantry"`.
 */
export function isPantryLocation(location: string | null | undefined): boolean {
  return location == null || location === "pantry";
}
