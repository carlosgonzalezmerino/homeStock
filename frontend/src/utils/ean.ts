/** Length of a GTIN-14, the code carried by GS1 QR payloads. */
const GTIN_14_LENGTH = 14;
/** Matches a GS1 Digital Link URL whose `/01/` application identifier carries a GTIN-14. */
const GS1_QR_PATTERN = new RegExp(`qrtrack\\.mercadona\\.es/01/(\\d{${GTIN_14_LENGTH}})`);
/** Accepted barcode shapes: EAN-8 and UPC-E (8 digits), EAN-13 and UPC-A (12 or 13), GTIN-14. */
const EAN_PATTERN = /^(\d{8}|\d{12,14})$/;

/**
 * Extracts a product EAN from a raw scan result.
 *
 * GS1 QR payloads wrap the code in a GTIN-14. When the GTIN-14 starts with `0`
 * it is an EAN-13 with a leading zero, so the zero is removed.
 *
 * @param raw - The raw barcode value or GS1 URL returned by the scanner.
 * @returns The EAN string, or `raw` unchanged when no GS1 pattern is found.
 */
export function extractEan(raw: string): string {
  const match = raw.match(GS1_QR_PATTERN);
  if (!match) return raw;
  const gtin = match[1];
  return gtin.startsWith("0") ? gtin.slice(1) : gtin;
}

/**
 * Checks whether a string has the shape of a numeric product code.
 *
 * @param code - The candidate code, already trimmed.
 * @returns `true` when the code is 8 digits, or 12 to 14 digits, and nothing else.
 */
export function isValidEan(code: string): boolean {
  return EAN_PATTERN.test(code);
}
