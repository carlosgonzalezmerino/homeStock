import { FREEZER_STALE_MONTHS } from "@/constants/inventory";
import type { InventoryCreate, InventoryPatch, InventoryOut, Location } from "@/types";
import { localIsoDate } from "./date";

/** Milliseconds in one day, used to turn a date difference into a day count. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Days treated as one month when turning an elapsed time into "hace N meses". An approximation: good enough for a kitchen, not a calendar library. */
const DAYS_PER_MONTH = 30;
/** Longest run of days shown as "Hace N días" before switching to months. */
const MAX_DAYS_SHOWN_AS_DAYS = 30;

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

/**
 * Parses a `YYYY-MM-DD` date as a local calendar date, rejecting anything that is not one.
 *
 * @param value - The text to parse.
 * @returns The parsed date, or `null` when the text is not a valid calendar date.
 */
function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(year, month - 1, day);
  const isRealDate = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return isRealDate ? date : null;
}

/**
 * Counts whole days between a frozen date and today, treating a future date as today.
 *
 * @param frozenAt - The stored frozen date, which may be missing or invalid.
 * @param today - The date to compare against.
 * @returns The number of days, never negative, or `null` when there is no valid date.
 */
function daysSinceFrozen(frozenAt: string | null | undefined, today: Date): number | null {
  if (!frozenAt) return null;
  const frozenDate = parseIsoDate(frozenAt);
  if (frozenDate === null) return null;
  const todayDate = parseIsoDate(localIsoDate(today));
  if (todayDate === null) return null;
  const elapsedDays = Math.round((todayDate.getTime() - frozenDate.getTime()) / MS_PER_DAY);
  return Math.max(elapsedDays, 0);
}

/**
 * Tells how many whole months an item has been in the freezer.
 *
 * @param frozenAt - The stored frozen date, which may be missing or invalid.
 * @param today - The date to compare against. Defaults to now.
 * @returns The number of whole months, or `null` when there is no valid date.
 */
export function monthsFrozen(frozenAt: string | null | undefined, today: Date = new Date()): number | null {
  const days = daysSinceFrozen(frozenAt, today);
  return days === null ? null : Math.floor(days / DAYS_PER_MONTH);
}

/**
 * Describes how long ago an item was frozen, in short Spanish text.
 *
 * @param frozenAt - The stored frozen date, which may be missing or invalid.
 * @param today - The date to compare against. Defaults to now.
 * @returns A short text such as "Hoy", "Hace 12 días" or "Hace 3 meses", or `null` when there is
 *   no valid date to describe.
 */
export function formatFrozenAge(frozenAt: string | null | undefined, today: Date = new Date()): string | null {
  const days = daysSinceFrozen(frozenAt, today);
  if (days === null) return null;
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days <= MAX_DAYS_SHOWN_AS_DAYS) return `Hace ${days} días`;
  const months = Math.floor(days / DAYS_PER_MONTH);
  return months === 1 ? "Hace 1 mes" : `Hace ${months} meses`;
}

/**
 * Tells whether an item has been frozen long enough to warn about it.
 *
 * @param frozenAt - The stored frozen date, which may be missing or invalid.
 * @param today - The date to compare against. Defaults to now.
 * @returns `true` once it has spent at least {@link FREEZER_STALE_MONTHS} months frozen.
 */
export function isFreezerStale(frozenAt: string | null | undefined, today: Date = new Date()): boolean {
  const months = monthsFrozen(frozenAt, today);
  return months !== null && months >= FREEZER_STALE_MONTHS;
}

/**
 * Orders freezer items from the oldest frozen date to the newest. Items without a date are
 * never placed first: there is no evidence they are old, so they go last instead.
 *
 * @param a - One inventory row to compare.
 * @param b - The other inventory row to compare.
 * @param today - The date to compare against. Defaults to now.
 * @returns A negative number when `a` is older, positive when `b` is older, `0` when tied.
 */
export function compareByFreezerAge(a: InventoryOut, b: InventoryOut, today: Date = new Date()): number {
  const daysA = daysSinceFrozen(a.frozen_at, today);
  const daysB = daysSinceFrozen(b.frozen_at, today);
  if (daysA === null && daysB === null) return 0;
  if (daysA === null) return 1;
  if (daysB === null) return -1;
  return daysB - daysA;
}
