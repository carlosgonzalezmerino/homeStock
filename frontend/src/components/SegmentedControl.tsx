/** One option of a {@link SegmentedControl}. */
export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Props accepted by {@link SegmentedControl}. */
interface SegmentedControlProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

const SEGMENT_BASE_CLASS = "flex-1 rounded-pill py-3 text-body-sm transition-colors";
const ACTIVE_SEGMENT_CLASS = "bg-primary text-on-primary";
const INACTIVE_SEGMENT_CLASS = "text-slate-text";

/**
 * Pill-shaped tab switcher used to filter a list by one of a few options.
 *
 * @param props - The options, the selected value, the change callback and an accessible name.
 * @returns A tablist whose active tab is filled with the accent color.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-1">
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={`${SEGMENT_BASE_CLASS} ${isActive ? ACTIVE_SEGMENT_CLASS : INACTIVE_SEGMENT_CLASS}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
