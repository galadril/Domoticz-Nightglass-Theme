/* ── Feature 14: Room Filter Pill-Bar ──────────────────────────────
   Injects a toggle button ("Rooms") next to the command palette
   trigger inside #tbFiltSearch.  Clicking it slides open a pill
   strip below #topBar with the Domoticz room plans.

   Also acts as topbar reveal coordinator: #topBar starts at opacity:0
   (CSS) and is made visible once all topbar JS work is done, so the
   user never sees a half-built topbar on page load or route change.

   Room plans come from #comboroom (Angular-populated select).
   #tbFiltRooms is hidden via CSS so it stays gone across re-renders.
   Clicking a pill drives #comboroom + triggers ng-change → Angular
   filters devices exactly as with the original dropdown.
──────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var _pills          = [];
    var _topbarRetries  = 0;   /* waiting for #topBar to appear in DOM */
    var _comboRetries   = 0;   /* waiting for #comboroom to be populated */
    var MAX_TOPBAR      = 15;  /* × 100ms = 1.5s max wait for topbar */
    var MAX_COMBO       = 8;   /* × 300ms = 2.4s max wait for comboroom options */
    var _safetyTimer    = null;

    /* ══ Topbar reveal ══════════════════════════════════════════════ */

    function revealTopBar() {
        if (_safetyTimer) { clearTimeout(_safetyTimer); _safetyTimer = null; }
        var tb = document.getElementById('topBar');
        if (tb) tb.classList.add('ng-topbar--ready');
        /* Pills strip visibility is user-controlled — not revealed here */
    }

    function scheduleRevealFallback() {
        if (_safetyTimer) clearTimeout(_safetyTimer);
        /* Always reveal topbar within 1.2 s even if something goes wrong */
        _safetyTimer = setTimeout(revealTopBar, 1200);
    }

    /* ══ Toggle button ══════════════════════════════════════════════ */

    function injectToggleBtn() {
        if (document.getElementById('ng-rf-toggle')) return;
        var searchBar = document.getElementById('tbFiltSearch');
        if (!searchBar) return;

        var btn = document.createElement('button');
        btn.id        = 'ng-rf-toggle';
        btn.className = 'ng-rf-toggle-btn';
        btn.setAttribute('aria-label',    'Toggle room filter');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<i class="fa-solid fa-sliders"></i>' +
                        '<span class="ng-rf-toggle-label">Rooms</span>';
        btn.addEventListener('click', toggleFilter);

        /* Insert immediately after the command palette trigger */
        var cmdBtn = searchBar.querySelector('.dz-cmd-palette-trigger');
        if (cmdBtn && cmdBtn.nextSibling) {
            searchBar.insertBefore(btn, cmdBtn.nextSibling);
        } else if (cmdBtn) {
            searchBar.appendChild(btn);
        } else {
            searchBar.appendChild(btn);
        }
    }

    function toggleFilter() {
        var rf  = document.getElementById('ng-room-filter');
        var btn = document.getElementById('ng-rf-toggle');
        if (!rf || !btn) return;
        var open = rf.classList.toggle('ng-rf--open');
        btn.classList.toggle('ng-rf-toggle-btn--active', open);
        btn.setAttribute('aria-expanded', String(open));
    }

    function closeFilter() {
        var rf  = document.getElementById('ng-room-filter');
        var btn = document.getElementById('ng-rf-toggle');
        if (rf)  rf.classList.remove('ng-rf--open');
        if (btn) {
            btn.classList.remove('ng-rf-toggle-btn--active');
            btn.setAttribute('aria-expanded', 'false');
        }
    }

    /* ══ Room options ═══════════════════════════════════════════════ */

    function getOptions() {
        var sel = document.getElementById('comboroom');
        if (!sel || !sel.options.length) return [];
        return Array.prototype.slice.call(sel.options).map(function (o, i) {
            return { label: o.textContent.trim(), index: i };
        });
    }

    /* ══ Drive Angular combobox ═════════════════════════════════════ */

    function selectRoom(index) {
        var sel = document.getElementById('comboroom');
        if (!sel) return;
        sel.selectedIndex = index;
        $(sel).trigger('change');   /* jQuery always present in Domoticz */
        syncActive();
    }

    function syncActive() {
        var sel = document.getElementById('comboroom');
        var cur = sel ? sel.selectedIndex : 0;
        _pills.forEach(function (p, i) {
            var on = (i === cur);
            p.classList.toggle('ng-rf-pill--active', on);
            p.setAttribute('aria-selected', String(on));
        });
    }

    /* ══ Build / remove bar ═════════════════════════════════════════ */

    function removeBar() {
        var rf  = document.getElementById('ng-room-filter');
        var btn = document.getElementById('ng-rf-toggle');
        if (rf)  rf.remove();
        if (btn) btn.remove();
        _pills = [];
    }

    function buildBar() {
        var topBar = document.getElementById('topBar');

        /* Phase 1: #topBar not in DOM yet — Angular still rendering the view.
           Retry quickly; reveal if it never appears.                          */
        if (!topBar) {
            if (_topbarRetries < MAX_TOPBAR) {
                _topbarRetries++;
                setTimeout(buildBar, 100);
            } else {
                revealTopBar();
            }
            return;
        }
        _topbarRetries = 0;

        var sel = document.getElementById('comboroom');

        /* Phase 2: #topBar ready but no comboroom → page has no room plans.
           Reveal the topbar immediately — no further retrying needed.         */
        if (!sel) {
            removeBar();
            revealTopBar();
            return;
        }

        /* Phase 3: comboroom exists but Angular hasn't populated its options yet */
        var opts = getOptions();
        if (opts.length < 2) {
            if (_comboRetries < MAX_COMBO) {
                _comboRetries++;
                setTimeout(buildBar, 300);
            } else {
                removeBar();
                revealTopBar();   /* comboroom stayed empty — reveal anyway */
            }
            return;
        }
        _comboRetries = 0;

        /* Already correct? Sync + ensure topbar visible. */
        var existing = document.getElementById('ng-room-filter');
        if (existing && _pills.length === opts.length) {
            syncActive();
            injectToggleBtn();
            revealTopBar();
            return;
        }

        /* Rebuild from scratch */
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

        /* Inject pill strip after the ng-include div that wraps #topBar */
        var anchor = topBar.parentNode;
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(bar, anchor.nextSibling);
        }

        syncActive();
        injectToggleBtn();
        revealTopBar();
    }

    /* ══ Angular hooks ══════════════════════════════════════════════ */

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
                removeBar();
                _topbarRetries = 0;
                _comboRetries  = 0;
                if (_safetyTimer) clearTimeout(_safetyTimer);
            });

            $rs.$on('$viewContentLoaded', function () {
                _topbarRetries = 0;
                _comboRetries  = 0;
                scheduleRevealFallback();
                setTimeout(buildBar, 150);
            });
        } catch (e) {
            setTimeout(attachHooks, 600);
        }
    }

    /* ══ Init ════════════════════════════════════════════════════════ */

    function init() {
        scheduleRevealFallback();
        setTimeout(buildBar, 300);
        attachHooks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
