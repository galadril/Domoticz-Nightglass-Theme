# Icon Replacement System — Documentation

## Overview

`src/js/icons.js` replaces every `<img>` Domoticz renders with a Font Awesome `<i>` element.
The original `<img>` is hidden (kept in place for event delegation and state tracking).
Replacement runs in multiple passes: on load, after Angular route changes, and via `MutationObserver` on img `src` attribute changes.

---

## 1. What is replaced

Replacement happens for three categories of image:

### 1a. Navbar / UI icons — `ICON_MAP`

Key is a substring matched against `img.src`. These are static, stateless icons.

| PNG src substring | FA class |
|---|---|
| `images/desktop.png` | `fa-solid fa-gauge` |
| `images/house.png` | `fa-solid fa-house` |
| `images/lightbulb.png` | `fa-solid fa-lightbulb` |
| `images/lightbulboff.png` | `fa-regular fa-lightbulb` |
| `images/scenes.png` | `fa-solid fa-layer-group` |
| `images/temperature.png` | `fa-solid fa-temperature-half` |
| `images/rain.png` | `fa-solid fa-cloud-rain` |
| `images/utility.png` | `fa-solid fa-bolt` |
| `images/setup.png` | `fa-solid fa-gear` |
| `images/hardware.png` | `fa-solid fa-microchip` |
| `images/devices.png` | `fa-solid fa-sliders` |
| `images/energy.png` | `fa-solid fa-charging-station` |
| `images/users.png` | `fa-solid fa-users` |
| `images/update.png` | `fa-solid fa-download` |
| `images/log.png` | `fa-solid fa-terminal` |
| `images/about.png` | `fa-solid fa-circle-info` |
| `images/logout.png` | `fa-solid fa-right-from-bracket` |
| `images/restart.png` | `fa-solid fa-rotate-right` |
| `images/shutdown.png` | `fa-solid fa-power-off` |
| `images/events.png` | `fa-solid fa-code` |
| `images/customicons.png` | `fa-solid fa-icons` |
| `images/variables.png` | `fa-solid fa-list` |
| `images/contact.png` | `fa-solid fa-share-nodes` |
| `images/camera-web.png` | `fa-solid fa-video` |
| `images/security.png` | `fa-solid fa-shield-halved` |
| `images/notification.png` | `fa-solid fa-bell` |
| `images/floorplans.png` | `fa-solid fa-map` |
| `images/report.png` | `fa-solid fa-chart-bar` |
| `images/delete.png` | `fa-solid fa-trash-can` |
| `images/rename.png` | `fa-solid fa-pen-to-square` |
| `images/add.png` | `fa-solid fa-plus` |
| `images/webcam.png` | `fa-solid fa-video` |
| `images/override.png` | `fa-solid fa-sliders` |
| `images/next.png` | `fa-solid fa-chevron-right` |
| `images/capture.png` | `fa-solid fa-camera` |
| `images/location.png` | `fa-solid fa-location-dot` |
| `images/arrow_up.png` | `fa-solid fa-arrow-trend-up` |
| `images/arrow_down.png` | `fa-solid fa-arrow-trend-down` |
| `images/arrow_stable.png` | `fa-solid fa-right-long` |
| `images/arrow_unk.png` | `fa-solid fa-question dz-trend-unk` |
| `images/blindsstop.png` | `fa-solid fa-stop` |
| `images/up.png` | `fa-solid fa-arrow-up` |
| `images/down.png` | `fa-solid fa-arrow-down` |
| `images/remove.png` | `fa-solid fa-circle-minus` |
| `images/ok.png` | `fa-solid fa-circle-check` |
| `images/failed.png` | `fa-solid fa-circle-xmark` |
| `images/unknown.png` | `fa-solid fa-circle-question` |
| `images/sleep.png` | `fa-solid fa-moon` |
| `images/heal.png` | `fa-solid fa-heart-pulse` |
| `images/battery-ok.png` | `fa-solid fa-battery-full dz-batt-ok` |
| `images/battery-low.png` | `fa-solid fa-battery-quarter dz-batt-low` |
| `images/battery.png` | `fa-solid fa-battery-half dz-batt-mid` |
| `images/air_signal.png` | `fa-solid fa-signal` |
| `images/equal.png` | `fa-solid fa-minus` |
| `images/gup.png` | `fa-solid fa-arrow-trend-up` |
| `images/gdown.png` | `fa-solid fa-arrow-trend-down` |
| `images/gequal.png` | `fa-solid fa-minus` |

**Priority note:** ICON_MAP is checked *before* the device parser. This prevents e.g. `rain.png` from matching the `rain` device entry.

### 1b. Favorite star icons — `FAV_MAP`

| PNG src substring | FA class |
|---|---|
| `images/nofavorite.png` | `fa-regular fa-star dz-fa-fav dz-fav-off` |
| `images/favorite.png` | `fa-solid fa-star dz-fa-fav dz-fav-on` |

### 1c. Device / widget icons — `DEVICE_MAP`

Matched by parsing the filename: `images/Light48_On.png` → base=`light`, state=`on`.
The regex is: `/images\/([A-Za-z]+)(?:48)?(?:[_-]?(On|Off|on|off|sel))?\.png/`

These are state-aware: `colorOn` is used when state=`on` (or no state), `colorOff` when state=`off`.

| DEVICE_MAP key (base name) | FA class | colorOn | colorOff |
|---|---|---|---|
| `light` | `fa-solid fa-lightbulb` | `#f0a832` | `#555770` |
| `dimmer` | `fa-solid fa-circle-half-stroke` | `#f0a832` | `#555770` |
| `glight` | `fa-solid fa-lightbulb` | `#4caf7d` | `#555770` |
| `strip` | `fa-solid fa-grip-lines` | `#c8a0ff` | `#555770` |
| `rgb` | `fa-solid fa-palette` | `#c8a0ff` | `#555770` |
| `generic` | `fa-solid fa-toggle-on` | `#4caf7d` | `#555770` |
| `push` | `fa-solid fa-circle-dot` | `#4e9af1` | `#555770` |
| `onoff` | `fa-solid fa-power-off` | null | null |
| `pushon` | `fa-solid fa-circle-dot` | `#4e9af1` | null |
| `contact` | `fa-solid fa-door-closed` | `#e05555` | `#4caf7d` |
| `door` | `fa-solid fa-door-open` | `#e05555` | `#4caf7d` |
| `window` | `fa-solid fa-window-maximize` | `#e05555` | `#4caf7d` |
| `blinds` | `fa-solid fa-chevron-down` | `#4e9af1` | `#555770` |
| `blindsopen` | `fa-solid fa-chevron-up` | `#4e9af1` | `#555770` |
| `heating` | `fa-solid fa-fire` | `#e05555` | `#555770` |
| `cooling` | `fa-solid fa-snowflake` | `#29b6f6` | `#555770` |
| `radiator` | `fa-solid fa-fire-flame-curved` | `#e05555` | `#555770` |
| `fireplace` | `fa-solid fa-fire` | `#ff7043` | `#555770` |
| `fan` | `fa-solid fa-fan` | `#4e9af1` | `#555770` |
| `ac` | `fa-solid fa-snowflake` | `#29b6f6` | `#555770` |
| `ehome` | `fa-solid fa-house-chimney` | `#4caf7d` | `#555770` |
| `water` | `fa-solid fa-droplet` | `#29b6f6` | `#555770` |
| `tap` | `fa-solid fa-faucet` | `#29b6f6` | `#555770` |
| `irrigation` | `fa-solid fa-hand-holding-droplet` | `#4caf7d` | `#555770` |
| `pool` | `fa-solid fa-water-ladder` | `#29b6f6` | `#555770` |
| `pump` | `fa-solid fa-pump-soap` | `#4e9af1` | `#555770` |
| `solar` | `fa-solid fa-solar-panel` | `#f0a832` | `#555770` |
| `pv` | `fa-solid fa-solar-panel` | `#f0a832` | null |
| `inverter` | `fa-solid fa-bolt` | `#f0a832` | `#555770` |
| `charger` | `fa-solid fa-charging-station` | `#4caf7d` | `#555770` |
| `laadpaal` | `fa-solid fa-charging-station` | `#4caf7d` | `#555770` |
| `wallsocket` | `fa-solid fa-plug` | `#4caf7d` | `#555770` |
| `current` | `fa-solid fa-bolt` | `#f0a832` | null |
| `tv` | `fa-solid fa-tv` | `#4e9af1` | `#555770` |
| `media` | `fa-solid fa-play` | `#4e9af1` | `#555770` |
| `speaker` | `fa-solid fa-volume-high` | `#4e9af1` | `#555770` |
| `amplifier` | `fa-solid fa-volume-high` | `#c8a0ff` | `#555770` |
| `logitechmediaserver` | `fa-solid fa-music` | `#4caf7d` | `#555770` |
| `remote` | `fa-solid fa-gamepad` | null | null |
| `computer` | `fa-solid fa-display` | `#4e9af1` | `#555770` |
| `computerpc` | `fa-solid fa-computer` | `#4e9af1` | `#555770` |
| `harddisk` | `fa-solid fa-hard-drive` | `#4e9af1` | `#555770` |
| `phone` | `fa-solid fa-phone` | `#4caf7d` | `#555770` |
| `printer` | `fa-solid fa-print` | `#4e9af1` | `#555770` |
| `alarm` | `fa-solid fa-bell` | `#e05555` | `#555770` |
| `smoke` | `fa-solid fa-triangle-exclamation` | `#e05555` | `#555770` |
| `motion` | `fa-solid fa-person-running` | `#e05555` | `#555770` |
| `security` | `fa-solid fa-shield-halved` | null | null |
| `coffee` | `fa-solid fa-mug-hot` | `#ff7043` | `#555770` |
| `washingmachine` | `fa-solid fa-shirt` | `#4e9af1` | `#555770` |
| `christmastree` | `fa-solid fa-tree` | `#4caf7d` | `#555770` |
| `temp` | `fa-solid fa-temperature-half` | `#e05555` | null |
| `humidity` | `fa-solid fa-droplet` | `#29b6f6` | `#555770` |
| `baro` | `fa-solid fa-gauge` | `#4e9af1` | null |
| `rain` | `fa-solid fa-cloud-showers-heavy` | `#29b6f6` | `#555770` |
| `wind` | `fa-solid fa-wind` | `#b0b3c6` | null |
| `uv` | `fa-solid fa-sun` | `#f0a832` | null |
| `lux` | `fa-solid fa-sun` | `#f0a832` | null |
| `visibility` | `fa-solid fa-eye` | `#b0b3c6` | null |
| `radiation` | `fa-solid fa-radiation` | `#e05555` | null |
| `gauge` | `fa-solid fa-gauge` | `#4e9af1` | null |
| `counter` | `fa-solid fa-hashtag` | `#4e9af1` | null |
| `percentage` | `fa-solid fa-percent` | `#4e9af1` | null |
| `scale` | `fa-solid fa-scale-balanced` | `#b0b3c6` | null |
| `gas` | `fa-solid fa-gas-pump` | `#f0a832` | null |
| `leaf` | `fa-solid fa-leaf` | `#4caf7d` | null |
| `moisture` | `fa-solid fa-hand-holding-droplet` | `#29b6f6` | null |
| `soil` | `fa-solid fa-seedling` | `#4caf7d` | `#555770` |
| `air` | `fa-solid fa-wind` | `#b0b3c6` | null |
| `airmeasure` | `fa-solid fa-lungs` | `#4e9af1` | `#555770` |
| `sun` | `fa-solid fa-sun` | `#f0a832` | `#555770` |
| `victron` | `fa-solid fa-car-battery` | `#4caf7d` | `#555770` |
| `doorlock` | `fa-solid fa-lock` | `#4caf7d` | `#e05555` |
| `doorlockcontact` | `fa-solid fa-lock` | `#4caf7d` | `#e05555` |
| `smartmeter` | `fa-solid fa-bolt` | `#f0a832` | null |
| `p1smartmeter` | `fa-solid fa-bolt` | `#f0a832` | null |
| `electricityusage` | `fa-solid fa-bolt` | `#f0a832` | null |
| `airquality` | `fa-solid fa-smog` | `#f0a832` | null |
| `pm25` | `fa-solid fa-smog` | `#f0a832` | null |
| `co2` | `fa-solid fa-cloud` | `#f0a832` | null |
| `co` | `fa-solid fa-cloud` | `#e05555` | null |
| `leaksensor` | `fa-solid fa-droplet` | `#e05555` | `#4caf7d` |
| `flood` | `fa-solid fa-droplet` | `#e05555` | `#4caf7d` |
| `curtain` | `fa-solid fa-table-columns` | `#4e9af1` | `#555770` |
| `presence` | `fa-solid fa-circle-dot` | `#e05555` | `#555770` |
| `pir` | `fa-solid fa-person-running` | `#e05555` | `#555770` |
| `text` | `fa-solid fa-align-left` | `#b0b3c6` | null |
| `alert` | `fa-solid fa-circle-exclamation` | `#e05555` | null |
| `clock` | `fa-solid fa-clock` | `#4e9af1` | `#555770` |
| `mode` | `fa-solid fa-sliders` | `#4e9af1` | null |
| `doorbell` | `fa-solid fa-bell` | `#f0a832` | null |
| `adjust` | `fa-solid fa-sliders` | `#4e9af1` | null |
| `custom` | `fa-solid fa-gear` | `#b0b3c6` | `#555770` |
| `scene` | `fa-solid fa-layer-group` | `#4caf7d` | `#555770` |
| `group` | `fa-solid fa-layer-group` | `#4caf7d` | `#555770` |

### 1d. Temperature range icons — `TEMP_COLORS`

These are filename-matched (no regex parsing needed), always device-size.

| PNG filename | FA class | Color |
|---|---|---|
| `ice.png` | `fa-solid fa-snowflake` | `#29b6f6` |
| `temp-0-5.png` | `fa-solid fa-temperature-empty` | `#29b6f6` |
| `temp-5-10.png` | `fa-solid fa-temperature-quarter` | `#4caf7d` |
| `temp-10-15.png` | `fa-solid fa-temperature-low` | `#4caf7d` |
| `temp-15-20.png` | `fa-solid fa-temperature-half` | `#f0a832` |
| `temp-20-25.png` | `fa-solid fa-temperature-three-quarters` | `#ff7043` |
| `temp-25-30.png` | `fa-solid fa-temperature-high` | `#e05555` |
| `temp-gt-30.png` | `fa-solid fa-temperature-full` | `#e05555` |

### 1e. Alert level icons

Matched by regex `/images\/Alert48_(\d)\.png/i`.

| Level | Color |
|---|---|
| 0 | `#8a8a8a` |
| 1 | `#4caf7d` |
| 2 | `#f0a832` |
| 3 | `#ff7043` |
| 4 | `#e05555` |

Always uses `fa-solid fa-circle-exclamation`.

### 1f. Wind direction icons

Matched by regex `/images\/Wind([A-Z]{1,3})\.png/`. Icon is `fa-solid fa-arrow-up` rotated via CSS `transform: rotate(Ndeg)`.

`Wind0.png` and `wind48.png` (calm) → `fa-solid fa-wind`, color `#b0b3c6`.

---

## 2. What is NOT replaced — `shouldSkip()`

These image src patterns are skipped and the original PNG is kept:

| Pattern | Reason |
|---|---|
| `images/evohome/` | Evohome zone icons (complex, zone-specific) |
| `Coltemp48` | Color temperature picker (visual slider) |
| `White48` | White-balance control image |
| `Customw48` / `Customww48` | Custom white channel images |
| `RGB48_Sel` / `RGB48.png` | RGB color wheel (visual, not replaceable) |
| `Up48` / `Down48` / `Stop48` | Blinds directional arrows (Domoticz built-in, use separate blinds logic) |
| `uvdark` / `uvsunny` | Dusk sensor day/night images |
| `siren-` | X10 Siren on/off images |
| `camera_default` | Default camera placeholder |
| `empty16` | Empty/spacer images |
| Angular template bindings (`{{`) | Not yet resolved by Angular |
| Inside `.dd-options`, `.dd-select`, `.iconlist` | Icon-picker dropdowns in the Edit Device dialog |

---

## 3. How `resolveIcon(src)` works — resolution order

1. Check `FAV_MAP` — favorite star images
2. Check `ICON_MAP` — explicit navbar/action/status images (has priority over device parser)
3. Run `parseDeviceSrc(src)` — extract base name and on/off state from filename, look up in `DEVICE_MAP`
4. Check `ALERT_RE` — `Alert48_N.png` alert level icons
5. Check wind direction regex — `WindN.png` compass icons
6. Check `Wind0.png` / `wind48.png` — calm wind
7. Check `TEMP_KEYS` — temperature range icons
8. Return `null` — image is skipped

---

## 4. How the dialog shows "default" icons — `_dzIconForDevice(device)`

`window._dzIconForDevice` is exposed by `icons.js` (line 1304) for the icon override dialog to call. It takes a Domoticz device API object and tries to predict which FA icon the replacement system will render, so the dialog can preview the "current default" next to each device.

It does this by **constructing a synthetic `src` string** from device properties, then running `resolveIcon()` on it, mirroring `dzLightWidget.js::getDeviceIcon()`.

### Special-case handling in `_dzIconForDevice`

| Condition | Synthetic src used |
|---|---|
| `SwitchType == 'Doorbell'` | `images/doorbell48.png` |
| Any Blinds switch type | `images/{TypeImg}open48sel.png` |
| `SwitchType == 'Smoke Detector'` | `images/smoke48on.png` |
| `SwitchType == 'Motion Sensor'` | `images/motion48-on.png` |
| `SwitchType == 'Dusk Sensor'` | Returns `lux` spec directly (uvdark/uvsunny are skipped) |
| `SubType == 'Security Panel'` | `images/security48.png` |
| `SwitchType == 'X10 Siren'` | Returns `alarm` spec directly (siren-on/off are skipped) |
| `SwitchType == 'TPI'` | `images/Fireplace48_On.png` |
| Fan subtypes (Itho, Orcon, Lucci, Falmec, Westinghouse) | `images/Fan48_On.png` |
| `Type == 'Security'` | `images/security48.png` |
| Door Lock / Door Lock Inverted | `images/{Image}48_On.png` |
| Contact / Door Contact | `images/{Image}48_On.png` |
| `Type == 'Scene'` | Returns `scene` spec directly |
| `Type == 'Group'` | Returns `group` spec directly |
| No SwitchType (sensors/meters) | Looks up `TypeImg` in DEVICE_MAP with alias normalisation, or `images/{TypeImg}48.png` |
| Standard switches | `images/{Image}48_On.png` (capitalised when `CustomImage==0`) |

---

## 5. Known mismatches between dialog defaults and actual Domoticz rendering

The dialog uses `_dzIconForDevice()` which mirrors `dzLightWidget.getDeviceIcon()`. However, **utility/sensor devices use `dzUtilityWidget.getDeviceIcon()` in Domoticz**, which has its own filename logic that `_dzIconForDevice` only partially replicates via the TypeImg fallback. This causes several mismatches:

### Humidity devices — FIXED
- **Was:** `fa-solid fa-droplet` (via DEVICE_MAP alias `hum` → `humidity`)
- **Now / Domoticz renders:** `fa-solid fa-gauge` (`dzUtilityWidget` returns `gauge48.png` for `device.Type === 'Humidity'`)
- **Fix:** Added explicit `type === 'Humidity'` branch before the TypeImg lookup.

### Blinds devices with non-standard TypeImg — FIXED
- **Was:** `fa-circle-question` fallback (constructed `images/{TypeImg}open48sel.png` where TypeImg is not `blinds`)
- **Now / Domoticz renders:** `fa-solid fa-chevron-up` (`dzLightWidget` always uses `blindsopen48sel.png` regardless of TypeImg)
- **Fix:** Hardcoded `images/blindsopen48sel.png` instead of using TypeImg.

### Utility sensors looked up via TypeImg
- `_dzIconForDevice` constructs `images/{TypeImg}48.png` and runs `resolveIcon()`
- `dzUtilityWidget.getDeviceIcon()` uses specific `SwitchTypeVal`, `SubType`, and `Type` checks to pick filenames
- Filenames like `Gas48.png`, `Water48_On.png`, `Counter48.png`, `PV48.png`, `current48.png`, `air48.png`, `Percentage48.png` etc. are all hardcoded by Domoticz based on counters/SubType — not derived from TypeImg
- If `TypeImg` matches one of those names (e.g. `TypeImg = 'counter'`), it works. If it doesn't match (e.g. TypeImg is `'elec'` but SwitchTypeVal selects `current48.png`), the dialog shows the wrong default.

### What the actual replacement sees
The MutationObserver and initial scan processes the **actual `img.src`** that Domoticz's Angular app sets in the DOM — which comes from `dzLightWidget.getDeviceIcon()` or `dzUtilityWidget.getDeviceIcon()`. This is always correct. The only thing that can be wrong is the **dialog preview** of the default icon.

---

## 6. `resolveIcon()` resolution for key Domoticz filenames

This table maps the actual filenames Domoticz puts in the DOM to what the replacement system produces:

| Actual img.src (from Domoticz) | Parsed base | FA result |
|---|---|---|
| `images/Light48_On.png` | `light` | `fa-solid fa-lightbulb` (amber) |
| `images/Light48_Off.png` | `light` | `fa-solid fa-lightbulb` (grey) |
| `images/Fan48_On.png` | `fan` | `fa-solid fa-fan` (blue) |
| `images/doorbell48.png` | `doorbell` | `fa-solid fa-bell` (amber) |
| `images/blindsopen48sel.png` | `blindsopen`, state=`on` | `fa-solid fa-chevron-up` (blue) |
| `images/blinds48sel.png` | `blinds`, state=`on` | `fa-solid fa-chevron-down` (blue) |
| `images/smoke48on.png` | `smoke`, state=`on` | `fa-solid fa-triangle-exclamation` (red) |
| `images/motion48-on.png` | `motion`, state=`on` | `fa-solid fa-person-running` (red) |
| `images/security48.png` | `security` | `fa-solid fa-shield-halved` |
| `images/Fireplace48_On.png` | `fireplace`, state=`on` | `fa-solid fa-fire` (orange) |
| `images/gas48.png` | `gas` | `fa-solid fa-gas-pump` (amber) |
| `images/Water48_On.png` | `water`, state=`on` | `fa-solid fa-droplet` (blue) |
| `images/Counter48.png` | `counter` | `fa-solid fa-hashtag` (blue) |
| `images/PV48.png` | `pv` | `fa-solid fa-solar-panel` (amber) |
| `images/current48.png` | `current` | `fa-solid fa-bolt` (amber) |
| `images/air48.png` | `air` | `fa-solid fa-wind` (grey-blue) |
| `images/Percentage48.png` | `percentage` | `fa-solid fa-percent` (blue) |
| `images/leaf48.png` | `leaf` | `fa-solid fa-leaf` (green) |
| `images/visibility48.png` | `visibility` | `fa-solid fa-eye` (grey-blue) |
| `images/text48.png` | `text` | `fa-solid fa-align-left` (grey) |
| `images/Alert48_0.png` – `Alert48_4.png` | alert regex | `fa-solid fa-circle-exclamation` (level color) |
| `images/gauge48.png` | `gauge` | `fa-solid fa-gauge` (blue) |
| `images/lux48.png` | `lux` | `fa-solid fa-sun` (amber) |
| `images/scale48.png` | `scale` | `fa-solid fa-scale-balanced` (grey-blue) |
| `images/clock48.png` | `clock` | `fa-solid fa-clock` (blue) |
| `images/mode48.png` | `mode` | `fa-solid fa-sliders` (blue) |
| `images/Speaker48_On.png` | `speaker`, state=`on` | `fa-solid fa-volume-high` (blue) |
| `images/moisture48.png` | `moisture` | `fa-solid fa-hand-holding-droplet` (blue) |
| `images/radiation48.png` | `radiation` | `fa-solid fa-radiation` (red) |
| `images/Rain48_On.png` | `rain`, state=`on` | `fa-solid fa-cloud-showers-heavy` (blue) |
| `images/uv48.png` | `uv` | `fa-solid fa-sun` (amber) |
| `images/WindN.png` / `WindS.png` etc. | wind direction regex | `fa-solid fa-arrow-up` rotated |
| `images/wind48.png` | special case | `fa-solid fa-wind` (grey-blue) |
| `images/temp-0-5.png` etc. | TEMP_KEYS match | temperature-range icon |
| `images/ice.png` | TEMP_KEYS match | `fa-solid fa-snowflake` (blue) |
| `images/RGB48_On.png` / `RGB48_Off.png` | **SKIPPED** | original PNG kept |
| `images/uvdark.png` / `images/uvsunny.png` | **SKIPPED** | original PNG kept |
| `images/siren-on.png` / `images/siren-off.png` | **SKIPPED** | original PNG kept |
| `images/Up48.png` / `images/Down48.png` / `images/Stop48.png` | **SKIPPED** | original PNG kept |

---

## 7. Adding coverage

- **New device icon:** Add entry to `DEVICE_MAP` in `src/js/icons.js`. Key must be the lowercase base name extracted from the PNG filename by the regex (strip `48`, `_On`, `_Off`, etc.).
- **New static UI icon:** Add entry to `ICON_MAP`.
- **Fix a dialog default mismatch:** Update `_dzIconForDevice()` in `icons.js` to add the missing case, mirroring the relevant `dzUtilityWidget.getDeviceIcon()` or `dzLightWidget.getDeviceIcon()` branch.
