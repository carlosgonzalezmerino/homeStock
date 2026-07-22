import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useResolve, useInventory, usePatchInventory, useAddInventory, useDeleteInventory } from "@/hooks";
import { Card, Button, QuantityStepper, Spinner, ErrorState } from "@/components";

export function ProductDetail() {
  const { ean = "" } = useParams<{ ean: string }>();
  const navigate = useNavigate();

  const { data: product, isLoading: productLoading, isError: productError } = useResolve(ean);
  const { data: inventory } = useInventory();

  const tracked = useMemo(
    () => (inventory ?? []).find((i) => i.inventory.ean === ean),
    [inventory, ean]
  );

  const initialQty = tracked?.inventory.quantity ?? 1;
  const [qty, setQty] = useState<number | null>(null);
  const currentQty = qty ?? initialQty;

  const patch = usePatchInventory();
  const add = useAddInventory();
  const remove = useDeleteInventory();

  if (productLoading) return <Spinner />;
  if (productError || !product) return <ErrorState message="Producto no encontrado" onRetry={() => navigate(-1)} />;

  function handleUpdate() {
    if (tracked) {
      patch.mutate(
        { ean, body: { quantity: currentQty } },
        { onSuccess: () => navigate("/despensa") }
      );
    } else {
      add.mutate(
        { ean, quantity: currentQty, threshold: 2, unit: "units" },
        { onSuccess: () => navigate("/despensa") }
      );
    }
  }

  function handleDelete() {
    remove.mutate(ean, { onSuccess: () => navigate("/despensa") });
  }

  return (
    <div className="flex flex-col gap-stack-md pt-stack-md">
      <Card>
        <div className="flex items-start gap-4">
          {product.image_url && (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-20 w-20 rounded-md object-contain bg-surface-container-low"
            />
          )}
          <div>
            <h1 className="text-headline-md text-on-surface">{product.name}</h1>
            {product.brand && (
              <p className="text-body-sm text-on-surface-variant">{product.brand}</p>
            )}
            <span className="mt-1 inline-block rounded-full bg-primary-container px-2 py-0.5 text-label-md text-on-primary-container">
              {product.source === "manual" ? "Manual" : "Reconocido"}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <p className="text-label-md text-on-surface-variant mb-stack-sm">
          {tracked ? "Cantidad actual" : "Cantidad a añadir"}
        </p>
        <QuantityStepper value={currentQty} onChange={setQty} />
      </Card>

      <div className="flex flex-col gap-3">
        <Button onClick={handleUpdate} disabled={patch.isPending || add.isPending}>
          {tracked ? "Actualizar" : "Añadir a mi despensa"}
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
