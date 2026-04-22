# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nightglass** is a custom dark/light theme for [Domoticz](https://www.domoticz.com/), an open-source home automation server. The theme is installed by placing `custom.css` and `custom.js` into Domoticz's `www/styles/` directory and selecting "Custom" in the Domoticz theme settings.

There is no build system — the output files are `custom.css` and `custom.js` directly.

## Architecture

### `custom.css`
A single stylesheet (~8300 lines) with numbered sections:

1. **CSS Variable Overrides** — Dark color palette defined as custom properties (`--dz-accent-color: #4e9af1`, `--dz-body-bg: #1b1d25`, etc.). Changing colors should happen here.
   - **1b. Light Mode Variable Overrides** — `body.dz-light` overrides all dark tokens with light equivalents (`#f0f2f5` background, `#1a1c24` text, accent `#2a7de1`, etc.).
2. **Global Resets & Font** — System font stack, custom scrollbars, selection styling.
3. **Navbar** — Dark navbar, dropdown menus, Font Awesome icon integration.
4. **Top Bar** — `#topBar` search field, room selector, and sun-times bar.
5. **Content Panels & Sections**
6. **Device / Widget Cards** — The core card layout with `.dz-card-footer` timestamp bar.
7. **Buttons**
8. **Form Inputs**
9. **Modals & Dialogs**
10. **Sliders** — dim slider, jQuery UI slider.
11. **Data Tables**
12. **Settings / Sub-tabs**
13. **Log Console**
14. **Glassmorphism Cards** — Login, setup wizard, about pages.
15. **Dashboard 2.0** — `dd-` prefixed component classes; also at ~6838 full `dd-widget` styling.
16. **Charts** — Highcharts panel backgrounds.
17. **Tooltips & Popovers**
18. **Accordion Menus**
19. **Mobile & Table Items**
20. **Notifications & Misc** — also contains Event Automation Editor styles (~4567).
21. **Fancy Checkboxes** — dark-friendly toggle switch.
22. **Animations** — CSS keyframes.
23. **Responsive Navbar**
24. **Back-to-Top Button**
25. **Animated Device Icons**
26. **State-Change Flash Animation** — `.dz-flash-on` / `.dz-flash-off`.
27. **3D Card Tilt** — `.dz-tilt-enabled`.
28. **Temperature-Reactive Card Accent** — `.dz-temp-accent`.
30. **Dead Device Staleness Indicator** — `.dz-stale`.
31. **Sparkline Micro-Charts** — `.dz-sparkline-wrap`.
32. **Keyboard Search Overlay** — `#dz-search-overlay` (slash-to-search UI).
- **Update Page** — styled `#updatecontent` with SVG progress ring and themed console.
- **Navbar Keyframe Animations** — staggered entrance via `@keyframes dzNavFadeIn`.
- **Accessibility** — `prefers-reduced-motion` overrides.
- **Light Mode — About/Login overrides** — counteracts hardcoded dark inline styles.
- **Nightglass Theme Settings Panel** — `#ng-settings-panel` and all child components.
- **Domoticz Settings Pages** — `#settingscontent` card-based redesign.
- **Device Detail Pages** — `.page-header-with-button`, `.js-device-logs`, `.js-device-timers`, etc.

### `custom.js`
A single script (~3850 lines) with the following top-level sections (all IIFEs unless noted):

1. **Ace Editor Theme Persistence** — Auto-applies and persists the user's chosen Ace theme on the Events page. Stores preference in `localStorage` under key `dz-ace-theme`.
2. **Highcharts Theme** (`applyHighchartsTheme(isDark)`) — Named function, not an IIFE. Called by the dark/light toggle and on DOMContentLoaded. Applies a full dark or light palette to Highcharts globally.
3. **Logo Replacement** — Swaps Domoticz's default logo with `styles/default/images/ic_launcher.png`.
4. **Dark / Light Mode Toggle** — Injects a sun/moon button (`#dz-theme-style-btn`) into the navbar. Stores preference in `localStorage` under key `dz-theme-style` (values: `'dark'`, `'light'`, `'auto'`). Applies `body.dz-light` class. Responds to OS `prefers-color-scheme` changes when in auto mode.
5. **Font Awesome Icon Replacement System** — The core of the JS:
   - `ICON_MAP` maps PNG filenames → Font Awesome classes for navbar/menu/action icons.
   - `DEVICE_MAP` maps ~90 device types → `{ icon, colorOn, colorOff }` for device state icons.
   - `SKIP_PATTERNS` — array of image src substrings that should NOT be replaced (evohome folder, camera defaults, RGB picker, etc.).
   - `parseDeviceSrc(src)` — regex parser extracting device type and on/off state from filenames (e.g. `Light48_On.png` → `{ device: "Light48", state: "on" }`).
   - `resolveIcon(src)` — resolves final icon + color using DEVICE_MAP, alert levels, wind direction rotation, temperature ranges, and favorite star states.
   - `replaceImage(img)` — replaces a single `<img>` with a `<i>` (Font Awesome) element, copying attributes.
   - `iconMap` — internal `WeakMap`/map for `img → <i>` tracking to support direct updates and orphan cleanup.
   - Two-pass replacement: initial scan on load, then delta updates via `MutationObserver` watching image `src` attribute changes.
   - Burst scheduling (50ms, 200ms, 600ms) to catch Angular's multi-cycle rendering.
   - Hooks into Angular `$routeChangeSuccess` and `$viewContentLoaded` events.
   - Exposes `window._dzScheduleBurst` and `window._dzExtraProcessors` for other modules.
6. **Status-to-BigText Promotion** — If a device card's `#bigtext` cell is empty, promotes the `#status` text into it.
7. **Text Device Card Enhancement** — For "General, Text" devices, truncates long messages in `#bigtext` (max 60 chars) and moves the full text to a scrollable `#status` area.
8. **Timestamp Formatting + Card Footer** — Formats `#lastupdate` timestamps to human-readable ("today 3:42 pm", "yesterday 10:15 am", "Apr 3, 2:00 pm") and pins them into a `.dz-card-footer > .dz-time` element appended to each device card.
9. **Mind-Blowing Features block:**
   - **3D Card Tilt** — Mousemove listener applies `perspective(700px) rotateX/Y` (±3°) on `.dz-tilt-enabled` cards.
   - **Temperature-Reactive Card Accent** — Reads `#bigtext` temperature values and applies a color accent (`--dz-temp-accent-color`) ranging from ice-blue (≤0°C) to red (≥35°C).
   - **Ambient Glow** — On-state device icons get a colored box-shadow glow matching their `colorOn`.
   - **Staleness Indicator** — Device cards with a last-update older than a configurable threshold get `.dz-stale` class.
   - **State-Change Flash** — MutationObserver on icon `src` changes triggers `.dz-flash-on` / `.dz-flash-off` CSS animations.
10. **Update Page Enhancer** — Transforms `#updatecontent` with a spinning FA icon, hides the stock canvas progress bar, and styles the console output.
11. **Sparkline Micro-Charts (Feature 7)** — Calls the Domoticz JSON API for sensor history (temp, counter, %, UV, rain, wind) and injects inline SVG area sparklines into device cards.
12. **Slash-to-Search + Keyboard Tab Shortcuts (Feature 8)** — Press `/` to open a fuzzy-search overlay over all visible device cards. Press `1`–`9` to jump to navbar routes (Dashboard, Switches, Scenes, Temp, Weather, Utility, Cameras, Log, Setup).
13. **Navbar Sliding Indicator** — Injects `.dz-nav-indicator` pill that slides between nav items on hover and snaps back to the active item on mouse-leave.
14. **Nightglass Theme Settings Panel** — Injects a full config UI (`#ng-settings-panel`) into the Domoticz Settings page. Persists all settings as Domoticz user variables (`ngTheme_*`) via the JSON API so they sync across browsers/devices. Exposes `window.dzNightglassSettings.get/set/reset`. Settings include icon toggles, dark/light mode defaults, custom accent/surface/border/text colors (separate dark and light values), card feature flags (tilt, sparklines, staleness, flash, temp accent, animations), layout options (uppercase names, last-update visibility, icon size), and more.

### Angular/jQuery context
Domoticz's frontend is an AngularJS app using jQuery. The `custom.js` script runs in that context and can use `$`, `angular`, and `Highcharts` globals freely.

## Key Conventions

- **Adding a new device icon:** Add an entry to `DEVICE_MAP` in `custom.js`. The key is the filename stem pattern (e.g., `"ChargingStation48"`), and the value is `{ icon: "fa-solid fa-charging-station", colorOn: "#4e9af1", colorOff: "#6c757d" }`.
- **Adding a new navbar/menu icon:** Add an entry to `ICON_MAP` in `custom.js`.
- **Skip list:** Images that should NOT be replaced are in the `SKIP_PATTERNS` array near the top of the icon replacement section.
- **Color states:** Device icons use `colorOn`/`colorOff` from DEVICE_MAP. The CSS class `.dz-fa-device` handles layout; color is applied inline by JS.
- **Wind direction:** The `WIND_ROTATION` map in `custom.js` translates compass direction filenames to CSS `transform: rotate(Ndeg)` applied to the icon.
- **Dark vs light tokens:** Dark-mode colors live in `:root`; light-mode overrides live in `body.dz-light`. Always update both when changing a color role.
- **Settings-controlled features:** Most visual features (tilt, sparklines, staleness, flash, temp accent, etc.) are gated by `window.dzNightglassSettings.get(key)`. Add a new setting to `DEFAULTS` in the settings IIFE, then gate the feature on it.
- **Extra processors:** Register functions in `window._dzExtraProcessors` to have them called on every icon-replacement burst pass (same batch as icon replacement, reducing reflows).
