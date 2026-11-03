import { useAddToShoppingList, useShoppingList } from "@/hooks";
import { Button } from "@/components";
import { formatQuantity } from "@/utils/format";

/** Props accepted by {@link AddToListButton}. */
interface AddToListButtonProps {
  ean: string;
}

/**
 * Button that puts a product on the shopping list. If it is already there it says how much
 * and pressing it adds one more, so the screen does not need to know in advance.
 *
 * @param props - The product's EAN.
 * @returns A button labelled "Añadir a la lista" or "En la lista (n)".
 */
export function AddToListButton({ ean }: AddToListButtonProps) {
  const { data } = useShoppingList();
  const add = useAddToShoppingList();
  const onList = data?.find((line) => line.ean === ean);
  const label = onList ? `En la lista (${formatQuantity(onList.quantity)})` : "Añadir a la lista";

  return (
    <Button variant="ghost" disabled={add.isPending} onClick={() => add.mutate({ ean })}>
      {label}
    </Button>
  );
}
