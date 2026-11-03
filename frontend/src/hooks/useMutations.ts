import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addInventory, patchInventory, deleteInventory } from "@/api/inventory";
import { createProduct } from "@/api/products";
import type { InventoryCreate, InventoryPatch, ProductCreate } from "@/types";
import { queryKeys } from "./queryKeys";

/**
 * Returns a function that refreshes every query affected by an inventory change.
 *
 * @returns A callback that invalidates the inventory and shopping list queries.
 */
function useInvalidateInventoryQueries() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList() }),
    ]);
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
 * @returns A react-query mutation whose variables are `{ ean, body }`.
 */
export function usePatchInventory() {
  const invalidate = useInvalidateInventoryQueries();
  return useMutation({
    mutationFn: ({ ean, body }: { ean: string; body: InventoryPatch }) => patchInventory(ean, body),
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
