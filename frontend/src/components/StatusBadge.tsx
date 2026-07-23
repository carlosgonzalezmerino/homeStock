type StatusBadgeProps = { status: "ok" | "low" | "empty" };

const CONFIG = {
  ok:    { color: "bg-primary",  label: "Stock OK"   },
  low:   { color: "bg-tertiary", label: "Stock bajo"  },
  empty: { color: "bg-error",    label: "Agotado"     },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { color, label } = CONFIG[status];
  return (
    <span
      aria-label={label}
      className={`inline-block h-3 w-3 rounded-full ${color} shrink-0`}
    />
  );
}
