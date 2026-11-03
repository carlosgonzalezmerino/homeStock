/**
 * Small icon that marks a product added by hand rather than recognised from a barcode.
 *
 * @returns An accessible icon, named "Añadido a mano".
 */
export function ManualSourceIcon() {
  return (
    <span role="img" aria-label="Añadido a mano" className="material-symbols-outlined shrink-0 text-body-sm text-on-surface-variant">
      edit_note
    </span>
  );
}
