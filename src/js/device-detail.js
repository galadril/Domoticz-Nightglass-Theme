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
   Studio is shared with the settings panel's override editor, where
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
                kind: 'override', name: ovCls, origin: 'Nightglass override',
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
                kind: 'override', name: ovCls, origin: 'Nightglass override (theme-only)',
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

    function buildPreview(src) {
        var wrap = document.createElement('span');
        wrap.className = 'dz-icon-field-preview';
        wrap.title = src.name + ' — ' + src.origin;
        if (src.pngSrc) {
            var im = document.createElement('img');
            im.src = src.pngSrc; im.alt = '';
            wrap.appendChild(im);
            return wrap;
        }
        var i = document.createElement('i');
        i.className = src.iconCls || 'fa-regular fa-square';
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

            var sig = [surface.idx, src.kind, src.iconCls || '', src.color || '',
                       src.pngSrc || '', ci, box.getAttribute('data-dirty') || ''].join('|');
            if (box.getAttribute('data-sig') === sig) return;
            box.setAttribute('data-sig', sig);

            box.innerHTML = '';
            box.appendChild(buildPreview(src));

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

    function openStudio(surface, device, src) {
        var s = settings();
        /* Open the Icon Studio for this device. Falls back to the full override
           dialog if the Studio module isn't available. */
        if (typeof window.dzOpenIconStudio === 'function') {
            var ci = surface.getCustomImage();
            window.dzOpenIconStudio({
                current: src.iconCls || '',
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
                title: 'Set icon for ' + ((device && device.Name) || 'device'),
                onPick: function (cls) { applyGlyph(surface, device, cls); },
                onPickImage: function (customImage) { applyImage(surface, customImage); }
            });
        } else if (s && s.openIconOverride) {
            s.openIconOverride(surface.idx);
            scheduleRefresh(surface);
        }
    }

    /* A glyph goes to Domoticz's Icon column where there is one, and to the
       theme's override blob where there isn't. Only the "on" class is written:
       the Studio picks one icon, and native reads `off || on`, so one class
       means one shape in both states — the same thing a Nightglass override
       has always meant.

       On native the colour is not written with it. DEVICE_MAP still tints the
       glyph by device type, and a per-device colour remains the settings
       panel's override editor to set; what does not happen any more is the
       shape being recorded in two places at once. */
    function applyGlyph(surface, device, cls) {
        if (nativeIconStorage()) {
            /* Icon and CustomImage are alternatives, not layers —
               dzIconService.resolve() gives Icon precedence, so leaving a stale
               CustomImage behind would only confuse a later read. */
            surface.setSelection(0, serializeIcon(cls, null));
            markDirty(surface);
        } else {
            var s = settings();
            if (s && s.setDeviceOverrideIcon) {
                s.setDeviceOverrideIcon(surface.idx, cls, device && device.Name);
            }
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

    /* The override dialog saves asynchronously; poll briefly so provenance
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
