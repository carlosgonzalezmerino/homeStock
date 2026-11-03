/** How a scan went, for the sound and the vibration. */
export type FeedbackKind = "success" | "warning";

/** One beep: its pitch and length. */
interface Tone {
  frequency: number;
  durationMs: number;
}

const SUCCESS_TONES: readonly Tone[] = [{ frequency: 880, durationMs: 90 }];
/** Two low beeps: a scan that did not do what was expected has to be noticed without looking. */
const WARNING_TONES: readonly Tone[] = [
  { frequency: 330, durationMs: 120 },
  { frequency: 330, durationMs: 120 },
];
const VIBRATION_PATTERNS: Record<FeedbackKind, readonly number[]> = {
  success: [40],
  warning: [80, 60, 80],
};
const TONE_VOLUME = 0.15;
const TONE_GAP_SECONDS = 0.05;
const MS_PER_SECOND = 1000;

/** The audio context, created on a user gesture because browsers refuse to do it earlier. */
let audioContext: AudioContext | null = null;

/**
 * Finds the audio context constructor the browser offers.
 *
 * @returns The constructor, or `null` when the browser has no WebAudio.
 */
function audioContextConstructor(): typeof AudioContext | null {
  const legacy = window as unknown as { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? legacy.webkitAudioContext ?? null;
}

/**
 * Prepares the sound. Call it from a user gesture, such as pressing "Activar cámara".
 *
 * A failure is logged and the app keeps working without sound.
 */
export function prepareScanFeedback(): void {
  const Constructor = audioContextConstructor();
  if (!Constructor) return;
  try {
    audioContext ??= new Constructor();
    void audioContext.resume();
  } catch (error) {
    console.warn(`Scan sound unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Plays a sequence of beeps.
 *
 * @param context - The audio context to play on.
 * @param tones - The beeps, in order.
 */
function playTones(context: AudioContext, tones: readonly Tone[]): void {
  let startAt = context.currentTime;
  for (const tone of tones) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const seconds = tone.durationMs / MS_PER_SECOND;
    oscillator.frequency.value = tone.frequency;
    gain.gain.value = TONE_VOLUME;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + seconds);
    startAt += seconds + TONE_GAP_SECONDS;
  }
}

/**
 * Tells the user how the scan went with a beep and a vibration, because whoever scans is
 * looking at the product and not at the screen. Neither can break the scan: where the
 * browser has no sound or no vibration, it is skipped, and a failure is only logged.
 *
 * @param kind - `success` for a change that was made, `warning` for one that was not.
 */
export function playScanFeedback(kind: FeedbackKind): void {
  try {
    if (audioContext) playTones(audioContext, kind === "success" ? SUCCESS_TONES : WARNING_TONES);
    navigator.vibrate?.([...VIBRATION_PATTERNS[kind]]);
  } catch (error) {
    console.warn(`Scan feedback failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
