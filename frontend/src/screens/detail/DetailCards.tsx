import { useState } from "react";

import { Button, Card, FreezerFields, LocationPicker, QuantityStepper } from "@/components";
import { INPUT_CLASS } from "@/components/styles";
import { NOTES_COUNTER_THRESHOLD, NOTES_MAX_LENGTH, NOTES_ROWS } from "@/constants/inventory";
import type { Location } from "@/types";

/** Props accepted by {@link LocationCard}. */
interface LocationCardProps {
  location: Location;
  onChange: (location: Location) => void;
}

/**
 * Card for moving a tracked item between the pantry and the freezer. The change is saved at once.
 *
 * @param props - The current location and the change callback.
 * @returns A card with the location radio group.
 */
export function LocationCard({ location, onChange }: LocationCardProps) {
  return (
    <Card>
      <p className="mb-4 text-body-lg text-on-surface-variant">Ubicación</p>
      <LocationPicker value={location} onChange={onChange} />
    </Card>
  );
}

/** Props accepted by {@link ThresholdCard}. */
interface ThresholdCardProps {
  threshold: number;
  isDirty: boolean;
  isSaving: boolean;
  onChange: (threshold: number) => void;
  onSave: () => void;
}

/**
 * Card for the alert threshold. The save button stays disabled until the value changes.
 *
 * @param props - The threshold, its dirty flag and the callbacks that change or save it.
 * @returns A card with an editable stepper and a save button.
 */
export function ThresholdCard({ threshold, isDirty, isSaving, onChange, onSave }: ThresholdCardProps) {
  return (
    <Card>
      <p className="mb-1 text-body-lg text-on-surface-variant">Umbral de alerta</p>
      <p className="mb-4 text-body-sm text-on-surface-variant">
        Recibirás alerta cuando baje de este valor o se agote
      </p>
      <div className="flex items-center justify-between gap-4">
        <QuantityStepper size="xs" editable value={threshold} onChange={onChange} />
        <Button size="sm" onClick={onSave} disabled={!isDirty || isSaving}>
          Guardar
        </Button>
      </div>
    </Card>
  );
}

/** Props accepted by {@link FreezerCard}. */
interface FreezerCardProps {
  drawer: number | null;
  frozenAt: string | null;
  isSaving: boolean;
  onSave: (fields: { drawer: number | null; frozen_at: string | null }) => void;
}

/**
 * Card with the drawer and frozen date of a freezer item.
 *
 * The values are kept locally until "Guardar" is pressed. The card is re-created when the
 * stored values change, so the local copy never goes stale.
 *
 * @param props - The stored values, the saving state and the save callback.
 * @returns A card with the freezer fields and a save button.
 */
export function FreezerCard({ drawer, frozenAt, isSaving, onSave }: FreezerCardProps) {
  return (
    <FreezerCardForm
      key={`${drawer}-${frozenAt}`}
      drawer={drawer}
      frozenAt={frozenAt}
      isSaving={isSaving}
      onSave={onSave}
    />
  );
}

/**
 * Form state of the freezer card.
 *
 * @param props - The stored values, the saving state and the save callback.
 * @returns The freezer card.
 */
function FreezerCardForm({ drawer, frozenAt, isSaving, onSave }: FreezerCardProps) {
  const [draftDrawer, setDraftDrawer] = useState(drawer);
  const [draftDate, setDraftDate] = useState(frozenAt);
  return (
    <Card>
      <p className="mb-4 text-body-lg text-on-surface-variant">Congelador</p>
      <FreezerFields
        drawer={draftDrawer}
        frozenAt={draftDate}
        onDrawerChange={setDraftDrawer}
        onFrozenAtChange={setDraftDate}
      />
      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={() => onSave({ drawer: draftDrawer, frozen_at: draftDate })} disabled={isSaving}>
          Guardar
        </Button>
      </div>
    </Card>
  );
}

/** Props accepted by {@link NotesCard}. */
interface NotesCardProps {
  value: string | null;
  isDirty: boolean;
  isSaving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

/**
 * Free-text note of a tracked item, such as "Hay 5 muslitos". It is saved with its own button.
 *
 * @param props - The note, its dirty flag and the callbacks that change or save it.
 * @returns A card with a text area, a character counter near the limit and a save button.
 */
export function NotesCard({ value, isDirty, isSaving, onChange, onSave }: NotesCardProps) {
  const text = value ?? "";
  return (
    <Card>
      <p className="mb-4 text-body-lg text-on-surface-variant">Notas</p>
      <textarea
        aria-label="Notas"
        maxLength={NOTES_MAX_LENGTH}
        rows={NOTES_ROWS}
        value={text}
        onChange={(event) => onChange(event.target.value)}
        className={INPUT_CLASS}
      />
      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="text-body-sm text-on-surface-variant">
          {text.length > NOTES_COUNTER_THRESHOLD ? `${text.length}/${NOTES_MAX_LENGTH}` : ""}
        </span>
        <Button size="sm" onClick={onSave} disabled={!isDirty || isSaving}>
          Guardar nota
        </Button>
      </div>
    </Card>
  );
}
