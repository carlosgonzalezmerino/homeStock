import type { Config } from "tailwindcss";

/** Builds a Tailwind color that reads an RGB-triplet CSS variable and supports alpha. */
const themeColor = (variableName: string) => `rgb(var(${variableName}) / <alpha-value>)`;

/** Fixed brand tokens from .claude/style.md. They do not change with the theme. */
const BRAND_COLORS = {
  "obsidian-shell": "#132322",
  "deep-abyss": "#0e1a19",
  charcoal: "#070f0f",
  "mint-frost": "#edf7f5",
  "pure-white": "#ffffff",
  "fog-border": "#d0d3d3",
  "stone-border": "#b2b6b4",
  "slate-text": "#828786",
  "graphite-fill": "#424f4f",
  "neon-pulse": "#3ddc91",
  "mint-whisper": "#97ddbc",
  "signal-yellow": "#ffcd48",
} as const;

/** Semantic tokens that switch between dark and light themes. */
const THEME_COLORS = {
  background: "--background",
  "on-background": "--on-background",
  surface: "--surface",
  "on-surface": "--on-surface",
  "on-surface-variant": "--on-surface-variant",
  "surface-container-lowest": "--surface-container-lowest",
  "surface-container-low": "--surface-container-low",
  "surface-container": "--surface-container",
  "surface-container-high": "--surface-container-high",
  outline: "--outline",
  "outline-variant": "--outline-variant",
  primary: "--primary",
  "on-primary": "--on-primary",
  "primary-container": "--primary-container",
  "on-primary-container": "--on-primary-container",
  "secondary-container": "--secondary-container",
  "on-secondary-container": "--on-secondary-container",
  tertiary: "--tertiary",
  "tertiary-container": "--tertiary-container",
  "on-tertiary-container": "--on-tertiary-container",
  error: "--error",
  "on-error": "--on-error",
  "error-container": "--error-container",
  "on-error-container": "--on-error-container",
} as const;

const themeColorEntries = Object.entries(THEME_COLORS).map(
  ([name, variable]) => [name, themeColor(variable)] as const,
);

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ...BRAND_COLORS,
        ...Object.fromEntries(themeColorEntries),
      },
      borderRadius: {
        /* Radius scale of the style guide: 10 small elements, 20 cards, 56 buttons and tabs, 60 large cards. */
        sm: "10px",
        lg: "20px",
        xl: "60px",
        pill: "56px",
        full: "9999px",
      },
      spacing: {
        base: "8px",
        "stack-sm": "16px",
        "stack-md": "24px",
        gutter: "16px",
        "container-padding": "16px",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      /* Type scale from .claude/style.md. Body text is weight 400; display is at most 500. */
      fontSize: {
        "heading-lg": ["48px", { lineHeight: "1.12", fontWeight: "500" }],
        heading: ["40px", { lineHeight: "1.2", fontWeight: "400" }],
        "heading-sm": ["32px", { lineHeight: "1.22", fontWeight: "400" }],
        subheading: ["24px", { lineHeight: "1.4", letterSpacing: "0.96px", fontWeight: "400" }],
        "body-lg": ["18px", { lineHeight: "1.45", fontWeight: "400" }],
        body: ["16px", { lineHeight: "1.5", letterSpacing: "-0.08px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.45", fontWeight: "400" }],
        eyebrow: ["9px", { lineHeight: "1.2", letterSpacing: "0.45px", fontWeight: "400" }],
      },
      boxShadow: {
        md: "1px 0px 9px 2px rgba(0, 0, 0, 0.04)",
      },
      maxWidth: {
        page: "1200px",
      },
    },
  },
  plugins: [],
} satisfies Config;
