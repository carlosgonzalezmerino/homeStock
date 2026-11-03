import type { NavigateFunction } from "react-router-dom";

/** Where the detail screen was opened from: the scanner, or the pantry and alerts. */
export type DetailMode = "scan" | "manage";

/**
 * Leaves the detail screen after a scan-flow save: back to the scanner, with the camera off.
 *
 * @param navigate - Router navigate function.
 */
export function returnToScanner(navigate: NavigateFunction): void {
  navigate("/scan", { state: { added: true }, replace: true });
}

/** Screen used when there is no previous screen to go back to. */
export const FALLBACK_BY_MODE: Record<DetailMode, string> = {
  scan: "/scan",
  manage: "/despensa",
};

/**
 * Goes back to the previous screen, or to the mode's own screen when there is none.
 *
 * @param navigate - Router navigate function.
 * @param hasPreviousScreen - Whether the router has a previous entry to go back to.
 * @param mode - The mode the detail screen was opened in, which picks the fallback screen.
 */
export function returnToPrevious(navigate: NavigateFunction, hasPreviousScreen: boolean, mode: DetailMode): void {
  if (hasPreviousScreen) {
    navigate(-1);
    return;
  }
  navigate(FALLBACK_BY_MODE[mode], { replace: true });
}
