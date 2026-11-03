import { useEffect, useMemo, useState } from "react";

/** localStorage key that remembers which shopping list items the user has picked up. */
const STORAGE_KEY = "shoppingChecked";

/**
 * Reads the EANs marked as picked up, if any.
 *
 * @returns The stored EANs, or an empty set when nothing valid is stored or storage is unavailable.
 */
function readStoredChecked(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    const eans = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
    return new Set(eans);
  } catch (error) {
    console.warn(`Shopping list storage unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return new Set();
  }
}

/**
 * Saves the EANs marked as picked up. A blocked storage only logs a warning.
 *
 * @param checked - The EANs to save.
 */
function writeStoredChecked(checked: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...checked]));
  } catch (error) {
    console.warn(`Shopping list storage unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Drops marks for EANs that are no longer on the list, so removed items never pile up.
 *
 * @param current - The currently marked EANs.
 * @param listEans - The EANs on the list right now.
 * @returns `current` unchanged when nothing is stale, otherwise a smaller set.
 */
function dropStaleMarks(current: Set<string>, listEans: readonly string[]): Set<string> {
  const valid = new Set(listEans);
  const next = new Set([...current].filter((ean) => valid.has(ean)));
  return next.size === current.size ? current : next;
}

/**
 * Tracks which shopping list items the user has already picked up, backed by localStorage so
 * the marks survive a reload in the middle of a shopping trip.
 *
 * @param listEans - The EANs currently on the shopping list, used to discard stale marks.
 *   `undefined` while the list is still loading: marks are left untouched until the real list
 *   arrives, so the loading screen's empty list never looks like an empty shopping list.
 * @returns The checked EANs, a toggle for one EAN and a function that clears a set of EANs.
 */
export function useCheckedItems(listEans: readonly string[] | undefined) {
  const [checked, setChecked] = useState<Set<string>>(readStoredChecked);
  const eanKey = useMemo(() => (listEans ? [...listEans].sort().join(",") : undefined), [listEans]);

  useEffect(() => {
    if (eanKey === undefined) return;
    const currentEans = eanKey ? eanKey.split(",") : [];
    setChecked((current) => dropStaleMarks(current, currentEans));
  }, [eanKey]);

  useEffect(() => {
    writeStoredChecked(checked);
  }, [checked]);

  function toggle(ean: string): void {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(ean)) next.delete(ean);
      else next.add(ean);
      return next;
    });
  }

  function clear(eans: readonly string[]): void {
    setChecked((current) => {
      const next = new Set(current);
      eans.forEach((ean) => next.delete(ean));
      return next;
    });
  }

  return { checked, toggle, clear };
}
