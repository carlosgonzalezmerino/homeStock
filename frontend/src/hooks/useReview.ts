import { useQuery } from "@tanstack/react-query";
import { getReview } from "@/api/review";
import { queryKeys } from "./queryKeys";

/**
 * Query for the products the weekly review asks about.
 *
 * @returns The react-query result holding the candidates, at most ten.
 */
export function useReview() {
  return useQuery({
    queryKey: queryKeys.review(),
    queryFn: getReview,
  });
}
