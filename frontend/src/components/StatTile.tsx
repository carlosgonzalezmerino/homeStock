/** Props accepted by {@link StatTile}. */
interface StatTileProps {
  label: string;
  value: number;
  highlighted?: boolean;
}

/**
 * Metric tile: an uppercase eyebrow label above a large number.
 *
 * Highlighted tiles use the warning color, which marks items that need attention.
 *
 * @param props - The metric label, its value and whether it needs attention.
 * @returns A tile with the label and the value.
 */
export function StatTile({ label, value, highlighted = false }: StatTileProps) {
  const valueClass = highlighted ? "text-tertiary" : "text-primary";
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-container p-6">
      <p className="text-eyebrow uppercase text-on-surface/50">{label}</p>
      <p className={`text-heading-lg font-medium tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
