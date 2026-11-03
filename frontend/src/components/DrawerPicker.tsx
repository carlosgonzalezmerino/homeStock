import { FREEZER_DRAWERS } from "@/constants/inventory";
import { SegmentedControl, type SegmentOption } from "./SegmentedControl";

/** Value used for "no drawer chosen". */
const NO_DRAWER = "none";

const DRAWER_OPTIONS: readonly SegmentOption<string>[] = [
  { value: NO_DRAWER, label: "—" },
  ...FREEZER_DRAWERS.map((drawer) => ({ value: String(drawer), label: String(drawer) })),
];

/** Props accepted by {@link DrawerPicker}. */
interface DrawerPickerProps {
  value: number | null | undefined;
  onChange: (drawer: number | null) => void;
}

/**
 * Chooses the freezer drawer of an item, or none.
 *
 * @param props - The chosen drawer, or empty, and the change callback.
 * @returns A segmented control with a dash and the drawer numbers.
 */
export function DrawerPicker({ value, onChange }: DrawerPickerProps) {
  const selected = value == null ? NO_DRAWER : String(value);
  return (
    <SegmentedControl
      options={DRAWER_OPTIONS}
      value={selected}
      onChange={(next) => onChange(next === NO_DRAWER ? null : Number(next))}
      ariaLabel="Cajón"
    />
  );
}
