import type { ReactNode } from "react";

/** Props accepted by {@link FormField}. */
interface FormFieldProps {
  label: string;
  children: ReactNode;
  error?: string;
  htmlFor?: string;
}

/**
 * Labelled wrapper for a form control, with an optional validation message.
 *
 * @param props - Visible label, the control to wrap, an error message and the id of the control.
 * @returns A column with the label, the control and the error text when present.
 */
export function FormField({ label, children, error, htmlFor }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-body-sm text-on-surface-variant">
        {label}
      </label>
      {children}
      {error && <p className="text-body-sm text-error">{error}</p>}
    </div>
  );
}
