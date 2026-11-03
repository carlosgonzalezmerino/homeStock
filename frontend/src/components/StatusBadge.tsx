/** Stock status values that the badge can display. */
export type BadgeStatus = "ok" | "low" | "empty";

/** Props accepted by {@link StatusBadge}. */
interface StatusBadgeProps {
  status: BadgeStatus;
}

const STATUS_DISPLAY: Record<BadgeStatus, { color: string; label: string }> = {
  ok: { color: "bg-primary", label: "Stock OK" },
  low: { color: "bg-tertiary", label: "Stock bajo" },
  empty: { color: "bg-error", label: "Agotado" },
};

/**
 * Small colored dot that signals the stock status of an item.
 *
 * @param props - The status to display.
 * @returns An accessible dot whose `aria-label` names the status.
 */
export function StatusBadge({ status }: StatusBadgeProps) {
  const { color, label } = STATUS_DISPLAY[status];
  return <span aria-label={label} className={`inline-block h-3 w-3 shrink-0 rounded-full ${color}`} />;
}
