/* ══════════════════════════════════════════════════════════════════
   DEVICE ICON — Nightglass takeover of the native icon pickers
   ──────────────────────────────────────────────────────────────────
   Domoticz lets you set a device icon in two places, both via a ddslick
   combo listing the ENTIRE built-in icon set:

     1. Setup ▸ Devices ▸ a device — Angular <device-icon-select>
        (ng-model vm.device.CustomImage; persisted by the page's Save).
     2. The Utility "edit device" jQuery-UI dialogs — #combosensoricon
        (persisted by the dialog's Update button, which reads
        $.ddData[selectedIndex].value → &customimage=).

   Nightglass replaces BOTH combos with one consistent UI that:
     • shows where the icon currently comes from (Nightglass override /
       theme icon / Domoticz built-in / uploaded custom image),
     • sets a Font-Awesome icon through our Device Icon Overrides dialog,
     • and — for the old-school path — offers ONLY the user's own uploaded
       custom images (getcustomiconset), not the whole built-in list.

   The native combo stays in the DOM (hidden) purely as the persistence
   bridge: we drive its selection / ng-model, so Domoticz's own Save /
   Update code writes CustomImage exactly as before. Custom-icon ZIP
   uploads (Setup ▸ More Options ▸ Custom Icons) remain fully supported.
   ══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

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
            if (!/^\d+$/.test(idx)) continue;
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

    /* ── Provenance + preview ─────────────────────────────────────── */

    function resolveSource(surface, device) {
        var s = settings();
        var ov = s && s.getDeviceOverride ? s.getDeviceOverride(surface.idx) : null;
        if (ov && (ov.iconOn || ov.iconOpen || ov.icon)) {
            return {
                kind: 'override', label: 'Nightglass override',
                hint: 'A Font Awesome icon you set for this device in Nightglass.',
                iconCls: ov.iconOn || ov.iconOpen || ov.icon, color: ov.on || '#4e9af1'
            };
        }

        var ci = surface.getCustomImage();
        if (ci >= 100) {
            var up = findUploaded(ci);
            return {
                kind: 'custom', label: 'Uploaded custom image',
                hint: 'One of your own uploaded custom icons (Setup ▸ More Options ▸ Custom Icons).',
                pngSrc: up ? up.IconFile48On : (selectedImg(surface) || null),
                iconCls: null, color: null
            };
        }
        if (ci > 0) {
            var spec = device && typeof window._dzIconForDevice === 'function'
                ? window._dzIconForDevice(device) : null;
            return {
                kind: 'builtin', label: 'Domoticz built-in icon',
                hint: 'A stock Domoticz icon. Prefer a Nightglass icon for a themed look.',
                iconCls: (spec && spec.icon) || null,
                color:   (spec && spec.color) || null,
                pngSrc:  (spec && spec.icon) ? null : (selectedImg(surface) || null)
            };
        }
        var themeSpec = device && typeof window._dzIconForDevice === 'function'
            ? window._dzIconForDevice(device) : null;
        return {
            kind: 'theme', label: 'Nightglass theme icon',
            hint: 'Automatically chosen by Nightglass from the device type.',
            iconCls: (themeSpec && themeSpec.icon)  || 'fa-solid fa-circle-question',
            color:   (themeSpec && themeSpec.color) || '#4e9af1'
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
        var wrap = document.createElement('div');
        wrap.className = 'ng-dd-icon-preview';
        if (src.pngSrc) {
            var im = document.createElement('img');
            im.src = src.pngSrc; im.alt = '';
            wrap.appendChild(im);
            return wrap;
        }
        var i = document.createElement('i');
        i.className = src.iconCls || 'fa-solid fa-image';
        i.style.color = src.color || 'var(--dz-accent)';
        wrap.appendChild(i);
        return wrap;
    }

    /* ── Render ───────────────────────────────────────────────────── */

    function render(surface) {
        var td = surface.td;
        if (!td) return;

        /* Create the box synchronously so concurrent async (device-fetch)
           renders can't each insert a duplicate. The native combo is a
           persistence bridge only — never shown. */
        var box = td.querySelector('#' + BOX_ID);
        if (!box) {
            box = document.createElement('div');
            box.id = BOX_ID;
            box.className = 'ng-dd-icon-box';
            td.insertBefore(box, surface.comboEl);
        }
        surface.comboEl.style.display = 'none';

        surface.withDevice(function (device) {
            if (!document.body.contains(box)) return;   // dialog closed meanwhile
            var src = resolveSource(surface, device);
            var ci  = surface.getCustomImage();

            var pickerOpen = box.getAttribute('data-picker-open') === '1';

            var sig = [surface.idx, src.kind, src.iconCls || '', src.color || '',
                       src.pngSrc || '', ci, pickerOpen ? 1 : 0].join('|');
            if (box.getAttribute('data-sig') === sig) return;

            box.setAttribute('data-sig', sig);
            box.setAttribute('data-picker-open', pickerOpen ? '1' : '0');

            box.innerHTML = '';

            var head = document.createElement('div');
            head.className = 'ng-dd-icon-head';
            head.appendChild(buildPreview(src));
            var info = document.createElement('div');
            info.className = 'ng-dd-icon-info';
            info.innerHTML =
                '<div class="ng-dd-icon-source ng-dd-icon-source--' + src.kind + '">' +
                '<span class="ng-dd-icon-dot"></span>' + src.label + '</div>' +
                '<div class="ng-dd-icon-hint">' + src.hint + '</div>';
            head.appendChild(info);
            box.appendChild(head);

            var actions = document.createElement('div');
            actions.className = 'ng-dd-icon-actions';

            var setBtn = mkBtn('ng-dd-icon-btn--primary',
                '<i class="fa-solid fa-wand-magic-sparkles"></i> ' +
                (src.kind === 'override' ? 'Edit Nightglass icon' : 'Set Nightglass icon'),
                function () {
                    var s = settings();
                    if (s && s.openIconOverride) s.openIconOverride(surface.idx);
                    scheduleRefresh(surface);
                });
            actions.appendChild(setBtn);

            var pickBtn = mkBtn('ng-dd-icon-btn--link',
                pickerOpen
                    ? '<i class="fa-solid fa-chevron-up"></i> Hide custom images'
                    : '<i class="fa-solid fa-images"></i> Use a custom uploaded image',
                function () {
                    box.setAttribute('data-picker-open', pickerOpen ? '0' : '1');
                    render(surface);
                });
            actions.appendChild(pickBtn);

            if (src.kind === 'override') {
                actions.appendChild(mkBtn('ng-dd-icon-btn--danger',
                    '<i class="fa-solid fa-rotate-left"></i> Remove override',
                    function () {
                        var s = settings();
                        if (s && s.removeDeviceOverride) s.removeDeviceOverride(surface.idx);
                        render(surface);
                    }));
            } else if (ci > 0) {
                actions.appendChild(mkBtn('ng-dd-icon-btn--danger',
                    '<i class="fa-solid fa-rotate-left"></i> Reset to default',
                    function () {
                        surface.setCustomImage(0);
                        render(surface);
                    }));
            }

            box.appendChild(actions);

            if (pickerOpen) box.appendChild(buildPicker(surface));
        });
    }

    function mkBtn(cls, html, onClick) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ng-dd-icon-btn ' + cls;
        b.innerHTML = html;
        b.addEventListener('click', onClick);
        return b;
    }

    /* Our own custom-image picker — uploaded icons ONLY (getcustomiconset). */
    function buildPicker(surface) {
        var panel = document.createElement('div');
        panel.className = 'ng-dd-icon-picker';
        panel.innerHTML = '<div class="ng-dd-icon-picker-loading">' +
            '<i class="fa-solid fa-spinner fa-spin"></i> Loading your custom images…</div>';

        fetchCustomSet(function (list) {
            panel.innerHTML = '';
            var note = document.createElement('div');
            note.className = 'ng-dd-icon-picker-note';
            note.innerHTML = '<i class="fa-solid fa-circle-info"></i> Your own uploaded ' +
                'custom images. Manage them in Setup ▸ More Options ▸ Custom Icons. ' +
                'Selecting one sets it as the Domoticz image — click <strong>' +
                surface.applyLabel + '</strong> to save.';
            panel.appendChild(note);

            if (!list.length) {
                var empty = document.createElement('div');
                empty.className = 'ng-dd-icon-picker-empty';
                empty.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> ' +
                    'No custom images uploaded yet. Upload a ZIP via ' +
                    'Setup ▸ More Options ▸ Custom Icons.';
                panel.appendChild(empty);
                return;
            }

            var grid = document.createElement('div');
            grid.className = 'ng-dd-icon-grid';
            var curCi = surface.getCustomImage();

            list.forEach(function (icon) {
                var value = (parseInt(icon.idx, 10) || 0) + 100;   // stored CustomImage
                var tile = document.createElement('button');
                tile.type = 'button';
                tile.className = 'ng-dd-icon-tile' + (value === curCi ? ' ng-dd-icon-tile--active' : '');
                tile.title = (icon.Title || '') + (icon.Description ? ' — ' + icon.Description : '');
                tile.innerHTML =
                    '<img src="' + icon.IconFile48On + '" alt="">' +
                    '<span>' + (icon.Title || ('#' + icon.idx)) + '</span>';
                tile.addEventListener('click', function () {
                    surface.setCustomImage(value);
                    render(surface);              // reflect new provenance immediately
                });
                grid.appendChild(tile);
            });
            panel.appendChild(grid);
        });

        return panel;
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
    function schedule() { clearTimeout(_t); _t = setTimeout(enhance, 120); }

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
