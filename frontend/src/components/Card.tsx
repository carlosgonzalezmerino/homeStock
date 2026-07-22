import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  accent?: "error" | "tertiary" | null;
}

export function Card({ children, accent }: CardProps) {
  const accentClass =
    accent === "error"
      ? "border-l-4 border-l-error"
      : accent === "tertiary"
        ? "border-l-4 border-l-tertiary"
        : "";

  return (
    <div
      className={`bg-surface-container-lowest rounded-lg border border-outline-variant p-4 ${accentClass}`}
    >
      {children}
    </div>
  );
}
