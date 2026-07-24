import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory, usePatchInventory } from "@/hooks";
import { Card, QuantityStepper, Spinner, ErrorState, EmptyState } from "@/components";
import type { InventoryWithProductOut, Location } from "@/types";

function isPantry(location: string | null | undefined): boolean {
  return location == null || location === "pantry";
}

export function Pantry() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useInventory();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Location>("pantry");

  const tabFiltered = useMemo(() => {
    return (data ?? []).filter((i) =>
      activeTab === "pantry"
        ? isPantry(i.inventory.location)
        : i.inventory.location === "freezer"
    );
  }, [data, activeTab]);

  const filtered = useMemo(() => {
    return tabFiltered.filter((i) =>
      !search ||
      i.product.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.product.brand ?? "").toLowerCase().includes(search.toLowerCase())
    );
  }, [tabFiltered, search]);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="Error al cargar" onRetry={refetch} />;

  const emptyMessage =
    activeTab === "pantry"
      ? "Tu despensa está vacía. Escanea tu primer producto"
      : "Tu congelador está vacío. Añade productos con 'Añadir sin código'";

  return (
    <div className="space-y-stack-md pt-stack-md">
      {/* Location tabs */}
      <div role="tablist" className="flex gap-1 rounded-lg bg-surface-container p-1">
        {(["pantry", "freezer"] as Location[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md py-2 text-label-lg font-medium transition-colors ${
              activeTab === tab
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant"
            }`}
          >
            {tab === "pantry" ? "Despensa" : "Congelador"}
          </button>
        ))}
      </div>

      <input
        role="searchbox"
        type="search"
        placeholder="Buscar..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-body-lg text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {filtered.length === 0 && tabFiltered.length === 0 ? (
        <EmptyState message={emptyMessage} />
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
  const tint = status === "empty" ? "error" : status === "low" ? "tertiary" : null;

  return (
    <Card dense tint={tint}>
      <div className="flex items-center gap-2">
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
              className="h-11 w-11 rounded-md object-contain bg-surface-container-low"
            />
          ) : (
            <span
              data-testid="img-placeholder"
              className="material-symbols-outlined flex h-11 w-11 items-center justify-center rounded-md bg-surface-container-low text-on-surface-variant text-2xl"
            >
              {inventory.location === "freezer" ? "ac_unit" : "grocery"}
            </span>
          )}
        </button>

        <button
          onClick={onNavigate}
          className="min-w-0 flex-1 text-left focus:outline-none"
          type="button"
        >
          <p className="text-body-lg font-medium text-on-surface truncate">{product.name}</p>
          {product.brand && (
            <p className="text-body-sm text-on-surface-variant truncate">{product.brand}</p>
          )}
        </button>

        <QuantityStepper value={localQty} onChange={handleQtyChange} size="xs" />
      </div>
    </Card>
  );
}
