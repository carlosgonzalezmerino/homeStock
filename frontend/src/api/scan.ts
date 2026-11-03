import { post } from "@/api/client";
import type { MovementOut, MovementSource, ScanRequest, ScanResult } from "@/types";

/**
 * Applies a scanned code: one unit in (`purchase`) or one unit out (`consume`).
 *
 * Every outcome is a normal answer, including an unknown code, so the caller reads `status`
 * instead of catching an error.
 *
 * @param request - The code, the mode and, for a new product, where it goes.
 * @param source - Where the scan comes from. Left out, the backend records `scan`.
 * @returns What happened, with the movement id so the change can be undone.
 */
export function postScan(request: ScanRequest, source?: MovementSource): Promise<ScanResult> {
  return post<ScanResult>("/scan", request, source);
}

/**
 * Reverts one stock change by writing a compensating movement.
 *
 * @param movementId - The movement to revert.
 * @returns The compensating movement.
 */
export function undoMovement(movementId: number): Promise<MovementOut> {
  return post<MovementOut>(`/movements/${movementId}/undo`);
}
