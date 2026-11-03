import type { KeyboardEvent, ReactNode } from "react";

/** Semantic highlight used for accents (left border) and tints (background). */
type Highlight = "error" | "tertiary" | null;

/** Props accepted by {@link Card}. */
interface CardProps {
  children: ReactNode;
  accent?: Highlight;
  tint?: Highlight;
  onClick?: () => void;
  dense?: boolean;
  /** `light` gives a mint surface with dark text, used sparingly for emphasis blocks. */
  surface?: "default" | "light";
}

const ACCENT_CLASSES: Record<"error" | "tertiary", string> = {
  error: "border-l-4 border-l-error",
  tertiary: "border-l-4 border-l-tertiary",
};

const TINT_CLASSES: Record<"error" | "tertiary", string> = {
  error: "bg-error-container",
  tertiary: "bg-tertiary-container",
};

const DEFAULT_BACKGROUND = "bg-surface-container";
const LIGHT_SURFACE_CLASS = "surface-light bg-mint-frost";
const INTERACTIVE_CLASS = "cursor-pointer transition hover:bg-surface-container-high active:scale-[0.99]";
const STATIC_CLASS = "transition";
const PADDING_CLASS = { regular: "p-6", dense: "p-4" } as const;

/**
 * Keyboard handler that makes a clickable card behave like a button.
 *
 * @param event - The keyboard event fired on the card.
 * @param onActivate - Callback to run when Enter or Space is pressed.
 */
function activateOnKey(event: KeyboardEvent<HTMLDivElement>, onActivate: () => void): void {
  if (event.key === "Enter" || event.key === " ") onActivate();
}

/**
 * Flat content surface on the dark canvas. Accent and tint express stock status.
 *
 * @param props - Card content and optional highlight, density and click handler.
 * @returns A `div`, exposed as a button when `onClick` is provided.
 */
export function Card({ children, accent, tint, onClick, dense = false, surface = "default" }: CardProps) {
  const className = [
    "rounded-lg border border-outline-variant",
    surface === "light" ? LIGHT_SURFACE_CLASS : tint ? TINT_CLASSES[tint] : DEFAULT_BACKGROUND,
    accent ? ACCENT_CLASSES[accent] : "",
    onClick ? INTERACTIVE_CLASS : STATIC_CLASS,
    dense ? PADDING_CLASS.dense : PADDING_CLASS.regular,
  ].join(" ");

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (event) => activateOnKey(event, onClick) : undefined}
      className={className}
    >
      {children}
    </div>
  );
}
