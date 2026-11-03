import { Link } from "react-router-dom";
import type { SheetState } from "@/hooks/useBurstScan";
import { describeScan } from "@/utils/scanMessages";
import { Button } from "./Button";
import { ProductThumbnail } from "./ProductThumbnail";

/** Classes shared by every kind of sheet: it floats above the navigation bar and over the page. */
const SHEET_CLASS =
  "fixed inset-x-0 bottom-24 z-40 mx-auto w-[calc(100%-2rem)] max-w-sm rounded-lg border border-outline-variant bg-surface-container-high p-4 shadow-md";
/** Border colour of a result that did not do what was expected. */
const WARNING_BORDER_CLASS = "border-l-4 border-l-tertiary";

/** Props accepted by {@link ScanResultSheet}. */
interface ScanResultSheetProps {
  sheet: SheetState;
  onUndo: () => void;
}

/**
 * Sheet that answers a scan: what happened, and a button to take it back.
 *
 * Success is not painted green: the accent is for actions. A scan that did not do what was
 * expected gets the warning accent instead.
 *
 * @param props - What the sheet shows and the undo callback.
 * @returns The sheet, anchored above the bottom navigation.
 */
export function ScanResultSheet({ sheet, onUndo }: ScanResultSheetProps) {
  if (sheet.kind === "error") {
    return (
      <div role="alert" className={`${SHEET_CLASS} ${WARNING_BORDER_CLASS} text-body-sm text-error`}>
        {sheet.message}
      </div>
    );
  }
  if (sheet.kind === "undone") {
    return (
      <div role="status" className={`${SHEET_CLASS} text-body-sm text-on-surface`}>
        ✓ Deshecho · {sheet.name}
      </div>
    );
  }
  return <ResultContent result={sheet.result} onUndo={onUndo} />;
}

/** Props accepted by {@link ResultContent}. */
interface ResultContentProps {
  result: Extract<SheetState, { kind: "result" }>["result"];
  onUndo: () => void;
}

/**
 * The sheet of a scan that got an answer: picture, name, effect and the undo button.
 *
 * @param props - The scan outcome and the undo callback.
 * @returns The sheet content.
 */
function ResultContent({ result, onUndo }: ResultContentProps) {
  const text = describeScan(result);
  const accent = text.tone === "warning" ? WARNING_BORDER_CLASS : "";
  return (
    <div role="status" className={`${SHEET_CLASS} ${accent} flex items-center gap-3`}>
      <ProductThumbnail imageUrl={result.image_url} alt={text.title} placeholderIcon="grocery" sizeClass="h-11 w-11" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body text-on-surface">{text.title}</p>
        <p className="text-body-sm text-on-surface-variant">{text.detail}</p>
        {text.linksToShoppingList && (
          <Link to="/lista" className="text-body-sm text-primary underline">
            Ver la lista
          </Link>
        )}
      </div>
      {result.movement_id != null && (
        <Button variant="ghost" size="sm" onClick={onUndo}>
          Deshacer
        </Button>
      )}
    </div>
  );
}
