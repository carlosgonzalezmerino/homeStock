import type { ScanResult } from "@/types";
import type { FeedbackKind } from "@/utils/scanFeedback";
import { formatQuantity } from "@/utils/format";

/** What the result sheet says about one scan. */
export interface ScanDescription {
  title: string;
  detail: string;
  /** `success` when the stock changed, `warning` when the scan did not do what was expected. */
  tone: FeedbackKind;
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
 * Running out is only reported. The shopping list holds what the user adds, so the sheet does
 * not claim the product is on it.
 *
 * @param result - What the backend answered.
 * @param unit - The unit of the product, or an empty string.
 * @returns The detail line and its tone.
 */
function describeConsume(result: ScanResult, unit: string): Pick<ScanDescription, "detail" | "tone"> {
  const left = result.quantity_after ?? 0;
  if (result.status === "applied" && left === 0) return { detail: "Se acabó", tone: "success" };
  if (result.status === "applied") {
    return { detail: `−1 · quedan ${formatQuantity(left)} ${unit}`.trim(), tone: "success" };
  }
  const warnings: Partial<Record<ScanResult["status"], string>> = {
    already_empty: "Ya estaba agotado",
    not_tracked: "No está en tu despensa",
    unknown: "Código sin identificar",
  };
  return { detail: warnings[result.status] ?? "No se ha cambiado nada", tone: "warning" };
}

/**
 * Turns a scan outcome into the text the user reads on the result sheet.
 *
 * @param result - What the backend answered.
 * @returns The title, the detail line and the tone.
 */
export function describeScan(result: ScanResult): ScanDescription {
  const title = result.name ?? result.ean;
  const unit = result.unit ?? "";
  if (result.mode === "purchase") return { title, ...describePurchase(result, unit) };
  return { title, ...describeConsume(result, unit) };
}
