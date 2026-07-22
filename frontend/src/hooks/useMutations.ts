import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addInventory,
  patchInventory,
  deleteInventory,
} from "@/api/inventory";
import { createProduct } from "@/api/products";
import type { InventoryCreate, InventoryPatch, ProductCreate } from "@/types";

function useInvalidateBoth() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["inventory"] }),
      qc.invalidateQueries({ queryKey: ["shopping-list"] }),
    ]);
}

export function useAddInventory() {
  const invalidate = useInvalidateBoth();
  return useMutation({
    mutationFn: (body: InventoryCreate) => addInventory(body),
    onSuccess: invalidate,
  });
}

export function usePatchInventory() {
  const invalidate = useInvalidateBoth();
  return useMutation({
    mutationFn: ({ ean, body }: { ean: string; body: InventoryPatch }) =>
      patchInventory(ean, body),
    onSuccess: invalidate,
  });
}

export function useDeleteInventory() {
  const invalidate = useInvalidateBoth();
  return useMutation({
    mutationFn: (ean: string) => deleteInventory(ean),
    onSuccess: invalidate,
  });
}

export function useCreateProduct() {
  const invalidate = useInvalidateBoth();
  return useMutation({
    mutationFn: (body: ProductCreate) => createProduct(body),
    onSuccess: invalidate,
  });
}
