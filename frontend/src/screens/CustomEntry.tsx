import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchProducts, useCreateProduct, useAddInventory } from "@/hooks";
import { Button, Card, Spinner } from "@/components";
import type { ProductOut, Location } from "@/types";

function generateCustomEan(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "CUSTOM-";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

type Step = "search" | "create" | "quantity";

interface QuantityFormValues {
  quantity: string;
  threshold: string;
  unit: string;
  location: Location;
  name: string;
  brand: string;
}

export function CustomEntry() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductOut | null>(null);
  const [formValues, setFormValues] = useState<QuantityFormValues>({
    quantity: "1",
    threshold: "1",
    unit: "units",
    location: "freezer",
    name: "",
    brand: "",
  });

  const [customEan, setCustomEan] = useState<string | null>(null);

  const createProduct = useCreateProduct();
  const addInventory = useAddInventory();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: searchResults = [], isLoading: isSearching } = useSearchProducts(debouncedQuery);

  function handleSelectProduct(product: ProductOut) {
    setSelectedProduct(product);
    setStep("quantity");
  }

  function handleCreateNew() {
    setSelectedProduct(null);
    setStep("create");
  }

  async function handleQuantitySubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    let ean: string;

    if (step === "create") {
      const eanToUse = customEan ?? generateCustomEan();
      if (!customEan) setCustomEan(eanToUse);
      await createProduct.mutateAsync({
        ean: eanToUse,
        name: formValues.name,
        ...(formValues.brand ? { brand: formValues.brand } : {}),
      });
      ean = eanToUse;
    } else {
      ean = selectedProduct!.ean;
    }

    await addInventory.mutateAsync({
      ean,
      quantity: parseInt(formValues.quantity, 10),
      threshold: parseInt(formValues.threshold, 10),
      unit: formValues.unit || "units",
      location: formValues.location,
    });

    navigate("/despensa");
  }

  const isPending = createProduct.isPending || addInventory.isPending;

  if (step === "search") {
    return (
      <div className="flex flex-col gap-stack-md pt-stack-md">
        <h1 className="text-headline-md text-on-surface">Añadir sin código</h1>

        <input
          role="searchbox"
          type="search"
          placeholder="Buscar producto existente..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {isSearching && <Spinner />}

        {searchResults.length > 0 && (
          <div className="space-y-stack-sm">
            {searchResults.map((product) => (
              <button
                key={product.ean}
                onClick={() => handleSelectProduct(product)}
                className="w-full text-left"
                type="button"
              >
                <Card>
                  <p className="text-body-lg font-medium text-on-surface">{product.name}</p>
                  {product.brand && (
                    <p className="text-body-sm text-on-surface-variant">{product.brand}</p>
                  )}
                </Card>
              </button>
            ))}
          </div>
        )}

        <Button variant="ghost" onClick={handleCreateNew} type="button">
          Crear nuevo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-stack-md pt-stack-md">
      <button
        onClick={() => setStep("search")}
        className="flex items-center gap-1 text-body-md text-primary self-start"
        type="button"
      >
        ← Volver
      </button>

      <h1 className="text-headline-md text-on-surface">
        {selectedProduct ? selectedProduct.name : "Nuevo producto"}
      </h1>

      <form role="form" onSubmit={handleQuantitySubmit} className="flex flex-col gap-4">
        {step === "create" && (
          <>
            <Field label="Nombre">
              <input
                aria-label="nombre"
                value={formValues.name}
                onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                required
                className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
            <Field label="Marca (opcional)">
              <input
                value={formValues.brand}
                onChange={(e) => setFormValues({ ...formValues, brand: e.target.value })}
                className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </Field>
          </>
        )}

        <Field label="Ubicación">
          <div className="flex gap-4">
            {(["pantry", "freezer"] as Location[]).map((loc) => (
              <label key={loc} className="flex items-center gap-2 text-body-lg text-on-surface cursor-pointer">
                <input
                  type="radio"
                  name="location"
                  value={loc}
                  aria-label={loc === "pantry" ? "Despensa" : "Congelador"}
                  checked={formValues.location === loc}
                  onChange={() => setFormValues({ ...formValues, location: loc })}
                  className="accent-primary"
                />
                {loc === "pantry" ? "Despensa" : "Congelador"}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Cantidad inicial" htmlFor="field-quantity">
          <input
            id="field-quantity"
            type="number"
            min={1}
            value={formValues.quantity}
            onChange={(e) => setFormValues({ ...formValues, quantity: e.target.value })}
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Umbral mínimo" htmlFor="field-threshold">
          <input
            id="field-threshold"
            type="number"
            min={0}
            value={formValues.threshold}
            onChange={(e) => setFormValues({ ...formValues, threshold: e.target.value })}
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        <Field label="Unidad" htmlFor="field-unit">
          <input
            id="field-unit"
            value={formValues.unit}
            onChange={(e) => setFormValues({ ...formValues, unit: e.target.value })}
            className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </Field>

        {(createProduct.isError || addInventory.isError) && (
          <p className="text-body-sm text-error">Error al guardar. Inténtalo de nuevo.</p>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
      </form>
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-label-md text-on-surface-variant">{label}</label>
      {children}
    </div>
  );
}
