import type { InventoryCreate, InventoryPatch, Location } from "@/types";
import { localIsoDate } from "./date";

/**
 * Normalises a stored location: anything that is not the freezer counts as the pantry.
 *
 * @param location - The stored location, which may be missing.
 * @returns `"freezer"` or `"pantry"`.
 */
export function normalizeLocation(location: string | null | undefined): Location {
  return location === "freezer" ? "freezer" : "pantry";
}

/**
 * Freezer-only fields of a new inventory item. Pantry items carry no drawer and no date.
 *
 * @param location - The chosen location.
 * @param drawer - The chosen drawer, or `null` for none.
 * @param frozenAt - The frozen date, or `null` to use today.
 * @returns The fields to send, empty for the pantry.
 */
export function freezerCreateFields(
  location: Location,
  drawer: number | null,
  frozenAt: string | null,
): Partial<InventoryCreate> {
  if (location !== "freezer") return {};
  return { drawer, frozen_at: frozenAt ?? localIsoDate() };
}

/**
 * The fields to send when an item moves to another location. Moving into the freezer gives
 * the item today's date, as the device sees it.
 *
 * @param previous - The location the item is in now.
 * @param next - The location the user chose.
 * @returns An empty patch when nothing changes, otherwise the location and the date it needs.
 */
export function locationPatch(previous: Location, next: Location): InventoryPatch {
  if (previous === next) return {};
  return next === "freezer" ? { location: next, frozen_at: localIsoDate() } : { location: next };
}
