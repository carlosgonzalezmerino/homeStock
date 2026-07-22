interface QuantityStepperProps {
  value: number;
  onChange: (n: number) => void;
}

export function QuantityStepper({ value, onChange }: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-4">
      <button
        aria-label="−"
        onClick={() => { if (value > 0) onChange(value - 1); }}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface text-xl"
        type="button"
      >
        −
      </button>
      <span className="min-w-[2ch] text-center text-headline-md">{value}</span>
      <button
        aria-label="＋"
        onClick={() => onChange(value + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-xl"
        type="button"
      >
        ＋
      </button>
    </div>
  );
}
