import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory } from "@/hooks";
import { Card, StatusBadge, LevelBar, Spinner, ErrorState, EmptyState } from "@/components";

export function Pantry() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useInventory();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    for (const i of data ?? []) {
      seen.add(i.product.category ?? "Otros");
    }
    return [...seen].sort();
  }, [data]);

  const filtered = useMemo(() => {
    return (data ?? []).filter((i) => {
      const matchesSearch =
        !search ||
        i.product.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.product.brand ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory =
        !activeCategory ||
        (i.product.category ?? "Otros") === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [data, search, activeCategory]);

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

      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-label-md transition-colors ${
              !activeCategory
                ? "bg-primary-container text-on-primary-container"
                : "bg-surface-container text-on-surface-variant"
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={`shrink-0 rounded-full px-3 py-1 text-label-md transition-colors ${
                activeCategory === cat
                  ? "bg-primary-container text-on-primary-container"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

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
                  {item.product.category && (
                    <span className="mt-1 inline-block rounded-full bg-surface-container-high px-2 py-0.5 text-label-md text-on-surface-variant">
                      {item.product.category}
                    </span>
                  )}
                </div>
                <StatusBadge low={item.low} />
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
