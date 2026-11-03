import { ApiError } from "@/api/client";
import { HTTP_CONFLICT } from "@/api/status";

/**
 * Builds a short, human-readable description of an unknown thrown value.
 *
 * @param error - The value caught in a `catch` block (may be any type).
 * @returns The error message when `error` is an `Error`, otherwise its string form.
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Tells whether an error is a 409 Conflict, which the backend uses for "already exists".
 *
 * @param error - The error caught from a request.
 * @returns `true` for an API error with status 409.
 */
export function isConflictError(error: unknown): boolean {
  return error instanceof ApiError && error.status === HTTP_CONFLICT;
}
