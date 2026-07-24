import type { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  variant?: "primary" | "ghost";
  size?: "md" | "sm";
}

export function Button({
  children,
  onClick,
  type = "button",
  disabled = false,
  variant = "primary",
  size = "md",
}: ButtonProps) {
  const base =
    size === "sm"
      ? "inline-flex items-center justify-center rounded-full px-5 py-2 text-label-md font-semibold transition-opacity disabled:opacity-50"
      : "inline-flex min-h-[56px] items-center justify-center rounded-full px-8 text-body-lg font-semibold transition-opacity disabled:opacity-50";
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
