---
name: Alimenda Design System
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3d4a3d'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6d7b6c'
  outline-variant: '#bccbb9'
  surface-tint: '#006e2f'
  primary: '#006e2f'
  on-primary: '#ffffff'
  primary-container: '#22c55e'
  on-primary-container: '#004b1e'
  inverse-primary: '#4ae176'
  secondary: '#545f73'
  on-secondary: '#ffffff'
  secondary-container: '#d5e0f8'
  on-secondary-container: '#586377'
  tertiary: '#9d4300'
  on-tertiary: '#ffffff'
  tertiary-container: '#ff8e4d'
  on-tertiary-container: '#6d2d00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6bff8f'
  primary-fixed-dim: '#4ae176'
  on-primary-fixed: '#002109'
  on-primary-fixed-variant: '#005321'
  secondary-fixed: '#d8e3fb'
  secondary-fixed-dim: '#bcc7de'
  on-secondary-fixed: '#111c2d'
  on-secondary-fixed-variant: '#3c475a'
  tertiary-fixed: '#ffdbca'
  tertiary-fixed-dim: '#ffb690'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#783200'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
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
  container-padding: 20px
  stack-sm: 12px
  stack-md: 24px
  gutter: 16px
---

## Brand & Style
The design system focuses on creating a high-trust, low-friction environment for managing food resources. The brand personality is **Fresh, Organized, Reliable, and Minimalist**. It utilizes a **Modern Corporate** aesthetic with a lean toward **Soft Minimalism** to ensure the interface feels lightweight yet structurally sound.

The UI aims to evoke a sense of calm control over household or commercial kitchen chaos. By leveraging heavy whitespace and a restricted color palette, the system directs focus toward high-priority data points like expiration dates and stock levels. The visual language avoids decorative clutter, opting instead for functional clarity and tactile feedback.

## Colors
This design system utilizes a high-contrast palette designed for legibility in various lighting conditions (e.g., bright kitchens or dim pantries).

- **Primary (Fresh Green):** Used for growth, "in-stock" indicators, and primary action buttons.
- **Secondary (Deep Navy):** Reserved for core typography, navigation headers, and grounding structural elements.
- **Tertiary (Alert Orange):** A functional color specifically for low-stock warnings and expiring items.
- **Neutral (Light Gray):** The primary canvas color, used to differentiate surface areas without adding visual weight.

## Typography
The system uses **Inter** for its exceptional legibility and neutral, systematic tone. The type scale is designed to be generous, prioritizing vertical rhythm to prevent data-heavy screens from feeling cramped.

- **Headlines:** Use Bold weights for immediate orientation.
- **Body:** Uses Regular weights with increased line height (1.5x) to ensure inventory lists are easy to scan.
- **Labels:** Small, uppercase, and tracked out for metadata like category tags or "Days Left" indicators.

## Layout & Spacing
The layout follows a **Fluid Grid** model optimized for mobile-first interaction. 

- **Grid:** A 4-column grid for mobile and 12-column for tablet/desktop. 
- **Margins:** A standard 20px safe area on mobile devices to ensure touch targets for side-scrolling elements remain accessible.
- **Rhythm:** An 8pt linear scale governs all spacing. Vertical stacks of inventory cards should use 12px spacing (`stack-sm`) to maintain a tight relationship, while major sections use 24px (`stack-md`).

## Elevation & Depth
Depth is created through **Tonal Layers** combined with **Ambient Shadows**. 

- **Surface Levels:** The background uses the Neutral color (#F8FAFC). Cards and containers are pure white (#FFFFFF) to pop against the base.
- **Shadows:** Use a "Soft Floor" shadow for interactive cards: `0px 4px 12px rgba(30, 41, 59, 0.05)`. This creates a subtle lift without the UI feeling "heavy."
- **Interactive State:** When an item is pressed, it should scale slightly (98%) and the shadow should soften, simulating a physical press into the surface.

## Shapes
The shape language is defined by **Soft Geometric** forms. 

A base roundedness of **16px** (Value 2, `rounded-lg`) is applied to all primary inventory cards and input fields. This high radius reinforces the "Fresh" and "Friendly" brand personality, moving away from the harsh edges of traditional enterprise software. Buttons use a more aggressive **Full Radius (Pill)** to distinguish them as primary action triggers.

## Components
- **Buttons:** Primary buttons are pill-shaped, using the Fresh Green background and White text. They must have a minimum height of 56px for high accessibility.
- **Inventory Cards:** White background, 16px corner radius, and a 1px subtle border (#E2E8F0). Items approaching expiration display a 4px left-border accent in Alert Orange.
- **Chips/Tags:** Used for categories (e.g., "Dairy"). These should use a light tint of the primary or secondary color (10% opacity) with high-contrast text.
- **Input Fields:** Large, 16px rounded containers with "Deep Navy" labels placed above the field. Focus states utilize a 2px Fresh Green stroke.
- **Inventory Progress Bars:** Used to show quantity levels. A thick, 8px rounded track with a high-contrast fill color to show "fullness" at a glance.
- **Icons:** Use a consistent 2pt stroke weight with rounded terminals to match the typography and shape language.