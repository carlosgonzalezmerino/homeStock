import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  accent?: "error" | "tertiary" | null;
  tint?: "error" | "tertiary" | null;
  onClick?: () => void;
  dense?: boolean;
}

export function Card({ children, accent, tint, onClick, dense }: CardProps) {
  const accentClass =
    accent === "error"
      ? "border-l-4 border-l-error"
      : accent === "tertiary"
        ? "border-l-4 border-l-tertiary"
        : "";

  const bgClass =
    tint === "error"
      ? "bg-error-container"
      : tint === "tertiary"
        ? "bg-tertiary-container"
        : "bg-surface-container-lowest";

  const interactiveClass = onClick
    ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.99] active:translate-y-0"
    : "transition-shadow";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      className={`card-texture ${bgClass} rounded-lg border border-outline-variant shadow-sm ${dense ? "p-3" : "p-4"} ${accentClass} ${interactiveClass}`}
    >
      {children}
    </div>
  );
}
