interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-on-surface">
      <span className="material-symbols-outlined text-5xl text-error">error</span>
      <p className="text-body-lg">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="text-primary underline text-body-lg"
      >
        Reintentar
      </button>
    </div>
  );
}
