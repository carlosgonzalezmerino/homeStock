import { Button, Card, QuantityStepper } from "@/components";
import type { ProductEditor } from "@/hooks/useProductEditor";
import type { InventoryWithProductOut } from "@/types";
import { normalizeLocation } from "@/utils/freezer";
import { FreezerCard, LocationCard, NotesCard, ThresholdCard } from "./DetailCards";

/** Props accepted by {@link ManageStockCards}. */
interface ManageStockCardsProps {
  tracked: InventoryWithProductOut;
  editor: ProductEditor;
  onSaved: () => void;
  onRemoved: () => void;
}

/**
 * Every control for a product that is already in the pantry: quantity, location, freezer
 * fields, threshold, notes and removal.
 *
 * @param props - The tracked item, the editor and the callbacks after a save or a removal.
 * @returns The stack of cards.
 */
export function ManageStockCards({ tracked, editor, onSaved, onRemoved }: ManageStockCardsProps) {
  const location = normalizeLocation(tracked.inventory.location);
  return (
    <>
      <QuantityCard editor={editor} onSaved={onSaved} />
      <LocationCard location={location} onChange={editor.changeLocation} />
      {location === "freezer" && (
        <FreezerCard
          drawer={tracked.inventory.drawer ?? null}
          frozenAt={tracked.inventory.frozen_at ?? null}
          isSaving={editor.isSaving}
          onSave={editor.saveFreezerFields}
        />
      )}
      <ThresholdSection editor={editor} />
      <NotesSection editor={editor} />
      <RemoveButton editor={editor} onRemoved={onRemoved} />
    </>
  );
}

/** Props accepted by {@link ThresholdSection} and {@link NotesSection}. */
interface EditorSectionProps {
  editor: ProductEditor;
}

/**
 * The alert threshold card, bound to the editor.
 *
 * @param props - The editor that holds the threshold.
 * @returns The threshold card.
 */
function ThresholdSection({ editor }: EditorSectionProps) {
  return (
    <ThresholdCard
      threshold={editor.threshold.value}
      isDirty={editor.threshold.isDirty}
      isSaving={editor.isSaving}
      onChange={editor.threshold.change}
      onSave={editor.saveThreshold}
    />
  );
}

/**
 * The notes card, bound to the editor.
 *
 * @param props - The editor that holds the notes.
 * @returns The notes card.
 */
function NotesSection({ editor }: EditorSectionProps) {
  return (
    <NotesCard
      value={editor.notes.value}
      isDirty={editor.notes.isDirty}
      isSaving={editor.isSaving}
      onChange={editor.notes.change}
      onSave={editor.saveNotes}
    />
  );
}

/** Props accepted by {@link RemoveButton}. */
interface RemoveButtonProps {
  editor: ProductEditor;
  onRemoved: () => void;
}

/**
 * Button that takes the product out of the pantry.
 *
 * @param props - The editor that owns the removal and the callback after it.
 * @returns The removal button.
 */
function RemoveButton({ editor, onRemoved }: RemoveButtonProps) {
  return (
    <Button variant="ghost" onClick={() => editor.removeProduct(onRemoved)} disabled={editor.isRemoving}>
      Quitar de la despensa
    </Button>
  );
}

/** Props accepted by {@link QuantityCard}. */
interface QuantityCardProps {
  editor: ProductEditor;
  onSaved: () => void;
}

/**
 * Card for the quantity on hand. The value is absolute: "−" takes one unit out and "＋" puts one in.
 *
 * @param props - The editor and the callback after a save.
 * @returns A card with an editable stepper and the update button.
 */
function QuantityCard({ editor, onSaved }: QuantityCardProps) {
  return (
    <Card>
      <p className="mb-4 text-body-lg text-on-surface-variant">Cantidad actual</p>
      <div className="flex items-center justify-between gap-4">
        <QuantityStepper size="xs" editable value={editor.quantity.value} onChange={editor.quantity.change} />
        <Button size="sm" onClick={() => editor.setQuantity(editor.quantity.value, onSaved)} disabled={editor.isSaving}>
          Actualizar cantidad
        </Button>
      </div>
    </Card>
  );
}
