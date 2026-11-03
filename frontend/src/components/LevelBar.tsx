/** Props accepted by {@link LevelBar}. */
interface LevelBarProps {
  quantity: number;
  max: number;
}

/**
 * Converts a quantity into a percentage of `max`, clamped between 0 and 100.
 *
 * @param quantity - Units currently in stock.
 * @param max - Quantity that represents a full bar. A value of 0 or less gives an empty bar.
 * @returns A number from 0 to 100.
 */
export function computeFillPercentage(quantity: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (quantity / max) * 100));
}

/**
 * Horizontal bar that shows how full an item's stock is.
 *
 * @param props - Current quantity and the quantity that counts as full.
 * @returns A track element with a filled portion sized by {@link computeFillPercentage}.
 */
export function LevelBar({ quantity, max }: LevelBarProps) {
  const percentage = computeFillPercentage(quantity, max);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-outline-variant">
      <div
        data-testid="level-bar-fill"
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
