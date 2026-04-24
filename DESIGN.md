---
version: alpha
name: Nightglass
description: A glassmorphic dark/light dashboard theme for the Domoticz home automation web interface. Deep navy surfaces, frosted glass overlays, and a vivid blue accent create a focused control-room feel that works day and night.

colors:
  # Backgrounds & surfaces (dark mode defaults)
  background:                  "#1b1d25"
  surface:                     "#23252f"
  surface-dim:                 "#16181f"
  surface-bright:              "#33354a"
  surface-container-lowest:    "#16181f"
  surface-container-low:       "#1e2028"
  surface-container:           "#23252f"
  surface-container-high:      "#2a2b35"
  surface-container-highest:   "#2e3040"
  surface-variant:             "#2a2b35"

  # Text on surfaces
  on-surface:                  "#e2e4ed"
  on-surface-variant:          "#b0b3c6"
  inverse-surface:             "#e2e4ed"
  inverse-on-surface:          "#2a2b35"

  # Borders
  outline:                     "#3a3b47"
  outline-variant:             "#2e3040"
  surface-tint:                "#4e9af1"

  # Primary — interactive blue accent
  primary:                     "#4e9af1"
  on-primary:                  "#ffffff"
  primary-container:           "#2a3050"
  on-primary-container:        "#6db3f8"
  inverse-primary:             "#2a7de1"
  primary-fixed:               "#6db3f8"
  primary-fixed-dim:           "#3d89e0"
  on-primary-fixed:            "#ffffff"
  on-primary-fixed-variant:    "#cfe3fd"

  # Secondary — success / on-state green
  secondary:                   "#4caf7d"
  on-secondary:                "#ffffff"
  secondary-container:         "#1d4a30"
  on-secondary-container:      "#6fcf97"
  secondary-fixed:             "#6fcf97"
  secondary-fixed-dim:         "#3d9e6c"
  on-secondary-fixed:          "#ffffff"
  on-secondary-fixed-variant:  "#b8f0d2"

  # Tertiary — warning amber
  tertiary:                    "#f0a832"
  on-tertiary:                 "#1b1d25"
  tertiary-container:          "#5a3d00"
  on-tertiary-container:       "#ffd080"
  tertiary-fixed:              "#ffd080"
  tertiary-fixed-dim:          "#d99528"
  on-tertiary-fixed:           "#1b1d25"
  on-tertiary-fixed-variant:   "#3a2800"

  # Error — timeout / danger red
  error:                       "#e05555"
  on-error:                    "#ffffff"
  error-container:             "#8b1a23"
  on-error-container:          "#ffb4ab"

  on-background:               "#e2e4ed"

typography:
  display-lg:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 2.5rem
    fontWeight: "700"
    lineHeight: 3rem
    letterSpacing: -0.02em

  headline-lg:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 1.5rem
    fontWeight: "600"
    lineHeight: 2rem
    letterSpacing: -0.01em

  headline-md:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 1.25rem
    fontWeight: "600"
    lineHeight: 1.75rem

  body-lg:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 1rem
    fontWeight: "400"
    lineHeight: 1.5rem

  body-md:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 0.9rem
    fontWeight: "400"
    lineHeight: 1.4rem

  label-lg:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 0.85rem
    fontWeight: "500"
    lineHeight: 1.25rem
    letterSpacing: 0.03em

  label-md:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 0.82rem
    fontWeight: "500"
    lineHeight: 1.2rem

  label-sm:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 0.75rem
    fontWeight: "400"
    lineHeight: 1rem
    letterSpacing: 0.01em

  device-value:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 140%
    fontWeight: "600"
    lineHeight: 1.3

  device-name:
    fontFamily: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 130%
    fontWeight: "500"
    lineHeight: 1.3

rounded:
  sm:      0.25rem
  DEFAULT: 0.5rem
  md:      0.75rem
  lg:      1rem
  xl:      1.25rem
  full:    9999px

spacing:
  unit:              4px
  card-gap:          12px
  card-padding:      8px
  section-margin:    24px
  modal-padding:     20px
  container-padding: 16px
  navbar-height:     54px

components:
  # Device cards — the core dashboard primitive
  device-card:
    backgroundColor: "{colors.surface-container}"
    textColor:       "{colors.on-surface}"
    rounded:         "{rounded.lg}"
    padding:         "{spacing.card-padding}"

  device-card-hover:
    backgroundColor: "{colors.surface-container-highest}"

  device-name-bar:
    backgroundColor: "{colors.surface-container-high}"
    textColor:       "{colors.on-surface}"
    typography:      "{typography.device-name}"

  device-name-bar-hover:
    backgroundColor: "{colors.surface-bright}"
    textColor:       "{colors.on-surface}"

  device-value:
    textColor:  "{colors.on-surface}"
    typography: "{typography.device-value}"

  device-timestamp:
    textColor:  "{colors.on-surface-variant}"
    typography: "{typography.label-sm}"

  # Buttons — Bootstrap .btn variants
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor:       "{colors.on-primary}"
    typography:      "{typography.label-md}"
    rounded:         "{rounded.DEFAULT}"
    height:          36px
    padding:         0 16px

  button-primary-hover:
    backgroundColor: "{colors.primary-fixed-dim}"

  button-default:
    backgroundColor: "{colors.surface-container-high}"
    textColor:       "{colors.on-surface}"
    typography:      "{typography.label-md}"
    rounded:         "{rounded.DEFAULT}"
    height:          36px
    padding:         0 14px

  button-default-hover:
    backgroundColor: "{colors.surface-bright}"

  button-danger:
    backgroundColor: "{colors.error}"
    textColor:       "{colors.on-error}"
    typography:      "{typography.label-md}"
    rounded:         "{rounded.DEFAULT}"
    height:          36px
    padding:         0 14px

  # Small pill buttons (.btnsmall) — device option tabs
  button-small:
    backgroundColor: "{colors.surface-container}"
    textColor:       "{colors.on-surface}"
    typography:      "{typography.label-sm}"
    rounded:         "{rounded.full}"
    padding:         2px 8px

  button-small-active:
    backgroundColor: "{colors.primary-container}"
    textColor:       "{colors.on-primary-container}"

  # Inputs
  input-field:
    backgroundColor: "{colors.surface-container-high}"
    textColor:       "{colors.on-surface}"
    typography:      "{typography.body-md}"
    rounded:         "{rounded.DEFAULT}"
    padding:         8px 12px

  input-field-focus:
    backgroundColor: "{colors.surface-bright}"

  # Navbar
  navbar:
    backgroundColor: "{colors.surface-container}"
    textColor:       "{colors.on-surface}"
    typography:      "{typography.label-lg}"
    height:          54px

  # Modals
  modal:
    backgroundColor: "{colors.surface-container}"
    textColor:       "{colors.on-surface}"
    rounded:         "{rounded.DEFAULT}"
    padding:         "{spacing.modal-padding}"

  modal-header:
    backgroundColor: "{colors.surface-container-high}"
    textColor:       "{colors.on-surface}"
    typography:      "{typography.headline-md}"

  # Glassmorphism panels (login, setup, about)
  glass-panel:
    backgroundColor: "rgba(35, 37, 47, 0.75)"
    textColor:       "{colors.on-surface}"
    rounded:         "{rounded.xl}"
    padding:         "{spacing.modal-padding}"

  # Data tables
  table-row-odd:
    backgroundColor: "{colors.surface-container}"
    textColor:       "{colors.on-surface}"

  table-row-even:
    backgroundColor: "{colors.surface-container-low}"
    textColor:       "{colors.on-surface}"

  table-row-hover:
    backgroundColor: "{colors.surface-bright}"
---

## Overview

Nightglass is a custom dark/light theme for the [Domoticz](https://www.domoticz.com/) home-automation web interface. It replaces the default visual style with a glassmorphic control-room aesthetic: deep navy surfaces, frosted glass overlays on elevated panels, Font Awesome icon replacements for all device imagery, and a vivid blue accent that carries all interactive meaning.

The theme ships as a single `custom.css` and `custom.js` installed into Domoticz's `www/styles/` directory. The JS layer handles icon replacement, a dark/light mode toggle, sparkline micro-charts, ambient device-state glow, and a settings panel that persists configuration to the Domoticz database.

**Mood:** Focused, layered, calm precision. Night-shift friendly. Feels like looking through tinted glass at live sensor data.

**Modes:** Full dark mode by default. Light mode activated by the `body.dz-light` class (toggled by a sun/moon navbar button); every token is overridden in light mode — it is a full peer, not an afterthought.

## Colors

The palette is cool blue-grey across all surface layers. A single warm accent (`primary: #4e9af1`) carries all interactive meaning — links, focus rings, active borders, and on-state icon color. Semantic colors (green success, amber warning, red error) are purposefully desaturated to remain readable at a glance without dominating.

Surface depth is achieved by stepping through `surface-container-*` levels, not by varying hue. Each level is exactly one visual step lighter than the last.

**Light mode** mirrors every token with an inverted palette (`#f0f2f5` background, `#1a1c24` text, accent `#2a7de1`). The `primary` accent shifts slightly toward a deeper, more legible blue on light backgrounds.

**Status accent colours** (applied to the device card name bar, not text):

| State | Dark | Light |
|---|---|---|
| Normal | `surface-container-high` | `surface-container` |
| Protected | `primary-container` | `primary-fixed` |
| Timeout | `error` | `error` |
| Low battery | `tertiary` | `tertiary` |
| Disabled | `outline` | `outline-variant` |

## Typography

The theme uses the native OS system font stack exclusively. No web fonts are loaded — zero layout shift, zero latency, and text renders in the typeface the user's OS and browser already anti-aliases beautifully.

```
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif
```

`-webkit-font-smoothing: antialiased` is set on `body` — essential on dark backgrounds where default subpixel rendering adds unwanted colour fringing.

Device value readings (`device-value`, 140% relative) are the visual focal point of each card. Device name bars (`device-name`, 130%) provide secondary identity. Supporting labels and timestamps recede using `on-surface-variant` color and `label-sm` size.

Numbers in live sensor readings benefit from `font-variant-numeric: tabular-nums` to prevent layout jitter on rapid updates.

## Layout

The Domoticz Bootstrap 2 grid is preserved intact. The theme adds spacing consistency and card-gap rhythm on top without altering column math.

**Spacing base unit:** 4px. All spacing values are multiples.

**Card grid:** `display: flex; flex-wrap: wrap` with `card-gap: 12px`. Cards have a minimum width (~140px) allowing 2 columns on mobile and 4–6 on desktop.

**Navbar:** Fixed height `54px`. Top bar (room selector, sun/rise times) sits directly beneath with no overlap.

**Z-index layers:**

| Layer | z-index | Elements |
|---|---|---|
| Base content | 0–9 | Cards, tables |
| Sticky chrome | 100 | Top bar, card footer |
| Dropdowns | 1000 | Navbar menus |
| Modals | 1050 | Dialog overlays |
| Settings panel | 1100 | `#ng-settings-panel` |
| Search overlay | 1200 | `#dz-search-overlay` |

## Elevation & Depth

Four elevation levels. Each step adds one visual cue — never all at once.

| Level | Surface token | Shadow | Backdrop blur | Use |
|---|---|---|---|---|
| 0 — Sunken | `surface-container-low` / `surface-container-lowest` | none | none | Table rows, inset zones |
| 1 — Flat | `surface-container` | `0 2px 8px rgba(0,0,0,0.25)` | none | Device cards, navbar |
| 2 — Raised | `surface-container-high` | `0 4px 16px rgba(0,0,0,0.35)` | none | Dropdowns, tooltips |
| 3 — Floating | `glass-panel` (`rgba(surface, 0.75)`) | `0 8px 32px rgba(0,0,0,0.45)` | `blur(14px) saturate(1.15)` | Modals, settings panel, login |

Backdrop blur is reserved exclusively for Level 3 elements that truly float over content. It is **never** applied to device cards — cards update on a live timer and blur recalculates on every repaint, causing jank on Raspberry Pi class hardware.

On-state device icons emit an ambient glow: a `box-shadow` on the `<i>` icon element in the icon's `colorOn` tint at 4–6px spread. This is the only decorative depth effect applied to individual cards.

## Shapes

Corner radius increases with elevation, reflecting an organic tactile language where floating elements feel softer than grounded ones.

| Token | Value | Applied to |
|---|---|---|
| `rounded.sm` | 0.25rem (4px) | Tight inline badges, status chips |
| `rounded.DEFAULT` | 0.5rem (8px) | Buttons, inputs, modal corners |
| `rounded.md` | 0.75rem (12px) — also `--dz-widget-border-radius` | Device cards |
| `rounded.lg` | 1rem (16px) | Settings panel sections |
| `rounded.xl` | 1.25rem (20px) | Glassmorphism panels (login, about) |
| `rounded.full` | 9999px | Small pill buttons (`.btnsmall`), toggle switches |

## Components

**Device cards** are the primary UI primitive. Each card contains a name bar (surface-container-high background), a content area (icon + value + status), and a pinned timestamp footer. Hover shifts both the card body and name bar one surface step lighter, and the name bar border flips to `primary` accent color. On-state icons receive a colored glow. Optionally: 3D perspective tilt on mousemove (±3°), temperature-reactive hue accent, and sparkline SVG micro-charts.

**Icons** are Font Awesome solid/outline elements injected by JS to replace all `<img>` device images. Icon color is `primary` (on) or `on-surface-variant` (off). Size inherits from a CSS variable (`--ng-icon-scale`) so the user's icon-size setting works globally.

**Buttons** follow three systems inherited from Domoticz: Bootstrap `.btn*`, custom `.btnstyle*` (switches/scenes), and `.btnsmall` pills (device option tabs). All share the same visual language: surface-container-high fill, outline border, 8px radius (or `full` for pills). Primary actions use `primary` fill. Hover lightens one surface step; active darkens slightly with an inset shadow.

**Navbar** uses a sliding indicator pill (`dz-nav-indicator`) that animates between nav items on hover and snaps to the active item on mouse-leave. Collapse to hamburger below 768px.

**Glassmorphism panels** (login, setup wizard, about pages) sit at Level 3 elevation: `backdrop-filter: blur(14px) saturate(1.15)`, semi-transparent `surface` background, 1px `outline` border. Used only on full-screen landing contexts — never on the live dashboard.

**Settings panel** (`#ng-settings-panel`) slides in from the right on the Domoticz Settings page. Sections use `rounded.lg` containers with `surface-container-high` backgrounds. Controls (color pickers, toggles, selects) are right-aligned; labels and descriptions are left-aligned; a `outline-variant` border separates each row.

## Do's and Don'ts

### Do
- Use `--dz-*` CSS variable tokens for all color decisions — hardcoded hex values break the dark/light toggle
- Use Font Awesome `<i>` classes for all device icons — the JS replacement layer manages them; never add `<img>` tags back into card contexts
- Scope custom selectors to a specific container (`#holder .item`, `#maindiv .card`) rather than bare global selectors
- Update both dark (`:root`) and light (`body.dz-light`) token blocks whenever a new color role is introduced
- Respect `prefers-reduced-motion` — all keyframe animations and transitions have reduced-motion overrides
- Keep cards data-dense — this is a live dashboard, not a marketing page; every pixel should carry information or reinforce hierarchy

### Don't
- Don't use `!important` on variable-driven properties — it defeats the token contract; reserve `!important` only for overriding Domoticz's own legacy inline styles
- Don't apply `backdrop-filter` to device cards — live update cycles cause continuous repaint on blur-composited layers; this is severe on ARM hardware
- Don't override Bootstrap's `.row-fluid`, `.span*`, or `.container-fluid` globally — scope all layout overrides to specific parent containers
- Don't load web fonts — the system font stack is zero-latency and intentional
- Don't use gradients on individual device cards — a subtle gradient on the page body background is fine; repeating it across 50+ cards wastes GPU fill-rate
- Don't hardcode dark-only colours in shared component rules — always pair a `:root` override with a `body.dz-light` override
