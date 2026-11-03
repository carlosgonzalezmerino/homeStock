import type { ReactNode } from "react";

/** Props accepted by {@link Button}. */
interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  variant?: "primary" | "ghost" | "tertiary";
  size?: "md" | "sm";
}

const SIZE_CLASSES = {
  md: "h-14 px-7 text-body",
  sm: "h-11 px-5 text-body-sm",
} as const;

const VARIANT_CLASSES = {
  primary: "bg-primary text-on-primary hover:brightness-110",
  ghost: "border-[1.5px] border-on-surface bg-transparent text-on-surface hover:bg-surface-container-low",
  tertiary: "bg-transparent text-on-surface hover:text-primary",
} as const;

/**
 * Pill-shaped action button following the 56px pill rule of the design system.
 *
 * @param props - Button content, behaviour and visual variant.
 * @returns A native `<button>` element styled as a pill.
 */
export function Button({
  children,
  onClick,
  type = "button",
  disabled = false,
  variant = "primary",
  size = "md",
}: ButtonProps) {
  const className = [
    "inline-flex items-center justify-center rounded-pill transition disabled:opacity-50",
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
  ].join(" ");

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}
