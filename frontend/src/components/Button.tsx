import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  variant?: "primary" | "ghost";
}

export function Button({
  children,
  onClick,
  type = "button",
  disabled = false,
  variant = "primary",
}: ButtonProps) {
  const base =
    "inline-flex min-h-[56px] items-center justify-center rounded-full px-8 text-body-lg font-semibold transition-opacity disabled:opacity-50";
  const variantClass =
    variant === "ghost"
      ? "bg-transparent text-on-surface-variant"
      : "bg-primary-container text-on-primary-container";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variantClass}`}
    >
      {children}
    </button>
  );
}
