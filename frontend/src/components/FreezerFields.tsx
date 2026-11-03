import { FormField } from "./FormField";
import { DrawerPicker } from "./DrawerPicker";
import { INPUT_CLASS } from "./styles";
import { localIsoDate } from "@/utils/date";

/** Props accepted by {@link FreezerFields}. */
interface FreezerFieldsProps {
  drawer: number | null;
  frozenAt: string | null;
  onDrawerChange: (drawer: number | null) => void;
  onFrozenAtChange: (frozenAt: string | null) => void;
}

/**
 * Drawer and frozen date of a freezer item. The date cannot be later than today.
 *
 * @param props - The current values and their change callbacks.
 * @returns The drawer picker and the date field.
 */
export function FreezerFields({ drawer, frozenAt, onDrawerChange, onFrozenAtChange }: FreezerFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <FormField label="Cajón">
        <DrawerPicker value={drawer} onChange={onDrawerChange} />
      </FormField>
      <FormField label="Fecha de congelación">
        <input
          type="date"
          aria-label="Fecha de congelación"
          max={localIsoDate()}
          value={frozenAt ?? ""}
          onChange={(event) => onFrozenAtChange(event.target.value || null)}
          className={INPUT_CLASS}
        />
        {frozenAt === null && <p className="text-body-sm text-on-surface-variant">Sin fecha</p>}
      </FormField>
    </div>
  );
}
