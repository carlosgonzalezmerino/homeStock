import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAddedToast, useInventory, usePatchInventory } from "@/hooks";
import {
  Card,
  EmptyState,
  ErrorState,
  INPUT_CLASS,
  ManualSourceIcon,
  ProductThumbnail,
  QuantityStepper,
  SegmentedControl,
  Spinner,
  StatusToast,
  type SegmentOption,
} from "@/components";
import { useActiveLocation } from "@/location";
import type { InventoryWithProductOut, Location } from "@/types";
import { roundQuantity } from "@/utils/format";
import { normalizeLocation } from "@/utils/freezer";
import { computeStockStatus, isPantryLocation } from "@/utils/stock";

/** Tabs that switch between the two storage locations. */
const LOCATION_OPTIONS: readonly SegmentOption<Location>[] = [
  { value: "pantry", label: "Despensa" },
  { value: "freezer", label: "Congelador" },
];

/** Message shown when a location has no items at all. */
const EMPTY_LOCATION_MESSAGES: Record<Location, string> = {
  pantry: "Tu despensa está vacía. Escanea tu primer producto",
  freezer: "Tu congelador está vacío. Añade productos con 'Añadir sin código'",
};

/** Message shown when a stock change could not be saved. */
const SAVE_CHANGE_ERROR = "No se pudo guardar el cambio";
/** Message shown in the "added" confirmation. */
const ADDED_MESSAGE = "Producto añadido";

/**
 * Tells whether an item belongs to the selected location tab.
 *
 * @param item - The inventory item to test.
 * @param location - The selected location.
 * @returns `true` when the item is stored in that location.
 */
function belongsToLocation(item: InventoryWithProductOut, location: Location): boolean {
  if (location === "pantry") return isPantryLocation(item.inventory.location);
  return item.inventory.location === "freezer";
}

/**
 * Tells whether an item matches a search text by its name or brand.
 *
 * @param item - The inventory item to test.
 * @param query - Text typed in the search box. An empty query matches everything.
 * @returns `true` when the name or the brand contains the query, ignoring case.
 */
function matchesSearch(item: InventoryWithProductOut, query: string): boolean {
  if (!query) return true;
  const needle = query.toLowerCase();
  const name = item.product.name.toLowerCase();
  const brand = (item.product.brand ?? "").toLowerCase();
  return name.includes(needle) || brand.includes(needle);
}

/**
 * Filter state of the pantry: the selected location (shared with the rest of the app), the search text and the visible items.
 *
 * @param items - All inventory items, or `undefined` while they load.
 * @returns The filter state and the setters for it.
 */
function usePantryFilter(items: InventoryWithProductOut[] | undefined) {
  const [search, setSearch] = useState("");
  const { location, setLocation } = useActiveLocation();
  const locationItems = useMemo(
    () => (items ?? []).filter((item) => belongsToLocation(item, location)),
    [items, location],
  );
  const visibleItems = useMemo(
    () => locationItems.filter((item) => matchesSearch(item, search)),
    [locationItems, search],
  );
  return { location, setLocation, search, setSearch, locationItems, visibleItems };
}

/**
 * Pantry screen: items grouped by storage location, with search and inline quantity editing.
 *
 * @returns The pantry list, or a loading or error state while the inventory loads.
 */
export function Pantry() {
  const { data, isLoading, isError, refetch } = useInventory();
  const filter = usePantryFilter(data);
  const showAddedToast = useAddedToast();

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="Error al cargar" onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6 pt-6">
      {showAddedToast && <StatusToast message={ADDED_MESSAGE} />}
      <PantryFilters filter={filter} />
      <PantryList
        items={filter.visibleItems}
        hasLocationItems={filter.locationItems.length > 0}
        emptyMessage={EMPTY_LOCATION_MESSAGES[filter.location]}
      />
    </div>
  );
}

/** Props accepted by {@link PantryFilters}. */
interface PantryFiltersProps {
  filter: ReturnType<typeof usePantryFilter>;
}

/**
 * Location tabs and the search box above the list.
 *
 * @param props - The filter state of the pantry.
 * @returns The tabs and the search field.
 */
function PantryFilters({ filter }: PantryFiltersProps) {
  return (
    <>
      <SegmentedControl
        options={LOCATION_OPTIONS}
        value={filter.location}
        onChange={filter.setLocation}
        ariaLabel="Ubicación"
      />
      <input
        role="searchbox"
        type="search"
        placeholder="Buscar..."
        value={filter.search}
        onChange={(event) => filter.setSearch(event.target.value)}
        className={INPUT_CLASS}
      />
    </>
  );
}

/** Props accepted by {@link PantryList}. */
interface PantryListProps {
  items: InventoryWithProductOut[];
  hasLocationItems: boolean;
  emptyMessage: string;
}

/**
 * Renders the visible items, or the empty message that explains why there are none.
 *
 * @param props - Visible items, whether the location has any items, and the empty message.
 * @returns A list of items or an empty state.
 */
function PantryList({ items, hasLocationItems, emptyMessage }: PantryListProps) {
  if (items.length === 0) {
    return <EmptyState message={hasLocationItems ? "Sin resultados" : emptyMessage} />;
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <PantryItem key={item.inventory.ean} item={item} />
      ))}
    </div>
  );
}

/**
 * Quantity that the user edits inline. Each change is saved immediately and rolled back on failure.
 *
 * @param item - The inventory item whose quantity is edited.
 * @returns The displayed quantity, the change handler and the save state.
 */
function useInlineQuantity(item: InventoryWithProductOut) {
  const { inventory } = item;
  const [quantity, setQuantity] = useState(inventory.quantity);
  const patch = usePatchInventory();

  useEffect(() => {
    setQuantity(inventory.quantity);
  }, [inventory.quantity]);

  function changeQuantity(nextQuantity: number) {
    const rounded = roundQuantity(nextQuantity);
    setQuantity(rounded);
    patch.mutate(
      { ean: inventory.ean, body: { quantity: rounded } },
      { onError: () => setQuantity(inventory.quantity) },
    );
  }

  return { quantity, changeQuantity, hasSaveError: patch.isError };
}

/**
 * Text under the product name: the drawer of a freezer item and its note.
 *
 * @param props - The inventory item.
 * @returns A short line of detail, or nothing when there is none.
 */
function PantryItemDetails({ item }: { item: InventoryWithProductOut }) {
  const { inventory, product } = item;
  const drawerLabel = normalizeLocation(inventory.location) === "freezer" && inventory.drawer ? `Cajón ${inventory.drawer}` : null;
  const parts = [product.brand, drawerLabel, inventory.notes].filter((part): part is string => Boolean(part));
  if (parts.length === 0) return null;
  return <p className="truncate text-body-sm text-on-surface-variant">{parts.join(" · ")}</p>;
}

/** Props accepted by {@link PantryItemLabel}. */
interface PantryItemLabelProps {
  item: InventoryWithProductOut;
  onOpen: () => void;
}

/**
 * Name, origin icon and details of a pantry item, as one button that opens the detail.
 *
 * @param props - The inventory item and the callback that opens its detail.
 * @returns The label button.
 */
function PantryItemLabel({ item, onOpen }: PantryItemLabelProps) {
  return (
    <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
      <span className="flex items-center gap-2">
        <span className="truncate text-body text-on-surface">{item.product.name}</span>
        {item.product.source === "manual" && <ManualSourceIcon />}
      </span>
      <PantryItemDetails item={item} />
    </button>
  );
}

/** Props accepted by {@link PantryItem}. */
interface PantryItemProps {
  item: InventoryWithProductOut;
}

/**
 * Row for one pantry item: thumbnail, name, details and a quantity stepper.
 *
 * @param props - The inventory item to display.
 * @returns A card that opens the product detail and edits the quantity in place.
 */
function PantryItem({ item }: PantryItemProps) {
  const navigate = useNavigate();
  const { product, inventory } = item;
  const { quantity, changeQuantity, hasSaveError } = useInlineQuantity(item);
  const openDetail = () => navigate(`/despensa/${encodeURIComponent(inventory.ean)}`);
  const status = computeStockStatus(quantity, inventory.threshold);
  const accent = status === "empty" ? "error" : status === "low" ? "tertiary" : null;

  return (
    <Card dense accent={accent}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={openDetail} aria-label={product.name} className="shrink-0 rounded-sm">
          <ProductThumbnail
            imageUrl={product.image_url}
            alt={product.name}
            placeholderIcon={normalizeLocation(inventory.location) === "freezer" ? "ac_unit" : "grocery"}
            sizeClass="h-11 w-11"
          />
        </button>
        <PantryItemLabel item={item} onOpen={openDetail} />
        <QuantityStepper value={quantity} onChange={changeQuantity} size="xs" tone="neutral" />
      </div>
      {hasSaveError && <p className="mt-2 text-body-sm text-error">{SAVE_CHANGE_ERROR}</p>}
    </Card>
  );
}
