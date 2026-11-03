/**
 * Formats a date as `YYYY-MM-DD` using the device's local calendar.
 *
 * @param date - The date to format. Defaults to now.
 * @returns The local calendar date, which is what the frozen-date field expects.
 */
export function localIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
