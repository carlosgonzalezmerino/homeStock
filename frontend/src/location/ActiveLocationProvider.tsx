import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Location } from "@/types";

/** What the active location context exposes. */
interface ActiveLocationValue {
  location: Location;
  setLocation: (location: Location) => void;
}

/** localStorage key that remembers the last location the user looked at. */
const STORAGE_KEY = "activeLocation";
/** Location used when nothing valid is stored. */
const DEFAULT_LOCATION: Location = "pantry";
/** Locations that can be stored. */
const LOCATIONS: readonly Location[] = ["pantry", "freezer"];

const ActiveLocationContext = createContext<ActiveLocationValue>({
  location: DEFAULT_LOCATION,
  setLocation: () => undefined,
});

/**
 * Reads the location saved by the user, if any.
 *
 * @returns The stored location, or `null` when nothing valid is stored or storage is unavailable.
 */
function readStoredLocation(): Location | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LOCATIONS.find((location) => location === stored) ?? null;
  } catch (error) {
    console.warn(`Location storage unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Saves the active location. A storage failure is logged and the app keeps working in memory.
 *
 * @param location - The location to remember.
 */
function writeStoredLocation(location: Location): void {
  try {
    localStorage.setItem(STORAGE_KEY, location);
  } catch (error) {
    console.warn(`Location storage unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Keeps the storage location the user is working in: it selects the pantry or freezer tab,
 * and it is the location preselected when adding a product.
 *
 * @param props - The children that can read the location.
 * @returns The context provider wrapping the children.
 */
export function ActiveLocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<Location>(() => readStoredLocation() ?? DEFAULT_LOCATION);

  useEffect(() => {
    writeStoredLocation(location);
  }, [location]);

  const value = useMemo(() => ({ location, setLocation }), [location]);
  return <ActiveLocationContext.Provider value={value}>{children}</ActiveLocationContext.Provider>;
}

/**
 * Reads the active location and the function that changes it.
 *
 * @returns The current location and its setter.
 */
export function useActiveLocation(): ActiveLocationValue {
  return useContext(ActiveLocationContext);
}
