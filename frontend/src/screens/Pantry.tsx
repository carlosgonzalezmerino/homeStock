import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory, usePatchInventory } from "@/hooks";
import { Card, StatusBadge, QuantityStepper, Spinner, ErrorState, EmptyState } from "@/components";
import type { InventoryWithProductOut } from "@/types";

export function Pantry() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useInventory();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return (data ?? []).filter((i) =>
      !search ||
      i.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.product.brand ?? "").toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="Error al cargar" onRetry={refetch} />;

  return (
    <div className="space-y-stack-md pt-stack-md">
      <input
        role="searchbox"
        type="search"
        placeholder="Buscar..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {filtered.length === 0 && (data?.length ?? 0) === 0 ? (
        <EmptyState message="Tu despensa está vacía. Escanea tu primer producto" />
      ) : filtered.length === 0 ? (
        <EmptyState message="Sin resultados" />
      ) : (
        <div className="space-y-stack-sm">
          {filtered.map((item) => (
            <PantryItem
              key={item.inventory.ean}
              item={item}
              onNavigate={() => navigate(`/despensa/${item.inventory.ean}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PantryItem({
  item,
  onNavigate,
}: {
  item: InventoryWithProductOut;
  onNavigate: () => void;
}) {
  const { product, inventory } = item;
  const [localQty, setLocalQty] = useState(inventory.quantity);
  const patch = usePatchInventory();

  function handleQtyChange(newQty: number) {
    setLocalQty(newQty);
    patch.mutate(
      { ean: inventory.ean, body: { quantity: newQty } },
      {
        onError: () => setLocalQty(inventory.quantity),
      }
    );
  }

  const status = localQty === 0 ? "empty" : localQty <= inventory.threshold ? "low" : "ok";

  return (
    <Card>
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <button
          onClick={onNavigate}
          className="shrink-0 focus:outline-none focus:ring-2 focus:ring-primary rounded-md"
          aria-label={product.name}
          type="button"
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-14 w-14 rounded-md object-contain bg-surface-container-low"
            />
          ) : (
            <span
              data-testid="img-placeholder"
              className="material-symbols-outlined flex h-14 w-14 items-center justify-center rounded-md bg-surface-container-low text-on-surface-variant text-3xl"
            >
              grocery
            </span>
          )}
        </button>

        {/* Identity + badge */}
        <button
          onClick={onNavigate}
          className="min-w-0 flex-1 text-left focus:outline-none"
          type="button"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-body-lg font-medium text-on-surface truncate">{product.name}</p>
              {product.brand && (
                <p className="text-body-sm text-on-surface-variant truncate">{product.brand}</p>
              )}
            </div>
            <StatusBadge status={status} />
          </div>
        </button>
      </div>

      {/* Stepper inline — bottom right, does not trigger navigation */}
      <div className="mt-3 flex items-center justify-end gap-2">
        <span className="text-body-sm text-on-surface-variant">{inventory.unit}</span>
        <QuantityStepper value={localQty} onChange={handleQtyChange} size="lg" />
      </div>
    </Card>
  );
}
