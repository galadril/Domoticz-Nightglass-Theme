/* ══════════════════════════════════════════════════════════════════
   DEVICE ICON — Nightglass takeover of the native icon pickers
   ──────────────────────────────────────────────────────────────────
   Domoticz lets you set a device icon in two places:

     1. Setup ▸ Devices ▸ a device — Angular <device-icon-select>
        (ng-model vm.device.CustomImage; persisted by the page's Save).
     2. The Utility "edit device" jQuery-UI dialogs — #combosensoricon
        (persisted by the dialog's Update button, which reads
        $.ddData[selectedIndex].value → &customimage=).

   Nightglass replaces both with ONE control, and that control is
   deliberately the shape Domoticz itself settled on for its native
   picker: the current icon at 28px, then a small "Change…" button.
   Same markup, same class names (.dz-icon-field / -preview / -btn), so
   on a Domoticz that ships the native picker our field is visually the
   native field — only the button routes to Nightglass's Icon Studio
   instead of Domoticz's own dialog. On a Domoticz without it, the theme
   CSS supplies the same appearance from scratch.

   "Use default" sits in the field rather than inside the Studio: the
   Studio is shared with the settings panel's device-icon editor, where
   "default" means nothing, and keeping the reset next to the preview
   puts the state and the action that clears it in one place.

   The native combo / picker stays in the DOM (hidden) purely as the
   persistence bridge: we drive its selection / ng-model, so Domoticz's
   own Save / Update code writes CustomImage exactly as before.
   ══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    /* Mark the document as managed as early as this module executes (well
       before any device page / utility dialog renders). CSS keys off this to
       hide the native icon combos from first paint, so the user never sees the
       old combo flash in and get swapped out. If this module somehow doesn't
       run, the class is absent and the native combos show as a fallback. */
    document.documentElement.classList.add('ng-dd-icons-managed');

    var BOX_ID = 'ng-dd-icon-box';
    var _customSet = null;   // getcustomiconset result cache (uploaded icons)
    var _devByIdx  = {};     // idx → device object (utility-dialog fetch cache)

    function settings() { return window.dzNightglassSettings || null; }
    function jq()       { return window.jQuery || window.$ || null; }

    function injector() {
        try {
            return (window.angular && angular.element(document.body).injector()) || null;
        } catch (e) { return null; }
    }

    /* ── Where an icon choice is stored ───────────────────────────────
       Domoticz grew a per-device icon of its own: a DeviceStatus.Icon
       column holding {"t":"<prefix>","on":"<class>"[,"off":"<class>"]},
       written by setused's &icon=, plus CustomImage for an uploaded PNG.
       Where that exists it is the right home for a Nightglass pick — the
       server renders it, so the choice survives without the theme, and
       the theme's own override blob stays what it always was rather than
       growing a second, parallel icon store.

       Stable Domoticz has neither the column nor the endpoint, and
       silently posting &icon= there would be rejected ("Invalid icon")
       or ignored. So this is version-gated: without native storage the
       behaviour below is byte-for-byte what it was — glyph to the theme
       blob, image to the ddslick.

       The gate is dzIconService: it owns the Icon column's JSON contract
       on the client, and www ships with the binary, so its presence IS
       the server's. It is route-loaded, which is fine — the two routes
       that load it are exactly the two surfaces this module drives. The
       DOM check covers the Utility dialogs, which are jQuery and may run
       before the injector is reachable. Latched: once seen, never
       re-probed, so a route that hasn't loaded the module yet cannot
       downgrade a device page mid-edit. */
    var _nativeStore = false;
    function nativeIconStorage() {
        if (_nativeStore) return true;
        var inj = injector();
        try {
            if (inj && inj.has('dzIconService')) { _nativeStore = true; return true; }
        } catch (e) {}
        if (document.querySelector('dz-icon-picker, .dz-icon-picker-host')) {
            _nativeStore = true;
            return true;
        }
        return false;
    }

    /* The latch above can only say "yes" from a route that already loaded
       dzIconService, which is precisely the two surfaces this module drives.
       The settings panel's icon editor is a third caller, on a route that
       never loads it, so a synchronous "no" there would be a false negative.
       Asking the server for the file settles it independently of routing:
       dzIconService.js ships in www alongside the binary that has the Icon
       column, so a 200 IS the column. One request, shared by every caller. */
    var _probe = null;
    function probeNativeStorage(cb) {
        if (_nativeStore) { cb(true); return; }
        if (!_probe) {
            _probe = fetch('app/icons/dzIconService.js',
                           { method: 'HEAD', credentials: 'same-origin' })
                .then(function (r) { return !!(r && r.ok); })
                .catch(function () { return false; });
        }
        _probe.then(function (ok) {
            if (ok) _nativeStore = true;
            cb(ok);
        });
    }

    /* The Icon JSON, exactly as dzIconPicker.serializeIcon() writes it and
       NormaliseDeviceIcon() in main/WebServerCmds.cpp accepts it: "t" is the
       library prefix (required, no spaces, ≤32 chars), "on" the full class
       string (≤128, spaces allowed) and "off" is omitted when it would equal
       "on" — dzIconService.resolveIconClass() reads `off || on`. Classes are
       restricted to [A-Za-z0-9 _-]; anything else is refused outright with
       {"error":"Invalid icon"} and nothing is written. The server re-serialises
       what it accepts, so only the values have to match, not the key order. */
    function iconProviderOf(cls) {
        var token = String(cls || '').trim().split(/\s+/)[0] || '';
        return (token === 'fa' || token.indexOf('fa-') === 0) ? 'fa' : token;
    }

    function serializeIcon(on, off) {
        on = String(on || '').replace(/\s+/g, ' ').trim();
        if (!on) return '';
        var payload = { t: iconProviderOf(on), on: on };
        if (off && off !== on) payload.off = off;
        return JSON.stringify(payload);
    }

    function parseIcon(json) {
        if (!json) return null;
        var parsed = json;
        if (typeof json === 'string') {
            try { parsed = JSON.parse(json); } catch (e) { return null; }
        }
        if (!parsed || typeof parsed !== 'object' || typeof parsed.on !== 'string') return null;
        var on = parsed.on.replace(/\s+/g, ' ').trim();
        if (!on) return null;
        return { on: on, off: (typeof parsed.off === 'string' ? parsed.off.trim() : '') };
    }

    /* A pick is not saved until the page's Save / the dialog's Update, so it
       has to be remembered somewhere until then. The Angular surface has the
       live scope model for that; the Utility dialogs don't, and detectSurface()
       rebuilds their surface object on every mutation burst, so the pending
       choice lives here instead of in the surface closure. Keyed by idx so
       opening a different device drops it. */
    var _pending = null;
    function pendingFor(idx) {
        return (_pending && _pending.idx === String(idx)) ? _pending : null;
    }
    function setPending(idx, ci, icon) {
        _pending = { idx: String(idx), ci: ci, icon: icon || '' };
    }

    /* ── Data ─────────────────────────────────────────────────────── */

    function fetchCustomSet(cb) {
        if (_customSet) { cb(_customSet); return; }
        fetch('json.htm?type=command&param=getcustomiconset', { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (d) { _customSet = (d && d.result) || []; cb(_customSet); })
            .catch(function () { _customSet = []; cb(_customSet); });
    }

    function fetchDevice(idx, cb) {
        if (_devByIdx[idx]) { cb(_devByIdx[idx]); return; }
        fetch('json.htm?type=command&param=getdevices&rid=' + encodeURIComponent(idx),
              { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var dev = (d && d.result && d.result[0]) || null;
                if (dev) _devByIdx[idx] = dev;
                cb(dev);
            })
            .catch(function () { cb(null); });
    }

    /* ── Surface abstraction ──────────────────────────────────────────
       Normalises the Angular page and the jQuery dialogs behind one API. */

    function angularScope(el) {
        if (!window.angular) return null;
        var node = el, guard = 0;
        while (node && node !== document.body && guard++ < 20) {
            try {
                var s = angular.element(node).scope();
                if (s && ((s.vm && s.vm.device) || s.device)) return s;
            } catch (e) {}
            node = node.parentElement;
        }
        return null;
    }

    function detectSurface() {
        /* A visible utility dialog wins (there can be several hidden dialog
           templates that share the #combosensoricon id). */
        var dialogs = document.querySelectorAll('.ui-dialog');
        for (var i = 0; i < dialogs.length; i++) {
            var dlg = dialogs[i];
            if (!dlg.offsetWidth && !dlg.offsetHeight) continue;  // hidden dialog
            var combo = dlg.querySelector('#combosensoricon');
            if (!combo) continue;
            var idxEl = dlg.querySelector('#deviceidx');
            var idx   = idxEl ? (idxEl.textContent || '').trim() : '';
            if (!/^\d+$/.test(idx)) {
                /* Fall back to the global the dialogs set on open. */
                var $ = jq();
                if ($ && $.devIdx != null && /^\d+$/.test(String($.devIdx))) idx = String($.devIdx);
                else idx = '';
            }
            /* Return the surface even without an idx: the custom-image picker
               still works (it just drives the ddslick), so we never leave the
               native combo hidden with nothing in its place. */
            return makeJquerySurface(combo, idx);
        }

        var ng = document.querySelector('device-icon-select');
        if (ng) {
            var scope = angularScope(ng);
            var dev = scope ? ((scope.vm && scope.vm.device) || scope.device) : null;
            if (dev && dev.idx !== undefined) return makeAngularSurface(ng, scope, dev);
        }
        return null;
    }

    function makeAngularSurface(comboEl, scope, device) {
        return {
            kind: 'angular',
            comboEl: comboEl,
            td: comboEl.parentNode,
            idx: String(device.idx),
            device: device,
            applyLabel: 'Save',
            getCustomImage: function () { return parseInt(device.CustomImage, 10) || 0; },
            /* vm.device is the model the page's Save serialises (customimage +
               icon), so it is both the store and the source of truth here — no
               pending copy needed. */
            getIcon: function () { return device.Icon || ''; },
            withDevice: function (cb) { cb(device); },
            setCustomImage: function (value) { this.setSelection(value, this.getIcon()); },
            setSelection: function (value, icon) {
                var dev = scope.vm ? scope.vm.device : scope.device;
                var native = nativeIconStorage();
                function assign() {
                    dev.CustomImage = value;
                    /* Only touch Icon where the column exists: on stable it is
                       not in the model and setused would reject &icon=. */
                    if (native) dev.Icon = icon || '';
                }
                /* Our click runs outside Angular, so a digest usually isn't in
                   flight — $apply commits the model + updates Save. Guard on
                   $$phase to avoid "digest already in progress". */
                if (scope.$$phase || (scope.$root && scope.$root.$$phase)) {
                    assign();
                } else {
                    scope.$apply(assign);
                }
                device.CustomImage = value;
                if (native) device.Icon = icon || '';
                return native;
            }
        };
    }

    /* On native, the Utility dialog's persistence bridge is
       dzIconPickerService: UtilityController.iconParams() reads
       getCustomImage()/getIcon() off it when Update is pressed. mount() is its
       only setter, so re-mount the (CSS-hidden) native field with the new
       values — the same "drive the native control, let Domoticz save" trick the
       ddslick path uses, one API up. */
    function mountNativeBridge(surface, value, icon) {
        var inj = injector();
        if (!inj) return false;
        var svc;
        try { svc = inj.get('dzIconPickerService'); } catch (e) { return false; }
        var host = surface.td && surface.td.querySelector('.dz-icon-picker-host');
        if (!host || !svc || typeof svc.mount !== 'function') return false;
        try {
            svc.mount(host, { customImage: value, icon: icon || '', device: surface.device });
            return true;
        } catch (e) { return false; }
    }

    function makeJquerySurface(comboEl, idx) {
        var cur = comboEl.querySelector('.dd-selected-value');
        var curVal = cur ? (parseInt(cur.value, 10) || 0) : 0;
        return {
            kind: 'jquery',
            comboEl: comboEl,
            td: comboEl.parentNode,
            idx: String(idx),
            device: _devByIdx[idx] || null,
            applyLabel: 'Update',
            getCustomImage: function () {
                var p = pendingFor(idx);
                if (p) return p.ci;
                var v = comboEl.querySelector('.dd-selected-value');
                return v ? (parseInt(v.value, 10) || 0) : curVal;
            },
            getIcon: function () {
                var p = pendingFor(idx);
                if (p) return p.icon;
                return (this.device && this.device.Icon) || '';
            },
            withDevice: function (cb) {
                if (this.device) { cb(this.device); return; }
                if (!/^\d+$/.test(String(idx))) { cb(null); return; }  // no idx → no fetch
                var self = this;
                fetchDevice(idx, function (d) { self.device = d; cb(d); });
            },
            setCustomImage: function (value) { this.setSelection(value, this.getIcon()); },
            setSelection: function (value, icon) {
                if (nativeIconStorage() && mountNativeBridge(this, value, icon)) {
                    setPending(idx, value, icon);
                    return true;
                }
                var $ = jq();
                if (!$) return false;
                var data = $.ddData || [];
                var sel = -1;
                for (var i = 0; i < data.length; i++) {
                    var dv = (data[i] && data[i].value != null) ? data[i].value : 0;
                    if (String(dv) === String(value)) { sel = i; break; }
                }
                if (sel < 0 && value === 0) sel = 0;   // Default row
                if (sel >= 0) { try { $(comboEl).ddslick('select', { index: sel }); } catch (e) {} }
                return false;
            }
        };
    }

    /* ── Provenance + preview ─────────────────────────────────────────
       The compact field has room for one line of text, so provenance moves
       into the preview's tooltip: what the icon is, then where it came
       from. Native puts the class string there for the same reason. */

    function resolveSource(surface, device) {
        var s = settings();
        var ov = s && s.getDeviceOverride ? s.getDeviceOverride(surface.idx) : null;
        var ovCls = ov && (ov.iconOn || ov.iconOpen || ov.icon);
        var native = nativeIconStorage();

        /* Native fields first where they exist: Domoticz renders the Icon
           column / CustomImage itself, so that is what is actually on screen
           — the theme blob only tints a native glyph, it cannot reshape it.
           Without native storage the blob comes first, exactly as before. */
        if (native) {
            var icon = parseIcon(surface.getIcon());
            if (icon) {
                return {
                    kind: 'nativeIcon',
                    name: icon.on + (icon.off ? ' / ' + icon.off : ''),
                    origin: 'icon set on this device',
                    iconCls: icon.on, color: null, isDefault: false
                };
            }
        } else if (ovCls) {
            return {
                kind: 'override', name: ovCls, origin: 'set in Nightglass',
                iconCls: ovCls, color: (ov && ov.on) || '#4e9af1', isDefault: false
            };
        }

        var ci = surface.getCustomImage();
        if (ci >= 100) {
            var up = findUploaded(ci);
            return {
                kind: 'custom', name: (up && up.Title) || ('#' + ci),
                origin: 'Uploaded custom image',
                pngSrc: up ? up.IconFile48On : (selectedImg(surface) || null),
                iconCls: null, color: null, isDefault: false
            };
        }
        if (ci > 0) {
            var spec = device && typeof window._dzIconForDevice === 'function'
                ? window._dzIconForDevice(device) : null;
            return {
                kind: 'builtin', name: device && device.Image ? String(device.Image) : ('#' + ci),
                origin: 'Domoticz built-in icon',
                iconCls: (spec && spec.icon) || null,
                color:   (spec && spec.color) || null,
                pngSrc:  (spec && spec.icon) ? null : (selectedImg(surface) || null),
                isDefault: false
            };
        }
        /* Nothing native is set, so an override written before this Domoticz
           had the Icon column is still the effective shape everywhere the
           theme replaces PNGs, and reads as the current pick here too. */
        if (native && ovCls) {
            return {
                kind: 'override', name: ovCls, origin: 'set in Nightglass (this theme only)',
                iconCls: ovCls, color: (ov && ov.on) || '#4e9af1', isDefault: false
            };
        }

        var themeSpec = device && typeof window._dzIconForDevice === 'function'
            ? window._dzIconForDevice(device) : null;
        return {
            kind: 'theme', name: 'Default', origin: 'chosen from the device type',
            iconCls: (themeSpec && themeSpec.icon)  || 'fa-solid fa-circle-question',
            color:   (themeSpec && themeSpec.color) || '#4e9af1',
            isDefault: true
        };
    }

    function selectedImg(surface) {
        var img = surface.comboEl.querySelector('.dd-selected-image');
        return img ? img.getAttribute('src') : null;
    }

    function findUploaded(customImage) {
        if (!_customSet) return null;
        var wantId = customImage - 100;      // getcustomiconset idx == CustomImage - 100
        for (var i = 0; i < _customSet.length; i++) {
            if (String(_customSet[i].idx) === String(wantId)) return _customSet[i];
        }
        return null;
    }

    /* ── Animation ────────────────────────────────────────────────────
       An animation cannot go where the icon goes: Domoticz validates the
       Icon column to {"t","on","off"} and rejects anything else outright,
       so motion stays in the theme's own override blob even on a build
       that owns the icon itself. That also means it saves on the spot,
       unlike a pick, which waits for the page's Save. */

    function currentAnim(surface) {
        var s  = settings();
        var ov = s && s.getDeviceOverride ? s.getDeviceOverride(surface.idx) : null;
        return (ov && ov.anim) || '';
    }

    function animLabel(id) {
        var list = window.dzIconAnimations || [];
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) return list[i].label;
        }
        return '';
    }

    function buildPreview(src, anim) {
        var wrap = document.createElement('span');
        wrap.className = 'dz-icon-field-preview';
        var label = animLabel(anim);
        wrap.title = src.name + ' — ' + src.origin +
                     (label ? '; ' + label + ' animation' : '');
        if (src.pngSrc) {
            var im = document.createElement('img');
            im.src = src.pngSrc; im.alt = '';
            wrap.appendChild(im);
            return wrap;
        }
        var i = document.createElement('i');
        /* The preview animates too — the field is the one place that shows
           what this device's icon actually does. */
        var animCls = (typeof window.dzIconAnimClass === 'function')
            ? window.dzIconAnimClass(anim) : '';
        i.className = (src.iconCls || 'fa-regular fa-square') +
                      (animCls ? ' ' + animCls : '');
        if (src.color) i.style.color = src.color;
        wrap.appendChild(i);
        return wrap;
    }

    /* ── Render ───────────────────────────────────────────────────── */

    function render(surface) {
        var td = surface.td;
        if (!td) return;

        /* Create the field synchronously so concurrent async (device-fetch)
           renders can't each insert a duplicate. The native combo/picker is a
           persistence bridge only — never shown. */
        var box = td.querySelector('#' + BOX_ID);
        if (!box) {
            box = document.createElement('span');
            box.id = BOX_ID;
            /* Native's own class names first: on a Domoticz that ships the
               native picker this inherits its layout verbatim, so the two
               fields cannot drift apart. ng-icon-field is our own hook. */
            box.className = 'dz-icon-field ng-icon-field';
            td.insertBefore(box, surface.comboEl);
        }
        surface.comboEl.style.display = 'none';

        surface.withDevice(function (device) {
            if (!document.body.contains(box)) return;   // dialog closed meanwhile
            var src = resolveSource(surface, device);
            var ci  = surface.getCustomImage();

            /* An uploaded image only knows its title and PNG once the set has
               been read; re-render when it lands rather than showing "#101". */
            if (ci >= 100 && !_customSet) fetchCustomSet(function () { render(surface); });

            var anim = currentAnim(surface);
            var sig = [surface.idx, src.kind, src.iconCls || '', src.color || '',
                       src.pngSrc || '', ci, anim,
                       box.getAttribute('data-dirty') || ''].join('|');
            if (box.getAttribute('data-sig') === sig) return;
            box.setAttribute('data-sig', sig);

            box.innerHTML = '';
            box.appendChild(buildPreview(src, anim));

            box.appendChild(mkBtn('dz-icon-field-btn', 'Change…', function () {
                openStudio(surface, device, src);
            }));

            if (!src.isDefault) {
                box.appendChild(mkBtn('ng-icon-field-reset', 'Use default', function () {
                    useDefault(surface);
                }));
            }

            /* Neither surface saves on pick — the page's Save / the dialog's
               Update does. Say so, but only once there is something to lose. */
            if (box.getAttribute('data-dirty') === '1') {
                var note = document.createElement('em');
                note.className = 'ng-icon-field-note';
                note.textContent = 'click ' + surface.applyLabel + ' to save';
                box.appendChild(note);
            }
        });
    }

    /* Domoticz renders its own Change… as an <a class="btnsmall">; match that
       so the button is a real Domoticz small button on either build. */
    function mkBtn(cls, text, onClick) {
        var a = document.createElement('a');
        a.className = 'btnsmall ' + cls;
        a.setAttribute('role', 'button');
        a.appendChild(document.createTextNode(text));
        a.addEventListener('click', function (e) { e.preventDefault(); onClick(); });
        return a;
    }

    /* The on/off glyph pair currently in effect for a device, from whichever
       store holds it. Domoticz's Icon column IS an {on, off} pair; the theme
       blob carries iconOn/iconOff — so both halves come from one place and the
       Studio's two slots start on what is really set. */
    function currentIconPair(surface, src) {
        if (nativeIconStorage()) {
            var icon = parseIcon(surface.getIcon());
            if (icon) return { on: icon.on, off: icon.off || '' };
            return { on: src.iconCls || '', off: '' };
        }
        var s  = settings();
        var ov = s && s.getDeviceOverride ? s.getDeviceOverride(surface.idx) : null;
        return {
            on:  (ov && (ov.iconOn || ov.icon)) || src.iconCls || '',
            off: (ov && ov.iconOff) || ''
        };
    }

    function openStudio(surface, device, src) {
        var s = settings();
        /* Open the Icon Studio for this device. Falls back to the settings
           panel's Device Icons dialog if the Studio module isn't available. */
        if (typeof window.dzOpenIconStudio === 'function') {
            var ci   = surface.getCustomImage();
            var pair = currentIconPair(surface, src);
            window.dzOpenIconStudio({
                current: pair.on,
                /* Only an uploaded image (>= 100) is offered, so only that can
                   be the current pick; a built-in is not in the grid to mark. */
                currentImage: ci >= 100 ? ci : 0,
                /* Uploaded PNGs are the one choice a class string cannot carry,
                   and CustomImage is where they go — which only exists as a
                   destination once Domoticz owns the pick. Without native
                   storage the theme blob is the store, and it holds classes
                   only, so there is nowhere to put an image and the source
                   stays hidden rather than offering a dead end. */
                allowImages: nativeIconStorage(),
                /* Two slots so the off state can differ from the on state, the
                   way Domoticz's own native picker now offers. An off left
                   unset falls back to on in every store, so leaving it alone
                   keeps the old single-icon behaviour. */
                slots: [
                    { key: 'on',  label: 'On / active',    cls: pair.on },
                    { key: 'off', label: 'Off / inactive', cls: pair.off }
                ],
                /* One device in view, so an animation has somewhere to
                   belong — offer the row and preview it on this icon. */
                animation: currentAnim(surface),
                animationGlyph: pair.on,
                title: 'Set icon for ' + ((device && device.Name) || 'device'),
                onPickSlot: function (key, cls) {
                    pair[key] = cls;
                    applyGlyph(surface, device, pair.on, pair.off);
                },
                onPickImage: function (customImage) { applyImage(surface, customImage); },
                onPickAnimation: function (id) { applyAnim(surface, device, id); }
            });
        } else if (s && s.openIconOverride) {
            s.openIconOverride(surface.idx);
            scheduleRefresh(surface);
        }
    }

    /* The on/off glyph pair goes to Domoticz's Icon column where there is one,
       and to the theme's override blob where there isn't. An off equal to (or
       absent alongside) on is stored as a single shape — native reads
       `off || on`, and the blob's applyDeviceOverride does the same — so a
       device the user never gave a distinct off icon behaves exactly as before.

       Nothing here writes colour. DEVICE_MAP still tints the glyph by device
       type, and a per-device colour remains the settings panel's device-icon
       editor to set; the shape is not recorded in two places at once. */
    function applyGlyph(surface, device, onCls, offCls) {
        onCls  = String(onCls || '').trim();
        offCls = String(offCls || '').trim();
        if (!onCls) return;                    // an icon needs at least an on state
        if (nativeIconStorage()) {
            /* Icon and CustomImage are alternatives, not layers —
               dzIconService.resolve() gives Icon precedence, so leaving a stale
               CustomImage behind would only confuse a later read. */
            surface.setSelection(0, serializeIcon(onCls, offCls || null));
            markDirty(surface);
        } else {
            var s = settings();
            if (s && s.setDeviceOverrideIcons) {
                s.setDeviceOverrideIcons(surface.idx, onCls, offCls, device && device.Name);
            }
        }
        render(surface);
    }

    /* The theme blob is the only store for an animation, so this one takes
       effect immediately rather than waiting for Save — and it is not marked
       dirty, because there is nothing left for Save to write. */
    function applyAnim(surface, device, animId) {
        var s = settings();
        if (s && s.setDeviceOverrideAnim) {
            s.setDeviceOverrideAnim(surface.idx, animId, device && device.Name);
        }
        render(surface);
    }

    /* An uploaded image is the mirror image of a glyph: CustomImage carries it
       and Icon must be cleared, or dzIconService.resolve() would keep returning
       the glyph it prefers and the pick would appear to do nothing.

       customImage arrives already resolved to the value DeviceStatus.CustomImage
       stores — the Studio adds back the 100 that getcustomiconset subtracts —
       so there is no offset left to apply here. */
    function applyImage(surface, customImage) {
        customImage = parseInt(customImage, 10) || 0;
        if (customImage <= 0) return;
        surface.setSelection(customImage, '');
        markDirty(surface);
        render(surface);
    }

    function useDefault(surface) {
        var s = settings();
        /* Clear every layer in one press rather than peeling them off one at a
           time: "Use default" should mean the device is back to what Domoticz
           picks for its type, whichever store the current icon came from. */
        if (s && s.removeDeviceOverride) s.removeDeviceOverride(surface.idx);
        if (surface.getCustomImage() > 0 || parseIcon(surface.getIcon())) {
            surface.setSelection(0, '');
            markDirty(surface);
        }
        render(surface);
    }

    function markDirty(surface) {
        var box = surface.td && surface.td.querySelector('#' + BOX_ID);
        if (box) box.setAttribute('data-dirty', '1');
    }

    /* ── Writing the Icon column without a surface ─────────────────────
       Both surfaces above only stage a pick: the page's Save / the dialog's
       Update issues the setused that stores it. The settings panel's icon
       editor is not on a device page, so it has no Save to ride on and needs
       the write itself.

       Domoticz has no icon-only endpoint — the Icon column is written by
       setused, which leaves most parameters it is not given alone (description,
       switchtype, options, strparams and the rest all survive being omitted)
       but has two traps for a partial write, both found by trying it against a
       real server rather than by reading the handler:

         • `protected` is read with a default of false, so omitting it silently
           unprotects the device. Send it back unchanged.
         • `customimage` is only acted on when `name` is sent alongside it.
           Without a name, customimage=0 is quietly dropped and a stale
           uploaded image stays behind the new glyph — and then survives a
           "use default", which is the one thing it must not do. Send the
           device's own name, which leaves the name itself untouched.

       Published rather than reimplemented next to the caller so the
       {"t","on","off"} contract and the Icon-vs-CustomImage exclusivity have
       exactly one home. `device` is a getdevices record — the caller already
       has one, and reusing it keeps Protected honest without a second read.

       `spec` says what the device should end up carrying:
         { on, off }        a glyph pair (off optional)
         { image: <n> }     an uploaded PNG, as DeviceStatus.CustomImage stores it
         null / {}          neither — back to the device type's own icon
       The two are alternatives, not layers: dzIconService.resolve() prefers
       Icon, so setting either clears the other and a clear clears both. That
       rule lives here so no caller has to remember it. */
    function writeIcon(device, spec, done) {
        done = done || function () {};
        var idx = device && (device.idx !== undefined ? device.idx : device.IDX);
        if (!/^\d+$/.test(String(idx)) || !nativeIconStorage()) { done(false); return; }
        /* A record without these is a stub, not a device we know: guessing
           Protected would unprotect a protected device, and a missing name
           would silently cost us the CustomImage clear. Read the real one. */
        if (device.Protected === undefined || !device.Name) {
            fetchDevice(idx, function (full) {
                if (!full) { done(false); return; }
                writeIcon(full, spec, done);
            });
            return;
        }
        spec = spec || {};
        var icon  = serializeIcon(spec.on, spec.off);
        /* A glyph wins if both were somehow given, matching the precedence the
           server renders with, so what is stored is what will be drawn. */
        var image = icon ? 0 : (parseInt(spec.image, 10) || 0);
        var url = 'json.htm?type=command&param=setused&used=true' +
                  '&idx=' + encodeURIComponent(idx) +
                  '&icon=' + encodeURIComponent(icon) +
                  '&customimage=' + image +
                  /* Unchanged, and only here because customimage needs it. */
                  '&name=' + encodeURIComponent(device.Name) +
                  '&protected=' + (device.Protected ? 'true' : 'false');
        fetch(url, { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var ok = !!(d && d.status === 'OK');
                if (ok) {
                    /* Keep the caller's record (and our own cache, which may be
                       the same object) agreeing with the server. */
                    device.Icon = icon;
                    device.CustomImage = image;
                }
                done(ok);
            })
            .catch(function () { done(false); });
    }

    /* The settings panel's device-icon editor edits the same two stores as
       this module: Domoticz's Icon column for the shape, the theme blob for
       colour and motion. It gets the store, not a copy of it. */
    window.dzDeviceIconStore = {
        isNative:     nativeIconStorage,
        probeNative:  probeNativeStorage,
        parse:        parseIcon,
        write:        writeIcon
    };

    /* The settings dialog saves asynchronously; poll briefly so provenance
       refreshes without leaving the page. */
    function scheduleRefresh(surface) {
        var n = 0;
        var t = setInterval(function () {
            if (++n > 20 || !document.body.contains(surface.comboEl)) { clearInterval(t); return; }
            render(surface);
        }, 500);
    }

    /* ── Wiring ───────────────────────────────────────────────────── */

    function enhance() {
        var surface = detectSurface();
        if (surface) render(surface);
    }

    var _t = null;
    function schedule() { clearTimeout(_t); _t = setTimeout(enhance, 40); }

    var mo = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
            if (muts[i].addedNodes && muts[i].addedNodes.length) { schedule(); return; }
        }
    });

    function init() {
        mo.observe(document.body, { childList: true, subtree: true });
        [200, 600, 1400].forEach(function (d) { setTimeout(enhance, d); });
        var $ = jq();
        /* Closing a Utility dialog without pressing Update abandons the pick.
           Forget it, or the next open of the same device would show it as
           though it had been saved. */
        if ($) $(document).on('dialogclose', function () { _pending = null; });
        try {
            var $rootScope = angular.element(document.body).injector().get('$rootScope');
            $rootScope.$on('$routeChangeSuccess', function () {
                _pending = null;
                [200, 700, 1500].forEach(function (d) { setTimeout(enhance, d); });
            });
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
