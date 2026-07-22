import { get, post, patch, del } from "@/api/client";
import type { InventoryCreate, InventoryOut, InventoryPatch, InventoryWithProductOut } from "@/types";

export function listInventory(low?: boolean): Promise<InventoryWithProductOut[]> {
  const path = low === undefined ? "/inventory" : `/inventory?low=${low}`;
  return get<InventoryWithProductOut[]>(path);
}

export function addInventory(data: InventoryCreate): Promise<InventoryOut> {
  return post<InventoryOut>("/inventory", data);
}

export function patchInventory(ean: string, data: InventoryPatch): Promise<InventoryOut> {
  return patch<InventoryOut>(`/inventory/${encodeURIComponent(ean)}`, data);
}

export function deleteInventory(ean: string): Promise<void> {
  return del(`/inventory/${encodeURIComponent(ean)}`);
}
