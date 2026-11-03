/** Props accepted by {@link EmptyState}. */
interface EmptyStateProps {
  message: string;
}

/**
 * Placeholder shown when a list has no items to display.
 *
 * @param props - The message explaining why the list is empty.
 * @returns A centered icon with the message beneath it.
 */
export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-on-surface-variant">
      <span className="material-symbols-outlined text-5xl">inventory_2</span>
      <p className="text-center text-body-lg">{message}</p>
    </div>
  );
}
