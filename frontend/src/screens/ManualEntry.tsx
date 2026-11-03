import { useState, type BaseSyntheticEvent } from "react";
import { Controller, useForm, type Control, type FieldErrors, type UseFormRegister, type UseFormReturn } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAddInventory, useCreateProduct } from "@/hooks";
import { Button, DrawerPicker, FormField, INPUT_CLASS, LocationPicker } from "@/components";
import { DEFAULT_THRESHOLD, DEFAULT_UNIT } from "@/constants/inventory";
import { useActiveLocation } from "@/location";
import type { InventoryCreate, Location, ProductCreate } from "@/types";
import { localIsoDate } from "@/utils/date";
import { isConflictError } from "@/utils/errors";
import { useCreateOnce } from "@/hooks/useCreateOnce";
import { freezerCreateFields } from "@/utils/freezer";
import { parseOptionalDecimal, parseQuantity, validateOptionalQuantity, validateRequiredQuantity } from "@/utils/parse";
import { CONFLICT_MESSAGE, SAVE_ERROR_MESSAGE } from "@/hooks/useProductEditor";

/** Form values of the manual product screen. Numeric fields are kept as text until submit. */
export interface ManualFormValues {
  ean: string;
  name: string;
  brand: string;
  quantity: string;
  threshold: string;
  unit: string;
  location: Location;
  drawer: number | null;
  frozen_at: string;
  kcal_per_100g: string;
  proteins_per_100g: string;
  carbs_per_100g: string;
  fat_per_100g: string;
}

/** Nutrition inputs shown in the optional section of the form. */
const NUTRITION_FIELDS = [
  { name: "kcal_per_100g", label: "Calorías (kcal)" },
  { name: "proteins_per_100g", label: "Proteínas (g)" },
  { name: "carbs_per_100g", label: "Carbohidratos (g)" },
  { name: "fat_per_100g", label: "Grasas (g)" },
] as const satisfies readonly { name: keyof ManualFormValues; label: string }[];

/** Quantity used when the user leaves the quantity field empty. */
const DEFAULT_QUANTITY = 1;

/**
 * Builds the default form values, pre-filling the EAN from the route and the location from the active tab.
 *
 * @param ean - The EAN from the URL.
 * @param location - The location the user was looking at.
 * @returns The initial values for the form.
 */
function buildDefaultValues(ean: string, location: Location): ManualFormValues {
  return {
    ean,
    name: "",
    brand: "",
    quantity: String(DEFAULT_QUANTITY),
    threshold: String(DEFAULT_THRESHOLD),
    unit: DEFAULT_UNIT,
    location,
    drawer: null,
    frozen_at: localIsoDate(),
    kcal_per_100g: "",
    proteins_per_100g: "",
    carbs_per_100g: "",
    fat_per_100g: "",
  };
}

/**
 * Converts the form values into the body of the product creation request.
 *
 * @param values - The submitted form values.
 * @returns A {@link ProductCreate} body. Empty optional fields are omitted or left undefined.
 */
export function buildProductPayload(values: ManualFormValues): ProductCreate {
  return {
    ean: values.ean,
    name: values.name,
    ...(values.brand ? { brand: values.brand } : {}),
    kcal_per_100g: parseOptionalDecimal(values.kcal_per_100g),
    proteins_per_100g: parseOptionalDecimal(values.proteins_per_100g),
    carbs_per_100g: parseOptionalDecimal(values.carbs_per_100g),
    fat_per_100g: parseOptionalDecimal(values.fat_per_100g),
  };
}

/**
 * Converts the form values into the body of the inventory creation request.
 *
 * @param values - The submitted form values.
 * @returns An {@link InventoryCreate} body with the freezer fields only for the freezer.
 */
export function buildInventoryPayload(values: ManualFormValues): InventoryCreate {
  return {
    ean: values.ean,
    quantity: parseQuantity(values.quantity, DEFAULT_QUANTITY),
    threshold: parseQuantity(values.threshold, DEFAULT_THRESHOLD),
    unit: values.unit || DEFAULT_UNIT,
    location: values.location,
    ...freezerCreateFields(values.location, values.drawer, values.frozen_at || null),
  };
}

/**
 * Form for adding a product whose EAN is not in the catalogue.
 *
 * The product is created first and then added to the inventory. A retry after a failure does not
 * create the product again. On success the user goes to the list of the chosen location.
 *
 * @returns The manual entry page.
 */
export function ManualEntry() {
  const { ean: routeEan = "" } = useParams<{ ean: string }>();
  const { location: activeLocation } = useActiveLocation();
  const form = useForm<ManualFormValues>({ defaultValues: buildDefaultValues(routeEan, activeLocation) });
  const save = useManualSave();

  return (
    <div className="flex flex-col gap-6 pt-6">
      <h1 className="text-heading-sm text-on-surface">Nuevo producto</h1>
      <p className="text-body-sm text-on-surface-variant">EAN no reconocido. Rellena los datos del producto.</p>
      <ManualForm
        form={form}
        onSubmit={form.handleSubmit(save.submit)}
        isPending={save.isPending}
        errorMessage={save.errorMessage}
      />
    </div>
  );
}

/** Screen shown after the product is saved, unless the screen that sent the user here says otherwise. */
const DEFAULT_DESTINATION = "/despensa";

/**
 * Chooses where to go after saving. A screen can ask to be returned to through `state.returnTo`,
 * which is only honoured for paths inside the app.
 *
 * @param state - The router state this screen was opened with.
 * @returns The requested path, or the pantry.
 */
export function returnDestination(state: unknown): string {
  const requested = (state as { returnTo?: unknown } | null)?.returnTo;
  const isInternalPath = typeof requested === "string" && requested.startsWith("/") && !requested.startsWith("//");
  return isInternalPath ? requested : DEFAULT_DESTINATION;
}

/**
 * Save flow of the manual entry: the product once, then its stock. On success it returns to the
 * screen that asked for it, or to the pantry.
 *
 * @returns The submit handler, the pending flag and the message of the last failure.
 */
function useManualSave() {
  const navigate = useNavigate();
  const destination = returnDestination(useLocation().state);
  const queryClient = useQueryClient();
  const { setLocation } = useActiveLocation();
  const createProduct = useCreateProduct();
  const addInventory = useAddInventory();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const ensureProductSaved = useCreateOnce((values: ManualFormValues) =>
    createProduct.mutateAsync(buildProductPayload(values)),
  );

  async function submit(values: ManualFormValues): Promise<void> {
    setErrorMessage(null);
    try {
      await ensureProductSaved(values);
      await addInventory.mutateAsync(buildInventoryPayload(values));
    } catch (error) {
      setErrorMessage(describeManualError(error));
      if (isConflictError(error)) void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      return;
    }
    setLocation(values.location);
    navigate(destination, { state: { added: true }, replace: true });
  }

  return { submit, isPending: createProduct.isPending || addInventory.isPending, errorMessage };
}

/**
 * Message for a failed save. A conflict means the product was already added.
 *
 * @param error - The error that stopped the save.
 * @returns The text to show under the form.
 */
function describeManualError(error: unknown): string {
  return isConflictError(error) ? CONFLICT_MESSAGE : SAVE_ERROR_MESSAGE;
}

/** Props accepted by {@link ManualForm}. */
interface ManualFormProps {
  form: UseFormReturn<ManualFormValues>;
  onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
  isPending: boolean;
  errorMessage: string | null;
}

/**
 * Layout of the manual entry form: identity, location, stock and optional nutrition fields.
 *
 * @param props - The react-hook-form instance, submit handler and submission state.
 * @returns The form element.
 */
function ManualForm({ form, onSubmit, isPending, errorMessage }: ManualFormProps) {
  const { register, control, formState, watch } = form;
  const isFreezer = watch("location") === "freezer";
  return (
    <form role="form" aria-label="Nuevo producto" onSubmit={onSubmit} className="flex flex-col gap-4">
      <IdentityFields register={register} errors={formState.errors} />
      <LocationField control={control} />
      {isFreezer && <FreezerFieldsGroup control={control} register={register} />}
      <StockFields register={register} errors={formState.errors} />
      <NutritionFields register={register} errors={formState.errors} />
      {errorMessage && <p className="text-body-sm text-error">{errorMessage}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar producto"}
      </Button>
    </form>
  );
}

/** Props shared by the field groups that use react-hook-form. */
interface FieldGroupProps {
  register: UseFormRegister<ManualFormValues>;
  errors: FieldErrors<ManualFormValues>;
}

/**
 * Read-only EAN, product name and optional brand.
 *
 * @param props - The register function and the current validation errors.
 * @returns The identity field group.
 */
function IdentityFields({ register, errors }: FieldGroupProps) {
  return (
    <>
      <FormField label="EAN" htmlFor="manual-ean" error={errors.ean?.message}>
        <input {...register("ean", { required: "Requerido" })} id="manual-ean" readOnly className={INPUT_CLASS} />
      </FormField>
      <FormField label="Nombre" htmlFor="manual-name" error={errors.name?.message}>
        <input {...register("name", { required: "Requerido" })} id="manual-name" className={INPUT_CLASS} />
      </FormField>
      <FormField label="Marca (opcional)" htmlFor="manual-brand">
        <input {...register("brand")} id="manual-brand" className={INPUT_CLASS} />
      </FormField>
    </>
  );
}

/**
 * Storage location, bound to the form through `Controller` because the picker is a controlled component.
 *
 * @param props - The react-hook-form control object.
 * @returns The location field.
 */
function LocationField({ control }: { control: Control<ManualFormValues> }) {
  return (
    <FormField label="Ubicación">
      <Controller
        name="location"
        control={control}
        render={({ field }) => <LocationPicker value={field.value} onChange={field.onChange} />}
      />
    </FormField>
  );
}

/**
 * Drawer and frozen date, shown only when the chosen location is the freezer.
 *
 * @param props - The react-hook-form control object and register function.
 * @returns The freezer fields.
 */
function FreezerFieldsGroup({ control, register }: { control: Control<ManualFormValues>; register: UseFormRegister<ManualFormValues> }) {
  return (
    <>
      <FormField label="Cajón">
        <Controller
          name="drawer"
          control={control}
          render={({ field }) => <DrawerPicker value={field.value} onChange={field.onChange} />}
        />
      </FormField>
      <FormField label="Fecha de congelación" htmlFor="manual-frozen-at">
        <input {...register("frozen_at")} id="manual-frozen-at" type="date" max={localIsoDate()} className={INPUT_CLASS} />
      </FormField>
    </>
  );
}

/**
 * Quantity, threshold and unit inputs. Both numbers accept a decimal comma, and the threshold may be 0.
 *
 * @param props - The register function and the current validation errors.
 * @returns The stock field group.
 */
function StockFields({ register, errors }: FieldGroupProps) {
  return (
    <>
      <FormField label="Cantidad inicial" htmlFor="manual-quantity" error={errors.quantity?.message}>
        <input
          id="manual-quantity"
          {...register("quantity", { validate: (value) => validateRequiredQuantity(value) ?? true })}
          inputMode="decimal"
          className={INPUT_CLASS}
        />
      </FormField>
      <FormField label="Umbral mínimo" htmlFor="manual-threshold" error={errors.threshold?.message}>
        <input
          id="manual-threshold"
          {...register("threshold", { validate: (value) => validateRequiredQuantity(value) ?? true })}
          inputMode="decimal"
          className={INPUT_CLASS}
        />
      </FormField>
      <FormField label="Unidad" htmlFor="manual-unit">
        <input {...register("unit")} id="manual-unit" className={INPUT_CLASS} />
      </FormField>
    </>
  );
}

/**
 * Optional nutrition values per 100 g, laid out in two columns.
 *
 * @param props - The register function and the validation errors of the nutrition fields.
 * @returns The nutrition section heading and inputs.
 */
function NutritionFields({ register, errors }: FieldGroupProps) {
  return (
    <>
      <p className="pt-2 text-body-lg text-on-surface-variant">Información nutricional (por 100 g, opcional)</p>
      <div className="grid grid-cols-2 gap-4">
        {NUTRITION_FIELDS.map((field) => (
          <FormField key={field.name} label={field.label} htmlFor={`manual-${field.name}`} error={errors[field.name]?.message}>
            <input
              id={`manual-${field.name}`}
              {...register(field.name, { validate: (value) => validateOptionalQuantity(value) ?? true })}
              inputMode="decimal"
              placeholder="—"
              className={INPUT_CLASS}
            />
          </FormField>
        ))}
      </div>
    </>
  );
}
