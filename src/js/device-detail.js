/* ══════════════════════════════════════════════════════════════════
   DEVICE DETAIL PAGE — Nightglass icon section
   ──────────────────────────────────────────────────────────────────
   Domoticz's device detail page (Setup ▸ Devices ▸ a device, or the
   "Edit" button on a card) exposes a native <device-icon-select> combo
   that only lets you pick a built-in Domoticz PNG (CustomImage). But
   Nightglass resolves icons in three different ways:

     1. a Nightglass per-device OVERRIDE (Font Awesome, set via our
        Device Icon Overrides dialog — stored in a user variable),
     2. a Nightglass THEME icon (automatic FA icon from the device type),
     3. a Domoticz CUSTOM icon (CustomImage ≠ 0 — a built-in PNG).

   This module rewrites that row to (a) show which of the three the icon
   currently comes from, (b) let the user open our override dialog preset
   to this device, and (c) still reach Domoticz's native PNG selector on
   demand (kept in the DOM so its ng-model keeps writing CustomImage —
   Domoticz stays in sync). Issue #191 / device-detail request.
   ══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var BOX_ID = 'ng-dd-icon-box';

    function settings() { return window.dzNightglassSettings || null; }

    /* Resolve the Angular device object bound to the detail-page controller
       (controllerAs 'vm'). Falls back to null. */
    function getDetailDevice(iconSelectEl) {
        if (!window.angular) return null;
        var node = iconSelectEl;
        var guard = 0;
        while (node && node !== document.body && guard++ < 20) {
            try {
                var scope = angular.element(node).scope();
                if (scope) {
                    var d = (scope.vm && scope.vm.device) || scope.device ||
                            (scope.ctrl && scope.ctrl.device);
                    if (d && d.idx !== undefined) return d;
                }
            } catch (e) {}
            node = node.parentElement;
        }
        return null;
    }

    /* Determine where this device's icon currently comes from. */
    function resolveSource(device) {
        var s = settings();
        var idx = String(device.idx);
        var ov = s && s.getDeviceOverride ? s.getDeviceOverride(idx) : null;
        if (ov && (ov.iconOn || ov.iconOpen || ov.icon)) {
            return {
                kind:  'override',
                label: 'Nightglass override',
                hint:  'A custom Font Awesome icon you set for this device.',
                iconCls: ov.iconOn || ov.iconOpen || ov.icon,
                color:   ov.on || '#4e9af1',
                override: ov
            };
        }
        if (device.CustomImage && String(device.CustomImage) !== '0') {
            return {
                kind:  'domoticz',
                label: 'Domoticz custom icon',
                hint:  'A built-in Domoticz icon (CustomImage). Nightglass shows it as-is.',
                iconCls: null,
                color: null
            };
        }
        var themeSpec = (typeof window._dzIconForDevice === 'function')
            ? window._dzIconForDevice(device) : null;
        return {
            kind:  'theme',
            label: 'Nightglass theme icon',
            hint:  'Automatically chosen from the device type. Set a custom one below.',
            iconCls: (themeSpec && themeSpec.icon)  || 'fa-solid fa-circle-question',
            color:   (themeSpec && themeSpec.color) || '#4e9af1'
        };
    }

    /* Build the preview element for the current source. For a Domoticz PNG we
       reuse the native combo's selected thumbnail so the preview is accurate. */
    function buildPreview(src, iconSelectEl) {
        var wrap = document.createElement('div');
        wrap.className = 'ng-dd-icon-preview';
        if (src.kind === 'domoticz') {
            var thumb = iconSelectEl.querySelector('.dd-selected-image');
            if (thumb && thumb.getAttribute('src')) {
                var im = document.createElement('img');
                im.src = thumb.getAttribute('src');
                im.alt = '';
                wrap.appendChild(im);
                return wrap;
            }
        }
        var i = document.createElement('i');
        i.className = src.iconCls || 'fa-solid fa-image';
        i.style.color = src.color || 'var(--dz-accent)';
        wrap.appendChild(i);
        return wrap;
    }

    /* (Re)build our section inside the icon row's value cell. Idempotent:
       reuses the existing box element and only refreshes its contents. */
    function render(iconSelectEl) {
        var device = getDetailDevice(iconSelectEl);
        if (!device) return;
        var idx = String(device.idx);
        var td  = iconSelectEl.parentNode;
        if (!td) return;

        var src = resolveSource(device);

        var box = td.querySelector('#' + BOX_ID);
        var nativeVisible = box ? box.getAttribute('data-native-open') === '1' : false;
        if (!box) {
            box = document.createElement('div');
            box.id = BOX_ID;
            box.className = 'ng-dd-icon-box';
            /* Insert our UI before the native combo, then hide the combo. */
            td.insertBefore(box, iconSelectEl);
        }
        box.setAttribute('data-dz-idx', idx);

        /* Hide the native combo unless the user explicitly revealed it. */
        iconSelectEl.style.display = nativeVisible ? '' : 'none';

        box.innerHTML = '';
        box.appendChild(buildPreview(src, iconSelectEl));

        var info = document.createElement('div');
        info.className = 'ng-dd-icon-info';
        info.innerHTML =
            '<div class="ng-dd-icon-source ng-dd-icon-source--' + src.kind + '">' +
            '  <span class="ng-dd-icon-dot"></span>' + src.label +
            '</div>' +
            '<div class="ng-dd-icon-hint">' + src.hint + '</div>';
        box.appendChild(info);

        var actions = document.createElement('div');
        actions.className = 'ng-dd-icon-actions';

        var setBtn = document.createElement('button');
        setBtn.type = 'button';
        setBtn.className = 'ng-dd-icon-btn ng-dd-icon-btn--primary';
        setBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> ' +
            (src.kind === 'override' ? 'Edit Nightglass icon' : 'Set Nightglass icon');
        setBtn.addEventListener('click', function () {
            var s = settings();
            if (s && s.openIconOverride) s.openIconOverride(idx);
            /* The dialog saves asynchronously; refresh shortly after so the
               new provenance/preview shows without leaving the page. */
            scheduleRefresh(iconSelectEl);
        });
        actions.appendChild(setBtn);

        if (src.kind === 'override') {
            var rmBtn = document.createElement('button');
            rmBtn.type = 'button';
            rmBtn.className = 'ng-dd-icon-btn ng-dd-icon-btn--danger';
            rmBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Remove override';
            rmBtn.addEventListener('click', function () {
                var s = settings();
                if (s && s.removeDeviceOverride) s.removeDeviceOverride(idx);
                render(iconSelectEl);
            });
            actions.appendChild(rmBtn);
        }

        var nativeBtn = document.createElement('button');
        nativeBtn.type = 'button';
        nativeBtn.className = 'ng-dd-icon-btn ng-dd-icon-btn--link';
        nativeBtn.innerHTML = nativeVisible
            ? '<i class="fa-solid fa-chevron-up"></i> Hide Domoticz custom icon'
            : '<i class="fa-solid fa-image"></i> Use a Domoticz custom icon';
        nativeBtn.addEventListener('click', function () {
            var open = iconSelectEl.style.display === 'none';
            iconSelectEl.style.display = open ? '' : 'none';
            box.setAttribute('data-native-open', open ? '1' : '0');
            nativeBtn.innerHTML = open
                ? '<i class="fa-solid fa-chevron-up"></i> Hide Domoticz custom icon'
                : '<i class="fa-solid fa-image"></i> Use a Domoticz custom icon';
        });
        actions.appendChild(nativeBtn);

        box.appendChild(actions);
    }

    /* After the override dialog is used, its save is async. Poll briefly so
       the section reflects the new override/removal without a page reload. */
    function scheduleRefresh(iconSelectEl) {
        var tries = 0;
        var t = setInterval(function () {
            if (++tries > 20 || !document.body.contains(iconSelectEl)) {
                clearInterval(t);
                return;
            }
            render(iconSelectEl);
        }, 500);
    }

    /* Find the native icon combo on the current page and enhance it. */
    function enhance() {
        var iconSelectEl = document.querySelector('device-icon-select');
        if (!iconSelectEl) return;
        /* Wait until Angular has populated the isolate scope / device. */
        render(iconSelectEl);
    }

    var _t = null;
    function schedule() {
        clearTimeout(_t);
        _t = setTimeout(enhance, 120);
    }

    /* Detail page is rendered by AngularJS routing; watch for it to appear. */
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
