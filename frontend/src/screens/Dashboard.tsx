import { useMemo } from "react";
import { useInventory } from "@/hooks";
import { Card, StatusBadge, LevelBar, Spinner, ErrorState, EmptyState } from "@/components";
import type { InventoryWithProductOut } from "@/types";

export function Dashboard() {
  const { data, isLoading, isError, refetch } = useInventory();

  const lowItems = useMemo(
    () => (data ?? []).filter((i) => i.low),
    [data]
  );

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of data ?? []) {
      const cat = i.product.category ?? "Otros";
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [data]);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="Error al cargar" onRetry={refetch} />;

  return (
    <div className="space-y-stack-md pt-stack-md">
      <section>
        <h2 className="text-headline-md text-on-surface mb-stack-sm">Resumen</h2>
        <div className="grid grid-cols-2 gap-gutter">
          <SummaryCard label="Productos" value={data?.length ?? 0} />
          <SummaryCard label="Stock bajo" value={lowItems.length} accent />
        </div>
      </section>

      {categories.length > 0 && (
        <section>
          <h2 className="text-headline-md text-on-surface mb-stack-sm">Categorías</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map(([cat, count]) => (
              <span
                key={cat}
                className="rounded-full bg-secondary-container text-on-secondary-container text-label-md px-3 py-1"
              >
                {cat} ({count})
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-headline-md text-on-surface mb-stack-sm">Alertas de Stock</h2>
        {lowItems.length === 0 ? (
          <EmptyState message="Sin alertas de stock" />
        ) : (
          <div className="space-y-stack-sm">
            {lowItems.map((item) => (
              <LowStockCard key={item.inventory.ean} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card accent={accent ? "error" : undefined}>
      <p className="text-label-md text-on-surface-variant">{label}</p>
      <p className="text-headline-md text-on-surface">{value}</p>
    </Card>
  );
}

function LowStockCard({ item }: { item: InventoryWithProductOut }) {
  const { product, inventory } = item;
  return (
    <Card accent="tertiary">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body-lg text-on-surface truncate">{product.name}</p>
          {product.brand && (
            <p className="text-body-sm text-on-surface-variant">{product.brand}</p>
          )}
        </div>
        <StatusBadge low />
      </div>
      <p className="mt-2 text-label-md text-on-surface-variant">
        {inventory.quantity} {inventory.unit} restante{inventory.quantity !== 1 ? "s" : ""}
      </p>
      <LevelBar quantity={inventory.quantity} max={inventory.threshold * 2} />
    </Card>
  );
}
