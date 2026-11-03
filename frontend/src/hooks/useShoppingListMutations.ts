import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  addToShoppingList,
  registerPurchase,
  removeFromShoppingList,
  updateShoppingItem,
} from "@/api/shoppingList";
import type { ShoppingListItemOut, ShoppingListItemPatch } from "@/types";
import { invalidateStockQueries } from "./useMutations";
import { queryKeys } from "./queryKeys";

/**
 * Marks the shopping list as stale, so it is read again from the server.
 *
 * @param queryClient - The client that owns the cache.
 * @returns A promise that resolves when the list is marked.
 */
function refreshShoppingList(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList() });
}

/**
 * Mutation that puts a catalogue product on the list, or adds to it if it is already there.
 *
 * @returns A react-query mutation whose variables are `{ ean, quantity? }`.
 */
export function useAddToShoppingList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addToShoppingList,
    onSuccess: () => refreshShoppingList(queryClient),
  });
}

/** What the optimistic update keeps so it can be undone. */
interface UpdateContext {
  previous: ShoppingListItemOut[] | undefined;
}

/**
 * Mutation that changes a line (picked up, or how much to buy).
 *
 * It is optimistic: the screen changes at once, because marking things off is the gesture
 * repeated most in the shop and cannot wait for the network. If the server refuses, the
 * list goes back to how it was and `isError` is set, so the screen can say so.
 *
 * @returns A react-query mutation whose variables are `{ ean, body }`.
 */
export function useUpdateShoppingItem() {
  const queryClient = useQueryClient();
  const key = queryKeys.shoppingList();
  return useMutation<ShoppingListItemOut, Error, { ean: string; body: ShoppingListItemPatch }, UpdateContext>({
    mutationFn: ({ ean, body }) => updateShoppingItem(ean, body),
    onMutate: async ({ ean, body }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ShoppingListItemOut[]>(key);
      queryClient.setQueryData<ShoppingListItemOut[]>(key, (lines) =>
        lines?.map((line) => (line.ean === ean ? { ...line, ...body } : line)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    // Not returned on purpose: the mutation only publishes its error once its callbacks
    // finish, and the error message must not wait for the list to be read again.
    onSettled: () => {
      void refreshShoppingList(queryClient);
    },
  });
}

/**
 * Mutation that takes a product off the list.
 *
 * @returns A react-query mutation whose variable is the product's EAN.
 */
export function useRemoveFromShoppingList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeFromShoppingList,
    onSuccess: () => refreshShoppingList(queryClient),
  });
}

/**
 * Mutation that registers every picked-up line as a purchase.
 *
 * It refreshes the list and everything that depends on the stock.
 *
 * @returns A react-query mutation without variables, whose result is the summary.
 */
export function useRegisterPurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: registerPurchase,
    onSuccess: () => Promise.all([refreshShoppingList(queryClient), invalidateStockQueries(queryClient)]),
  });
}
