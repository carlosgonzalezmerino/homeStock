import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory } from "@/hooks";
import { Card, StatusBadge, LevelBar, Spinner, ErrorState, EmptyState } from "@/components";

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
            <Card
              key={item.inventory.ean}
              accent={item.low ? "tertiary" : undefined}
              onClick={() => navigate(`/despensa/${item.inventory.ean}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-body-lg text-on-surface truncate">{item.product.name}</p>
                  {item.product.brand && (
                    <p className="text-body-sm text-on-surface-variant">{item.product.brand}</p>
                  )}
</div>
                <StatusBadge status={item.inventory.quantity === 0 ? "empty" : item.low ? "low" : "ok"} />
              </div>
              <div className="mt-3">
                <p className="text-label-md text-on-surface-variant mb-1">
                  {item.inventory.quantity} {item.inventory.unit}
                </p>
                <LevelBar quantity={item.inventory.quantity} max={item.inventory.threshold * 2} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
