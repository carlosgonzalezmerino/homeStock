import { useState } from "react";
import { Button, Card, FreezerFields, LocationPicker, QuantityStepper } from "@/components";
import { DEFAULT_NEW_QUANTITY, DEFAULT_THRESHOLD } from "@/constants/inventory";
import type { ProductEditor } from "@/hooks/useProductEditor";
import type { InventoryWithProductOut, Location } from "@/types";
import { localIsoDate } from "@/utils/date";
import { formatQuantity } from "@/utils/format";
import { normalizeLocation } from "@/utils/freezer";
import { locationLabel } from "@/utils/stock";

/** Props accepted by {@link AddStockCard}. */
interface AddStockCardProps {
  tracked: InventoryWithProductOut | undefined;
  activeLocation: Location;
  editor: ProductEditor;
  onSaved: () => void;
}

/**
 * Card for adding stock: a new product, or more units of a product that is already tracked.
 *
 * For a new product it also asks for the alert threshold, and for the freezer the drawer and date.
 * For a tracked product it says how many units will be added, and warns when the location changes.
 *
 * @param props - The tracked item, the active location, the editor and the callback after a save.
 * @returns The card with the form and its save button.
 */
export function AddStockCard({ tracked, activeLocation, editor, onSaved }: AddStockCardProps) {
  const draft = useAddStockDraft(tracked, activeLocation);
  const { amount, location, threshold, drawer, frozenAt } = draft;

  const isSaveDisabled = amount <= 0 || editor.isSaving;
  const label = tracked ? `Sumar ${formatQuantity(amount)}` : `Añadir a ${locationLabel(location)}`;

  function save(): void {
    if (tracked) {
      editor.addToTracked(amount, location, onSaved);
      return;
    }
    editor.addProduct({ quantity: amount, threshold, location, drawer, frozenAt }, onSaved);
  }

  return (
    <Card>
      <AddNotice tracked={tracked} amount={amount} />
      <AddStockFields tracked={tracked} {...draft.setters} amount={amount} location={location} drawer={drawer} frozenAt={frozenAt} threshold={threshold} />
      <div className="mt-6 flex justify-end">
        <Button onClick={save} disabled={isSaveDisabled}>
          {label}
        </Button>
      </div>
    </Card>
  );
}

/** Props accepted by {@link AddStockFields}. */
interface AddStockFieldsProps extends AddStockSetters {
  tracked: InventoryWithProductOut | undefined;
  amount: number;
  location: Location;
  drawer: number | null;
  frozenAt: string | null;
  threshold: number;
}

/**
 * The inputs of the add card: amount, location and, depending on the product, the freezer fields or the threshold.
 *
 * @param props - The tracked item and the current value and setter of each input.
 * @returns The form fields.
 */
function AddStockFields(props: AddStockFieldsProps) {
  const { tracked, amount, location } = props;
  const isLocationChanged = tracked !== undefined && location !== normalizeLocation(tracked.inventory.location);
  return (
    <div className="mt-4 flex flex-col gap-4">
      <p className="text-body-lg text-on-surface-variant">{tracked ? "Cantidad a sumar" : "Cantidad a añadir"}</p>
      <QuantityStepper size="xs" editable value={amount} onChange={props.onAmountChange} />
      <p className="text-body-lg text-on-surface-variant">Ubicación</p>
      <LocationPicker value={location} onChange={props.onLocationChange} name="add-location" />
      {isLocationChanged && <p className="text-body-sm text-error">Cambiar la ubicación mueve todas las unidades</p>}
      {!tracked && location === "freezer" && (
        <FreezerFields
          drawer={props.drawer}
          frozenAt={props.frozenAt}
          onDrawerChange={props.onDrawerChange}
          onFrozenAtChange={props.onFrozenAtChange}
        />
      )}
      {!tracked && (
        <>
          <p className="text-body-lg text-on-surface-variant">Umbral de alerta</p>
          <QuantityStepper size="xs" editable value={props.threshold} onChange={props.onThresholdChange} />
        </>
      )}
    </div>
  );
}

/** Editable values of the add card, with their setters. */
interface AddStockDraft {
  amount: number;
  location: Location;
  threshold: number;
  drawer: number | null;
  frozenAt: string | null;
  setters: AddStockSetters;
}

/** Setters of the add card's inputs. */
interface AddStockSetters {
  onAmountChange: (amount: number) => void;
  onLocationChange: (location: Location) => void;
  onThresholdChange: (threshold: number) => void;
  onDrawerChange: (drawer: number | null) => void;
  onFrozenAtChange: (frozenAt: string | null) => void;
}

/**
 * Local values of the add card. The location starts at the product's own location when it is tracked,
 * otherwise at the active tab. A new freezer item starts with today's date.
 *
 * @param tracked - The inventory entry, if the product is already in the pantry.
 * @param activeLocation - The location the user was looking at.
 * @returns The current values and their setters.
 */
function useAddStockDraft(tracked: InventoryWithProductOut | undefined, activeLocation: Location): AddStockDraft {
  const [amount, setAmount] = useState(DEFAULT_NEW_QUANTITY);
  const [location, setLocation] = useState<Location>(
    tracked ? normalizeLocation(tracked.inventory.location) : activeLocation,
  );
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [drawer, setDrawer] = useState<number | null>(null);
  const [frozenAt, setFrozenAt] = useState<string | null>(localIsoDate());
  return {
    amount,
    location,
    threshold,
    drawer,
    frozenAt,
    setters: {
      onAmountChange: setAmount,
      onLocationChange: setLocation,
      onThresholdChange: setThreshold,
      onDrawerChange: setDrawer,
      onFrozenAtChange: setFrozenAt,
    },
  };
}

/** Props accepted by {@link AddNotice}. */
interface AddNoticeProps {
  tracked: InventoryWithProductOut | undefined;
  amount: number;
}

/**
 * Sentence that tells the user whether the product is new or already in the pantry.
 *
 * @param props - The tracked item, if any, and the amount that will be added.
 * @returns A short paragraph that describes the state of the product.
 */
function AddNotice({ tracked, amount }: AddNoticeProps) {
  if (!tracked) return <p className="text-body-lg text-on-surface">Producto nuevo</p>;
  const { quantity, unit, location } = tracked.inventory;
  return (
    <p className="text-body-lg text-on-surface">
      Ya existe: {formatQuantity(quantity)} {unit} en {locationLabel(normalizeLocation(location))}. Se sumarán{" "}
      {formatQuantity(amount)}
    </p>
  );
}

