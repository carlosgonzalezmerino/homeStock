import { useState } from "react";
import { useTheme } from "@/theme";
import { isDiagnosticsEnabled, setDiagnosticsEnabled } from "@/utils/diagnostics";

/** Human-readable name of each theme, shown under the "Tema" setting. */
const THEME_LABELS = {
  light: "Claro",
  dark: "Oscuro",
} as const;

/**
 * Settings screen: the light and dark theme switch, and the scanner diagnostics switch.
 *
 * @returns The settings page.
 */
export function Settings() {
  const { theme, toggle } = useTheme();
  const nextThemeIcon = theme === "light" ? "dark_mode" : "light_mode";

  return (
    <div className="flex flex-col gap-6 pt-6">
      <h1 className="text-heading-sm text-on-surface">Ajustes</h1>
      <div className="flex items-center justify-between rounded-lg bg-surface-container p-6">
        <div>
          <p className="text-body-lg text-on-surface">Tema</p>
          <p className="text-body-sm text-on-surface-variant">{THEME_LABELS[theme]}</p>
        </div>
        <button
          type="button"
          aria-label="Cambiar tema"
          onClick={toggle}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary"
        >
          <span className="material-symbols-outlined">{nextThemeIcon}</span>
        </button>
      </div>
      <DiagnosticsSetting />
    </div>
  );
}

/**
 * Switch that shows the scanner's diagnostic lines in the scan screen, to help find codes that are not read.
 *
 * @returns A row with the label and a checkbox that saves its value.
 */
function DiagnosticsSetting() {
  const [enabled, setEnabled] = useState(isDiagnosticsEnabled);

  function change(next: boolean): void {
    setDiagnosticsEnabled(next);
    setEnabled(next);
  }

  return (
    <label className="flex items-center justify-between rounded-lg bg-surface-container p-6">
      <div>
        <p className="text-body-lg text-on-surface">Diagnóstico del escáner</p>
        <p className="text-body-sm text-on-surface-variant">Muestra el valor leído por la cámara en la pantalla Escanear</p>
      </div>
      <input
        type="checkbox"
        aria-label="Diagnóstico del escáner"
        checked={enabled}
        onChange={(event) => change(event.target.checked)}
        className="h-6 w-6 accent-primary"
      />
    </label>
  );
}
