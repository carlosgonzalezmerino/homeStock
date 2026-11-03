/** What a code read by the camera does: open the product, add one unit, or take one out. */
export type ScanScreenMode = "detail" | "purchase" | "consume";

/** localStorage key that remembers the last scan mode. */
const STORAGE_KEY = "scanMode";
/** Mode used when nothing valid is stored. */
export const DEFAULT_SCAN_MODE: ScanScreenMode = "detail";
/**
 * Modes that are remembered between visits. `consume` is left out on purpose: taking units
 * out by mistake is worse than adding them, so that mode is always entered deliberately.
 */
const REMEMBERED_MODES: readonly ScanScreenMode[] = ["detail", "purchase"];

/**
 * Reads the scan mode of the last visit.
 *
 * @returns `detail` or `purchase`. Never `consume`, even if something else wrote it, and
 *   `detail` when nothing valid is stored or storage is unavailable.
 */
export function readStoredScanMode(): ScanScreenMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return REMEMBERED_MODES.find((mode) => mode === stored) ?? DEFAULT_SCAN_MODE;
  } catch (error) {
    console.warn(`Scan mode storage unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return DEFAULT_SCAN_MODE;
  }
}

/**
 * Remembers the scan mode for the next visit. `consume` is ignored, so the last remembered
 * mode stays in place and the next visit never starts taking units out.
 *
 * @param mode - The mode the user just chose.
 */
export function writeStoredScanMode(mode: ScanScreenMode): void {
  if (!REMEMBERED_MODES.includes(mode)) return;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch (error) {
    console.warn(`Scan mode storage unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}
