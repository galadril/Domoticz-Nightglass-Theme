# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Nightglass** is a custom dark theme for [Domoticz](https://www.domoticz.com/), an open-source home automation server. The theme is installed by placing `custom.css` and `custom.js` into Domoticz's `www/styles/` directory and selecting "Custom" in the Domoticz theme settings.

There is no build system — the output files are `custom.css` and `custom.js` directly.

## Architecture

### `custom.css`
A single stylesheet (2500+ lines) with logically grouped sections:

1. **CSS Variable Overrides** — Dark color palette defined as custom properties (`--bg-primary: #1b1d25`, `--surface: #23252f`, accent blue `#4e9af1`, etc.). Changing colors should happen here.
2. **Global Resets & Typography** — System font stack, custom scrollbars, selection styling.
3. **Navbar** — Dark navbar, dropdown menus, Font Awesome icon integration.
4. **Icon CSS Classes** — Four size/context classes used by the JS replacement system:
   - `.dz-fa-icon` — default navbar/menu icons
   - `.dz-fa-trend` — tiny trend arrows
   - `.dz-fa-device` — large 48px device icons (flex layout, on/off color state)
   - `.dz-fa-action` — action icons (delete/rename/add)
   - `.dz-fa-nav` — navigation chevrons
5. **Component Styling** — Panels, tables, forms, buttons, modals, widgets, charts.

### `custom.js`
A single script (690+ lines) with four functional sections:

1. **Highcharts Configuration** — Dark theme applied to all Domoticz charts.
2. **Logo Replacement** — Swaps Domoticz's default logo with `images/ic_launcher.png`.
3. **Font Awesome Icon Replacement System** — The core of the JS:
   - `ICON_MAP` maps PNG filenames → Font Awesome classes for navbar/menu/action icons.
   - `DEVICE_MAP` maps 140+ device types → `{ icon, colorOn, colorOff }` for device state icons.
   - `parseDeviceSrc(src)` — regex parser that extracts device type and on/off state from image filenames (e.g., `Light48_On.png` → `{ device: "Light48", state: "on" }`).
   - `resolveIcon(src)` — resolves final icon + color from filename using DEVICE_MAP, alert levels, wind direction rotation, temperature ranges, and favorite star states.
   - `replaceImage(img)` — replaces a single `<img>` with a `<i>` (Font Awesome) element, copying attributes.
   - Two-pass replacement: initial scan on load, then delta updates via `MutationObserver` watching image `src` attribute changes.
   - Burst scheduling (50ms, 200ms, 600ms) to catch Angular's multi-cycle rendering.
   - Hooks into Angular `$routeChangeSuccess` and `$viewContentLoaded` events.
4. **Status-to-BigText Promotion** — If a device card's bigtext cell is empty, promotes the status text into it.

### Angular/jQuery context
Domoticz's frontend is an AngularJS app using jQuery. The `custom.js` script runs in that context and can use `$`, `angular`, and Highcharts globals freely.

## Key Conventions

- **Adding a new device icon:** Add an entry to `DEVICE_MAP` in `custom.js`. The key is the filename stem pattern (e.g., `"ChargingStation48"`), and the value is `{ icon: "fa-solid fa-charging-station", colorOn: "#4e9af1", colorOff: "#6c757d" }`.
- **Adding a new navbar/menu icon:** Add an entry to `ICON_MAP` in `custom.js`.
- **Skip list:** Images that should NOT be replaced are in the `SKIP_PATTERNS` array near the top of the icon replacement section (e.g., evohome folder, camera defaults, RGB picker).
- **Color states:** Device icons use `colorOn`/`colorOff` from DEVICE_MAP. The CSS class `.dz-fa-device` handles layout; color is applied inline by JS.
- **Wind direction:** The `WIND_ROTATION` map in `custom.js` translates compass direction filenames to CSS `transform: rotate(Ndeg)` applied to the icon.
