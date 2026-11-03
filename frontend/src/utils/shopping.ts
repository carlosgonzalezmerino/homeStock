import { roundQuantity } from "./format";

/**
 * Suggests how much to buy of an item that is low on stock.
 *
 * Buying exactly the gap between the quantity and the threshold is enough to stop being low,
 * since being exactly at the threshold does not count as low (the same rule as
 * `computeStockStatus`). When there is no gap, one unit is suggested instead, so the
 * suggestion is never zero.
 *
 * @param quantity - Units currently in stock.
 * @param threshold - Quantity below which the item is considered low.
 * @returns The suggested quantity to buy, rounded to the allowed decimals. Never negative.
 */
export function suggestedPurchase(quantity: number, threshold: number): number {
  const gap = Math.max(threshold - quantity, 0);
  return roundQuantity(gap > 0 ? gap : 1);
}

/**
 * Orders shopping list items so the ones already picked up move to the end, each group
 * keeping the order it arrived in.
 *
 * @param items - The items to order.
 * @param checkedEans - The EANs marked as picked up.
 * @returns A new array; the input is never mutated.
 */
export function sortByChecked<T extends { ean: string }>(
  items: readonly T[],
  checkedEans: ReadonlySet<string>,
): T[] {
  const unchecked = items.filter((item) => !checkedEans.has(item.ean));
  const pickedUp = items.filter((item) => checkedEans.has(item.ean));
  return [...unchecked, ...pickedUp];
}
