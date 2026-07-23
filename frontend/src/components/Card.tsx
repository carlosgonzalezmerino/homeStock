import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  accent?: "error" | "tertiary" | null;
  onClick?: () => void;
}

export function Card({ children, accent, onClick }: CardProps) {
  const accentClass =
    accent === "error"
      ? "border-l-4 border-l-error"
      : accent === "tertiary"
        ? "border-l-4 border-l-tertiary"
        : "";

  const interactiveClass = onClick
    ? "cursor-pointer hover:bg-surface-container transition-colors active:scale-[0.99]"
    : "";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      className={`bg-surface-container-lowest rounded-lg border border-outline-variant p-4 ${accentClass} ${interactiveClass}`}
    >
      {children}
    </div>
  );
}
