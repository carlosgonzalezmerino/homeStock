import { useCallback, useState } from "react";
import { readStoredScanMode, writeStoredScanMode, type ScanScreenMode } from "@/utils/scanMode";

/**
 * The scan mode of the scan screen.
 *
 * It starts from the last remembered mode, which is never `consume`. Choosing `consume`
 * works for the visit but is not remembered, so leaving the screen puts it back.
 *
 * @returns The current mode and a function that changes it.
 */
export function useScanMode(): [ScanScreenMode, (mode: ScanScreenMode) => void] {
  const [mode, setMode] = useState<ScanScreenMode>(readStoredScanMode);
  const change = useCallback((next: ScanScreenMode) => {
    setMode(next);
    writeStoredScanMode(next);
  }, []);
  return [mode, change];
}
