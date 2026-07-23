import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory } from "@/hooks";
import { Card, StatusBadge, LevelBar, Spinner, ErrorState, EmptyState } from "@/components";
import type { InventoryWithProductOut } from "@/types";

export function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useInventory();

  const lowItems = useMemo(
    () => (data ?? []).filter((i) => i.low),
    [data]
  );

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

<section>
        <h2 className="text-headline-md text-on-surface mb-stack-sm">Alertas de Stock</h2>
        {lowItems.length === 0 ? (
          <EmptyState message="Sin alertas de stock" />
        ) : (
          <div className="space-y-stack-sm">
            {lowItems.map((item) => (
              <LowStockCard key={item.inventory.ean} item={item} onClick={() => navigate(`/despensa/${item.inventory.ean}`)} />
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

function LowStockCard({ item, onClick }: { item: InventoryWithProductOut; onClick: () => void }) {
  const { product, inventory } = item;
  return (
    <Card accent="tertiary" onClick={onClick}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body-lg text-on-surface truncate">{product.name}</p>
          {product.brand && (
            <p className="text-body-sm text-on-surface-variant">{product.brand}</p>
          )}
        </div>
        <StatusBadge status="low" />
      </div>
      <p className="mt-2 text-label-md text-on-surface-variant">
        {inventory.quantity} {inventory.unit} restante{inventory.quantity !== 1 ? "s" : ""}
      </p>
      <LevelBar quantity={inventory.quantity} max={inventory.threshold * 2} />
    </Card>
  );
}
