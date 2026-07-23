interface QuantityStepperProps {
  value: number;
  onChange: (n: number) => void;
  size?: "sm" | "lg";
}

export function QuantityStepper({ value, onChange, size = "sm" }: QuantityStepperProps) {
  const isLg = size === "lg";
  const btnClass = isLg
    ? "flex h-12 w-12 items-center justify-center rounded-full bg-surface-container-high text-on-surface text-2xl"
    : "flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface text-xl";
  const valueClass = isLg
    ? "min-w-[3ch] text-center text-headline-lg font-bold text-on-surface"
    : "min-w-[2ch] text-center text-headline-md";

  return (
    <div className="flex items-center gap-4">
      <button
        aria-label="−"
        onClick={() => { if (value > 0) onChange(value - 1); }}
        className={btnClass}
        type="button"
        disabled={value === 0}
      >
        −
      </button>
      <span className={valueClass}>{value}</span>
      <button
        aria-label="＋"
        onClick={() => onChange(value + 1)}
        className={isLg ? btnClass.replace("bg-surface-container-high text-on-surface", "bg-primary-container text-on-primary-container") : "flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container text-xl"}
        type="button"
      >
        ＋
      </button>
    </div>
  );
}
