import { useEffect, useState } from "react";

/**
 * Returns a copy of `value` that only updates after it has stopped changing for `delayMs`.
 *
 * @param value - The value to follow.
 * @param delayMs - Quiet period, in milliseconds, before the value is copied.
 * @returns The debounced value.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
