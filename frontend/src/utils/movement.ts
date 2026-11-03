import type { MovementReason } from "@/types";

/**
 * Decides why a quantity changed, from the direction of the change.
 *
 * Taking units out through a stepper is how things are really used up, so it counts as
 * consumption. That is what the weekly review measures.
 *
 * @param previous - The quantity before the change.
 * @param next - The quantity after the change.
 * @returns `consume` when the quantity went down, `purchase` when it went up.
 */
export function reasonForChange(previous: number, next: number): MovementReason {
  return next < previous ? "consume" : "purchase";
}
