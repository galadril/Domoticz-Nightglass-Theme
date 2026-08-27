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
            withDevice: function (cb) { cb(device); },
            setCustomImage: function (value) {
                var dev = scope.vm ? scope.vm.device : scope.device;
                /* Our click runs outside Angular, so a digest usually isn't in
                   flight — $apply commits the model + updates Save. Guard on
                   $$phase to avoid "digest already in progress". */
                if (scope.$$phase || (scope.$root && scope.$root.$$phase)) {
                    dev.CustomImage = value;
                } else {
                    scope.$apply(function () { dev.CustomImage = value; });
                }
                device.CustomImage = value;
            }
        };
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
                var v = comboEl.querySelector('.dd-selected-value');
                return v ? (parseInt(v.value, 10) || 0) : curVal;
            },
            withDevice: function (cb) {
                if (this.device) { cb(this.device); return; }
                if (!/^\d+$/.test(String(idx))) { cb(null); return; }  // no idx → no fetch
                var self = this;
                fetchDevice(idx, function (d) { self.device = d; cb(d); });
            },
            setCustomImage: function (value) {
                var $ = jq();
                if (!$) return;
                var data = $.ddData || [];
                var sel = -1;
                for (var i = 0; i < data.length; i++) {
                    var dv = (data[i] && data[i].value != null) ? data[i].value : 0;
                    if (String(dv) === String(value)) { sel = i; break; }
                }
                if (sel < 0 && value === 0) sel = 0;   // Default row
                if (sel >= 0) { try { $(comboEl).ddslick('select', { index: sel }); } catch (e) {} }
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
        if (ov && (ov.iconOn || ov.iconOpen || ov.icon)) {
            var cls = ov.iconOn || ov.iconOpen || ov.icon;
            return {
                kind: 'override', name: cls, origin: 'Nightglass override',
                iconCls: cls, color: ov.on || '#4e9af1', isDefault: false
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
        /* Open the Icon Studio for this device and apply the pick as an
           override (preserving any existing colors). Falls back to the full
           override dialog if the Studio module isn't available. */
        if (typeof window.dzOpenIconStudio === 'function' && s && s.setDeviceOverrideIcon) {
            window.dzOpenIconStudio({
                current: src.iconCls || '',
                title: 'Set icon for ' + ((device && device.Name) || 'device'),
                onPick: function (cls) {
                    s.setDeviceOverrideIcon(surface.idx, cls, device && device.Name);
                    render(surface);
                }
            });
        } else if (s && s.openIconOverride) {
            s.openIconOverride(surface.idx);
            scheduleRefresh(surface);
        }
    }

    function useDefault(surface) {
        var s = settings();
        if (s && s.removeDeviceOverride) s.removeDeviceOverride(surface.idx);
        if (surface.getCustomImage() > 0) {
            surface.setCustomImage(0);
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
        try {
            var $rootScope = angular.element(document.body).injector().get('$rootScope');
            $rootScope.$on('$routeChangeSuccess', function () {
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
