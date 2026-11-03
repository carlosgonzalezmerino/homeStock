import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCheckedItems, usePatchInventory, useShoppingList } from "@/hooks";
import { Button, Card, EmptyState, ErrorState, ProductThumbnail, Spinner, StatusToast } from "@/components";
import type { ShoppingListItemOut } from "@/types";
import { formatQuantity, roundQuantity } from "@/utils/format";
import { sortByChecked, suggestedPurchase } from "@/utils/shopping";

/** Message shown when the shopping list has no items. */
const EMPTY_LIST_MESSAGE = "No falta nada";
/** Message shown briefly after a successful registration. */
const REGISTERED_MESSAGE = "Compra añadida";

/**
 * Registers the picked-up items as a stock increase, one `PATCH` at a time.
 *
 * @returns A function that registers a batch of items and the EANs it could not save, and
 *   whether a registration is in progress.
 */
function useRegisterPurchases() {
  const patch = usePatchInventory();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function register(items: ShoppingListItemOut[]): Promise<string[]> {
    setIsSubmitting(true);
    const failedEans: string[] = [];
    for (const item of items) {
      const nextQuantity = roundQuantity(item.quantity + suggestedPurchase(item.quantity, item.threshold));
      try {
        await patch.mutateAsync({ ean: item.ean, body: { quantity: nextQuantity } });
      } catch {
        failedEans.push(item.ean);
      }
    }
    setIsSubmitting(false);
    return failedEans;
  }

  return { register, isSubmitting };
}

/**
 * State and actions of the shopping list screen: the checked items, the registration flow and
 * its outcome.
 *
 * @param items - The items currently on the shopping list.
 * @param loadedEans - The EANs of the loaded list, or `undefined` while it is still loading.
 * @returns Everything the screen needs to render and to register a purchase.
 */
function useShoppingListPage(items: ShoppingListItemOut[], loadedEans: readonly string[] | undefined) {
  const { checked, toggle, clear } = useCheckedItems(loadedEans);
  const { register, isSubmitting } = useRegisterPurchases();
  const [failedCount, setFailedCount] = useState(0);
  const [justRegistered, setJustRegistered] = useState(false);

  const orderedItems = useMemo(() => sortByChecked(items, checked), [items, checked]);
  const checkedItems = items.filter((item) => checked.has(item.ean));

  async function handleRegister() {
    setJustRegistered(false);
    const failedEans = await register(checkedItems);
    const savedEans = checkedItems.filter((item) => !failedEans.includes(item.ean)).map((item) => item.ean);
    clear(savedEans);
    setFailedCount(failedEans.length);
    setJustRegistered(failedEans.length === 0);
  }

  return { orderedItems, checked, toggle, checkedCount: checkedItems.length, isSubmitting, failedCount, justRegistered, handleRegister };
}

/**
 * Shopping list screen: what is low on stock, with the amount to buy of each item.
 *
 * Checking an item moves it to the end of the list. "Añadir al stock" registers every checked
 * item as a purchase in one go; items that fail to save stay checked so nothing is lost.
 *
 * @returns The shopping list, or a loading or error state while it loads.
 */
export function ShoppingList() {
  const { data, isLoading, isError, refetch } = useShoppingList();
  const items = data ?? [];
  const loadedEans = useMemo(() => data?.map((item) => item.ean), [data]);
  const page = useShoppingListPage(items, loadedEans);

  if (isLoading) return <Spinner />;
  if (isError) return <ErrorState message="Error al cargar" onRetry={refetch} />;

  return (
    <div className="flex flex-col gap-6 pt-6">
      {page.justRegistered && <StatusToast message={REGISTERED_MESSAGE} />}
      {items.length === 0 ? (
        <EmptyState message={EMPTY_LIST_MESSAGE} />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {page.orderedItems.map((item) => (
              <ShoppingListRow key={item.ean} item={item} isChecked={page.checked.has(item.ean)} onToggle={() => page.toggle(item.ean)} />
            ))}
          </div>
          <RegisterBar
            checkedCount={page.checkedCount}
            isSubmitting={page.isSubmitting}
            failedCount={page.failedCount}
            onRegister={page.handleRegister}
          />
        </>
      )}
    </div>
  );
}

/** Props accepted by {@link ShoppingListRow}. */
interface ShoppingListRowProps {
  item: ShoppingListItemOut;
  isChecked: boolean;
  onToggle: () => void;
}

/**
 * One line of the shopping list: thumbnail, name, how much is left and how much to buy, and a
 * checkbox for picking it up.
 *
 * @param props - The item, whether it is checked and the toggle callback.
 * @returns A card with the item's details and an inline checkbox.
 */
function ShoppingListRow({ item, isChecked, onToggle }: ShoppingListRowProps) {
  const navigate = useNavigate();
  const suggested = suggestedPurchase(item.quantity, item.threshold);
  const openDetail = () => navigate(`/despensa/${encodeURIComponent(item.ean)}`);
  const nameClass = isChecked ? "truncate text-body text-on-surface-variant line-through" : "truncate text-body text-on-surface";

  return (
    <Card dense>
      <div className="flex items-center gap-3">
        <button type="button" onClick={openDetail} aria-label={item.name} className="shrink-0 rounded-sm">
          <ProductThumbnail imageUrl={item.image_url} alt={item.name} placeholderIcon="grocery" sizeClass="h-11 w-11" />
        </button>
        <button type="button" onClick={openDetail} className="min-w-0 flex-1 text-left">
          <p className={nameClass}>{item.name}</p>
          <p className="truncate text-body-sm text-on-surface-variant">
            {`Quedan ${formatQuantity(item.quantity)} de ${formatQuantity(item.threshold)} · comprar ${formatQuantity(suggested)}`}
          </p>
        </button>
        <input
          type="checkbox"
          aria-label={item.name}
          checked={isChecked}
          onChange={onToggle}
          className="h-6 w-6 shrink-0 accent-primary"
        />
      </div>
    </Card>
  );
}

/** Props accepted by {@link RegisterBar}. */
interface RegisterBarProps {
  checkedCount: number;
  isSubmitting: boolean;
  failedCount: number;
  onRegister: () => void;
}

/**
 * Bar that registers every checked item as a purchase. Stays near the bottom of the screen,
 * above the navigation, so it is reachable without scrolling back up.
 *
 * @param props - How many items are checked, whether a save is in progress and how many failed last time.
 * @returns A sticky bar with the failure message, when there is one, and the register button.
 */
function RegisterBar({ checkedCount, isSubmitting, failedCount, onRegister }: RegisterBarProps) {
  return (
    <div className="sticky bottom-24 z-30 flex flex-col gap-2 bg-background/95 py-3 backdrop-blur">
      {failedCount > 0 && (
        <p role="alert" className="text-center text-body-sm text-error">
          {`No se pudieron añadir ${failedCount} productos`}
        </p>
      )}
      <Button onClick={onRegister} disabled={checkedCount === 0 || isSubmitting}>
        {`Añadir al stock (${checkedCount})`}
      </Button>
    </div>
  );
}
