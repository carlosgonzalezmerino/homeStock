export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-on-surface-variant">
      <span className="material-symbols-outlined text-5xl">inventory_2</span>
      <p className="text-body-lg text-center">{message}</p>
    </div>
  );
}
