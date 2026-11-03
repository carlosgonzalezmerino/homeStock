import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory, useReview } from "@/hooks";
import { Card, LevelBar, Spinner, ErrorState, EmptyState, StatTile, StatusBadge } from "@/components";
import type { InventoryWithProductOut } from "@/types";
import { formatQuantity } from "@/utils/format";
import { computeStockStatus } from "@/utils/stock";

/** Multiplier that turns the alert threshold into the quantity that fills a level bar. */
const FULL_STOCK_THRESHOLD_MULTIPLIER = 2;
/** Delay between the entrance animations of consecutive items. */
const STAGGER_STEP_MS = 60;

/**
 * Home screen: stock totals and the list of items that need restocking.
 *
 * @returns The dashboard, or a loading or error state while the inventory loads.
 */
export function Dashboard() {
  const { data, isLoading, isError, refetch } = useInventory();
  const lowStockItems = useMemo(() => (data ?? []).filter((item) => item.low), [data]);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="Error al cargar" onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-8 pt-6">
      <SummarySection totalCount={data?.length ?? 0} lowStockCount={lowStockItems.length} />
      <ReviewEntry />
      <AlertsSection items={lowStockItems} />
    </div>
  );
}

/**
 * Entry to the weekly review. It only shows when there is something to ask, and it never asks by
 * itself: the review waits until the user opens the app.
 *
 * @returns A card that opens the review, or nothing when there are no candidates or they failed to load.
 */
function ReviewEntry() {
  const navigate = useNavigate();
  const { data } = useReview();
  if (!data || data.length === 0) return null;
  const word = data.length === 1 ? "producto" : "productos";
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader eyebrow="Repaso semanal" title={`${data.length} ${word} · 1 minuto`} />
      <Card onClick={() => navigate("/repaso")}>
        <p className="text-body text-on-surface">Comprueba si lo que dice la despensa sigue siendo verdad.</p>
      </Card>
    </section>
  );
}

/** Props accepted by {@link SummarySection}. */
interface SummarySectionProps {
  totalCount: number;
  lowStockCount: number;
}

/**
 * Two stat tiles with the total number of products and the number that are running low.
 *
 * @param props - The totals to display.
 * @returns The summary section.
 */
function SummarySection({ totalCount, lowStockCount }: SummarySectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader eyebrow="General" title="Resumen" />
      <div className="grid grid-cols-2 gap-4">
        <StatTile label="Productos" value={totalCount} />
        <StatTile label="Stock bajo" value={lowStockCount} highlighted />
      </div>
    </section>
  );
}

/** Props accepted by {@link AlertsSection}. */
interface AlertsSectionProps {
  items: InventoryWithProductOut[];
}

/**
 * List of low-stock items, or an empty message when nothing needs restocking.
 *
 * @param props - The low-stock items to list.
 * @returns The alerts section.
 */
function AlertsSection({ items }: AlertsSectionProps) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader eyebrow="Atención" title="Alertas de Stock" />
      {items.length === 0 ? (
        <EmptyState message="Sin alertas de stock" />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item, index) => (
            <LowStockCard key={item.inventory.ean} item={item} index={index} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Props accepted by {@link SectionHeader}. */
interface SectionHeaderProps {
  eyebrow: string;
  title: string;
}

/**
 * Section title with a small uppercase label above it.
 *
 * @param props - The eyebrow label and the title.
 * @returns A heading group.
 */
function SectionHeader({ eyebrow, title }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-eyebrow uppercase text-primary">{eyebrow}</p>
      <h2 className="text-subheading text-on-surface">{title}</h2>
    </div>
  );
}

/** Props accepted by {@link LowStockCard}. */
interface LowStockCardProps {
  item: InventoryWithProductOut;
  index: number;
}

/**
 * Card for one low-stock item, with its remaining quantity and a level bar.
 *
 * @param props - The inventory item and its position in the list, used for the entrance animation.
 * @returns An animated card with a warning accent.
 */
function LowStockCard({ item, index }: LowStockCardProps) {
  const navigate = useNavigate();
  const { product, inventory } = item;
  const status = computeStockStatus(inventory.quantity, inventory.threshold);
  const unitWord = inventory.quantity === 1 ? "restante" : "restantes";
  return (
    <div className="animate-rise" style={{ animationDelay: `${index * STAGGER_STEP_MS}ms` }}>
      <Card accent={status === "empty" ? "error" : "tertiary"} onClick={() => navigate(`/despensa/${encodeURIComponent(inventory.ean)}`)}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-body-lg text-on-surface">{product.name}</p>
            {product.brand && <p className="text-body-sm text-on-surface-variant">{product.brand}</p>}
          </div>
          <StatusBadge status={status} />
        </div>
        <p className="mt-2 text-body-sm text-on-surface-variant">
          {formatQuantity(inventory.quantity)} {inventory.unit} {unitWord}
        </p>
        <div className="mt-3">
          <LevelBar quantity={inventory.quantity} max={inventory.threshold * FULL_STOCK_THRESHOLD_MULTIPLIER} />
        </div>
      </Card>
    </div>
  );
}
