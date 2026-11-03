import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useAddToShoppingList,
  useDebouncedValue,
  useRegisterPurchase,
  useRemoveFromShoppingList,
  useSearchProducts,
  useShoppingList,
  useUpdateShoppingItem,
} from "@/hooks";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  INPUT_CLASS,
  ProductThumbnail,
  QuantityStepper,
  Spinner,
  StatusToast,
} from "@/components";
import type { ProductOut, ShoppingListItemOut } from "@/types";
import { formatQuantity } from "@/utils/format";
import { sortByChecked } from "@/utils/shopping";

/** Shown when the list has nothing on it. It no longer means "nothing is missing". */
const EMPTY_LIST_MESSAGE = "Tu lista está vacía. Busca un producto para añadirlo";
/** Shown after a successful registration. */
const REGISTERED_MESSAGE = "Compra añadida";
/** Shown when the catalogue search finds nothing. */
const NO_RESULTS_MESSAGE = "Nada en tu catálogo con ese nombre";
/** Shown when a change could not be saved and was undone on screen. */
const UPDATE_ERROR_MESSAGE = "No se pudo guardar el cambio. Se ha deshecho.";
/** Shown when the purchase could not be registered. */
const PURCHASE_ERROR_MESSAGE = "No se pudo añadir la compra. La lista sigue como estaba.";
/** Quiet period before the catalogue is searched. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Shopping list: only what the user adds, taken from the catalogue.
 *
 * Marking a line or changing its amount shows at once and is undone if the server refuses.
 * "Añadir al stock" puts every picked-up line into the pantry in one go, all or nothing.
 *
 * @returns The search box, the lines and the purchase bar, or a loading or error state.
 */
export function ShoppingList() {
  const { data, isLoading, isError, refetch } = useShoppingList();
  const lines = useMemo(() => sortByChecked(data ?? []), [data]);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="Error al cargar" onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6 pt-6">
      <CatalogSearch />
      {lines.length === 0 ? <EmptyState message={EMPTY_LIST_MESSAGE} /> : <LinesList lines={lines} />}
      <PurchaseBar pickedUp={lines.filter((line) => line.checked).length} />
    </div>
  );
}

/**
 * Search box over the catalogue. Choosing a result puts that product on the list.
 *
 * @returns The input and, under it, the matching products.
 */
function CatalogSearch() {
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const { data: results = [], isFetched } = useSearchProducts(debounced);
  const add = useAddToShoppingList();

  function choose(product: ProductOut) {
    add.mutate({ ean: product.ean });
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        role="searchbox"
        type="search"
        placeholder="Añadir a la lista…"
        aria-label="Añadir a la lista"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className={INPUT_CLASS}
      />
      {debounced === query.trim() && debounced.length > 0 && (
        <SearchResults results={results} isFetched={isFetched} onChoose={choose} />
      )}
    </div>
  );
}

/** Props accepted by {@link SearchResults}. */
interface SearchResultsProps {
  results: ProductOut[];
  isFetched: boolean;
  onChoose: (product: ProductOut) => void;
}

/**
 * The products that match the search, or a message when none does.
 *
 * @param props - The matches, whether the search has finished and the choose callback.
 * @returns A list of buttons, or the "nothing found" message with a way to create a product.
 */
function SearchResults({ results, isFetched, onChoose }: SearchResultsProps) {
  if (!isFetched) return null;
  if (results.length === 0) {
    return (
      <div className="flex flex-col gap-2 text-body-sm text-on-surface-variant">
        <p>{NO_RESULTS_MESSAGE}</p>
        <Link to="/custom-entry" className="text-primary underline">
          Crear un producto
        </Link>
      </div>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {results.map((product) => (
        <li key={product.ean}>
          <button
            type="button"
            onClick={() => onChoose(product)}
            className="flex w-full items-center gap-3 rounded-lg bg-surface-container p-3 text-left"
          >
            <ProductThumbnail imageUrl={product.image_url} alt={product.name} placeholderIcon="grocery" sizeClass="h-10 w-10" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body text-on-surface">{product.name}</span>
              {product.brand && <span className="block truncate text-body-sm text-on-surface-variant">{product.brand}</span>}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Props accepted by {@link LinesList}. */
interface LinesListProps {
  lines: ShoppingListItemOut[];
}

/**
 * The lines of the list.
 *
 * @param props - The lines, already ordered.
 * @returns One card per line.
 */
function LinesList({ lines }: LinesListProps) {
  return (
    <div className="flex flex-col gap-3">
      {lines.map((line) => (
        <ShoppingRow key={line.ean} line={line} />
      ))}
    </div>
  );
}

/** Props accepted by {@link ShoppingRow}. */
interface ShoppingRowProps {
  line: ShoppingListItemOut;
}

/**
 * One line: the picked-up box, the product, how much is at home, the amount to buy, and a way to remove it.
 *
 * Taking the amount below 1 removes the line, as the "−" at 1 would suggest. If the server
 * refuses a change, the line goes back to how it was and says so under itself.
 *
 * @param props - The line.
 * @returns A card.
 */
function ShoppingRow({ line }: ShoppingRowProps) {
  const navigate = useNavigate();
  const update = useUpdateShoppingItem();
  const remove = useRemoveFromShoppingList();
  const openDetail = () => navigate(`/despensa/${encodeURIComponent(line.ean)}`);
  const nameClass = line.checked ? "truncate text-body text-on-surface-variant line-through" : "truncate text-body text-on-surface";

  function changeQuantity(next: number) {
    if (next <= 0) remove.mutate(line.ean);
    else update.mutate({ ean: line.ean, body: { quantity: next } });
  }

  return (
    <Card dense>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          aria-label={line.name}
          checked={line.checked}
          onChange={() => update.mutate({ ean: line.ean, body: { checked: !line.checked } })}
          className="h-6 w-6 shrink-0 accent-primary"
        />
        <button type="button" onClick={openDetail} aria-label={`Abrir ${line.name}`} className="shrink-0 rounded-sm">
          <ProductThumbnail imageUrl={line.image_url} alt="" placeholderIcon="grocery" sizeClass="h-11 w-11" />
        </button>
        <button type="button" onClick={openDetail} className="min-w-0 flex-1 text-left">
          <p className={nameClass}>{line.name}</p>
          <p className="truncate text-body-sm text-on-surface-variant">{stockLine(line)}</p>
        </button>
        <QuantityStepper size="xs" tone="neutral" editable value={line.quantity} onChange={changeQuantity} />
        <button
          type="button"
          aria-label={`Quitar ${line.name}`}
          onClick={() => remove.mutate(line.ean)}
          className="material-symbols-outlined shrink-0 text-on-surface-variant"
        >
          close
        </button>
      </div>
      {update.isError && (
        <p role="alert" className="mt-2 text-body-sm text-error">
          {UPDATE_ERROR_MESSAGE}
        </p>
      )}
    </Card>
  );
}

/**
 * Says how much of a product is at home.
 *
 * @param line - The line.
 * @returns "En casa: 2 units", or that it is not in the pantry.
 */
function stockLine(line: ShoppingListItemOut): string {
  if (line.in_stock == null) return "No está en la despensa";
  return `En casa: ${formatQuantity(line.in_stock)} ${line.unit}`;
}

/** Props accepted by {@link PurchaseBar}. */
interface PurchaseBarProps {
  pickedUp: number;
}

/**
 * Bar that registers every picked-up line as a purchase. It stays near the bottom of the screen,
 * above the navigation, so it is reachable without scrolling back up.
 *
 * @param props - How many lines are picked up.
 * @returns The bar with its button, and the outcome of the last attempt.
 */
function PurchaseBar({ pickedUp }: PurchaseBarProps) {
  const purchase = useRegisterPurchase();
  return (
    <div className="sticky bottom-24 z-30 flex flex-col gap-2 bg-background/95 py-3 backdrop-blur">
      {purchase.isSuccess && <StatusToast message={REGISTERED_MESSAGE} />}
      {purchase.isError && (
        <p role="alert" className="text-center text-body-sm text-error">
          {PURCHASE_ERROR_MESSAGE}
        </p>
      )}
      <Button onClick={() => purchase.mutate()} disabled={pickedUp === 0 || purchase.isPending}>
        {`Añadir al stock (${pickedUp})`}
      </Button>
    </div>
  );
}
