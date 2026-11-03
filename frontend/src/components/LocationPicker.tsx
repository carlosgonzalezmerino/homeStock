import type { Location } from "@/types";
import { locationLabel } from "@/utils/stock";

/** Props accepted by {@link LocationPicker}. */
interface LocationPickerProps {
  value: Location;
  onChange: (location: Location) => void;
  name?: string;
}

const LOCATIONS: readonly Location[] = ["pantry", "freezer"];

/**
 * Radio group for choosing between the pantry and the freezer.
 *
 * @param props - The selected location, the change callback and an optional radio group name.
 * @returns A row of labelled radio inputs.
 */
export function LocationPicker({ value, onChange, name = "location" }: LocationPickerProps) {
  return (
    <div className="flex gap-6">
      {LOCATIONS.map((location) => (
        <label
          key={location}
          className="flex cursor-pointer items-center gap-2 text-body text-on-surface"
        >
          <input
            type="radio"
            name={name}
            value={location}
            aria-label={locationLabel(location)}
            checked={value === location}
            onChange={() => onChange(location)}
            className="accent-primary"
          />
          {locationLabel(location)}
        </label>
      ))}
    </div>
  );
}
