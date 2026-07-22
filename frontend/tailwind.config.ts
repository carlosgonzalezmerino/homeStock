import type { Config } from "tailwindcss";

const color = (token: string) => `rgb(var(${token}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: color("--background"),
        "on-background": color("--on-background"),
        surface: color("--surface"),
        "on-surface": color("--on-surface"),
        "on-surface-variant": color("--on-surface-variant"),
        "surface-container-lowest": color("--surface-container-lowest"),
        "surface-container-low": color("--surface-container-low"),
        "surface-container": color("--surface-container"),
        "surface-container-high": color("--surface-container-high"),
        outline: color("--outline"),
        "outline-variant": color("--outline-variant"),
        primary: color("--primary"),
        "on-primary": color("--on-primary"),
        "primary-container": color("--primary-container"),
        "on-primary-container": color("--on-primary-container"),
        secondary: color("--secondary"),
        "secondary-container": color("--secondary-container"),
        "on-secondary-container": color("--on-secondary-container"),
        tertiary: color("--tertiary"),
        "tertiary-container": color("--tertiary-container"),
        "on-tertiary-container": color("--on-tertiary-container"),
        error: color("--error"),
        "error-container": color("--error-container"),
        "on-error-container": color("--on-error-container"),
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        sm: "0.25rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        full: "9999px",
      },
      spacing: {
        base: "8px",
        "stack-sm": "12px",
        "stack-md": "24px",
        gutter: "16px",
        "container-padding": "20px",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      fontSize: {
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-md": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "600" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
