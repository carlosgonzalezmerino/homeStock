import { Card, ProductThumbnail } from "@/components";
import type { ProductOut } from "@/types";

/** Nutrition fields shown in the table, with their label and whether they are emphasised. */
const NUTRITION_ROWS = [
  { key: "kcal_per_100g", label: "Calorías", unit: "kcal", highlight: true, nested: false },
  { key: "proteins_per_100g", label: "Proteínas", unit: "g", highlight: true, nested: false },
  { key: "carbs_per_100g", label: "Hidratos de carbono", unit: "g", highlight: false, nested: false },
  { key: "sugars_per_100g", label: "de los cuales azúcares", unit: "g", highlight: false, nested: true },
  { key: "fat_per_100g", label: "Grasas", unit: "g", highlight: false, nested: false },
  { key: "saturated_fat_per_100g", label: "de las cuales saturadas", unit: "g", highlight: false, nested: true },
  { key: "fiber_per_100g", label: "Fibra alimentaria", unit: "g", highlight: false, nested: false },
  { key: "salt_per_100g", label: "Sal", unit: "g", highlight: false, nested: false },
] as const;

type NutritionKey = (typeof NUTRITION_ROWS)[number]["key"];

/** Props accepted by {@link ProductHeader}. */
interface ProductHeaderProps {
  product: ProductOut;
}

/**
 * Product image, name and descriptive lines, on a light panel.
 *
 * @param props - The product to describe.
 * @returns A header card with the thumbnail and the product details.
 */
export function ProductHeader({ product }: ProductHeaderProps) {
  const detailLines = [product.brand, product.category, product.quantity_desc].filter(
    (line): line is string => Boolean(line),
  );
  const sourceLabel = product.source === "manual" ? "Manual" : "Reconocido";
  return (
    <Card surface="light">
      <div className="flex items-start gap-4">
        <ProductThumbnail imageUrl={product.image_url} alt={product.name} placeholderIcon="grocery" sizeClass="h-20 w-20" />
        <div className="min-w-0 space-y-1">
          <h1 className="text-subheading text-on-surface">{product.name}</h1>
          {detailLines.map((line) => (
            <p key={line} className="text-body-sm text-on-surface-variant">
              {line}
            </p>
          ))}
          <span className="mt-2 inline-block rounded-pill bg-primary-container px-3 py-1 text-eyebrow uppercase text-on-primary-container">
            {sourceLabel}
          </span>
        </div>
      </div>
    </Card>
  );
}

/**
 * Card with the nutrition table per 100 g. It is hidden when the product has no nutrition data.
 *
 * @param props - The product whose nutrition values are shown.
 * @returns The nutrition card, or `null` when there are no values.
 */
export function MacrosCard({ product }: { product: ProductOut }) {
  const hasAnyValue = NUTRITION_ROWS.some((row) => typeof product[row.key as NutritionKey] === "number");
  if (!hasAnyValue) return null;
  return (
    <Card>
      <p className="mb-2 text-body-lg text-on-surface-variant">Información nutricional (por 100 g)</p>
      <div className="divide-y divide-outline-variant">
        {NUTRITION_ROWS.map((row) => {
          const value = product[row.key as NutritionKey];
          if (value == null) return null;
          const toneClass = row.highlight ? "text-on-surface" : "text-on-surface-variant";
          const indentClass = row.nested ? "pl-4" : "";
          return (
            <div key={row.key} className={`flex justify-between py-2 ${toneClass} ${indentClass}`}>
              <span className="text-body">{row.label}</span>
              <span className="text-body tabular-nums">{`${value.toFixed(1)} ${row.unit}`}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
