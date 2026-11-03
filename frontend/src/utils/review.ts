import type { ReviewCandidate } from "@/types";

/** Days in a month, for saying "hace 3 meses" instead of "hace 90 días". */
const DAYS_PER_MONTH = 30;
/** Idle time from which the review speaks in months. */
const MONTHS_FROM_DAYS = 60;

/**
 * Says how long a product has gone untouched, in words a person would use.
 *
 * @param days - Days since anything happened to the stock.
 * @returns "hace N días" for a short time, "hace N meses" for a long one.
 */
export function describeIdleTime(days: number): string {
  if (days >= MONTHS_FROM_DAYS) return `hace ${Math.round(days / DAYS_PER_MONTH)} meses`;
  return days === 1 ? "hace 1 día" : `hace ${days} días`;
}

/**
 * Explains why the review asks about a product.
 *
 * @param candidate - The product the review asks about.
 * @returns A sentence for the card: the pace says it should have run out, or it has been untouched for long.
 */
export function describeReviewReason(candidate: ReviewCandidate): string {
  if (candidate.reason === "overdue") return "Según tu ritmo de consumo, ya debería haberse acabado";
  return `Lo tocaste por última vez ${describeIdleTime(candidate.days_since_activity)}`;
}
