/* ── Feature 15: Room Filter Pill-Bar ──────────────────────────────
   Injects a horizontal pill-bar above the device grid on any page
   that has two or more room sections (section.dashCategory).

   Clicking a pill instantly shows/hides rooms — no page reload.
   The bar rebuilds on Angular route changes.
   Mobile: horizontally scrollable, larger touch targets.
──────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var _active = 'all';
    var _bar    = null;

    /* ── Room detection ────────────────────────────────────────── */

    function getRooms() {
        var rooms = [];
        document.querySelectorAll('section.dashCategory').forEach(function (sec) {
            var h2 = sec.querySelector('h2');
            var n  = h2 ? h2.textContent.trim() : '';
            if (n && rooms.indexOf(n) === -1) rooms.push(n);
        });
        return rooms;
    }

    /* ── Filter application ────────────────────────────────────── */

    function applyFilter(room) {
        _active = room;
        document.querySelectorAll('section.dashCategory').forEach(function (sec) {
            var h2 = sec.querySelector('h2');
            var n  = h2 ? h2.textContent.trim() : '';
            sec.classList.toggle('ng-rf-hidden', room !== 'all' && n !== room);
        });
        if (_bar) {
            _bar.querySelectorAll('.ng-rf-pill').forEach(function (p) {
                var active = p.dataset.room === room;
                p.classList.toggle('ng-rf-pill--active', active);
                p.setAttribute('aria-selected', active ? 'true' : 'false');
            });
        }
    }

    /* ── Pill-bar DOM ──────────────────────────────────────────── */

    function buildBar() {
        var rooms    = getRooms();
        var existing = document.getElementById('ng-room-filter');

        /* Remove bar if fewer than 2 rooms on this page */
        if (rooms.length < 2) {
            if (existing) { existing.remove(); _bar = null; }
            return;
        }

        /* If rooms unchanged, reuse existing bar */
        if (existing) {
            var pills   = existing.querySelectorAll('.ng-rf-pill[data-room]:not([data-room="all"])');
            var current = Array.prototype.map.call(pills, function (p) { return p.dataset.room; });
            if (JSON.stringify(current) === JSON.stringify(rooms)) {
                _bar = existing;
                return;
            }
            existing.remove();
        }

        var firstSection = document.querySelector('section.dashCategory');
        if (!firstSection || !firstSection.parentNode) return;

        _bar = document.createElement('div');
        _bar.id = 'ng-room-filter';
        _bar.setAttribute('role', 'tablist');
        _bar.setAttribute('aria-label', 'Filter by room');

        function makePill(label, key) {
            var btn = document.createElement('button');
            btn.className    = 'ng-rf-pill' + (key === _active ? ' ng-rf-pill--active' : '');
            btn.dataset.room = key;
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', key === _active ? 'true' : 'false');
            btn.textContent  = label;
            btn.addEventListener('click', function () { applyFilter(key); });
            return btn;
        }

        _bar.appendChild(makePill('All', 'all'));
        rooms.forEach(function (r) { _bar.appendChild(makePill(r, r)); });

        firstSection.parentNode.insertBefore(_bar, firstSection);
        applyFilter(_active); /* re-apply current filter to new DOM state */
    }

    /* ── Angular route hooks ───────────────────────────────────── */

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
                _active = 'all'; /* reset selection on page navigation */
                setTimeout(buildBar, 500);
            });
            $rs.$on('$viewContentLoaded', function () { setTimeout(buildBar, 300); });
        } catch (e) {
            setTimeout(attachHooks, 600);
        }
    }

    /* ── Init ──────────────────────────────────────────────────── */

    function init() {
        setTimeout(buildBar, 500); /* allow Angular to render rooms first */
        attachHooks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
