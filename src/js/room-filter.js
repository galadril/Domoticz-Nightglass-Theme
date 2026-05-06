/* ── Feature 14: Room Filter Pill-Bar ──────────────────────────────
   Injects a pill strip directly BELOW #topBar (sibling, not child)
   so it has its own full row — no topbar crowding.

   Room plans are read from #comboroom (Angular-populated select).
   #tbFiltRooms is hidden via CSS so it stays hidden across route
   changes without needing JS re-application.

   Clicking a pill drives #comboroom + triggers ng-change so Angular
   filters devices exactly as if the user picked from the dropdown.
──────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var _pills   = [];
    var _retries = 0;
    var MAX_RETRIES = 12;

    /* ── Read room options from the Angular-populated combobox ──── */

    function getOptions() {
        var sel = document.getElementById('comboroom');
        if (!sel || !sel.options.length) return [];
        return Array.prototype.slice.call(sel.options).map(function (o, i) {
            return { label: o.textContent.trim(), index: i };
        });
    }

    /* ── Drive the hidden combobox → Angular filters devices ────── */

    function selectRoom(index) {
        var sel = document.getElementById('comboroom');
        if (!sel) return;
        sel.selectedIndex = index;
        /* jQuery is always present in Domoticz */
        $(sel).trigger('change');
        syncActive();
    }

    /* ── Keep active pill in sync with select ───────────────────── */

    function syncActive() {
        var sel = document.getElementById('comboroom');
        var cur = sel ? sel.selectedIndex : 0;
        _pills.forEach(function (p, i) {
            var on = (i === cur);
            p.classList.toggle('ng-rf-pill--active', on);
            p.setAttribute('aria-selected', String(on));
        });
    }

    /* ── Remove bar from DOM ────────────────────────────────────── */

    function removeBar() {
        var el = document.getElementById('ng-room-filter');
        if (el) el.remove();
        _pills = [];
    }

    /* ── (Re)build bar ──────────────────────────────────────────── */

    function buildBar() {
        var opts   = getOptions();
        var topBar = document.getElementById('topBar');

        /* Not ready yet — retry */
        if (!topBar || opts.length < 2) {
            if (_retries < MAX_RETRIES) { _retries++; setTimeout(buildBar, 400); }
            else { removeBar(); }   /* page has no room plans */
            return;
        }
        _retries = 0;

        /* Bar already in DOM with the right number of pills? Just sync. */
        var existing = document.getElementById('ng-room-filter');
        if (existing && _pills.length === opts.length) {
            syncActive();
            return;
        }

        /* Start fresh */
        removeBar();

        var bar = document.createElement('div');
        bar.id = 'ng-room-filter';
        bar.setAttribute('role', 'tablist');
        bar.setAttribute('aria-label', 'Filter by room');

        opts.forEach(function (r) {
            var btn = document.createElement('button');
            btn.className = 'ng-rf-pill';
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', 'false');
            btn.textContent = r.label;
            (function (i) {
                btn.addEventListener('click', function () { selectRoom(i); });
            }(r.index));
            bar.appendChild(btn);
            _pills.push(btn);
        });

        /* Inject after the ng-include wrapper that contains #topBar
           so the pill strip sits between the topbar and page content  */
        var anchor = topBar.parentNode;   /* the ng-include div */
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(bar, anchor.nextSibling);
        }

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
            /* Route change: old view torn down — remove stale bar immediately */
            $rs.$on('$routeChangeSuccess', function () {
                removeBar();
                _retries = 0;
            });
            /* View rendered: rebuild after Angular finishes populating comboroom */
            $rs.$on('$viewContentLoaded', function () {
                _retries = 0;
                setTimeout(buildBar, 400);
            });
        } catch (e) {
            setTimeout(attachHooks, 600);
        }
    }

    /* ── Init ───────────────────────────────────────────────────── */

    function init() {
        setTimeout(buildBar, 800);   /* first load: give Angular time to render */
        attachHooks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
