import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useCreateProduct, useAddInventory } from "@/hooks";
import { Button } from "@/components";
import type { ProductCreate } from "@/types";

interface FormValues {
  ean: string;
  name: string;
  brand: string;
  quantity: string;
  threshold: string;
  unit: string;
}

export function ManualEntry() {
  const { ean: paramEan = "" } = useParams<{ ean: string }>();
  const navigate = useNavigate();
  const createProduct = useCreateProduct();
  const addInventory = useAddInventory();

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { ean: paramEan, quantity: "1", threshold: "2", unit: "units" },
  });

  async function onSubmit(values: FormValues) {
    const productData: ProductCreate = {
      ean: values.ean,
      name: values.name,
      ...(values.brand ? { brand: values.brand } : {}),
    };

    await createProduct.mutateAsync(productData);
    await addInventory.mutateAsync({
      ean: values.ean,
      quantity: parseInt(values.quantity, 10),
      threshold: parseInt(values.threshold, 10),
      unit: values.unit || "units",
    });
    navigate("/scan", { state: { added: true }, replace: true });
  }

  const isPending = createProduct.isPending || addInventory.isPending;

  return (
    <div className="flex flex-col gap-stack-md pt-stack-md">
      <h1 className="text-headline-md text-on-surface">Nuevo producto</h1>
      <p className="text-body-sm text-on-surface-variant">
        EAN no reconocido. Rellena los datos del producto.
      </p>

      <form role="form" onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="EAN" error={errors.ean?.message}>
          <input
            {...register("ean", { required: "Requerido" })}
            readOnly
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Nombre" error={errors.name?.message}>
          <input
            {...register("name", { required: "Requerido" })}
            aria-label="nombre"
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Marca (opcional)">
          <input
            {...register("brand")}
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Cantidad inicial">
          <input
            {...register("quantity", { required: true, min: 1 })}
            type="number"
            min={1}
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Umbral mínimo">
          <input
            {...register("threshold", { required: true, min: 1 })}
            type="number"
            min={1}
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Unidad">
          <input
            {...register("unit")}
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        {(createProduct.isError || addInventory.isError) && (
          <p className="text-body-sm text-error">
            Error al guardar. Inténtalo de nuevo.
          </p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar producto"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-label-md text-on-surface-variant">{label}</label>
      {children}
      {error && <p className="text-label-md text-error">{error}</p>}
    </div>
  );
}
