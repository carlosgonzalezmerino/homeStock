import type { ScanResult } from "@/types";
import type { FeedbackKind } from "@/utils/scanFeedback";
import { formatQuantity } from "@/utils/format";

/** What the result sheet says about one scan. */
export interface ScanDescription {
  title: string;
  detail: string;
  /** `success` when the stock changed, `warning` when the scan did not do what was expected. */
  tone: FeedbackKind;
  /** The product ran out, so the sheet links to the shopping list where it now is. */
  linksToShoppingList: boolean;
}

/**
 * Describes the outcome of a purchase scan.
 *
 * @param result - What the backend answered.
 * @param unit - The unit of the product, or an empty string.
 * @returns The detail line and its tone.
 */
function describePurchase(result: ScanResult, unit: string): Pick<ScanDescription, "detail" | "tone"> {
  if (result.status === "created") return { detail: `Nuevo en la despensa · 1 ${unit}`.trim(), tone: "success" };
  if (result.status === "applied") {
    return { detail: `+1 · ahora ${formatQuantity(result.quantity_after ?? 0)} ${unit}`.trim(), tone: "success" };
  }
  if (result.status === "unknown") return { detail: "Código sin identificar, queda para revisar", tone: "warning" };
  return { detail: "No se ha cambiado nada", tone: "warning" };
}

/**
 * Describes the outcome of a consume scan.
 *
 * @param result - What the backend answered.
 * @param unit - The unit of the product, or an empty string.
 * @returns The detail line, its tone and whether the product just ran out.
 */
function describeConsume(
  result: ScanResult,
  unit: string,
): Pick<ScanDescription, "detail" | "tone" | "linksToShoppingList"> {
  const left = result.quantity_after ?? 0;
  if (result.status === "applied" && left === 0) {
    return { detail: "Se acabó · ya está en la lista de la compra", tone: "success", linksToShoppingList: true };
  }
  if (result.status === "applied") {
    return { detail: `−1 · quedan ${formatQuantity(left)} ${unit}`.trim(), tone: "success", linksToShoppingList: false };
  }
  const warnings: Partial<Record<ScanResult["status"], string>> = {
    already_empty: "Ya estaba agotado",
    not_tracked: "No está en tu despensa",
    unknown: "Código sin identificar",
  };
  return { detail: warnings[result.status] ?? "No se ha cambiado nada", tone: "warning", linksToShoppingList: false };
}

/**
 * Turns a scan outcome into the text the user reads on the result sheet.
 *
 * @param result - What the backend answered.
 * @returns The title, the detail line, the tone and whether to link to the shopping list.
 */
export function describeScan(result: ScanResult): ScanDescription {
  const title = result.name ?? result.ean;
  const unit = result.unit ?? "";
  if (result.mode === "purchase") return { title, linksToShoppingList: false, ...describePurchase(result, unit) };
  return { title, ...describeConsume(result, unit) };
}
