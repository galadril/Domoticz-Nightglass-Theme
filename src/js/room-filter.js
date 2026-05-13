/* ── Feature 14: Room Filter Pill-Bar ──────────────────────────────
   Client-side multi-room filter — no page reloads.

   On first build we quietly force #comboroom to "All" so every device
   is in the DOM, then fetch plan→device mappings from the API.
   Subsequent pill clicks toggle room selections and filter cards
   entirely in JS — instant, multi-select, toggle-to-clear.

   #tbFiltRooms stays hidden via CSS across all route changes.
   Plan→device maps are cached for the whole session.
──────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    /* ── Module state ───────────────────────────────────────────── */

    var _pills             = [];     /* pill button elements */
    var _planOptions       = [];     /* [{label, index, planIdx}] from combobox */
    var _selected          = [];     /* planIdx strings currently active */
    var _planCache         = {};     /* planIdx → {deviceIdx: true} */
    var _planQueue         = {};     /* planIdx → [callbacks] while loading */
    var _topbarRetries     = 0;
    var _comboRetries      = 0;
    var MAX_TOPBAR         = 15;     /* × 100ms = 1.5s */
    var MAX_COMBO          = 8;      /* × 300ms = 2.4s */
    var _safetyTimer       = null;
    var _preserveNextRoute = false;  /* suppress bar removal on forced All reload */
    var _savedSelected     = null;   /* selection preserved across detail-page navigation */
    var _savedMainPath     = null;   /* main-page hash path that triggered the save */
    var _cameFromDD        = false;  /* arrived via DD openRoomPlan — show back button */
    var _$route            = null;   /* cached Angular $route service for reload */

    /* ══ Route path helpers ══════════════════════════════════════════ */

    /* Returns the current hash path without leading "#/" (e.g. "Switches"). */
    function currentHashPath() {
        return (window.location.hash || '').replace(/^#\/?/, '');
    }

    /* Detail pages have multiple path segments (e.g. "Devices/42/Edit", "LightLog/42").
       Main list pages are single-segment (e.g. "Switches", "Temperature"). */
    function isDetailPath(path) {
        return path.indexOf('/') !== -1;
    }

    /* ══ Topbar reveal ══════════════════════════════════════════════ */

    function revealTopBar() {
        if (_safetyTimer) { clearTimeout(_safetyTimer); _safetyTimer = null; }
        var tb = document.getElementById('topBar');
        if (tb) tb.classList.add('ng-topbar--ready');
    }

    function scheduleRevealFallback() {
        if (_safetyTimer) clearTimeout(_safetyTimer);
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
        btn.innerHTML =
            '<i class="fa-solid fa-sliders"></i>' +
            '<span class="ng-rf-toggle-label">Rooms</span>' +
            '<span class="ng-rf-toggle-count"></span>';
        btn.addEventListener('click', toggleStrip);

        searchBar.appendChild(btn);
    }

    function toggleStrip() {
        var rf  = document.getElementById('ng-room-filter');
        var btn = document.getElementById('ng-rf-toggle');
        if (!rf || !btn) return;
        var open = rf.classList.toggle('ng-rf--open');
        btn.classList.toggle('ng-rf-toggle-btn--open', open);
        btn.setAttribute('aria-expanded', String(open));
    }

    /* ══ Combobox options ═══════════════════════════════════════════ */

    function readOptions() {
        var sel = document.getElementById('comboroom');
        if (!sel || !sel.options.length) return [];
        return Array.prototype.slice.call(sel.options).map(function (o, i) {
            /* AngularJS serialises ng-value as "number:0" / "string:2" */
            var planIdx = (o.value || '').replace(/^(?:number|string):/, '');
            return { label: o.textContent.trim(), index: i, planIdx: planIdx };
        });
    }

    /* ══ Plan → device cache ════════════════════════════════════════ */

    /* Fetch device idxes for one plan; results are cached for the session. */
    function fetchPlan(planIdx, cb) {
        if (_planCache.hasOwnProperty(planIdx)) { cb(); return; }
        if (_planQueue[planIdx]) { _planQueue[planIdx].push(cb); return; }
        _planQueue[planIdx] = [cb];

        $.getJSON('json.htm?type=command&param=getplandevices&idx=' + planIdx,
            function (data) {
                var set = {};
                (data.result || []).forEach(function (d) {
                    var id = String(d.devidx || d.idx || '');
                    if (id) set[id] = true;
                });
                _planCache[planIdx] = set;
                (_planQueue[planIdx] || []).forEach(function (fn) { fn(); });
                delete _planQueue[planIdx];
            }
        ).fail(function () {
            _planCache[planIdx] = {};
            (_planQueue[planIdx] || []).forEach(function (fn) { fn(); });
            delete _planQueue[planIdx];
        });
    }

    /* Pre-warm cache for all plans in the background */
    function preFetchAll() {
        _planOptions.forEach(function (o) {
            if (o.planIdx !== '0') fetchPlan(o.planIdx, function () {});
        });
    }

    /* ══ DOM card helpers ═══════════════════════════════════════════ */

    /* Extract device idx from card element.
       Dashboard pages:   id="light_42" / "temp_42" → "42"
       Tab pages (Lights, Scenes, etc.): id="42"    → "42" */
    function cardIdx(card) {
        var id = card.id || '';
        var m  = id.match(/_(\d+)$/) || id.match(/^(\d+)$/);
        return m ? m[1] : null;
    }

    /* Collect all device card elements on the current page.
       Dashboard uses .movable wrappers (id="light_42").
       Tab pages use the outer custom element with class "span4 itemBlock" (id="42").
       Mobile dashboard uses <tr id="light_42"> rows in table.mobileitem.
       The outer element is preferred over the inner div so that hiding it cleanly
       removes the entire widget including spacing. */
    function getCards() {
        var cards = [];
        document.querySelectorAll('.movable').forEach(function (el) { cards.push(el); });
        document.querySelectorAll('.span4.itemBlock').forEach(function (el) {
            if (!el.closest('.movable')) cards.push(el);
        });
        /* Mobile dashboard rows */
        document.querySelectorAll('.dashboardMobile table.mobileitem tbody tr[id]').forEach(function (el) {
            cards.push(el);
        });
        return cards;
    }

    /* ══ Filter application ═════════════════════════════════════════ */

    function applyFilter() {
        var showAll = (_selected.length === 0);
        var cards   = getCards();

        cards.forEach(function (card) {
            var show = showAll;
            if (!show) {
                var idx = cardIdx(card);
                if (!idx) {
                    show = true;   /* can't determine — keep visible */
                } else {
                    for (var i = 0; i < _selected.length; i++) {
                        var set = _planCache[_selected[i]];
                        if (set && set[idx]) { show = true; break; }
                    }
                }
            }
            card.classList.toggle('ng-rf-filtered', !show);
        });

        /* Hide sections that have no visible cards */
        document.querySelectorAll('section.dashCategory').forEach(function (sec) {
            var hasVisible = !!sec.querySelector(
                '.movable:not(.ng-rf-filtered), tr[id]:not(.ng-rf-filtered)'
            );
            sec.classList.toggle('ng-rf-section-hidden', !hasVisible);
        });

        syncPills();
        uncloak();
    }

    /* ══ Pill selection logic ════════════════════════════════════════ */

    function onPillClick(planIdx) {
        if (planIdx === '0') {
            /* "All" → clear all filters */
            _selected = [];
            applyFilter();
            return;
        }

        var pos = _selected.indexOf(planIdx);
        if (pos !== -1) {
            _selected.splice(pos, 1);   /* deselect */
        } else {
            _selected.push(planIdx);    /* select */
        }

        if (_selected.length === 0) {
            applyFilter();
            return;
        }

        /* If the native combobox is not at "All", only the currently-selected
           room's cards are in the DOM. Force "All" first so Angular loads every
           device card; applyFilter() will be called by buildBar() after the
           resulting $viewContentLoaded. */
        var sel = document.getElementById('comboroom');
        if (sel && sel.selectedIndex !== 0) {
            /* Pre-warm cache in background while Angular reloads */
            _selected.forEach(function (p) {
                if (!_planCache.hasOwnProperty(p)) fetchPlan(p, function () {});
            });
            forceAllIfNeeded();
            return;
        }

        /* All devices are already in the DOM — fetch uncached plans then filter */
        var uncached = _selected.filter(function (p) {
            return !_planCache.hasOwnProperty(p);
        });
        if (uncached.length === 0) {
            applyFilter();
            return;
        }
        var pending = uncached.length;
        uncached.forEach(function (p) {
            fetchPlan(p, function () {
                if (--pending === 0) applyFilter();
            });
        });
    }

    function syncPills() {
        _pills.forEach(function (pill) {
            var pi     = pill.dataset.planIdx;
            var active = (pi === '0') ? _selected.length === 0
                                      : _selected.indexOf(pi) !== -1;
            pill.classList.toggle('ng-rf-pill--active', active);
            pill.setAttribute('aria-selected', String(active));
        });

        /* Update toggle button count badge */
        var btn   = document.getElementById('ng-rf-toggle');
        var count = btn && btn.querySelector('.ng-rf-toggle-count');
        if (count) {
            count.textContent    = _selected.length > 0 ? String(_selected.length) : '';
            count.style.display  = _selected.length > 0 ? 'inline-flex' : 'none';
        }
        if (btn) {
            btn.classList.toggle('ng-rf-toggle-btn--filtered', _selected.length > 0);
        }
    }

    /* ══ Force "All" in Angular combobox ════════════════════════════ */

    /* Ensures all devices are loaded in the DOM for client-side filtering.
       Sets a flag so the resulting route change doesn't destroy the pill bar.
       Also hides the device grid while Angular reloads to prevent a flash of
       all-devices before applyFilter() runs. */
    function forceAllIfNeeded() {
        var sel = document.getElementById('comboroom');
        if (!sel || sel.selectedIndex === 0) return;  /* already "All" */
        _preserveNextRoute = true;
        /* Cloak device grid to avoid a visible flash of unfiltered content */
        document.body.classList.add('ng-rf-reloading');
        sel.selectedIndex  = 0;
        $(sel).trigger('change');   /* triggers Angular route change */
    }

    /* Remove the reloading cloak after applyFilter() has run */
    function uncloak() {
        document.body.classList.remove('ng-rf-reloading');
    }

    /* ══ Mobile dashboard helpers ════════════════════════════════════ */

    /* Attach a live-search listener that filters mobile <tr> rows.
       The native WatchLiveSearch targets .itemBlock divs, not <tr> rows,
       so we handle mobile rows ourselves. */
    function attachMobileSearch() {
        var input = document.querySelector('.jsLiveSearch');
        if (!input || input._ngMobileSearch) return;
        input._ngMobileSearch = true;
        input.addEventListener('input', function () {
            var q = (this.value || '').trim().toLowerCase();
            document.querySelectorAll('.dashboardMobile table.mobileitem tbody tr[id]')
                .forEach(function (row) {
                    var match = !q || (row.textContent || '').toLowerCase().indexOf(q) !== -1;
                    row.classList.toggle('ng-mobile-search-hidden', !match);
                });
        });
    }

    /* Detect mobile dashboard and set body class so CSS can target it.
       Also attaches the mobile search handler.
       Called inside buildBar() once #topBar is confirmed present. */
    function setupMobilePage() {
        var isMobile = !!document.querySelector('.dashboardMobile');
        document.body.classList.toggle('ng-mobile-dashboard', isMobile);
        if (isMobile) {
            /* Re-attach on each route load in case the input was recreated */
            setTimeout(attachMobileSearch, 200);
        }
    }

    /* ══ Build / remove bar ═════════════════════════════════════════ */

    function removeBar() {
        var rf  = document.getElementById('ng-room-filter');
        var btn = document.getElementById('ng-rf-toggle');
        var bb  = document.getElementById('ng-dd-back-btn');
        if (rf)  rf.remove();
        if (btn) btn.remove();
        if (bb)  bb.remove();
        _pills = [];
    }

    /* Inject a "← DD" back button as the first item of #ng-room-filter.
       Only shown when the user arrived via DD's openRoomPlan(). */
    function injectDDBackButton() {
        if (!_cameFromDD) return;
        if (document.getElementById('ng-dd-back-btn')) return;
        var rf = document.getElementById('ng-room-filter');
        if (!rf) return;

        /* Verify DD is enabled on this install */
        try {
            var rs = angular.element(document.body).injector().get('$rootScope');
            if (!rs.config || !rs.config.EnableTabDashboardDynamic) return;
        } catch (e) { return; }

        var btn = document.createElement('button');
        btn.id        = 'ng-dd-back-btn';
        btn.className = 'ng-dd-back-btn';
        btn.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
        btn.setAttribute('title', 'Back to Dynamic Dashboard');
        btn.addEventListener('click', function () {
            if (window.myglobals) { window.myglobals.LastPlanSelected = 0; }
            _cameFromDD = false;
            _selected   = [];
            removeBar();
            /* Reload the route — since _forceClassicDashboard is false, DD renders.
               Don't wrap in $apply if a digest is already running. */
            try {
                var inj    = angular.element(document.body).injector();
                var $route = _$route || inj.get('$route');
                var $rsc   = inj.get('$rootScope');
                if ($rsc.$$phase) {
                    $route.reload();
                } else {
                    $rsc.$apply(function () { $route.reload(); });
                }
            } catch (e) {
                /* Force a hash round-trip so Angular sees the change even when
                   we're already at #/Dashboard (same hash = no hashchange event). */
                var base = window.location.href.replace(/#.*$/, '');
                window.location.replace(base + '#/');
                setTimeout(function () { window.location.hash = '#/Dashboard'; }, 30);
            }
        });

        /* Prepend before the room pills inside the filter bar */
        rf.insertBefore(btn, rf.firstChild);
    }

    /* Apply the filter once all selected plans are present in the cache.
       Called from buildBar() instead of raw setTimeout(applyFilter, 300)
       so the filter is never applied before the API data is ready. */
    function applyWhenCached() {
        var missing = _selected.filter(function (p) {
            return !_planCache.hasOwnProperty(p);
        });
        if (!missing.length) { applyFilter(); return; }
        var done = 0;
        missing.forEach(function (p) {
            fetchPlan(p, function () {
                if (++done === missing.length) applyFilter();
            });
        });
    }

    function buildBar() {
        /* Phase 1: wait for #topBar */
        var topBar = document.getElementById('topBar');
        if (!topBar) {
            if (_topbarRetries < MAX_TOPBAR) {
                _topbarRetries++;
                setTimeout(buildBar, 100);
            } else { revealTopBar(); }
            return;
        }
        _topbarRetries = 0;

        /* Detect mobile dashboard + attach mobile search (independent of comboroom) */
        setupMobilePage();

        /* Phase 2: no comboroom → page has no room plans */
        var sel = document.getElementById('comboroom');
        if (!sel) { removeBar(); revealTopBar(); return; }

        /* Phase 3: comboroom exists but not populated yet */
        var opts = readOptions();
        if (opts.length < 2) {
            if (_comboRetries < MAX_COMBO) {
                _comboRetries++;
                setTimeout(buildBar, 300);
            } else { removeBar(); revealTopBar(); }
            return;
        }
        _comboRetries  = 0;
        _planOptions   = opts;

        /* If comboroom was pre-selected (e.g. by DD's openRoomPlan) and no pill
           is active yet, auto-activate the matching pill and force "All" so all
           device cards are loaded into the DOM for client-side filtering. */
        if (_selected.length === 0) {
            var nativeSel = document.getElementById('comboroom');
            if (nativeSel && nativeSel.selectedIndex > 0) {
                var nativeOpt    = nativeSel.options[nativeSel.selectedIndex];
                var nativePlanIdx = (nativeOpt.value || '').replace(/^(?:number|string):/, '');
                if (nativePlanIdx && nativePlanIdx !== '0') {
                    _selected   = [nativePlanIdx];
                    /* Track that we arrived via DD room plan so we can show a back button */
                    _cameFromDD = !!(window.myglobals && window.myglobals.LastPlanSelected);
                }
            }
        }

        /* Already correct number of pills? Sync + reveal. */
        var existing = document.getElementById('ng-room-filter');
        if (existing && _pills.length === opts.length) {
            syncPills();
            injectToggleBtn();
            injectDDBackButton();
            revealTopBar();
            /* Only reset the native combobox when a pill filter is active;
               otherwise the user's own room selection must be respected. */
            if (_selected.length > 0) forceAllIfNeeded();
            if (_selected.length > 0) setTimeout(applyWhenCached, 100);
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
            btn.className          = 'ng-rf-pill';
            btn.dataset.planIdx    = r.planIdx;
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', 'false');
            btn.textContent = r.label;
            (function (pi) {
                btn.addEventListener('click', function () { onPillClick(pi); });
            }(r.planIdx));
            bar.appendChild(btn);
            _pills.push(btn);
        });

        /* Inject after ng-include wrapper → between topbar and page content */
        var anchor = topBar.parentNode;
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(bar, anchor.nextSibling);
        }

        syncPills();
        injectToggleBtn();
        injectDDBackButton();
        revealTopBar();

        /* Only reset the native combobox to "All" when a pill filter is active —
           all device cards must be in the DOM for client-side filtering to work.
           When no pill is active the user's native combobox selection is respected. */
        if (_selected.length > 0) forceAllIfNeeded();
        preFetchAll();

        /* If selection was restored after returning from a detail page, re-apply it */
        if (_selected.length > 0) setTimeout(applyWhenCached, 100);
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
            try { _$route = bodyEl.injector().get('$route'); } catch (e) {}

            $rs.$on('$routeChangeStart', function () {
                /* Save the active selection before leaving a main list page so we
                   can restore it if the user returns from a detail sub-page. */
                var path = currentHashPath();
                if (!isDetailPath(path) && _selected.length > 0) {
                    _savedMainPath = path;
                    _savedSelected = _selected.slice();
                }
            });

            $rs.$on('$routeChangeSuccess', function () {
                if (_preserveNextRoute) {
                    /* This route change was triggered by our forceAllIfNeeded —
                       don't tear down the bar, just let Angular rebuild devices */
                    _preserveNextRoute = false;
                    return;
                }

                var newPath = currentHashPath();

                if (isDetailPath(newPath)) {
                    /* Navigating into a detail sub-page (edit / timers / log / etc.).
                       Remove the bar (it has no place there) but keep _selected so
                       it can be restored when the user comes back. */
                    removeBar();
                    document.body.classList.remove('ng-mobile-dashboard');

                } else if (_savedMainPath && newPath === _savedMainPath) {
                    /* Returning to the same main page after a detail sub-page visit —
                       restore the saved selection; applyFilter() runs inside buildBar(). */
                    removeBar();
                    document.body.classList.remove('ng-mobile-dashboard');
                    _selected      = _savedSelected ? _savedSelected.slice() : [];
                    _savedSelected = null;
                    _savedMainPath = null;
                    /* Cloak the device grid immediately so devices don't flash
                       unfiltered while Angular renders; uncloak() is called by applyFilter().
                       Safety: force-uncloak after 2s in case applyFilter() never fires. */
                    if (_selected.length > 0) {
                        document.body.classList.add('ng-rf-reloading');
                        setTimeout(uncloak, 2000);
                    }

                } else {
                    /* Real navigation to a different main page — full reset. */
                    removeBar();
                    document.body.classList.remove('ng-mobile-dashboard');
                    _selected      = [];
                    _savedSelected = null;
                    _savedMainPath = null;
                    _cameFromDD    = false;

                    /* Detect DD→classic navigation via openRoomPlan():
                       $routeChangeSuccess fires BEFORE the classic dashboard
                       controller runs, so we can capture and clear
                       LastPlanSelected here. The classic dashboard then loads
                       with All devices (no room pre-selection), which means
                       forceAllIfNeeded() is unnecessary — one render only.
                       The cloak hides everything until applyFilter() runs. */
                    var ddPlan = window.myglobals &&
                                 Number(window.myglobals.LastPlanSelected);
                    if (ddPlan) {
                        window.myglobals.LastPlanSelected = 0;
                        _selected   = [String(ddPlan)];
                        _cameFromDD = true;
                        document.body.classList.add('ng-rf-reloading');
                        setTimeout(uncloak, 2000);
                    }
                }

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

            /* Re-apply active filter after Angular updates device cards */
            $rs.$on('device_update', function () {
                if (_selected.length > 0) setTimeout(applyFilter, 80);
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
