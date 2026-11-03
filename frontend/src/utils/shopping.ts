/**
 * Orders shopping list lines so the ones already picked up move to the end, each group
 * keeping the order it arrived in.
 *
 * @param lines - The lines to order.
 * @returns A new array; the input is never mutated.
 */
export function sortByChecked<T extends { checked: boolean }>(lines: readonly T[]): T[] {
  const pending = lines.filter((line) => !line.checked);
  const pickedUp = lines.filter((line) => line.checked);
  return [...pending, ...pickedUp];
}
