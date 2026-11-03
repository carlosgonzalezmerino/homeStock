import { useEffect, useState, type KeyboardEvent } from "react";
import { formatQuantity, roundQuantity } from "@/utils/format";
import { parseDecimal, QUANTITY_RANGE_MESSAGE } from "@/utils/parse";

/** Available sizes for the stepper. */
export type StepperSize = "xs" | "sm" | "lg";

/** Props accepted by {@link QuantityStepper}. */
interface QuantityStepperProps {
  value: number;
  onChange: (nextValue: number) => void;
  size?: StepperSize;
  /** When `true` the value can be typed, which allows amounts such as 0,5. */
  editable?: boolean;
  /** `neutral` keeps the increment button off the accent colour, for long lists. */
  tone?: "accent" | "neutral";
}

const BUTTON_SIZE_CLASSES: Record<StepperSize, string> = {
  xs: "h-8 w-8 text-body",
  sm: "h-10 w-10 text-body-lg",
  lg: "h-12 w-12 text-subheading",
};

const VALUE_SIZE_CLASSES: Record<StepperSize, string> = {
  xs: "min-w-[2ch] text-center text-body-lg",
  sm: "min-w-[2ch] text-center text-subheading",
  lg: "min-w-[3ch] text-center text-heading-sm",
};

const GAP_CLASSES: Record<StepperSize, string> = {
  xs: "gap-2",
  sm: "gap-4",
  lg: "gap-4",
};

const BUTTON_BASE_CLASS = "flex items-center justify-center rounded-full transition disabled:opacity-40";
const DECREMENT_TONE = "bg-surface-container-high text-on-surface";
const INCREMENT_TONES = {
  accent: "bg-primary text-on-primary",
  neutral: "bg-surface-container-high text-on-surface",
} as const;
const EDITABLE_VALUE_CLASS = "w-[4ch] rounded-sm bg-transparent text-center text-on-surface focus:outline-none focus:ring-2 focus:ring-primary";

/**
 * Minus / plus control for editing a quantity, in steps of one unit.
 *
 * The value never drops below zero; the decrement button is disabled at zero. The value
 * is rounded to the allowed decimals after every step.
 *
 * @param props - Current value, change callback, visual size, whether the value can be typed and the tone.
 * @returns A row with a decrement button, the value and an increment button.
 */
export function QuantityStepper({ value, onChange, size = "sm", editable = false, tone = "accent" }: QuantityStepperProps) {
  return (
    <div className={`flex shrink-0 items-center ${GAP_CLASSES[size]}`}>
      <StepButton
        label="−"
        disabled={value <= 0}
        className={`${BUTTON_SIZE_CLASSES[size]} ${DECREMENT_TONE}`}
        onClick={() => onChange(Math.max(0, roundQuantity(value - 1)))}
      />
      {editable ? (
        <EditableValue value={value} onChange={onChange} sizeClass={VALUE_SIZE_CLASSES[size]} />
      ) : (
        <span className={VALUE_SIZE_CLASSES[size]}>{formatQuantity(value)}</span>
      )}
      <StepButton
        label="＋"
        className={`${BUTTON_SIZE_CLASSES[size]} ${INCREMENT_TONES[tone]}`}
        onClick={() => onChange(roundQuantity(value + 1))}
      />
    </div>
  );
}

/** Props accepted by {@link StepButton}. */
interface StepButtonProps {
  label: string;
  className: string;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * One of the two round buttons of the stepper.
 *
 * @param props - The visible and accessible label, the classes, the click callback and the disabled flag.
 * @returns A round button.
 */
function StepButton({ label, className, onClick, disabled = false }: StepButtonProps) {
  return (
    <button aria-label={label} type="button" disabled={disabled} onClick={onClick} className={`${BUTTON_BASE_CLASS} ${className}`}>
      {label}
    </button>
  );
}

/**
 * Keeps the text typed in the value field and checks it when the user leaves the field.
 *
 * @param value - The saved value.
 * @param onChange - Called with the new value when the text is valid and different.
 * @returns The draft text, its setter, the validation message and the commit function.
 */
function useDraftText(value: number, onChange: (nextValue: number) => void) {
  const [draft, setDraft] = useState(formatQuantity(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(formatQuantity(value));
    setError(null);
  }, [value]);

  function commit() {
    const parsed = parseDecimal(draft);
    if (parsed === null) {
      setError(QUANTITY_RANGE_MESSAGE);
      return;
    }
    setError(null);
    if (parsed !== value) onChange(roundQuantity(parsed));
  }

  return { draft, setDraft, error, commit };
}

/** Props accepted by {@link EditableValue}. */
interface EditableValueProps {
  value: number;
  onChange: (nextValue: number) => void;
  sizeClass: string;
}

/**
 * Text field that replaces the value in the middle of the stepper.
 *
 * The typed text is only saved when the field loses focus or Enter is pressed, and only if it is valid.
 *
 * @param props - The current value, the change callback and the text size.
 * @returns The input, with the validation message under it when the text is not valid.
 */
function EditableValue({ value, onChange, sizeClass }: EditableValueProps) {
  const { draft, setDraft, error, commit } = useDraftText(value, onChange);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") event.currentTarget.blur();
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <input
        aria-label="cantidad"
        aria-invalid={error !== null}
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={`${EDITABLE_VALUE_CLASS} ${sizeClass}`}
      />
      {error && <p className="max-w-[12rem] text-center text-body-sm text-error">{error}</p>}
    </div>
  );
}
