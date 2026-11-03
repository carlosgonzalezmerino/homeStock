import { MAX_QUANTITY_DECIMALS } from "@/constants/inventory";

/** Thousands are not grouped, so the text a user sees can be typed back and parsed unchanged. */
const QUANTITY_FORMATTER = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: MAX_QUANTITY_DECIMALS,
  useGrouping: false,
});
const DECIMAL_FACTOR = 10 ** MAX_QUANTITY_DECIMALS;

/**
 * Rounds a quantity to the number of decimals the app allows, so that steps never drift.
 *
 * @param value - The quantity to round.
 * @returns The quantity rounded to `MAX_QUANTITY_DECIMALS` decimals.
 */
export function roundQuantity(value: number): number {
  return Math.round(value * DECIMAL_FACTOR) / DECIMAL_FACTOR;
}

/**
 * Formats a quantity for display in Spanish: a decimal comma and no trailing zeros.
 *
 * @param value - The quantity to format.
 * @returns The text shown to the user, such as `0,5` or `2`.
 */
export function formatQuantity(value: number): string {
  return QUANTITY_FORMATTER.format(value);
}
