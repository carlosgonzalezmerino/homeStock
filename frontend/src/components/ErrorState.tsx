import { Button } from "./Button";

/** Props accepted by {@link ErrorState}. */
interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  actionLabel?: string;
}

/**
 * Error panel with a recovery action.
 *
 * @param props - The error message, the callback for the action and its label.
 * @returns A centered error icon, message and action button.
 */
export function ErrorState({ message, onRetry, actionLabel = "Reintentar" }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-on-surface">
      <span className="material-symbols-outlined text-5xl text-error">error</span>
      <p className="text-body-lg">{message}</p>
      <Button variant="tertiary" onClick={onRetry}>
        {actionLabel}
      </Button>
    </div>
  );
}
