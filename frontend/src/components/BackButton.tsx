import { BACK_LINK_CLASS } from "./styles";

/** Props accepted by {@link BackButton}. */
interface BackButtonProps {
  onBack: () => void;
  label?: string;
}

/**
 * Text link that returns to the previous screen.
 *
 * @param props - The back callback and an optional visible label.
 * @returns A button styled as a back link.
 */
export function BackButton({ onBack, label = "Volver" }: BackButtonProps) {
  return (
    <button type="button" onClick={onBack} className={BACK_LINK_CLASS} aria-label={label}>
      ← {label}
    </button>
  );
}
