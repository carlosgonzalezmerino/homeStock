/**
 * Minimal typing of the browser's native BarcodeDetector API, which TypeScript's DOM lib does not ship.
 *
 * This declaration is ambient: at runtime the identifier resolves to `window.BarcodeDetector`.
 */
declare class BarcodeDetector {
  /**
   * @param options - The barcode formats to look for. Omit it to accept the browser defaults.
   */
  constructor(options?: { formats: string[] });

  /**
   * Looks for barcodes in the current frame of a video.
   *
   * @param image - The video element to read.
   * @returns The codes found, with their decoded text.
   */
  detect(image: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;

  /**
   * Lists the formats this browser can read.
   *
   * @returns The supported format names.
   */
  static getSupportedFormats(): Promise<string[]>;
}

/** Type of an instance of the native barcode detector. */
export type NativeBarcodeDetector = BarcodeDetector;

/**
 * Format lists from most to least specific. Browsers reject lists they do not support,
 * so the detector falls back to the next entry.
 */
export const FORMAT_CANDIDATES: readonly (readonly string[])[] = [
  ["ean_13", "ean_8", "code_128", "upc_e", "qr_code"],
  ["ean_13", "ean_8", "code_128"],
  ["ean_13", "ean_8"],
  ["ean_13"],
];

/** The most specific list, which is the first attempt when the browser reports its supported formats. */
const PREFERRED_FORMATS = FORMAT_CANDIDATES[0];

/** Callback used to record a diagnostic line for the scanner debug panel. */
export type DiagnosticLogger = (message: string) => void;

/**
 * Creates a native barcode detector that accepts the most formats the browser supports.
 *
 * Strategy: intersect the best format list with `getSupportedFormats()`. When that call is
 * unavailable (some iOS builds), try each candidate list until the constructor accepts one.
 * As a last resort, build the detector with the browser defaults.
 *
 * @param log - Receives a line for each fallback step so the debug panel shows which path ran.
 * @returns A ready-to-use native barcode detector.
 * @throws {Error} When the browser exposes no BarcodeDetector constructor at all.
 */
export async function createBarcodeDetector(log: DiagnosticLogger): Promise<NativeBarcodeDetector> {
  const preferred = await intersectWithSupportedFormats(log);
  if (preferred) return preferred;

  for (const formats of FORMAT_CANDIDATES) {
    const detector = tryCreateDetector(formats, log);
    if (detector) return detector;
  }

  log("No format list accepted; using browser defaults");
  return new BarcodeDetector();
}

/**
 * Builds a detector from the best candidate list that the browser reports as supported.
 *
 * @param log - Receives a line when `getSupportedFormats` is unavailable or rejects.
 * @returns The detector, or `null` when the browser cannot report its supported formats.
 */
async function intersectWithSupportedFormats(log: DiagnosticLogger): Promise<NativeBarcodeDetector | null> {
  try {
    const supported = await BarcodeDetector.getSupportedFormats();
    const formats = PREFERRED_FORMATS.filter((format) => supported.includes(format));
    return formats.length > 0 ? new BarcodeDetector({ formats }) : null;
  } catch (error) {
    log(`getSupportedFormats unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Attempts to construct a detector for one format list.
 *
 * @param formats - Barcode formats to request.
 * @param log - Receives a line when the browser rejects the list.
 * @returns The detector, or `null` when the constructor throws.
 */
function tryCreateDetector(formats: readonly string[], log: DiagnosticLogger): NativeBarcodeDetector | null {
  try {
    return new BarcodeDetector({ formats: [...formats] });
  } catch (error) {
    log(`Format list rejected (${formats.join(",")}): ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
