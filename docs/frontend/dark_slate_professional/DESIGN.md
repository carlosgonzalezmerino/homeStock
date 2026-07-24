---
name: Dark Slate Professional
colors:
  surface: '#0e150e'
  surface-dim: '#0e150e'
  surface-bright: '#333b33'
  surface-container-lowest: '#091009'
  surface-container-low: '#161d16'
  surface-container: '#1a221a'
  surface-container-high: '#242c24'
  surface-container-highest: '#2f372e'
  on-surface: '#dce5d9'
  on-surface-variant: '#bccbb9'
  inverse-surface: '#dce5d9'
  inverse-on-surface: '#2a322a'
  outline: '#869585'
  outline-variant: '#3d4a3d'
  surface-tint: '#4ae176'
  primary: '#4be277'
  on-primary: '#003915'
  primary-container: '#22c55e'
  on-primary-container: '#004b1e'
  inverse-primary: '#006e2f'
  secondary: '#b9c7e0'
  on-secondary: '#233144'
  secondary-container: '#3c4a5e'
  on-secondary-container: '#abb9d2'
  tertiary: '#ffb5ab'
  on-tertiary: '#60130d'
  tertiary-container: '#ff8b7c'
  on-tertiary-container: '#76231b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6bff8f'
  primary-fixed-dim: '#4ae176'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#d5e3fd'
  secondary-fixed-dim: '#b9c7e0'
  on-secondary-fixed: '#0d1c2f'
  on-secondary-fixed-variant: '#3a485c'
  tertiary-fixed: '#ffdad5'
  tertiary-fixed-dim: '#ffb4a9'
  on-tertiary-fixed: '#410001'
  on-tertiary-fixed-variant: '#7f2a21'
  background: '#0e150e'
  on-background: '#dce5d9'
  surface-variant: '#2f372e'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style
This design system utilizes a **Minimalist-Modern** aesthetic optimized for high-performance productivity. The brand personality is professional, precise, and focused, catering to users who require long-duration focus without visual fatigue. 

The style leverages a deep slate monochromatic foundation punctuated by high-vibrancy functional accents. Depth is communicated through subtle tonal shifts rather than traditional shadows, creating a sophisticated, layered interface that feels integrated and expansive.

## Colors
The palette is anchored in a deep slate (#0f172a) to provide a stable, low-strain background. 

- **Primary:** The brand green is maintained at #22c55e, providing an AA-compliant contrast ratio for actionable elements against the dark background.
- **Surface Hierarchy:** Elevation is handled via "Lighter-is-Higher" logic. Base surfaces use #0f172a, elevated containers use #1e293b, and interactive hover states or high-level popovers use #334155.
- **Functional Colors:** Status colors (Red and Amber) are calibrated for dark mode by increasing their luminance and saturation slightly to ensure they "pop" against the slate backdrop without creating "vibration" artifacts.

## Typography
The system uses **Inter** exclusively to maintain a systematic and utilitarian feel. 

- **Weight Strategy:** Headlines use Semi-Bold (600) and Bold (700) to ensure clear information architecture. Body text remains at Regular (400) for maximum legibility.
- **Contrast:** Primary information is set in Off-White (#f8fafc), while meta-data and supporting labels utilize Muted Slate (#94a3b8) to reduce visual noise.
- **Scale:** Large display type is reserved for dashboard summaries, while tight, 14px body text is used for data-heavy list views.

## Layout & Spacing
The design system follows a strict **8px grid** (Round-Eight logic).

- **Grid Model:** A 12-column fluid grid for desktop and a 4-column fluid grid for mobile. 
- **Consistency:** All margins and paddings must be multiples of 8px. Use 16px (md) for standard card internal padding and 24px (lg) for section spacing.
- **Density:** In data-intensive views, vertical spacing can be reduced to 4px (xs) or 8px (base) to increase information density without sacrificing clarity.

## Elevation & Depth
Depth in this system is achieved through **Tonal Layering** and **Low-Contrast Outlines**.

1.  **Level 0 (Background):** #0f172a.
2.  **Level 1 (Cards/Containers):** #1e293b. Use a subtle 1px border of #334155 to define edges.
3.  **Level 2 (Modals/Popovers):** #334155. These elements should have an ambient, extra-diffused shadow (0px 10px 30px rgba(0,0,0,0.5)) to separate them from the primary UI plane.

Do not use heavy drop shadows on standard cards; rely on the contrast between slate shades to define the hierarchy.

## Shapes
In alignment with the "Round-Eight" philosophy, the design system utilizes a **Rounded** shape language.

- **Standard Elements:** Buttons, input fields, and small cards use a 0.5rem (8px) corner radius.
- **Large Containers:** Main content areas and large feature cards use 1rem (16px) for a softer, more modern profile.
- **Interactive States:** Subtle 1px strokes are applied to shapes to maintain definition on dark screens where shadows are less effective.

## Components

### Buttons
- **Primary:** Solid #22c55e background with #0f172a (dark) text for maximum readability. 8px border radius.
- **Secondary:** Transparent background with a #334155 border and #f8fafc text.
- **Tertiary:** No border or background, #94a3b8 text, turning #f8fafc on hover.

### Input Fields
- **Default:** #1e293b background with a 1px border of #334155. Text is #f8fafc.
- **Focus:** Border changes to #22c55e with a subtle outer glow.

### Cards & Chips
- **Cards:** Background #1e293b. Titles in #f8fafc, body text in #94a3b8.
- **Chips:** Small, 4px rounded shapes. Status chips use a low-opacity background of the status color (e.g., 10% Alpha Red) with a solid colored label for a "muted alert" look.

### Lists
- Row items should be separated by a 1px #1e293b divider. Hovering over a list item should trigger a #334155 background highlight.