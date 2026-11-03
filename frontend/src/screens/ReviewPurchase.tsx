import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useInventory, usePurchaseSession } from "@/hooks";
import { Button, Card, EmptyState, ProductThumbnail } from "@/components";
import type { SessionLine } from "@/utils/purchaseSession";

/** Where the manual entry sends the user back to after registering an unknown code. */
const REVIEW_PATH = "/scan/revisar";

/**
 * Review of a shopping session: what was added, what is new and needs its threshold looked at,
 * and the codes nobody knew, which can be registered one by one.
 *
 * Codes that have since been registered disappear from the last block by themselves.
 *
 * @returns The three blocks and the button that closes the session.
 */
export function ReviewPurchase() {
  const navigate = useNavigate();
  const session = usePurchaseSession();
  const inventory = useInventory();
  const trackedEans = useMemo(() => new Set((inventory.data ?? []).map((item) => item.inventory.ean)), [inventory.data]);
  const { forgetRegistered } = session;

  useEffect(() => {
    if (inventory.data) forgetRegistered(trackedEans);
  }, [inventory.data, trackedEans, forgetRegistered]);

  function finish() {
    session.clear();
    navigate("/despensa", { state: { added: true }, replace: true });
  }

  if (session.count === 0) return <NothingToReview onScan={() => navigate("/scan")} />;
  const newLines = session.lines.filter((line) => line.isNew);

  return (
    <div className="flex flex-col gap-8 pt-6">
      <h1 className="text-heading-sm text-on-surface">Revisar compra</h1>
      <LinesBlock eyebrow="Añadido" title="Lo que has escaneado" lines={session.lines} />
      <LinesBlock eyebrow="Nuevo" title="Revisa el umbral" lines={newLines} />
      <UnknownBlock eans={session.unknown} onRegister={(ean) => navigate(`/scan/${ean}/manual`, { state: { returnTo: REVIEW_PATH } })} />
      <Button onClick={finish}>Terminar</Button>
    </div>
  );
}

/** Props accepted by {@link NothingToReview}. */
interface NothingToReviewProps {
  onScan: () => void;
}

/**
 * Shown when the session is empty, for example after finishing it.
 *
 * @param props - The callback that goes back to the scanner.
 * @returns A message and a button.
 */
function NothingToReview({ onScan }: NothingToReviewProps) {
  return (
    <div className="flex flex-col items-center gap-4 pt-6">
      <EmptyState message="No hay nada que revisar" />
      <Button variant="ghost" onClick={onScan}>
        Volver al escáner
      </Button>
    </div>
  );
}

/** Props accepted by {@link LinesBlock}. */
interface LinesBlockProps {
  eyebrow: string;
  title: string;
  lines: SessionLine[];
}

/**
 * A block of scanned products. It renders nothing when it has no lines.
 *
 * @param props - The block's labels and its lines.
 * @returns The block, or `null` when empty.
 */
function LinesBlock({ eyebrow, title, lines }: LinesBlockProps) {
  if (lines.length === 0) return null;
  return (
    <section className="flex flex-col gap-4" aria-label={title}>
      <div className="flex flex-col gap-1">
        <p className="text-eyebrow uppercase text-primary">{eyebrow}</p>
        <h2 className="text-subheading text-on-surface">{title}</h2>
      </div>
      <div className="flex flex-col gap-3">
        {lines.map((line) => (
          <LineRow key={line.ean} line={line} />
        ))}
      </div>
    </section>
  );
}

/** Props accepted by {@link LineRow}. */
interface LineRowProps {
  line: SessionLine;
}

/**
 * One scanned product. Tapping it opens the pantry detail, where the quantity and the
 * threshold can be corrected.
 *
 * @param props - The line.
 * @returns A card with the picture, the name and the number of units.
 */
function LineRow({ line }: LineRowProps) {
  const navigate = useNavigate();
  return (
    <Card dense onClick={() => navigate(`/despensa/${encodeURIComponent(line.ean)}`)}>
      <div className="flex items-center gap-3">
        <ProductThumbnail imageUrl={line.imageUrl} alt={line.name} placeholderIcon="grocery" sizeClass="h-11 w-11" />
        <p className="min-w-0 flex-1 truncate text-body text-on-surface">{line.name}</p>
        <span className="text-body text-on-surface-variant">{`×${line.units}`}</span>
      </div>
    </Card>
  );
}

/** Props accepted by {@link UnknownBlock}. */
interface UnknownBlockProps {
  eans: string[];
  onRegister: (ean: string) => void;
}

/**
 * Codes nobody knew, each with a button to register the product by hand.
 *
 * @param props - The codes and the callback that opens the manual entry for one.
 * @returns The block, or `null` when there are none.
 */
function UnknownBlock({ eans, onRegister }: UnknownBlockProps) {
  if (eans.length === 0) return null;
  return (
    <section className="flex flex-col gap-4" aria-label="Sin identificar">
      <div className="flex flex-col gap-1">
        <p className="text-eyebrow uppercase text-primary">Pendiente</p>
        <h2 className="text-subheading text-on-surface">Sin identificar</h2>
      </div>
      {eans.map((ean) => (
        <Card dense key={ean}>
          <div className="flex items-center justify-between gap-3">
            <span className="break-all text-body text-on-surface">{ean}</span>
            <Button variant="ghost" size="sm" onClick={() => onRegister(ean)}>
              Dar de alta
            </Button>
          </div>
        </Card>
      ))}
    </section>
  );
}
