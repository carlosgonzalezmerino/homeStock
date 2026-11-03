/** Alert threshold used when a product is added for the first time. */
export const DEFAULT_THRESHOLD = 2;
/** Quantity offered when a product is added for the first time. */
export const DEFAULT_NEW_QUANTITY = 1;
/** Unit used when the user leaves the unit field empty. */
export const DEFAULT_UNIT = "units";
/** Most decimal places a quantity or threshold can have. */
export const MAX_QUANTITY_DECIMALS = 2;
/** Freezer drawers that can be chosen. */
export const FREEZER_DRAWERS = [1, 2, 3, 4] as const;
/** Months in the freezer after which an item is flagged as having been there too long. */
export const FREEZER_STALE_MONTHS = 6;
/** Longest note that can be saved on an inventory item. */
export const NOTES_MAX_LENGTH = 500;
/** Rows of the notes text area. */
export const NOTES_ROWS = 3;
/** Notes longer than this show a character counter. */
export const NOTES_COUNTER_THRESHOLD = 400;
