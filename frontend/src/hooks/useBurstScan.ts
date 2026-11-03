import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { postScan, undoMovement } from "@/api/scan";
import type { Location, ScanMode, ScanResult } from "@/types";
import { describeScan } from "@/utils/scanMessages";
import { playScanFeedback } from "@/utils/scanFeedback";
import { describeError } from "@/utils/errors";
import { invalidateStockQueries } from "./useMutations";
import type { PurchaseSession } from "./usePurchaseSession";

/** How long the result sheet stays on screen before it closes itself. */
export const RESULT_SHEET_MS = 2500;
/** Shown when a scan could not be registered. */
export const SCAN_ERROR_MESSAGE = "No se pudo registrar. Inténtalo de nuevo.";
/** Shown when an undo could not be done. */
export const UNDO_ERROR_MESSAGE = "No se pudo deshacer.";

/** What the result sheet is showing. Every state has an id, so a newer one replaces an older one. */
export type SheetState =
  | { kind: "result"; id: number; result: ScanResult }
  | { kind: "undone"; id: number; name: string }
  | { kind: "error"; id: number; message: string };

/** What {@link useBurstScan} needs to know about the screen. */
interface BurstOptions {
  /** `purchase` adds a unit, `consume` takes one out. */
  mode: ScanMode;
  /** Where a product that was not tracked goes. */
  location: Location;
  session: PurchaseSession;
}

/**
 * Scans codes one after another without leaving the screen: each one is sent to the backend,
 * answered with a beep, a vibration and a sheet, and can be undone while the sheet is open.
 *
 * @param options - The mode, where new products go, and the session that records purchases.
 * @returns The sheet to show, and the actions to scan a code, undo the last scan and close the sheet.
 */
export function useBurstScan({ mode, location, session }: BurstOptions) {
  const queryClient = useQueryClient();
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const nextId = useRef(0);

  const show = useCallback((state: DistributiveOmit<SheetState, "id">) => {
    setSheet({ ...state, id: ++nextId.current } as SheetState);
  }, []);

  useEffect(() => {
    if (!sheet) return undefined;
    const timer = setTimeout(() => setSheet((current) => (current?.id === sheet.id ? null : current)), RESULT_SHEET_MS);
    return () => clearTimeout(timer);
  }, [sheet]);

  const scan = useCallback(
    async (ean: string) => {
      try {
        const body = mode === "purchase" ? { ean, mode, location } : { ean, mode };
        const result = await postScan(body);
        playScanFeedback(describeScan(result).tone);
        if (mode === "purchase") session.recordScan(result);
        show({ kind: "result", result });
        void invalidateStockQueries(queryClient);
      } catch (error) {
        console.warn(`Scan of ${ean} failed: ${describeError(error)}`);
        playScanFeedback("warning");
        show({ kind: "error", message: SCAN_ERROR_MESSAGE });
      }
    },
    [mode, location, session, queryClient, show],
  );

  const undo = useCallback(async () => {
    if (sheet?.kind !== "result" || sheet.result.movement_id == null) return;
    const { result } = sheet;
    try {
      await undoMovement(result.movement_id as number);
      if (result.mode === "purchase") session.recordUndo(result.ean, result.movement_id as number);
      show({ kind: "undone", name: result.name ?? result.ean });
      void invalidateStockQueries(queryClient);
    } catch (error) {
      console.warn(`Undo of ${result.movement_id} failed: ${describeError(error)}`);
      show({ kind: "error", message: UNDO_ERROR_MESSAGE });
    }
  }, [sheet, session, queryClient, show]);

  const dismiss = useCallback(() => setSheet(null), []);

  return { sheet, scan, undo, dismiss };
}

/** `Omit` that works on each member of a union instead of on the union as a whole. */
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
