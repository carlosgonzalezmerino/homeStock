import { MAX_QUANTITY_DECIMALS } from "@/constants/inventory";

/** Message shown when a quantity field is empty and it is required. */
export const REQUIRED_MESSAGE = "Requerido";
/** Message shown when a quantity is negative, not a number, or has too many decimals. */
export const QUANTITY_RANGE_MESSAGE = `Introduce un número mayor o igual que 0, con hasta ${MAX_QUANTITY_DECIMALS} decimales (por ejemplo 0,5)`;

/** A non-negative number, with an optional decimal part of at most the allowed length, using `,` or `.`. */
const QUANTITY_PATTERN = new RegExp(`^\\d+([.,]\\d{1,${MAX_QUANTITY_DECIMALS}})?$`);

/**
 * Reads a non-negative decimal typed by the user, accepting `,` or `.` as the separator.
 *
 * @param rawValue - The text typed in the field.
 * @returns The number, or `null` when the text is empty, negative, not a number or has too many decimals.
 */
export function parseDecimal(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!QUANTITY_PATTERN.test(trimmed)) return null;
  return Number(trimmed.replace(",", "."));
}

/**
 * Reads an optional decimal value from a text input.
 *
 * @param rawValue - The text typed in the field.
 * @returns The parsed number, or `undefined` when the field is empty or not a valid number.
 */
export function parseOptionalDecimal(rawValue: string): number | undefined {
  if (rawValue.trim() === "") return undefined;
  return parseDecimal(rawValue) ?? undefined;
}

/**
 * Reads a required quantity, using a fallback when the text is not valid.
 *
 * @param rawValue - The text typed in the field.
 * @param fallback - Value used when the text is not a valid quantity.
 * @returns The parsed quantity, or `fallback`.
 */
export function parseQuantity(rawValue: string, fallback: number): number {
  return parseDecimal(rawValue) ?? fallback;
}

/**
 * Validates a required quantity or threshold field.
 *
 * @param rawValue - The text typed in the field.
 * @returns An error message, or `null` when the value is valid.
 */
export function validateRequiredQuantity(rawValue: string): string | null {
  if (rawValue.trim() === "") return REQUIRED_MESSAGE;
  return parseDecimal(rawValue) === null ? QUANTITY_RANGE_MESSAGE : null;
}

/**
 * Validates an optional quantity field, such as a nutrition value.
 *
 * @param rawValue - The text typed in the field.
 * @returns An error message, or `null` when the field is empty or valid.
 */
export function validateOptionalQuantity(rawValue: string): string | null {
  if (rawValue.trim() === "") return null;
  return parseDecimal(rawValue) === null ? QUANTITY_RANGE_MESSAGE : null;
}
