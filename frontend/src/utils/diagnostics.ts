/** localStorage key that turns on the scanner diagnostics panel. */
const STORAGE_KEY = "scannerDiagnostics";

/**
 * Tells whether the scanner diagnostics panel should be shown in this build.
 *
 * Storage failures are treated as "off", so the scanner keeps working without it.
 *
 * @returns `true` when the user has switched the diagnostics on.
 */
export function isDiagnosticsEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on";
  } catch (error) {
    console.warn(`Diagnostics preference not read: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Switches the scanner diagnostics panel on or off, and remembers the choice.
 *
 * @param enabled - Whether the panel should be shown.
 */
export function setDiagnosticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch (error) {
    console.warn(`Diagnostics preference not saved: ${error instanceof Error ? error.message : String(error)}`);
  }
}
