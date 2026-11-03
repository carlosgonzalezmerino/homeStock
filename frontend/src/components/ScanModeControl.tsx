import { SegmentedControl, type SegmentOption } from "./SegmentedControl";
import type { ScanScreenMode } from "@/utils/scanMode";

/**
 * The three things a code can do. "Gastar" is not drawn in the green of actions: taking units
 * out has consequences, and the warning colour tells the user which mode they are in.
 */
const MODE_OPTIONS: readonly SegmentOption<ScanScreenMode>[] = [
  { value: "detail", label: "Detalle" },
  { value: "purchase", label: "Compra" },
  { value: "consume", label: "Gastar", activeClass: "bg-tertiary-container text-on-tertiary-container" },
];

/** Props accepted by {@link ScanModeControl}. */
interface ScanModeControlProps {
  value: ScanScreenMode;
  onChange: (mode: ScanScreenMode) => void;
}

/**
 * Selector of what a scanned code does: open the product, add one unit or take one out.
 *
 * @param props - The current mode and the change callback.
 * @returns A tab switcher.
 */
export function ScanModeControl({ value, onChange }: ScanModeControlProps) {
  return <SegmentedControl options={MODE_OPTIONS} value={value} onChange={onChange} ariaLabel="Modo de escaneo" />;
}

/**
 * Permanent notice that every reading takes one unit out. It stays visible for as long as the
 * mode is active, so nobody scans in it by accident.
 *
 * @returns A status banner in the warning colour.
 */
export function ConsumeBanner() {
  return (
    <div
      role="status"
      className="w-full max-w-sm rounded-lg bg-tertiary-container px-4 py-3 text-center text-body-sm text-on-tertiary-container"
    >
      Modo gastar · cada lectura resta 1
    </div>
  );
}
