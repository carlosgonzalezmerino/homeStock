import { useCallback, useMemo, useRef, useState } from "react";
import type { ScanResult } from "@/types";
import {
  EMPTY_SESSION,
  addScan,
  countSession,
  dropRegistered,
  removeUnit,
  type PurchaseSessionData,
} from "@/utils/purchaseSession";

/** localStorage key that keeps the session across reloads: a screen that turns off must not lose a shop. */
const STORAGE_KEY = "purchaseSession";

/**
 * Reads the session saved by a previous render or visit.
 *
 * @returns The stored session, or an empty one when nothing valid is stored or storage is unavailable.
 */
function readStoredSession(): PurchaseSessionData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : null;
    return isSessionData(parsed) ? parsed : EMPTY_SESSION;
  } catch (error) {
    console.warn(`Purchase session storage unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return EMPTY_SESSION;
  }
}

/**
 * Checks that something read from storage has the shape of a session.
 *
 * @param value - The parsed JSON.
 * @returns `true` when it has a list of lines and a list of unknown codes.
 */
function isSessionData(value: unknown): value is PurchaseSessionData {
  const candidate = value as Partial<PurchaseSessionData> | null;
  return Array.isArray(candidate?.lines) && Array.isArray(candidate?.unknown);
}

/**
 * Saves the session. A blocked storage only logs a warning.
 *
 * @param data - The session to keep.
 */
function writeStoredSession(data: PurchaseSessionData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn(`Purchase session storage unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * What was scanned in the current shopping session, kept across reloads.
 *
 * Each change is worked out from a ref and saved at once, not from an effect after the next
 * render: "Terminar" clears the session and leaves the screen in the same click, so the screen
 * can be gone before an effect would run, and the old session would come back.
 *
 * @returns The lines and unknown codes, how many things were scanned, and the actions that
 *   record a scan, take a unit back, forget registered codes and start over.
 */
export function usePurchaseSession() {
  const [data, setData] = useState<PurchaseSessionData>(readStoredSession);
  const latest = useRef(data);

  const change = useCallback((transform: (current: PurchaseSessionData) => PurchaseSessionData) => {
    const next = transform(latest.current);
    if (next === latest.current) return;
    latest.current = next;
    writeStoredSession(next);
    setData(next);
  }, []);

  const recordScan = useCallback((result: ScanResult) => change((current) => addScan(current, result)), [change]);
  const recordUndo = useCallback(
    (ean: string, movementId: number) => change((current) => removeUnit(current, ean, movementId)),
    [change],
  );
  const forgetRegistered = useCallback(
    (eans: ReadonlySet<string>) => change((current) => dropRegistered(current, eans)),
    [change],
  );
  const clear = useCallback(() => change(() => EMPTY_SESSION), [change]);
  const count = useMemo(() => countSession(data), [data]);

  return { lines: data.lines, unknown: data.unknown, count, recordScan, recordUndo, forgetRegistered, clear };
}

/** What {@link usePurchaseSession} returns. */
export type PurchaseSession = ReturnType<typeof usePurchaseSession>;
