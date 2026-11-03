import { useState } from "react";
import { isConflictError } from "@/utils/errors";

/**
 * Runs a creation request at most once successfully. A later call after success does nothing.
 *
 * A 409 Conflict counts as success, because the record already exists. Any other error is
 * thrown to the caller and the next call tries again.
 *
 * @param create - The request that creates the record. It receives the same arguments as the returned function.
 * @returns A function that runs the request, unless it already succeeded.
 */
export function useCreateOnce<Args extends unknown[]>(
  create: (...args: Args) => Promise<unknown>,
): (...args: Args) => Promise<void> {
  const [isCreated, setIsCreated] = useState(false);

  return async (...args: Args) => {
    if (isCreated) return;
    try {
      await create(...args);
    } catch (error) {
      if (!isConflictError(error)) throw error;
    }
    setIsCreated(true);
  };
}
