import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAddInventory, useCreateProduct, useDebouncedValue, useSearchProducts } from "@/hooks";
import { BackButton, Button, Card, FormField, FreezerFields, INPUT_CLASS, LocationPicker, Spinner } from "@/components";
import { DEFAULT_THRESHOLD, DEFAULT_UNIT } from "@/constants/inventory";
import { useActiveLocation } from "@/location";
import { CONFLICT_MESSAGE, SAVE_ERROR_MESSAGE } from "@/hooks/useProductEditor";
import type { InventoryCreate, Location, ProductCreate, ProductOut } from "@/types";
import { localIsoDate } from "@/utils/date";
import { isConflictError } from "@/utils/errors";
import { useCreateOnce } from "@/hooks/useCreateOnce";
import { generateCustomEan } from "@/utils/customEan";
import { freezerCreateFields } from "@/utils/freezer";
import { parseQuantity, validateRequiredQuantity } from "@/utils/parse";

/** How long the search waits after the last keystroke before querying the catalogue. */
const SEARCH_DEBOUNCE_MS = 300;
/** Storage location preselected for products added without a barcode. */
const DEFAULT_LOCATION: Location = "freezer";
/** Quantity preselected for products added without a barcode. */
const CUSTOM_DEFAULT_QUANTITY = 1;
/** Threshold preselected for products added without a barcode. */
const CUSTOM_DEFAULT_THRESHOLD = 1;
/** Error text for a name that is left empty. */
const NAME_REQUIRED_MESSAGE = "Requerido";

/** Values of the details step. Numeric fields stay as text until submit. */
export interface DetailsFormValues {
  name: string;
  brand: string;
  quantity: string;
  threshold: string;
  unit: string;
  location: Location;
  drawer: number | null;
  frozenAt: string | null;
}

/** Validation messages of the details step, keyed by field. */
export interface DetailsErrors {
  name?: string;
  quantity?: string;
  threshold?: string;
}

/** Field setter used by the details inputs. */
type FieldChange = <K extends keyof DetailsFormValues>(key: K, value: DetailsFormValues[K]) => void;

/**
 * Screen for adding a product that has no barcode.
 *
 * Step 1 searches the catalogue. Choosing a match opens the normal scan detail for it, so
 * stock is never added twice. "Crear nuevo" opens step 2, which creates the product and its stock.
 *
 * @returns The custom entry page.
 */
export function CustomEntry() {
  const [query, setQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  if (!isCreating) {
    return <SearchStep query={query} onQueryChange={setQuery} onCreateNew={() => setIsCreating(true)} />;
  }
  return <DetailsStep onBack={() => setIsCreating(false)} />;
}

/** Props accepted by {@link SearchStep}. */
interface SearchStepProps {
  query: string;
  onQueryChange: (query: string) => void;
  onCreateNew: () => void;
}

/**
 * Step 1: catalogue search with a shortcut to create a new product.
 *
 * @param props - The search text, its setter and the callback for "Crear nuevo".
 * @returns The search page.
 */
function SearchStep({ query, onQueryChange, onCreateNew }: SearchStepProps) {
  const navigate = useNavigate();
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const { data: results = [], isLoading: isSearching } = useSearchProducts(debouncedQuery);

  return (
    <div className="flex flex-col gap-6 pt-6">
      <h1 className="text-heading-sm text-on-surface">Añadir sin código</h1>
      <input
        role="searchbox"
        type="search"
        placeholder="Buscar producto existente..."
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        className={INPUT_CLASS}
      />
      {isSearching && <Spinner />}
      <SearchResultList products={results} onSelect={(ean) => navigate(`/scan/${encodeURIComponent(ean)}`)} />
      <Button variant="ghost" onClick={onCreateNew} type="button">
        Crear nuevo
      </Button>
    </div>
  );
}

/** Props accepted by {@link SearchResultList}. */
interface SearchResultListProps {
  products: ProductOut[];
  onSelect: (ean: string) => void;
}

/**
 * Clickable list of catalogue matches.
 *
 * @param props - The matches and the callback with the EAN of the one the user picks.
 * @returns The list, or nothing when there are no matches.
 */
function SearchResultList({ products, onSelect }: SearchResultListProps) {
  if (products.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {products.map((product) => (
        <button key={product.ean} type="button" onClick={() => onSelect(product.ean)} className="w-full text-left">
          <Card>
            <p className="text-body text-on-surface">{product.name}</p>
            {product.brand && <p className="text-body-sm text-on-surface-variant">{product.brand}</p>}
          </Card>
        </button>
      ))}
    </div>
  );
}

/**
 * Step 2: a new product and its stock. The code is generated once, so a retry reuses it.
 *
 * @param props - The callback that returns to step 1.
 * @returns The details form.
 */
function DetailsStep({ onBack }: { onBack: () => void }) {
  const [values, setValues] = useState<DetailsFormValues>(buildInitialValues);
  const [errors, setErrors] = useState<DetailsErrors>({});
  const { saveEntry, isPending, errorMessage } = useCustomEntrySave(values, setErrors);

  const updateValue: FieldChange = (key, value) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };

  return (
    <div className="flex flex-col gap-6 pt-6">
      <BackButton onBack={onBack} />
      <h1 className="text-heading-sm text-on-surface">Nuevo producto</h1>
      <form role="form" onSubmit={saveEntry} className="flex flex-col gap-4">
        <CreateFields values={values} errors={errors} onChange={updateValue} />
        <LocationField value={values.location} onChange={(location) => updateValue("location", location)} />
        {values.location === "freezer" && <FreezerDetails values={values} onChange={updateValue} />}
        <StockFields values={values} errors={errors} onChange={updateValue} />
        {errorMessage && <p className="text-body-sm text-error">{errorMessage}</p>}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
      </form>
    </div>
  );
}

/** Props accepted by {@link LocationField}. */
interface LocationFieldProps {
  value: Location;
  onChange: (location: Location) => void;
}

/**
 * Storage location of the new product.
 *
 * @param props - The chosen location and its change callback.
 * @returns The labelled location picker.
 */
function LocationField({ value, onChange }: LocationFieldProps) {
  return (
    <FormField label="Ubicación">
      <LocationPicker value={value} onChange={onChange} name="custom-location" />
    </FormField>
  );
}

/**
 * Drawer and frozen date of the new product, which only apply to the freezer.
 *
 * @param props - The current values and the change callback.
 * @returns The freezer fields.
 */
function FreezerDetails({ values, onChange }: Pick<DetailsFieldsProps, "values" | "onChange">) {
  return (
    <FreezerFields
      drawer={values.drawer}
      frozenAt={values.frozenAt}
      onDrawerChange={(drawer) => onChange("drawer", drawer)}
      onFrozenAtChange={(frozenAt) => onChange("frozenAt", frozenAt)}
    />
  );
}

/**
 * Creates the initial values of the details form.
 *
 * @returns The default values for a product added without a barcode.
 */
function buildInitialValues(): DetailsFormValues {
  return {
    name: "",
    brand: "",
    quantity: String(CUSTOM_DEFAULT_QUANTITY),
    threshold: String(CUSTOM_DEFAULT_THRESHOLD),
    unit: DEFAULT_UNIT,
    location: DEFAULT_LOCATION,
    drawer: null,
    frozenAt: localIsoDate(),
  };
}

/**
 * Checks the details form and returns a message for each invalid field.
 *
 * @param values - The values the user entered.
 * @returns The messages by field. An empty object means the form is valid.
 */
export function validateDetails(values: DetailsFormValues): DetailsErrors {
  const errors: DetailsErrors = {};
  if (values.name.trim() === "") errors.name = NAME_REQUIRED_MESSAGE;
  const quantityError = validateRequiredQuantity(values.quantity);
  if (quantityError) errors.quantity = quantityError;
  const thresholdError = validateRequiredQuantity(values.threshold);
  if (thresholdError) errors.threshold = thresholdError;
  return errors;
}

/** What the save hook returns to the details step. */
interface CustomEntrySave {
  saveEntry: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  isPending: boolean;
  errorMessage: string | null;
}

/**
 * Save flow of the custom entry: creates the product once, then adds it to the inventory.
 *
 * @param values - The submitted details.
 * @param setErrors - Receives the validation messages when the form is not valid.
 * @returns The submit handler, the pending flag and the message of the last failure.
 */
function useCustomEntrySave(values: DetailsFormValues, setErrors: (errors: DetailsErrors) => void): CustomEntrySave {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setLocation } = useActiveLocation();
  const [customEan] = useState(generateCustomEan);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const createProduct = useCreateProduct();
  const addInventory = useAddInventory();
  const ensureProductSaved = useCreateOnce(() => createProduct.mutateAsync(buildProductBody(customEan, values)));

  async function saveEntry(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const found = validateDetails(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setErrorMessage(null);
    try {
      await ensureProductSaved();
      await addInventory.mutateAsync(buildInventoryBody(customEan, values));
    } catch (error) {
      setErrorMessage(isConflictError(error) ? CONFLICT_MESSAGE : SAVE_ERROR_MESSAGE);
      if (isConflictError(error)) void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      return;
    }
    setLocation(values.location);
    navigate("/despensa", { state: { added: true }, replace: true });
  }

  return { saveEntry, isPending: createProduct.isPending || addInventory.isPending, errorMessage };
}

/**
 * Builds the product creation body for a product added without a barcode.
 *
 * @param ean - The generated identifier for the product.
 * @param values - The submitted details.
 * @returns A {@link ProductCreate} body. The brand is omitted when empty.
 */
export function buildProductBody(ean: string, values: DetailsFormValues): ProductCreate {
  return {
    ean,
    name: values.name,
    ...(values.brand ? { brand: values.brand } : {}),
  };
}

/**
 * Builds the inventory creation body, applying defaults to empty fields.
 *
 * @param ean - EAN of the product being stored.
 * @param values - The submitted details.
 * @returns An {@link InventoryCreate} body.
 */
export function buildInventoryBody(ean: string, values: DetailsFormValues): InventoryCreate {
  return {
    ean,
    quantity: parseQuantity(values.quantity, CUSTOM_DEFAULT_QUANTITY),
    threshold: parseQuantity(values.threshold, DEFAULT_THRESHOLD),
    unit: values.unit || DEFAULT_UNIT,
    location: values.location,
    ...freezerCreateFields(values.location, values.drawer, values.frozenAt),
  };
}

/** Props accepted by the detail field groups. */
interface DetailsFieldsProps {
  values: DetailsFormValues;
  errors: DetailsErrors;
  onChange: FieldChange;
}

/**
 * Name and brand inputs of a new product.
 *
 * @param props - The current values, the validation messages and the change callback.
 * @returns The name and brand fields.
 */
function CreateFields({ values, errors, onChange }: DetailsFieldsProps) {
  return (
    <>
      <FormField label="Nombre" error={errors.name}>
        <input
          aria-label="nombre"
          value={values.name}
          onChange={(event) => onChange("name", event.target.value)}
          className={INPUT_CLASS}
        />
      </FormField>
      <FormField label="Marca (opcional)" htmlFor="field-brand">
        <input
          id="field-brand"
          value={values.brand}
          onChange={(event) => onChange("brand", event.target.value)}
          className={INPUT_CLASS}
        />
      </FormField>
    </>
  );
}

/**
 * Quantity, threshold and unit inputs. Both numbers accept a decimal comma, and the threshold may be 0.
 *
 * @param props - The current values, the validation messages and the change callback.
 * @returns The stock fields.
 */
function StockFields({ values, errors, onChange }: DetailsFieldsProps) {
  return (
    <>
      <FormField label="Cantidad inicial" htmlFor="field-quantity" error={errors.quantity}>
        <input
          id="field-quantity"
          inputMode="decimal"
          value={values.quantity}
          onChange={(event) => onChange("quantity", event.target.value)}
          className={INPUT_CLASS}
        />
      </FormField>
      <FormField label="Umbral mínimo" htmlFor="field-threshold" error={errors.threshold}>
        <input
          id="field-threshold"
          inputMode="decimal"
          value={values.threshold}
          onChange={(event) => onChange("threshold", event.target.value)}
          className={INPUT_CLASS}
        />
      </FormField>
      <FormField label="Unidad" htmlFor="field-unit">
        <input id="field-unit" value={values.unit} onChange={(event) => onChange("unit", event.target.value)} className={INPUT_CLASS} />
      </FormField>
    </>
  );
}
