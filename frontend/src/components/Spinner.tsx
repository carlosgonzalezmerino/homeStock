/**
 * Loading indicator announced to assistive technology as "Cargando".
 *
 * @returns A centered, rotating ring.
 */
export function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <span
        role="status"
        aria-label="Cargando"
        className="h-10 w-10 animate-spin rounded-full border-4 border-outline-variant border-t-primary"
      />
    </div>
  );
}
