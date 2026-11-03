import { get, post } from "@/api/client";
import type { ReviewCandidate } from "@/types";

/**
 * Lists the products the weekly review asks about, in asking order.
 *
 * @returns At most ten candidates, empty when there is not enough history yet.
 */
export function getReview(): Promise<ReviewCandidate[]> {
  return get<ReviewCandidate[]>("/review");
}

/**
 * Records that the stock of a product was checked and is real. No stock change is made.
 *
 * @param ean - EAN of the product.
 * @returns A promise that resolves when the backend has stored the check.
 */
export async function confirmReview(ean: string): Promise<void> {
  await post<void>(`/review/${encodeURIComponent(ean)}/confirm`);
}
