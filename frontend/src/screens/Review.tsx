import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { confirmReview } from "@/api/review";
import { patchInventory } from "@/api/inventory";
import { useQueryClient } from "@tanstack/react-query";
import { useReview } from "@/hooks";
import { invalidateStockQueries } from "@/hooks/useMutations";
import { Button, Card, EmptyState, ErrorState, ProductThumbnail, QuantityStepper, Spinner } from "@/components";
import type { ReviewCandidate } from "@/types";
import { describeError } from "@/utils/errors";
import { formatQuantity } from "@/utils/format";
import { reasonForChange } from "@/utils/movement";
import { describeReviewReason } from "@/utils/review";

/** Shown under a card when an answer could not be saved. */
const SAVE_ERROR_MESSAGE = "No se pudo guardar. Inténtalo de nuevo.";

/**
 * The products to ask about, frozen the first time they load.
 *
 * Every answer refreshes the stock queries, and the review is one of them. Without freezing,
 * the list would shrink under the user's feet and the position in it would point elsewhere.
 *
 * @returns The frozen list, or `null` while it loads, plus the query state.
 */
function useFrozenReview() {
  const query = useReview();
  const [cards, setCards] = useState<ReviewCandidate[] | null>(null);
  useEffect(() => {
    if (query.data && cards === null) setCards(query.data);
  }, [query.data, cards]);
  return { cards, isError: query.isError, refetch: query.refetch };
}

/**
 * Weekly review: one product at a time, asking whether the registered stock is still true.
 *
 * @returns The current card with its progress, the closing message, or a loading or error state.
 */
export function Review() {
  const queryClient = useQueryClient();
  const { cards, isError, refetch } = useFrozenReview();
  const [position, setPosition] = useState(0);
  const [answered, setAnswered] = useState(0);

  if (isError) return <ErrorState message="Error al cargar" onRetry={refetch} />;
  if (cards === null) return <Spinner />;
  if (cards.length === 0) return <NothingToReview />;
  if (position >= cards.length) return <Finished answered={answered} />;

  function next(wasAnswered: boolean) {
    if (wasAnswered) setAnswered((count) => count + 1);
    setPosition((current) => current + 1);
    void invalidateStockQueries(queryClient);
  }

  return (
    <div className="flex flex-col gap-6 pt-6">
      <Progress position={position} total={cards.length} />
      <ReviewCard key={cards[position].ean} candidate={cards[position]} onDone={next} />
    </div>
  );
}

/** Props accepted by {@link Progress}. */
interface ProgressProps {
  position: number;
  total: number;
}

/**
 * Says where the user is in the review.
 *
 * @param props - The zero-based position and the number of cards.
 * @returns A label such as "3 de 8" and a thin bar.
 */
function Progress({ position, total }: ProgressProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-eyebrow uppercase text-primary">{`${position + 1} de ${total}`}</p>
      <div className="h-1 rounded-full bg-surface-container-high">
        <div className="h-1 rounded-full bg-primary" style={{ width: `${(position / total) * 100}%` }} />
      </div>
    </div>
  );
}

/**
 * Message when there is nothing to ask.
 *
 * @returns An empty state that explains why, and a way back.
 */
function NothingToReview() {
  return (
    <div className="flex flex-col items-center gap-4 pt-6">
      <EmptyState message="No hay nada que repasar" />
      <p className="max-w-sm text-center text-body-sm text-on-surface-variant">
        Cuando haya más historial, aquí aparecerá lo que debería haberse acabado.
      </p>
      <Link to="/despensa" className="text-body-sm text-primary underline">
        Ir a la despensa
      </Link>
    </div>
  );
}

/** Props accepted by {@link Finished}. */
interface FinishedProps {
  answered: number;
}

/**
 * Closing message of the review.
 *
 * @param props - How many products were checked.
 * @returns The summary and a way back.
 */
function Finished({ answered }: FinishedProps) {
  return (
    <div className="flex flex-col items-center gap-4 pt-6">
      <EmptyState message={`Listo, ${answered} comprobados`} />
      <Link to="/despensa" className="text-body-sm text-primary underline">
        Ir a la despensa
      </Link>
    </div>
  );
}

/** Props accepted by {@link ReviewCard}. */
interface ReviewCardProps {
  candidate: ReviewCandidate;
  /** Called after the card is dealt with. `true` when the stock was confirmed or corrected. */
  onDone: (wasAnswered: boolean) => void;
}

/**
 * Saves the answer to one card.
 *
 * @param candidate - The product being reviewed.
 * @param onDone - Called after a successful save.
 * @returns The answer actions, the pending flag and the message of the last failure.
 */
function useAnswer(candidate: ReviewCandidate, onDone: (wasAnswered: boolean) => void) {
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function run(save: () => Promise<unknown>) {
    setIsPending(true);
    setErrorMessage(null);
    try {
      await save();
      onDone(true);
    } catch (error) {
      console.warn(`Review answer for ${candidate.ean} failed: ${describeError(error)}`);
      setErrorMessage(SAVE_ERROR_MESSAGE);
    } finally {
      setIsPending(false);
    }
  }

  const correct = (quantity: number) =>
    run(() =>
      patchInventory(candidate.ean, { quantity, reason: reasonForChange(candidate.quantity, quantity) }, "review"),
    );
  const confirm = () => run(() => confirmReview(candidate.ean));
  return { isPending, errorMessage, confirm, correct, runOut: () => correct(0) };
}

/**
 * One card of the review: the product, why it is asked about, and the ways to answer.
 *
 * The main button changes with the stepper: "Sigue igual" while the number is the registered
 * one, and "Guardar N" once it has been changed.
 *
 * @param props - The product and the callback after an answer.
 * @returns The card.
 */
function ReviewCard({ candidate, onDone }: ReviewCardProps) {
  const [quantity, setQuantity] = useState(candidate.quantity);
  const answer = useAnswer(candidate, onDone);
  const isUnchanged = quantity === candidate.quantity;

  return (
    <Card>
      <div className="flex items-center gap-3">
        <ProductThumbnail imageUrl={candidate.image_url} alt={candidate.name} placeholderIcon="grocery" sizeClass="h-14 w-14" />
        <div className="min-w-0">
          <p className="truncate text-body-lg text-on-surface">{candidate.name}</p>
          {candidate.brand && <p className="text-body-sm text-on-surface-variant">{candidate.brand}</p>}
        </div>
      </div>
      <p className="mt-4 text-body-sm text-on-surface-variant">{describeReviewReason(candidate)}</p>
      <p className="mt-1 text-body text-on-surface">{`Tienes registrados ${formatQuantity(candidate.quantity)} ${candidate.unit}`}</p>
      <div className="mt-4">
        <QuantityStepper size="sm" editable value={quantity} onChange={setQuantity} />
      </div>
      {answer.errorMessage && (
        <p role="alert" className="mt-3 text-body-sm text-error">
          {answer.errorMessage}
        </p>
      )}
      <div className="mt-6 flex flex-col gap-3">
        <Button disabled={answer.isPending} onClick={() => void (isUnchanged ? answer.confirm() : answer.correct(quantity))}>
          {isUnchanged ? "Sigue igual" : `Guardar ${formatQuantity(quantity)}`}
        </Button>
        <Button variant="ghost" disabled={answer.isPending} onClick={() => void answer.runOut()}>
          Se acabó
        </Button>
        <Button variant="tertiary" disabled={answer.isPending} onClick={() => onDone(false)}>
          Saltar
        </Button>
      </div>
    </Card>
  );
}
