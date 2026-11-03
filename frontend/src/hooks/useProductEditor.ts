import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_UNIT } from "@/constants/inventory";
import type { InventoryCreate, InventoryWithProductOut, Location } from "@/types";
import { roundQuantity } from "@/utils/format";
import { freezerCreateFields, locationPatch, normalizeLocation } from "@/utils/freezer";
import { isConflictError } from "@/utils/errors";
import { useAddInventory, useDeleteInventory, usePatchInventory } from "./useMutations";
import { useQuantityDraft, useSavedFieldDraft, useThresholdDraft } from "./useProductDrafts";

/** Message shown when the product was added by someone else in the meantime. */
export const CONFLICT_MESSAGE = "Este producto ya estaba en el inventario. Revisa la cantidad";
/** Message shown when a save fails for any other reason. */
export const SAVE_ERROR_MESSAGE = "No se pudo guardar. Inténtalo de nuevo.";

/** Values needed to add a product that is not in the pantry yet. */
export interface NewStockDetails {
  quantity: number;
  threshold: number;
  location: Location;
  drawer: number | null;
  frozenAt: string | null;
}

/** The freezer-only fields of a tracked item. */
export interface FreezerFields {
  drawer: number | null;
  frozen_at: string | null;
}

/** Callback run after a save succeeds. */
type OnSaved = () => void;

/** Local editing state and save actions for one product's detail screen. */
export interface ProductEditor {
  quantity: ReturnType<typeof useQuantityDraft>;
  threshold: ReturnType<typeof useThresholdDraft>;
  notes: ReturnType<typeof useSavedFieldDraft<string | null>>;
  addProduct: (details: NewStockDetails, onSaved: OnSaved) => void;
  addToTracked: (amount: number, location: Location, onSaved: OnSaved) => void;
  setQuantity: (quantity: number, onSaved: OnSaved) => void;
  changeLocation: (location: Location) => void;
  saveThreshold: () => void;
  saveFreezerFields: (fields: FreezerFields) => void;
  saveNotes: () => void;
  removeProduct: (onRemoved: OnSaved) => void;
  isSaving: boolean;
  isRemoving: boolean;
  errorMessage: string | null;
}

/**
 * Builds the body that adds a product to the inventory.
 *
 * @param ean - EAN of the product.
 * @param details - The values chosen by the user.
 * @returns The creation body, with the freezer fields only when the location is the freezer.
 */
export function buildNewStockBody(ean: string, details: NewStockDetails): InventoryCreate {
  return {
    ean,
    quantity: details.quantity,
    threshold: details.threshold,
    unit: DEFAULT_UNIT,
    location: details.location,
    ...freezerCreateFields(details.location, details.drawer, details.frozenAt),
  };
}

/**
 * Describes a failed save for the user. A 409 on add means the product is already tracked.
 *
 * @param error - The error from the failed mutation.
 * @returns The message to show.
 */
function describeSaveError(error: unknown): string {
  return isConflictError(error) ? CONFLICT_MESSAGE : SAVE_ERROR_MESSAGE;
}

/**
 * The three inventory mutations of a detail screen, with their combined state.
 *
 * A 409 on a write also refreshes the inventory, so the screen shows what is really stored.
 *
 * @returns The mutations, the refresh helper and the combined save state.
 */
function useStockMutations() {
  const queryClient = useQueryClient();
  const patch = usePatchInventory();
  const add = useAddInventory();
  const remove = useDeleteInventory();
  const failure = [add.error, patch.error, remove.error].find((error) => error != null);

  return {
    patch,
    add,
    remove,
    refreshOnConflict: (error: unknown) => {
      if (isConflictError(error)) void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    isSaving: add.isPending || patch.isPending,
    isRemoving: remove.isPending,
    errorMessage: failure === undefined ? null : describeSaveError(failure),
  };
}

/** The mutations used by the action builders. */
type StockMutations = ReturnType<typeof useStockMutations>;

/**
 * Actions that change the product's presence in the pantry or its location.
 *
 * @param ean - EAN of the product.
 * @param tracked - The inventory entry, or `undefined` when the product is not in the pantry.
 * @param mutations - The mutations to call.
 * @returns The add, sum, quantity, location and removal actions.
 */
function createStockActions(ean: string, tracked: InventoryWithProductOut | undefined, mutations: StockMutations) {
  const currentLocation = normalizeLocation(tracked?.inventory.location);
  const onError = mutations.refreshOnConflict;
  return {
    addProduct(details: NewStockDetails, onSaved: OnSaved): void {
      mutations.add.mutate(buildNewStockBody(ean, details), { onSuccess: onSaved, onError });
    },
    addToTracked(amount: number, location: Location, onSaved: OnSaved): void {
      if (!tracked) return;
      const body = {
        quantity: roundQuantity(tracked.inventory.quantity + amount),
        reason: "purchase" as const,
        ...locationPatch(currentLocation, location),
      };
      mutations.patch.mutate({ ean, body }, { onSuccess: onSaved, onError });
    },
    setQuantity(quantity: number, onSaved: OnSaved): void {
      mutations.patch.mutate({ ean, body: { quantity } }, { onSuccess: onSaved });
    },
    changeLocation(location: Location): void {
      const body = locationPatch(currentLocation, location);
      if (Object.keys(body).length > 0) mutations.patch.mutate({ ean, body });
    },
    removeProduct(onRemoved: OnSaved): void {
      mutations.remove.mutate(ean, { onSuccess: onRemoved });
    },
  };
}

/**
 * Actions that save the editable fields of a tracked product.
 *
 * @param ean - EAN of the product.
 * @param drafts - The local drafts of threshold and notes.
 * @param mutations - The mutations to call.
 * @returns The threshold, freezer and notes save actions.
 */
function createFieldActions(
  ean: string,
  drafts: { threshold: ProductEditor["threshold"]; notes: ProductEditor["notes"] },
  mutations: StockMutations,
) {
  return {
    saveThreshold(): void {
      mutations.patch.mutate({ ean, body: { threshold: drafts.threshold.value } }, { onSuccess: drafts.threshold.markSaved });
    },
    saveFreezerFields(fields: FreezerFields): void {
      mutations.patch.mutate({ ean, body: fields });
    },
    saveNotes(): void {
      mutations.patch.mutate({ ean, body: { notes: drafts.notes.value } }, { onSuccess: drafts.notes.markSaved });
    },
  };
}

/**
 * Holds the edits made on a product's detail screen and the mutations that save them.
 *
 * @param ean - EAN of the product being edited.
 * @param tracked - The inventory entry for this EAN, or `undefined` when the product is not in the pantry.
 * @returns The local drafts, the save actions and the save state.
 */
export function useProductEditor(ean: string, tracked: InventoryWithProductOut | undefined): ProductEditor {
  const drafts = {
    quantity: useQuantityDraft(tracked?.inventory.quantity),
    threshold: useThresholdDraft(tracked?.inventory.threshold),
    notes: useSavedFieldDraft<string | null>(tracked?.inventory.notes, null),
  };
  const mutations = useStockMutations();
  return {
    ...drafts,
    ...createStockActions(ean, tracked, mutations),
    ...createFieldActions(ean, drafts, mutations),
    isSaving: mutations.isSaving,
    isRemoving: mutations.isRemoving,
    errorMessage: mutations.errorMessage,
  };
}
