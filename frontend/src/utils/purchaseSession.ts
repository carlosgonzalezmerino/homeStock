import type { ScanResult } from "@/types";

/** One product scanned during the current shopping session. */
export interface SessionLine {
  ean: string;
  name: string;
  imageUrl: string | null;
  units: number;
  /** The product was not tracked before this session, so it got default values. */
  isNew: boolean;
  /** Movements that put these units in, newest last. Needed to take one back. */
  movementIds: number[];
}

/** Everything scanned in the current shopping session. */
export interface PurchaseSessionData {
  lines: SessionLine[];
  /** Codes nobody knows, waiting to be registered by hand. */
  unknown: string[];
}

/** A session with nothing in it. */
export const EMPTY_SESSION: PurchaseSessionData = { lines: [], unknown: [] };

/**
 * Builds the line for a product scanned for the first time in the session.
 *
 * @param result - The scan that put the first unit in.
 * @returns A line with one unit.
 */
function newLine(result: ScanResult): SessionLine {
  return {
    ean: result.ean,
    name: result.name ?? result.ean,
    imageUrl: result.image_url ?? null,
    units: 1,
    isNew: result.status === "created",
    movementIds: result.movement_id == null ? [] : [result.movement_id],
  };
}

/**
 * Adds one more unit to a line.
 *
 * @param line - The existing line.
 * @param result - The scan that put the unit in.
 * @returns The updated line.
 */
function withExtraUnit(line: SessionLine, result: ScanResult): SessionLine {
  const movementIds = result.movement_id == null ? line.movementIds : [...line.movementIds, result.movement_id];
  return { ...line, units: line.units + 1, isNew: line.isNew || result.status === "created", movementIds };
}

/**
 * Records the outcome of a purchase scan in the session.
 *
 * A known product adds a unit to its line. An unknown code is queued, once. Anything else
 * (a consumption, or a scan that changed nothing) leaves the session as it was.
 *
 * @param data - The session before the scan.
 * @param result - What the backend answered.
 * @returns The session after the scan; the same object when nothing changed.
 */
export function addScan(data: PurchaseSessionData, result: ScanResult): PurchaseSessionData {
  if (result.mode !== "purchase") return data;
  if (result.status === "unknown") {
    return data.unknown.includes(result.ean) ? data : { ...data, unknown: [...data.unknown, result.ean] };
  }
  if (result.status !== "applied" && result.status !== "created") return data;
  const existing = data.lines.find((line) => line.ean === result.ean);
  const lines = existing
    ? data.lines.map((line) => (line === existing ? withExtraUnit(line, result) : line))
    : [...data.lines, newLine(result)];
  return { ...data, lines };
}

/**
 * Takes one unit back after an undo. A line that reaches zero units disappears.
 *
 * @param data - The session before the undo.
 * @param ean - The product whose unit was taken back.
 * @param movementId - The movement that was undone.
 * @returns The session after the undo; the same object when the line is not there.
 */
export function removeUnit(data: PurchaseSessionData, ean: string, movementId: number): PurchaseSessionData {
  const target = data.lines.find((line) => line.ean === ean);
  if (!target) return data;
  const units = target.units - 1;
  const movementIds = target.movementIds.filter((id) => id !== movementId);
  const lines =
    units <= 0
      ? data.lines.filter((line) => line !== target)
      : data.lines.map((line) => (line === target ? { ...line, units, movementIds } : line));
  return { ...data, lines };
}

/**
 * Forgets unknown codes that have since been registered.
 *
 * @param data - The session.
 * @param registeredEans - EANs that are now tracked.
 * @returns The session without those codes; the same object when none of them was queued.
 */
export function dropRegistered(data: PurchaseSessionData, registeredEans: ReadonlySet<string>): PurchaseSessionData {
  const unknown = data.unknown.filter((ean) => !registeredEans.has(ean));
  return unknown.length === data.unknown.length ? data : { ...data, unknown };
}

/**
 * Counts what the session holds, for the "Terminar" button.
 *
 * @param data - The session.
 * @returns Units scanned plus codes waiting to be identified.
 */
export function countSession(data: PurchaseSessionData): number {
  return data.lines.reduce((total, line) => total + line.units, 0) + data.unknown.length;
}
