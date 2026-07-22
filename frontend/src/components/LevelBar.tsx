interface LevelBarProps {
  quantity: number;
  max: number;
}

export function LevelBar({ quantity, max }: LevelBarProps) {
  const pct = Math.min(100, Math.max(0, (quantity / max) * 100));
  return (
    <div className="h-2 w-full rounded-full bg-outline-variant overflow-hidden">
      <div
        data-testid="level-bar-fill"
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
