import { useEffect, useState } from "react";
import { DEFAULT_NEW_QUANTITY, DEFAULT_THRESHOLD } from "@/constants/inventory";

/** A value the user is editing locally before it is saved. */
export interface QuantityDraft {
  value: number;
  change: (nextQuantity: number) => void;
}

/** A value the user is editing locally, with a flag for unsaved changes. */
export interface SavedFieldDraft<T> {
  value: T;
  isDirty: boolean;
  change: (next: T) => void;
  markSaved: () => void;
}

/** A threshold the user is editing locally, with a flag for unsaved changes. */
export type ThresholdDraft = SavedFieldDraft<number>;

/**
 * Local quantity draft. It follows the server value until the user edits it.
 *
 * @param serverQuantity - Quantity stored on the server, or `undefined` when the product is not tracked.
 * @returns The value to show and a setter for the draft.
 */
export function useQuantityDraft(serverQuantity: number | undefined): QuantityDraft {
  const [draft, setDraft] = useState<number | null>(null);
  return {
    value: draft ?? serverQuantity ?? DEFAULT_NEW_QUANTITY,
    change: setDraft,
  };
}

/**
 * Local draft of any saved field. It follows the server value until the user edits it, and
 * it stops following once the user has unsaved changes.
 *
 * @param serverValue - Value stored on the server. `undefined` means the product is not tracked.
 * @param fallback - Value shown when the server has none yet.
 * @returns The value to show, the dirty flag and the change and saved callbacks.
 */
export function useSavedFieldDraft<T>(serverValue: T | undefined, fallback: T): SavedFieldDraft<T> {
  const [value, setValue] = useState<T>(serverValue === undefined ? fallback : serverValue);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (serverValue !== undefined && !isDirty) setValue(serverValue);
  }, [serverValue, isDirty]);

  return {
    value,
    isDirty,
    change: (next) => {
      setValue(next);
      setIsDirty(true);
    },
    markSaved: () => setIsDirty(false),
  };
}

/**
 * Local threshold draft, the alert level of a tracked product.
 *
 * @param serverThreshold - Threshold stored on the server, or `undefined` when the product is not tracked.
 * @returns The value to show, the dirty flag and the change and saved callbacks.
 */
export function useThresholdDraft(serverThreshold: number | undefined): ThresholdDraft {
  return useSavedFieldDraft(serverThreshold, DEFAULT_THRESHOLD);
}
