export function StatusBadge({ low }: { low: boolean }) {
  return low ? (
    <span className="text-label-md uppercase text-tertiary">STOCK BAJO</span>
  ) : (
    <span className="text-label-md uppercase text-primary">EN BUEN ESTADO</span>
  );
}
