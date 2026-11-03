import { get, post, patch, del } from "@/api/client";
import type { InventoryCreate, InventoryOut, InventoryPatch, InventoryWithProductOut } from "@/types";

/**
 * Lists inventory items, optionally filtered by their low-stock flag.
 *
 * @param low - `true` for low-stock items only, `false` for the rest, `undefined` for all.
 * @returns The inventory items with their product data.
 */
export function listInventory(low?: boolean): Promise<InventoryWithProductOut[]> {
  const path = low === undefined ? "/inventory" : `/inventory?low=${low}`;
  return get<InventoryWithProductOut[]>(path);
}

/**
 * Adds a product to the inventory.
 *
 * @param data - Product EAN, quantity, threshold and optional unit and location.
 * @returns The created inventory record.
 */
export function addInventory(data: InventoryCreate): Promise<InventoryOut> {
  return post<InventoryOut>("/inventory", data);
}

/**
 * Updates the quantity, threshold, unit or location of an inventory item.
 *
 * @param ean - EAN of the inventory item.
 * @param data - Only the fields to change.
 * @returns The updated inventory record.
 */
export function patchInventory(ean: string, data: InventoryPatch): Promise<InventoryOut> {
  return patch<InventoryOut>(`/inventory/${encodeURIComponent(ean)}`, data);
}

/**
 * Removes an inventory item.
 *
 * @param ean - EAN of the inventory item to remove.
 * @returns A promise that resolves when the item is removed.
 */
export function deleteInventory(ean: string): Promise<void> {
  return del(`/inventory/${encodeURIComponent(ean)}`);
}
