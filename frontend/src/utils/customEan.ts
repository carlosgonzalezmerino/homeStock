/** Prefix that marks EANs created by the user for products without a barcode. */
export const CUSTOM_EAN_PREFIX = "CUSTOM-";
/** Number of random characters appended after the custom prefix. */
export const CUSTOM_EAN_RANDOM_LENGTH = 8;
const CUSTOM_EAN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Generates a unique identifier for a product that has no barcode.
 *
 * @returns A string such as `CUSTOM-3FQ9KD2X`, built from random characters.
 */
export function generateCustomEan(): string {
  let randomPart = "";
  for (let index = 0; index < CUSTOM_EAN_RANDOM_LENGTH; index++) {
    const randomIndex = Math.floor(Math.random() * CUSTOM_EAN_ALPHABET.length);
    randomPart += CUSTOM_EAN_ALPHABET.charAt(randomIndex);
  }
  return `${CUSTOM_EAN_PREFIX}${randomPart}`;
}
