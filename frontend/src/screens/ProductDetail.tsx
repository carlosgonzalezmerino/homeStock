import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useResolve, useInventory, usePatchInventory, useAddInventory, useDeleteInventory } from "@/hooks";
import { Card, Button, QuantityStepper, Spinner, ErrorState } from "@/components";
import type { ProductOut } from "@/types";

interface MacroRowProps {
  label: string;
  value?: number | null;
  unit?: string;
  highlight?: boolean;
}

function MacroRow({ label, value, unit = "g", highlight = false }: MacroRowProps) {
  if (value == null) return null;
  return (
    <div className={`flex justify-between py-2 ${highlight ? "font-semibold text-on-surface" : "text-on-surface-variant"}`}>
      <span className="text-body-md">{label}</span>
      <span className="text-body-md tabular-nums">{value.toFixed(1)} {unit}</span>
    </div>
  );
}

function MacrosCard({ product }: { product: ProductOut }) {
  const hasAny =
    product.kcal_per_100g != null ||
    product.fat_per_100g != null ||
    product.carbs_per_100g != null ||
    product.proteins_per_100g != null;

  if (!hasAny) return null;

  return (
    <Card>
      <p className="text-label-md text-on-surface-variant mb-1">Información nutricional (por 100 g)</p>
      <div className="divide-y divide-outline-variant">
        <MacroRow label="Calorías" value={product.kcal_per_100g} unit="kcal" highlight />
        <MacroRow label="Proteínas" value={product.proteins_per_100g} highlight />
        <MacroRow label="Hidratos de carbono" value={product.carbs_per_100g} />
        <MacroRow label="  de los cuales azúcares" value={product.sugars_per_100g} />
        <MacroRow label="Grasas" value={product.fat_per_100g} />
        <MacroRow label="  de las cuales saturadas" value={product.saturated_fat_per_100g} />
        <MacroRow label="Fibra alimentaria" value={product.fiber_per_100g} />
        <MacroRow label="Sal" value={product.salt_per_100g} />
      </div>
    </Card>
  );
}

export function ProductDetail() {
  const { ean = "" } = useParams<{ ean: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const fromDespensa = location.pathname.startsWith("/despensa");
  const backPath = fromDespensa ? "/despensa" : "/despensa";

  const { data: product, isLoading: productLoading, isError: productError } = useResolve(ean);
  const { data: inventory } = useInventory();

  const tracked = useMemo(
    () => (inventory ?? []).find((i) => i.inventory.ean === ean),
    [inventory, ean]
  );

  const initialQty = tracked?.inventory.quantity ?? 1;
  const [qty, setQty] = useState<number | null>(null);
  const currentQty = qty ?? initialQty;

  const [threshold, setThreshold] = useState<number>(tracked?.inventory.threshold ?? 2);
  const [thresholdDirty, setThresholdDirty] = useState(false);

  // Sync once inventory data arrives (tracked starts undefined)
  useEffect(() => {
    if (tracked && !thresholdDirty) setThreshold(tracked.inventory.threshold);
  }, [tracked?.inventory.threshold]);

  const patch = usePatchInventory();
  const add = useAddInventory();
  const remove = useDeleteInventory();

  if (productLoading) return <Spinner />;
  if (productError || !product) return <ErrorState message="Producto no encontrado" onRetry={() => navigate(-1)} />;

  function handleUpdate() {
    if (tracked) {
      patch.mutate(
        { ean, body: { quantity: currentQty } },
        { onSuccess: () => navigate(backPath) }
      );
    } else {
      add.mutate(
        { ean, quantity: currentQty, threshold: 2, unit: "units" },
        { onSuccess: () => navigate(backPath) }
      );
    }
  }

  function handleDelete() {
    remove.mutate(ean, { onSuccess: () => navigate(backPath) });
  }

  function handleThreshold() {
    patch.mutate(
      { ean, body: { threshold } },
      { onSuccess: () => setThresholdDirty(false) }
    );
  }

  return (
    <div className="flex flex-col gap-stack-md pt-stack-md">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-body-md text-primary self-start"
        aria-label="Volver"
      >
        ← Volver
      </button>

      <Card>
        <div className="flex items-start gap-4">
          {product.image_url && (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-20 w-20 rounded-md object-contain bg-surface-container-low shrink-0"
            />
          )}
          <div className="min-w-0">
            <h1 className="text-headline-md text-on-surface">{product.name}</h1>
            {product.brand && (
              <p className="text-body-sm text-on-surface-variant">{product.brand}</p>
            )}
            {product.category && (
              <p className="text-body-sm text-on-surface-variant">{product.category}</p>
            )}
            {product.quantity_desc && (
              <p className="text-body-sm text-on-surface-variant">{product.quantity_desc}</p>
            )}
            <span className="mt-2 inline-block rounded-full bg-primary-container px-2 py-0.5 text-label-md text-on-primary-container">
              {product.source === "manual" ? "Manual" : "Reconocido"}
            </span>
          </div>
        </div>
      </Card>

      <MacrosCard product={product} />

      <Card>
        <p className="text-label-md text-on-surface-variant mb-stack-sm">
          {tracked ? "Cantidad actual" : "Cantidad a añadir"}
        </p>
        <QuantityStepper value={currentQty} onChange={setQty} />
      </Card>

      {tracked && (
        <Card>
          <p className="text-label-md text-on-surface-variant mb-1">Umbral de alerta</p>
          <p className="text-body-sm text-on-surface-variant mb-stack-sm">
            Recibirás alerta cuando la cantidad baje de este valor
          </p>
          <div className="flex items-center justify-between gap-4">
            <QuantityStepper
              value={threshold}
              onChange={(n) => { setThreshold(n); setThresholdDirty(true); }}
            />
            <Button
              onClick={handleThreshold}
              disabled={!thresholdDirty || patch.isPending}
            >
              Guardar
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <Button onClick={handleUpdate} disabled={patch.isPending || add.isPending}>
          {tracked ? "Actualizar cantidad" : "Añadir a mi despensa"}
        </Button>
        {tracked && (
          <Button variant="ghost" onClick={handleDelete} disabled={remove.isPending}>
            Quitar de la despensa
          </Button>
        )}
      </div>
    </div>
  );
}
