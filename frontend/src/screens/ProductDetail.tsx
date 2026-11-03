import { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useInventory, useResolve } from "@/hooks";
import { useProductEditor, type ProductEditor } from "@/hooks/useProductEditor";
import { BackButton, ErrorState, Spinner } from "@/components";
import { useActiveLocation } from "@/location";
import type { InventoryWithProductOut, ProductOut } from "@/types";
import { AddStockCard } from "./detail/AddStockCard";
import { AddToListButton } from "./detail/AddToListButton";
import { ManageStockCards } from "./detail/ManageStockCards";
import { MacrosCard, ProductHeader } from "./detail/ProductInfo";
import { returnToPrevious, returnToScanner, type DetailMode } from "./detail/navigation";

/** Props accepted by {@link ProductDetail}. */
interface ProductDetailProps {
  mode: DetailMode;
}

/**
 * Detail screen for one product. It is opened from the scanner (`scan` mode) or from the
 * pantry and the alerts (`manage` mode).
 *
 * It waits for both the product and the inventory before showing anything, so a tracked product
 * is never shown as new while the inventory loads.
 *
 * @param props - The mode the screen was opened in.
 * @returns The product detail, or a loading or error state.
 */
export function ProductDetail({ mode }: ProductDetailProps) {
  const { ean = "" } = useParams<{ ean: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const productQuery = useResolve(ean);
  const inventoryQuery = useInventory();
  const tracked = useMemo(() => findTrackedItem(inventoryQuery.data, ean), [inventoryQuery.data, ean]);

  if (productQuery.isLoading || inventoryQuery.isLoading) return <Spinner />;
  if (productQuery.isError || !productQuery.data) {
    return <ErrorState message="Producto no encontrado" onRetry={() => navigate(-1)} actionLabel="Volver" />;
  }
  if (inventoryQuery.isError) {
    return <ErrorState message="Error al cargar el inventario" onRetry={() => void inventoryQuery.refetch()} />;
  }
  return (
    <ProductView
      product={productQuery.data}
      ean={ean}
      tracked={tracked}
      mode={mode}
      hasPreviousScreen={location.key !== "default"}
    />
  );
}

/**
 * Looks up the inventory entry for an EAN.
 *
 * @param inventory - The inventory list, which may still be loading.
 * @param ean - The EAN to look for.
 * @returns The matching inventory item, or `undefined` when the product is not tracked.
 */
function findTrackedItem(
  inventory: InventoryWithProductOut[] | undefined,
  ean: string,
): InventoryWithProductOut | undefined {
  return (inventory ?? []).find((item) => item.inventory.ean === ean);
}

/** Props accepted by {@link ProductView}. */
interface ProductViewProps {
  product: ProductOut;
  ean: string;
  tracked: InventoryWithProductOut | undefined;
  mode: DetailMode;
  hasPreviousScreen: boolean;
}

/**
 * Layout of the detail screen. A tracked product in manage mode gets its controls; everything
 * else gets the add card.
 *
 * @param props - The product, its EAN, its inventory entry, the mode and the history state.
 * @returns The page with the header, the cards and the nutrition table.
 */
function ProductView({ product, ean, tracked, mode, hasPreviousScreen }: ProductViewProps) {
  const navigate = useNavigate();
  const { location: activeLocation } = useActiveLocation();
  const editor = useProductEditor(ean, tracked);
  const onSaved = saveDestination(navigate, mode, hasPreviousScreen);
  const isManaging = mode === "manage" && tracked !== undefined;

  return (
    <div className="flex flex-col gap-6 pt-6">
      <BackButton onBack={() => returnToPrevious(navigate, hasPreviousScreen, mode)} />
      <ProductHeader product={product} />
      {mode === "manage" && <AddToListButton ean={ean} />}
      {isManaging ? (
        <ManageStockCards tracked={tracked} editor={editor} onSaved={onSaved} onRemoved={() => returnToPrevious(navigate, false, "manage")} />
      ) : (
        <AddStockCard tracked={tracked} activeLocation={activeLocation} editor={editor} onSaved={onSaved} />
      )}
      <MacrosCard product={product} />
      <SaveError editor={editor} />
    </div>
  );
}

/**
 * Chooses where the user goes after a save, according to the mode of the screen.
 *
 * @param navigate - Router navigate function.
 * @param mode - The mode the screen was opened in.
 * @param hasPreviousScreen - Whether there is a previous screen to go back to.
 * @returns The callback to run after a successful save.
 */
function saveDestination(
  navigate: ReturnType<typeof useNavigate>,
  mode: DetailMode,
  hasPreviousScreen: boolean,
): () => void {
  if (mode === "scan") return () => returnToScanner(navigate);
  return () => returnToPrevious(navigate, hasPreviousScreen, mode);
}

/** Props accepted by {@link SaveError}. */
interface SaveErrorProps {
  editor: ProductEditor;
}

/**
 * Message under the cards when the last save failed. The entered values are kept.
 *
 * @param props - The editor whose last error is shown.
 * @returns The message, or nothing when there is no error.
 */
function SaveError({ editor }: SaveErrorProps) {
  if (!editor.errorMessage) return null;
  return <p className="text-body-sm text-error">{editor.errorMessage}</p>;
}
