import type { InventoryWithProductOut, ProductOut } from "@/types";

/** EAN of the product used by most detail-screen tests. */
export const EAN = "1234567890123";

/** Units in stock of a tracked fixture, unless a test says otherwise. */
const DEFAULT_FIXTURE_QUANTITY = 5;

/**
 * A catalogue product as the API returns it.
 *
 * @param overrides - Fields to change.
 * @returns The product.
 */
export function productFixture(overrides: Partial<ProductOut> = {}): ProductOut {
  return { ean: EAN, name: "Leche Entera", brand: "Hacendado", source: "openfoodfacts", ...overrides };
}

/**
 * A tracked inventory item as the API returns it in the list.
 *
 * @param inventory - Fields of the inventory row to change.
 * @param product - Fields of the product to change.
 * @returns The item with its low-stock flag computed the way the backend does.
 */
export function trackedFixture(
  inventory: Partial<InventoryWithProductOut["inventory"]> = {},
  product: Partial<ProductOut> = {},
): InventoryWithProductOut {
  const row = { id: 1, ean: EAN, quantity: DEFAULT_FIXTURE_QUANTITY, threshold: 2, unit: "units", location: "pantry", ...inventory };
  const low = row.quantity === 0 || row.quantity < row.threshold;
  return { inventory: row, product: productFixture(product), low };
}
