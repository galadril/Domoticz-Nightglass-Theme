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

        /* Fetch any uncached plans then filter */
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
       Sets a flag so the resulting route change doesn't destroy the pill bar. */
    function forceAllIfNeeded() {
        var sel = document.getElementById('comboroom');
        if (!sel || sel.selectedIndex === 0) return;  /* already "All" */
        _preserveNextRoute = true;
        sel.selectedIndex  = 0;
        $(sel).trigger('change');   /* triggers Angular route change */
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
        if (rf)  rf.remove();
        if (btn) btn.remove();
        _pills = [];
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

        /* Already correct number of pills? Sync + reveal. */
        var existing = document.getElementById('ng-room-filter');
        if (existing && _pills.length === opts.length) {
            syncPills();
            injectToggleBtn();
            revealTopBar();
            forceAllIfNeeded();
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
        revealTopBar();

        /* Force "All" so all devices are in DOM, then pre-warm plan cache */
        forceAllIfNeeded();
        preFetchAll();
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
                if (_preserveNextRoute) {
                    /* This route change was triggered by our forceAllIfNeeded —
                       don't tear down the bar, just let Angular rebuild devices */
                    _preserveNextRoute = false;
                    return;
                }
                removeBar();
                document.body.classList.remove('ng-mobile-dashboard');
                _selected      = [];   /* reset selection on real navigation */
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
