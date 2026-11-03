import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { addInventory, patchInventory, deleteInventory } from "@/api/inventory";
import { createProduct } from "@/api/products";
import type { InventoryCreate, InventoryPatch, MovementSource, ProductCreate } from "@/types";
import { queryKeys } from "./queryKeys";

/**
 * Refreshes every query that depends on the stock: the inventory, the shopping list and the
 * weekly review, whose candidates come from the stock and its history.
 *
 * @param queryClient - The client that owns the cache.
 * @returns A promise that resolves when the queries have been marked stale.
 */
export function invalidateStockQueries(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["inventory"] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.review() }),
  ]);
}

/**
 * Returns a function that refreshes every query affected by an inventory change.
 *
 * @returns A callback that invalidates the queries that depend on the stock.
 */
function useInvalidateInventoryQueries() {
  const queryClient = useQueryClient();
  return () => invalidateStockQueries(queryClient);
}

/**
 * Mutation that adds a product to the inventory.
 *
 * @returns A react-query mutation whose variables are an {@link InventoryCreate} body.
 */
export function useAddInventory() {
  const invalidate = useInvalidateInventoryQueries();
  return useMutation({
    mutationFn: (body: InventoryCreate) => addInventory(body),
    onSuccess: invalidate,
  });
}

/**
 * Mutation that updates an inventory item.
 *
 * @returns A react-query mutation whose variables are `{ ean, body, source? }`.
 */
export function usePatchInventory() {
  const invalidate = useInvalidateInventoryQueries();
  return useMutation({
    mutationFn: ({ ean, body, source }: { ean: string; body: InventoryPatch; source?: MovementSource }) =>
      patchInventory(ean, body, source),
    onSuccess: invalidate,
  });
}

/**
 * Mutation that removes an inventory item.
 *
 * @returns A react-query mutation whose variable is the item's EAN.
 */
export function useDeleteInventory() {
  const invalidate = useInvalidateInventoryQueries();
  return useMutation({
    mutationFn: (ean: string) => deleteInventory(ean),
    onSuccess: invalidate,
  });
}

/**
 * Mutation that creates a product in the catalogue.
 *
 * @returns A react-query mutation whose variable is a {@link ProductCreate} body.
 */
export function useCreateProduct() {
  const invalidate = useInvalidateInventoryQueries();
  return useMutation({
    mutationFn: (body: ProductCreate) => createProduct(body),
    onSuccess: invalidate,
  });
}
