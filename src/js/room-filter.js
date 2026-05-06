/* ── Feature 14: Room Filter Pill-Bar ──────────────────────────────
   Replaces the #tbFiltRooms combobox in the topbar with pill buttons
   that drive the same Angular ctrl.changeRoom() logic.

   Room plans come from #comboroom (populated by Angular).
   Clicking a pill sets the select value and triggers ng-change —
   Angular handles all device filtering exactly as with the dropdown.
   Mobile: scrollable strip, hides at very small widths.
──────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var _bar         = null;
    var _pills       = [];
    var _retries     = 0;
    var MAX_RETRIES  = 8;

    /* ── Read rooms from the Angular-populated combobox ────────── */

    function getOptions() {
        var select = document.getElementById('comboroom');
        if (!select || !select.options.length) return [];
        return Array.prototype.slice.call(select.options).map(function (opt, i) {
            return { label: opt.textContent.trim(), index: i };
        });
    }

    /* ── Select a room by option index ─────────────────────────── */

    function selectRoom(index) {
        var select = document.getElementById('comboroom');
        if (!select) return;
        select.selectedIndex = index;
        /* Trigger Angular ng-change via jQuery (Domoticz always has jQuery) */
        if (window.$) {
            $(select).trigger('change');
        } else {
            try { angular.element(select).triggerHandler('change'); } catch (e) {}
        }
        syncActive();
    }

    /* ── Sync pill highlight to current combobox selection ──────── */

    function syncActive() {
        var select = document.getElementById('comboroom');
        var idx    = select ? select.selectedIndex : 0;
        _pills.forEach(function (p, i) {
            var active = i === idx;
            p.classList.toggle('ng-rf-pill--active', active);
            p.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }

    /* ── Build pill bar ─────────────────────────────────────────── */

    function buildBar() {
        var tbFiltRooms = document.getElementById('tbFiltRooms');
        var opts        = getOptions();

        /* Comboroom not ready yet — retry */
        if (!tbFiltRooms || opts.length < 2) {
            if (_retries < MAX_RETRIES) {
                _retries++;
                setTimeout(buildBar, 400);
            }
            return;
        }
        _retries = 0;

        /* Already built with the same options? Just sync. */
        if (_bar && _pills.length === opts.length) {
            syncActive();
            return;
        }

        /* Remove stale bar */
        var existing = document.getElementById('ng-room-filter');
        if (existing) { existing.remove(); }
        _bar   = null;
        _pills = [];

        /* Build new bar */
        _bar = document.createElement('span');
        _bar.id = 'ng-room-filter';
        _bar.setAttribute('role', 'tablist');
        _bar.setAttribute('aria-label', 'Filter by room');

        opts.forEach(function (r) {
            var btn = document.createElement('button');
            btn.className = 'ng-rf-pill';
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', 'false');
            btn.textContent = r.label;
            (function (i) {
                btn.addEventListener('click', function () { selectRoom(i); });
            }(r.index));
            _bar.appendChild(btn);
            _pills.push(btn);
        });

        /* Inject after the original combobox span and hide it */
        tbFiltRooms.parentNode.insertBefore(_bar, tbFiltRooms.nextSibling);
        tbFiltRooms.style.display = 'none';

        syncActive();
    }

    /* ── Angular hooks ──────────────────────────────────────────── */

    function attachHooks() {
        if (!window.angular) { setTimeout(attachHooks, 600); return; }
        var bodyEl = angular.element(document.body);
        if (!bodyEl || !bodyEl.injector || !bodyEl.injector()) {
            setTimeout(attachHooks, 400);
            return;
        }
        try {
            var $rs = bodyEl.injector().get('$rootScope');
            $rs.$on('$routeChangeSuccess', function () {
                _retries = 0;
                setTimeout(buildBar, 500);
            });
            $rs.$on('$viewContentLoaded', function () {
                _retries = 0;
                setTimeout(buildBar, 300);
            });
        } catch (e) {
            setTimeout(attachHooks, 600);
        }
    }

    /* ── Init ───────────────────────────────────────────────────── */

    function init() {
        setTimeout(buildBar, 600);
        attachHooks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
