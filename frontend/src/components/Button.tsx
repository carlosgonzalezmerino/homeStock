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
      ? "inline-flex items-center justify-center rounded-md px-5 py-2 text-label-md font-semibold transition-all disabled:opacity-50"
      : "inline-flex min-h-[52px] items-center justify-center rounded-md px-8 text-body-lg font-semibold transition-all disabled:opacity-50";
  const variantClass =
    variant === "ghost"
      ? "bg-transparent text-on-surface-variant hover:bg-surface-container active:scale-[0.98]"
      : "bg-primary text-on-primary shadow-sm hover:shadow active:scale-[0.98]";

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
