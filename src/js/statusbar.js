/* ── Feature 14: At-a-Glance Status Bar ─────────────────────────────
   A slim bar fixed to the bottom of the page that shows live summary
   stats: # devices currently on, outdoor temp, power usage. Collapsed
   by default (dot + Attention chip only) until the user expands it.

   Updates reactively via Angular device_update events.
   Collapse state persists in localStorage.
   Mobile: horizontally scrollable slots, smaller height.
──────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var _bar   = null;
    var _cache = {};  /* idx → latest device object */

    /* ── Build bar ─────────────────────────────────────────────── */

    function onLoginRoute() {
        var h = (window.location.hash || '').toLowerCase();
        return h.indexOf('login') >= 0 || h.indexOf('wizard') >= 0;
    }

    function buildBar() {
        if (onLoginRoute()) {
            var old = document.getElementById('ng-status-bar');
            if (old) old.remove();
            document.body.classList.remove('ng-sb-bottom');
            _bar = null;
            return;
        }
        if (document.getElementById('ng-status-bar')) {
            _bar = document.getElementById('ng-status-bar');
            return;
        }

        /* Attach to <body> (outside Angular's views, so route changes never
           discard it); CSS pins it to the bottom of the viewport. */
        if (!document.body) return;

        _bar = document.createElement('div');
        _bar.id = 'ng-status-bar';
        _bar.innerHTML =
            '<div class="ng-sb-inner">' +
                '<div class="ng-sb-slots" id="ng-sb-slots"></div>' +
                '<div class="ng-sb-dot" id="ng-sb-dot" title="Receiving live updates"></div>' +
                '<button class="ng-sb-toggle" id="ng-sb-toggle" ' +
                        'aria-label="Toggle status bar">' +
                    '<i class="fa-solid fa-chevron-down"></i>' +
                '</button>' +
            '</div>';

        document.body.appendChild(_bar);
        document.body.classList.add('ng-sb-bottom');
        document.getElementById('ng-sb-toggle').addEventListener('click', toggleCollapse);
        buildSlots();
        refresh();

        /* Restore collapsed state: collapsed unless the user expanded it */
        var collapsed = true;
        try { collapsed = localStorage.getItem('ng-sb-collapsed') !== '0'; } catch (e) {}
        if (collapsed) {
            _bar.classList.add('ng-sb--collapsed');
            document.getElementById('ng-sb-toggle').querySelector('i').className = 'fa-solid fa-chevron-up';
        }
    }

    function buildSlots() {
        var el = document.getElementById('ng-sb-slots');
        if (!el) return;
        el.innerHTML =
            '<div class="ng-sb-slot" id="ng-sb-lights">' +
                '<i class="fa-solid fa-lightbulb"></i>' +
                '<span>–</span>' +
            '</div>' +
            '<div class="ng-sb-sep"></div>' +
            '<div class="ng-sb-slot" id="ng-sb-temp">' +
                '<i class="fa-solid fa-thermometer-half" style="color:var(--dz-accent)"></i>' +
                '<span>–</span>' +
            '</div>' +
            '<div class="ng-sb-sep"></div>' +
            '<div class="ng-sb-slot" id="ng-sb-power">' +
                '<i class="fa-solid fa-bolt" style="color:var(--dz-success)"></i>' +
                '<span>–</span>' +
            '</div>' +
            /* Attention Center chip — hidden until attention-center.js reports items */
            '<div class="ng-sb-slot ng-sb-slot--attn" id="ng-sb-attn" role="button" tabindex="0" hidden>' +
                '<i class="fa-solid fa-triangle-exclamation"></i>' +
                '<span>0</span>' +
            '</div>';
        syncAttention();
    }

    /* Mirror the Attention Center count into the chip. The panel itself opens
       from a delegated click handler in attention-center.js. */
    function syncAttention(counts) {
        var el = document.getElementById('ng-sb-attn');
        if (!el) return;
        if (!counts && window.ngAttention) counts = window.ngAttention.getCounts();
        var n = counts ? counts.total : 0;
        el.hidden = n <= 0;
        el.classList.toggle('ng-sb-slot--danger', !!counts && counts.severity === 'danger');
        el.setAttribute('aria-label', n + (n === 1 ? ' item needs attention' : ' items need attention') + ' (A)');
        el.title = 'Attention Center  [A]';
        setSlot('attn', String(n), counts && counts.severity === 'danger' ? 'var(--dz-danger)' : 'var(--dz-warning)');
    }

    document.addEventListener('ng-attention-change', function (e) { syncAttention(e.detail); });
    document.addEventListener('keydown', function (e) {
        var el = e.target && e.target.closest && e.target.closest('#ng-sb-attn');
        if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click(); }
    });

    function setSlot(id, text, iconColor) {
        var el = document.getElementById('ng-sb-' + id);
        if (!el) return;
        var span = el.querySelector('span');
        var icon = el.querySelector('i');
        if (span) span.textContent = text;
        if (icon && iconColor) icon.style.color = iconColor;
    }

    /* ── Refresh ───────────────────────────────────────────────── */

    function refresh() {
        /* Count "on" devices by reading the DOM status cells */
        var onCount = 0;
        document.querySelectorAll('table[id^="itemtable"] td#status').forEach(function (td) {
            var s = (td.textContent || '').trim().toLowerCase();
            if (/^\s*on\b|^open$|^motion detected$|^active$|^alarm$/.test(s)) onCount++;
        });
        var lightsColor = onCount > 0 ? 'var(--dz-warning)' : 'var(--dz-text-faint)';
        setSlot('lights', onCount + '\u202fon', lightsColor);

        /* Temp and power from device cache (populated by live updates) */
        var tempStr  = null;
        var powerStr = null;
        var keys = Object.keys(_cache);
        for (var k = 0; k < keys.length; k++) {
            var d = _cache[keys[k]];
            var t = (d.Type || '').toLowerCase();
            if (!tempStr && t.indexOf('temp') !== -1) {
                var tv = d.Temp !== undefined ? d.Temp : parseFloat(d.Data);
                if (!isNaN(tv)) tempStr = tv.toFixed(1) + '°';
            }
            if (!powerStr && (t.indexOf('p1') !== -1 || t.indexOf('energy') !== -1 || t.indexOf('usage') !== -1)) {
                var pv = (d.Usage || d.Data || '').split(';')[0];
                if (pv) powerStr = String(pv).trim();
            }
        }
        if (tempStr)  setSlot('temp',  tempStr,  null);
        if (powerStr) setSlot('power', powerStr, null);
    }

    /* ── Live dot pulse ────────────────────────────────────────── */

    function pulse() {
        var dot = document.getElementById('ng-sb-dot');
        if (!dot) return;
        dot.classList.remove('ng-sb-dot--pulse');
        void dot.offsetWidth; /* force reflow to restart animation */
        dot.classList.add('ng-sb-dot--pulse');
    }

    /* ── Collapse ──────────────────────────────────────────────── */

    function toggleCollapse() {
        if (!_bar) return;
        var collapsed = _bar.classList.toggle('ng-sb--collapsed');
        var btn = document.getElementById('ng-sb-toggle');
        if (btn) {
            btn.querySelector('i').className =
                'fa-solid ' + (collapsed ? 'fa-chevron-up' : 'fa-chevron-down');
        }
        try { localStorage.setItem('ng-sb-collapsed', collapsed ? '1' : '0'); } catch (e) {}
    }

    /* ── Device update ─────────────────────────────────────────── */

    function onDeviceUpdate(device) {
        var idx = String(device.idx || device.ID || '');
        if (idx) _cache[idx] = device;
        pulse();
        refresh();
    }

    /* Expose so demo pages can simulate live data */
    window.ngStatusBarUpdate = onDeviceUpdate;

    /* ── Angular hooks ─────────────────────────────────────────── */

    function attachHooks() {
        if (!window.angular) { setTimeout(attachHooks, 600); return; }
        var bodyEl = angular.element(document.body);
        if (!bodyEl || !bodyEl.injector || !bodyEl.injector()) {
            setTimeout(attachHooks, 400);
            return;
        }
        try {
            var $rs = bodyEl.injector().get('$rootScope');
            $rs.$on('device_update',       function (e, d) { onDeviceUpdate(d); });
            $rs.$on('$routeChangeSuccess', function ()     { setTimeout(function () { buildBar(); refresh(); }, 600); });
        } catch (e) {
            setTimeout(attachHooks, 600);
        }
    }

    /* ── Init ──────────────────────────────────────────────────── */

    function init() {
        buildBar();
        attachHooks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
