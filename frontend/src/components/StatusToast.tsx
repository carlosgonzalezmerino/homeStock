/** Props accepted by {@link StatusToast}. */
interface StatusToastProps {
  message: string;
}

/**
 * Green confirmation banner shown briefly after an action succeeds.
 *
 * @param props - The text to show.
 * @returns A status region with the message.
 */
export function StatusToast({ message }: StatusToastProps) {
  return (
    <div role="status" className="w-full max-w-sm rounded-lg bg-secondary-container px-4 py-3 text-center text-body-sm text-on-secondary-container">
      ✓ {message}
    </div>
  );
}
