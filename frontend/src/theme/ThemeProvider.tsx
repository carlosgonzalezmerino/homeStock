import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/** Themes supported by the application. */
export type Theme = "light" | "dark";

/** Value exposed to components through {@link useTheme}. */
interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

/** Theme used when the user has not chosen one. The design system is dark-first. */
const DEFAULT_THEME: Theme = "dark";
/** localStorage key that remembers the user's choice. */
const STORAGE_KEY = "theme";
/** CSS class on `<html>` that switches the color tokens to the dark palette. */
const DARK_CLASS = "dark";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Reads the theme saved by the user, if any.
 *
 * @returns The stored theme, or `null` when nothing valid is stored or storage is unavailable.
 */
function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch (error) {
    console.warn(`Theme storage unavailable: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Chooses the theme to start with: the stored choice, otherwise the dark default.
 *
 * @returns The initial theme.
 */
function getInitialTheme(): Theme {
  return readStoredTheme() ?? DEFAULT_THEME;
}

/**
 * Provides the current theme and a toggle to the component tree.
 *
 * The chosen theme is written to `<html>` as the `dark` class and saved to localStorage.
 *
 * @param props - The children that can read the theme.
 * @returns The context provider wrapping the children.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle(DARK_CLASS, theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

/**
 * Reads the current theme and the toggle action.
 *
 * @returns The theme context value.
 * @throws {Error} When called outside a {@link ThemeProvider}.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
