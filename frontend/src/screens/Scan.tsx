import { useState, type FormEvent, type RefObject } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import {
  useAddedToast,
  useBurstScan,
  usePurchaseSession,
  useScanMode,
  useScanner,
  type ScannerState,
  type UseScannerReturn,
} from "@/hooks";
import { ApiError } from "@/api/client";
import { resolveProduct } from "@/api/resolve";
import { HTTP_NOT_FOUND } from "@/api/status";
import { Button, ConsumeBanner, INPUT_CLASS, ScanModeControl, ScanResultSheet, StatusToast } from "@/components";
import { useActiveLocation } from "@/location";
import { describeError } from "@/utils/errors";
import { extractEan, isValidEan } from "@/utils/ean";
import { isDiagnosticsEnabled } from "@/utils/diagnostics";
import { prepareScanFeedback } from "@/utils/scanFeedback";

/** Message shown in the "added" confirmation. */
const ADDED_MESSAGE = "Producto añadido";
/** Error text shown when the typed code is not a valid EAN. */
const INVALID_EAN_MESSAGE = "Introduce un código EAN válido (8, 12 o 13 dígitos)";

/**
 * Opens the right screen for a scanned or typed EAN.
 *
 * Known products go to their detail screen. Unknown EANs (404) go to the manual entry form.
 * Other failures open the detail screen, which shows its own error state.
 *
 * @param ean - The EAN to open.
 * @param navigate - Router navigate function.
 */
async function openProductForEan(ean: string, navigate: NavigateFunction): Promise<void> {
  try {
    await resolveProduct(ean);
    navigate(`/scan/${ean}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === HTTP_NOT_FOUND) {
      navigate(`/scan/${ean}/manual`);
      return;
    }
    console.warn(`Could not resolve EAN ${ean}: ${describeError(error)}`);
    navigate(`/scan/${ean}`);
  }
}

/**
 * Turns the text typed by the user into an EAN, or reports that it is not one.
 *
 * @param rawText - The text from the input field, which may be a GS1 URL.
 * @returns The EAN, or `null` when the text does not look like one.
 */
export function normalizeTypedEan(rawText: string): string | null {
  const ean = extractEan(rawText.trim());
  return isValidEan(ean) ? ean : null;
}

/**
 * Behaviour of the scan page: the camera, the mode, the confirmation toast and what a code does.
 *
 * In `detail` mode a code opens the product and the camera stops, as it always did. In `purchase`
 * and `consume` modes the camera stays on and each code is applied at once. A code that is
 * neither an EAN nor a supported QR is not used. It is kept so the screen can show it.
 *
 * @returns The scanner, the mode, the burst actions, whether the toast is visible, the
 *   unrecognised code, a handler for an EAN typed by the user and the camera start action.
 */
function useScanPage() {
  const navigate = useNavigate();
  const { location } = useActiveLocation();
  const [mode, changeMode] = useScanMode();
  const session = usePurchaseSession();
  const burst = useBurstScan({ mode: mode === "consume" ? "consume" : "purchase", location, session });
  const [unrecognizedCode, setUnrecognizedCode] = useState<string | null>(null);

  function applyCode(ean: string) {
    if (mode === "detail") void openProductForEan(ean, navigate);
    else void burst.scan(ean);
  }

  const scanner: UseScannerReturn = useScanner(
    (rawValue) => {
      const ean = normalizeTypedEan(rawValue);
      setUnrecognizedCode(ean === null ? rawValue : null);
      if (ean !== null) applyCode(ean);
    },
    { continuous: mode !== "detail" },
  );
  const showAddedToast = useAddedToast();

  function submitTypedEan(ean: string) {
    if (mode === "detail") scanner.stop();
    setUnrecognizedCode(null);
    applyCode(ean);
  }

  function startCamera() {
    prepareScanFeedback();
    void scanner.start();
  }

  return { scanner, mode, changeMode, session, burst, showAddedToast, unrecognizedCode, submitTypedEan, startCamera };
}

/**
 * Scan screen: mode selector, camera viewfinder, manual EAN entry and a path for products without a barcode.
 *
 * @returns The scan page.
 */
export function Scan() {
  const navigate = useNavigate();
  const page = useScanPage();
  const { scanner, mode, burst, session } = page;
  const showDiagnostics = import.meta.env.DEV || isDiagnosticsEnabled();

  return (
    <div className="flex flex-col items-center gap-6 pt-6">
      <h1 className="text-heading-sm text-on-surface">Escanear producto</h1>
      <div className="w-full max-w-sm">
        <ScanModeControl value={mode} onChange={page.changeMode} />
      </div>
      {mode === "consume" && <ConsumeBanner />}
      {page.showAddedToast && <StatusToast message={ADDED_MESSAGE} />}
      <CameraViewfinder videoRef={scanner.ref} isScanning={scanner.state === "scanning"} isConsuming={mode === "consume"} />
      <ScannerStatus state={scanner.state} errorMessage={scanner.error} />
      {page.unrecognizedCode && <UnrecognizedCodeMessage code={page.unrecognizedCode} />}
      {(scanner.state === "idle" || scanner.state === "error") && <Button onClick={page.startCamera}>Activar cámara</Button>}
      {session.count > 0 && <Button variant="ghost" onClick={() => navigate("/scan/revisar")}>{`Terminar (${session.count})`}</Button>}
      {showDiagnostics && <ScannerDebugPanel lines={scanner.debugInfo} />}
      <OrDivider />
      <ManualEanForm onSubmitEan={page.submitTypedEan} />
      <Button variant="tertiary" onClick={() => navigate("/custom-entry")}>
        Añadir sin código
      </Button>
      {burst.sheet && <ScanResultSheet sheet={burst.sheet} onUndo={() => void burst.undo()} />}
    </div>
  );
}

/** Props accepted by {@link UnrecognizedCodeMessage}. */
interface UnrecognizedCodeMessageProps {
  code: string;
}

/**
 * Explains that a code was read but cannot be used, and shows its value so the user can check it.
 *
 * @param props - The raw value that the camera read.
 * @returns An alert paragraph under the viewfinder.
 */
function UnrecognizedCodeMessage({ code }: UnrecognizedCodeMessageProps) {
  return (
    <p role="alert" className="max-w-sm break-all text-center text-body-sm text-error">
      Código leído, pero no reconocido: {code}
    </p>
  );
}

/** Props accepted by {@link CameraViewfinder}. */
interface CameraViewfinderProps {
  videoRef: RefObject<HTMLVideoElement>;
  isScanning: boolean;
  /** The mode takes units out, so the aiming frame uses the warning colour instead of the accent. */
  isConsuming?: boolean;
}

/**
 * Live camera feed with an aiming rectangle while scanning.
 *
 * The video element stays mounted while idle so the scanner can attach the stream to it.
 *
 * @param props - The video ref used by the scanner, whether the camera is running and whether the mode takes units out.
 * @returns The video element and the aiming overlay.
 */
function CameraViewfinder({ videoRef, isScanning, isConsuming = false }: CameraViewfinderProps) {
  return (
    <div className="relative w-full max-w-sm">
      <video
        ref={videoRef}
        muted
        playsInline
        className={`w-full rounded-lg bg-surface-container transition-opacity ${isScanning ? "opacity-100" : "h-0 opacity-0"}`}
      />
      {isScanning && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`h-32 w-64 rounded-sm border-2 opacity-70 ${isConsuming ? "border-tertiary" : "border-primary"}`} />
        </div>
      )}
    </div>
  );
}

/** Props accepted by {@link ScannerStatus}. */
interface ScannerStatusProps {
  state: ScannerState;
  errorMessage: string | null;
}

/**
 * Hint or error text that matches the scanner state.
 *
 * @param props - Current scanner state and the last error message.
 * @returns A short instruction, a progress message or the error.
 */
function ScannerStatus({ state, errorMessage }: ScannerStatusProps) {
  if (state === "scanning") {
    return <p className="text-center text-body-sm text-on-surface-variant">Apunta al código de barras o QR</p>;
  }
  if (state === "error" || errorMessage) {
    return <p className="text-center text-body-sm text-error">{errorMessage ?? "Cámara no disponible"}</p>;
  }
  const message = state === "starting" ? "Iniciando cámara…" : "Pulsa el botón para activar la cámara";
  return <p className="text-center text-body-sm text-on-surface-variant">{message}</p>;
}

/**
 * Horizontal rule with a caption, separating the camera from manual entry.
 *
 * @returns A divider row.
 */
function OrDivider() {
  return (
    <div className="flex w-full max-w-sm items-center gap-3">
      <hr className="flex-1 border-outline-variant" />
      <span className="text-eyebrow uppercase text-on-surface-variant">o introduce manualmente</span>
      <hr className="flex-1 border-outline-variant" />
    </div>
  );
}

/** Props accepted by {@link ManualEanForm}. */
interface ManualEanFormProps {
  onSubmitEan: (ean: string) => void;
}

/**
 * Text field for typing an EAN. The value is validated before it is used.
 *
 * @param props - Callback that receives a valid EAN.
 * @returns A form with the input, a search button and the validation message.
 */
function ManualEanForm({ onSubmitEan }: ManualEanFormProps) {
  const [manualEan, setManualEan] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ean = normalizeTypedEan(manualEan);
    setValidationError(ean === null ? INVALID_EAN_MESSAGE : null);
    if (ean !== null) onSubmitEan(ean);
  }

  return (
    <form aria-label="Introducir EAN manual" onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={manualEan}
          onChange={(event) => setManualEan(event.target.value)}
          placeholder="Código EAN"
          aria-label="Código EAN"
          className={`flex-1 ${INPUT_CLASS}`}
        />
        <Button type="submit" variant="ghost">
          Buscar
        </Button>
      </div>
      {validationError && <p className="text-body-sm text-error">{validationError}</p>}
    </form>
  );
}

/** Props accepted by {@link ScannerDebugPanel}. */
interface ScannerDebugPanelProps {
  lines: string[];
}

/**
 * Lists the scanner's diagnostic lines. Shown in development builds, or when the user switches it on in Settings.
 *
 * @param props - The diagnostic lines to show.
 * @returns A monospace panel with one line per entry, or `null` when there are none.
 */
function ScannerDebugPanel({ lines }: ScannerDebugPanelProps) {
  if (lines.length === 0) return null;
  return (
    <div className="w-full max-w-sm space-y-1 rounded-lg bg-surface-container p-4 font-mono text-body-sm text-on-surface-variant">
      {lines.map((line, index) => (
        <div key={`${index}-${line}`}>{line}</div>
      ))}
    </div>
  );
}
