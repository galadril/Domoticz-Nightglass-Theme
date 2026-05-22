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

    /* ── Debug logging ──────────────────────────────────────────── */

    /* Reads the session toggle from the Nightglass settings panel.
       Off by default — enable via Settings → Developer → Debug Logging. */
    function isDebugEnabled() {
        return !!(window.dzNightglassSettings &&
                  window.dzNightglassSettings.get('debugLogs'));
    }

    function log() {
        if (!isDebugEnabled()) return;
        var a = Array.prototype.slice.call(arguments);
        window.ngLog.apply(window, ['[RF]'].concat(a));
    }

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
    var _buildBarTimer     = null;   /* handle for pending buildBar timeout — cancelled on route change */
    var _preserveNextRoute = false;  /* suppress bar removal on forced All reload */
    var _savedSelected     = null;   /* selection preserved across detail-page navigation */
    var _savedMainPath     = null;   /* main-page hash path that triggered the save */
    var _cameFromDD        = false;  /* arrived via DD openRoomPlan — show back button */
    var _$route            = null;   /* cached Angular $route service for reload */
    var _loadAllMode       = false;  /* true while multi-room mode needs all-devices loaded */
    var _svcPatched        = false;  /* true after Angular dashboard services have been patched */
    var _stripWasOpen      = false;  /* strip open-state saved across removeBar() calls */

    /* ══ Route path helpers ══════════════════════════════════════════ */

    /* Returns the current hash path without leading "#/" and without query
       string (e.g. "#/Dashboard?room=5" → "Dashboard").
       Stripping the query string is critical: Domoticz encodes the selected
       comboroom as ?room=N in the URL.  Without stripping, "Dashboard?room=5"
       and "Dashboard?room=0" look like different pages to our path comparisons,
       causing $routeChangeSuccess to treat forceAllIfNeeded()'s own reload as a
       full page change and incorrectly resetting _selected. */
    function currentHashPath() {
        return (window.location.hash || '').replace(/^#\/?/, '').replace(/\?.*$/, '');
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

    /* Schedule a buildBar() call, cancelling any previously pending one.
       Using this instead of raw setTimeout() ensures stale retry timers
       from a previous route (e.g. DD view's Phase-1 topbar-wait loop)
       never fire on the newly loaded page. */
    function scheduleBuildBar(delay) {
        if (_buildBarTimer !== null) { clearTimeout(_buildBarTimer); _buildBarTimer = null; }
        _buildBarTimer = setTimeout(function () { _buildBarTimer = null; buildBar(); }, delay);
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
        /* Mobile drawer: show/hide backdrop */
        if (open) { showMobileBackdrop(); } else { hideMobileBackdrop(); }
    }

    /* ── Mobile backdrop helpers ────────────────────────────────── */

    function showMobileBackdrop() {
        if (window.innerWidth > 768) return;          /* desktop: no-op */
        if (document.getElementById('ng-rf-backdrop')) return;
        var bd = document.createElement('div');
        bd.id = 'ng-rf-backdrop';
        bd.addEventListener('click', closeDrawer);
        document.body.appendChild(bd);
        /* Force reflow so the CSS transition fires */
        bd.getBoundingClientRect();
        bd.classList.add('ng-rf-backdrop--visible');
    }

    function hideMobileBackdrop() {
        var bd = document.getElementById('ng-rf-backdrop');
        if (!bd) return;
        bd.classList.remove('ng-rf-backdrop--visible');
        setTimeout(function () { if (bd.parentNode) bd.parentNode.removeChild(bd); }, 280);
    }

    function closeDrawer() {
        var rf  = document.getElementById('ng-room-filter');
        var btn = document.getElementById('ng-rf-toggle');
        if (rf)  rf.classList.remove('ng-rf--open');
        if (btn) { btn.classList.remove('ng-rf-toggle-btn--open'); btn.setAttribute('aria-expanded', 'false'); }
        hideMobileBackdrop();
    }

    /* ══ Combobox options ═══════════════════════════════════════════ */

    function readOptions() {
        var sel = document.getElementById('comboroom');
        if (!sel || !sel.options.length) return [];
        return Array.prototype.slice.call(sel.options).map(function (o, i) {
            /* AngularJS serialises ng-value as "number:0" / "string:2" */
            var planIdx = (o.value || '').replace(/^(?:number|string):/, '');
            return { label: o.textContent.trim(), index: i, planIdx: planIdx };
        }).filter(function (r) {
            /* Exclude AngularJS "unknown option" placeholder (value="? string:0 ?")
               injected when the model value doesn't match any option yet. */
            if (r.planIdx.charAt(0) === '?') return false;
            /* Exclude Dynamic Dashboard layouts (value="dd:…") — navigation
               shortcuts, not room plans — so they don't appear as pills. */
            if (r.planIdx.indexOf('dd:') === 0) return false;
            return true;
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

    /* ══ DOM completeness check ═════════════════════════════════════ */

    /* Returns true if every device in the cached plan set is already present
       as a card in the current DOM.  When true, no Angular reload is needed
       and the room filter can be applied purely client-side.
       Returns false when the cache is not yet populated (safe: triggers reload). */
    function hasAllPlanDevicesInDOM(planIdx) {
        if (!_planCache.hasOwnProperty(planIdx)) return false;
        var needed = Object.keys(_planCache[planIdx]);
        if (!needed.length) return true;   /* empty plan — nothing missing */
        var cards  = getCards();
        var inDom  = {};
        cards.forEach(function (c) { var id = cardIdx(c); if (id) inDom[id] = true; });
        return needed.every(function (id) { return !!inDom[id]; });
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
            /* "All" → clear filter; if comboroom was at a specific plan reload to
               plan 0 so Domoticz restores the all-favourites device set. */
            _selected = [];
            _loadAllMode = false;
            window._ngRfLoadAllDevices = false;
            syncPills();   /* highlight "All" immediately, even before any reload */
            if (!forceAllIfNeeded()) applyFilter();
            return;
        }

        var pos = _selected.indexOf(planIdx);
        if (pos !== -1) {
            _selected.splice(pos, 1);   /* deselect */
        } else {
            _selected.push(planIdx);    /* select */
        }

        if (_selected.length === 0) {
            /* Deselected the last room — auto-switch to "All" */
            _loadAllMode = false;
            window._ngRfLoadAllDevices = false;
            syncPills();   /* highlight "All" immediately, even before any reload */
            if (!forceAllIfNeeded()) applyFilter();
            return;
        }

        /* Pre-warm cache for any newly-selected plans */
        _selected.forEach(function (p) {
            if (!_planCache.hasOwnProperty(p)) fetchPlan(p, function () {});
        });

        /* ensureDevicesLoaded() sets comboroom to the specific plan (single room,
           used=all → all devices) or plan 0 (multi-room, used=true → favourites).
           If a reload was triggered, $viewContentLoaded → buildBar() finishes the job. */
        if (ensureDevicesLoaded()) return;

        /* No reload needed — all required cards are already in the DOM; filter now. */
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
       all-devices before applyFilter() runs.
       Returns true when a reload was triggered, false when already at "All". */
    function forceAllIfNeeded() {
        var sel = document.getElementById('comboroom');
        if (!sel || sel.selectedIndex === 0) {
            log('forceAllIfNeeded: already All, no-op');
            return false;
        }
        log('forceAllIfNeeded: comboroom at index', sel.selectedIndex, '— forcing All');
        _preserveNextRoute = true;
        /* Cloak device grid to avoid a visible flash of unfiltered content */
        document.body.classList.add('ng-rf-reloading');
        sel.selectedIndex  = 0;
        $(sel).trigger('change');   /* triggers Angular route change */
        return true;
    }

    /* Schedule applyWhenCached at multiple offsets so late-rendering Angular
       cards are caught even when the first pass runs slightly too early.
       Only call this when no Angular reload is pending — if ensureDevicesLoaded()
       returned true the $viewContentLoaded → buildBar() cycle handles it. */
    function scheduleFilterPasses() {
        [100, 350, 700].forEach(function (delay) {
            setTimeout(function () {
                if (_selected.length > 0) applyWhenCached();
            }, delay);
        });
    }

    /* Helper: return the comboroom <option> index whose planIdx matches. -1 if none. */
    function comboroomIndexForPlan(planIdx) {
        var sel = document.getElementById('comboroom');
        if (!sel) return -1;
        for (var i = 0; i < sel.options.length; i++) {
            var pi = (sel.options[i].value || '').replace(/^(?:number|string):/, '');
            if (pi === planIdx) return i;
        }
        return -1;
    }

    /* Patch dashboardService.loadFavorites and livesocket.getJson so that when
       _loadAllMode is active, the dashboard loads every device (used=all, plan=0,
       favorite=0) instead of just favourites (used=true, plan=0, favorite=1).
       Called lazily before the first multi-room reload and idempotent thereafter. */
    function patchAngularServices() {
        if (_svcPatched) return;
        try {
            var inj = angular.element(document.body).injector();

            /* ── Patch dashboardService.loadFavorites (initial page load) ── */
            var svc = inj.get('dashboardService');
            if (!svc.__ngRfPatched) {
                var api      = inj.get('domoticzApi');
                var origLoad = svc.loadFavorites.bind(svc);
                svc.loadFavorites = function (planId) {
                    if (window._ngRfLoadAllDevices) {
                        /* Multi-room: load all USED/active devices (used=true), but
                           drop the favourite filter (favorite=0) so every configured
                           device is available for client-side room filtering.
                           We intentionally keep used=true (not used=all) to avoid
                           surfacing unconfigured / disabled device slots. */
                        log('loadFavorites: multi-room override — used=true, favorite=0, plan=0');
                        return api.sendRequest({
                            type: 'command', param: 'getdevices',
                            filter: 'all', used: 'true', favorite: 0,
                            order: '[Order]', plan: 0
                        }).then(function (data) {
                            return {
                                devices:        data.result || [],
                                lastUpdateTime: data.ActTime ? parseInt(data.ActTime) : 0,
                                sunrise:        data.Sunrise,
                                sunset:         data.Sunset,
                                serverTime:     data.ServerTime
                            };
                        });
                    }
                    return origLoad(planId);
                };
                svc.__ngRfPatched = true;
            }

            /* ── Patch livesocket.getJson (RefreshFavorites live-update calls) ── */
            var ls = inj.get('livesocket');
            if (!ls.__ngRfPatched) {
                var origGetJson = ls.getJson.bind(ls);
                ls.getJson = function (url, cb) {
                    if (window._ngRfLoadAllDevices &&
                            typeof url === 'string' &&
                            url.indexOf('param=getdevices') !== -1) {
                        /* Only drop the favourite flag — keep used=true so unconfigured
                           devices are not surfaced. */
                        url = url.replace(/\bfavorite=1\b/, 'favorite=0');
                        log('livesocket.getJson: multi-room override — favorite=0');
                    }
                    return origGetJson.call(this, url, cb);
                };
                ls.__ngRfPatched = true;
            }

            _svcPatched = true;
            log('patchAngularServices: done');
        } catch (e) {
            log('patchAngularServices: failed', e);
        }
    }

    /* Set comboroom so Domoticz loads the right device set, then reload.
       Single room  → specific plan option → used=all → ALL devices in the room.
       Multi-room   → plan 0 with patched service → used=true, favorite=0 → ALL used devices.
       Zero rooms   → plan 0 (unpatched) → used=true, favorite=1 → favourites (normal view).

       Before triggering any reload, checks whether all required device cards are
       already present in the DOM — if so, skips the reload entirely so filtering
       is instant (no visible page refresh).

       Returns true when a reload was triggered, false when already correct. */
    function ensureDevicesLoaded() {
        if (_selected.length > 1) {
            /* Multi-room: check if all required devices are already in the DOM.
               This is true after the first multi-room load (all used devices present). */
            var allInDOM = _selected.every(function (p) { return hasAllPlanDevicesInDOM(p); });
            if (allInDOM) {
                log('ensureDevicesLoaded: all multi-room devices already in DOM — no reload');
                _loadAllMode = true;        /* keep flag set for live-refresh patch */
                window._ngRfLoadAllDevices = true;
                return false;
            }
            /* Need to load all used devices */
            _loadAllMode = true;
            window._ngRfLoadAllDevices = true;
            patchAngularServices();
            return forceAllIfNeeded();
        }

        /* Single room or no selection: restore normal favourites mode */
        _loadAllMode = false;
        window._ngRfLoadAllDevices = false;

        if (_selected.length !== 1) {
            return forceAllIfNeeded();
        }

        /* Single room: check if all room devices are already in the DOM */
        if (hasAllPlanDevicesInDOM(_selected[0])) {
            log('ensureDevicesLoaded: all devices for plan', _selected[0], 'already in DOM — no reload');
            return false;
        }

        var sel = document.getElementById('comboroom');
        if (!sel) return false;
        var targetIndex = comboroomIndexForPlan(_selected[0]);
        if (targetIndex < 0) {
            /* Plan not found in comboroom — fall back to All */
            return forceAllIfNeeded();
        }
        if (sel.selectedIndex === targetIndex) {
            log('ensureDevicesLoaded: already at plan', _selected[0], '— no reload');
            return false;
        }
        log('ensureDevicesLoaded: setting comboroom to plan', _selected[0]);
        _preserveNextRoute = true;
        document.body.classList.add('ng-rf-reloading');
        sel.selectedIndex = targetIndex;
        $(sel).trigger('change');
        return true;
    }

    /* Remove the reloading cloak after applyFilter() has run */
    function uncloak() {
        var cards = getCards();
        var visible = cards.filter(function (c) { return !c.classList.contains('ng-rf-filtered'); }).length;
        log('uncloak: showing', visible, 'of', cards.length, 'cards');
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

    /* Build or sync the pill bar using already-cached _planOptions.
       Used on category pages (Switches, Temperature, etc.) where #comboroom is
       absent but we still want to show the active room filter.
       No comboroom manipulation — the page already loaded its own device set. */
    function buildBarFromCache() {
        var topBar = document.getElementById('topBar');
        if (!topBar || _planOptions.length < 2) { removeBar(); revealTopBar(); return; }

        var existing = document.getElementById('ng-room-filter');
        if (existing && _pills.length === _planOptions.length) {
            log('buildBarFromCache: pills already built — sync only');
            syncPills();
            injectToggleBtn();
            revealTopBar();
            if (_selected.length > 0) scheduleFilterPasses();
            return;
        }

        removeBar();
        var bar = document.createElement('div');
        bar.id = 'ng-room-filter';
        bar.setAttribute('role', 'tablist');
        bar.setAttribute('aria-label', 'Filter by room');

        /* Panel title — visible only in mobile drawer (hidden via CSS on desktop) */
        var titleEl = document.createElement('span');
        titleEl.className = 'ng-rf-panel-title';
        titleEl.setAttribute('aria-hidden', 'true');
        titleEl.textContent = 'Rooms';
        bar.appendChild(titleEl);

        _planOptions.forEach(function (r) {
            var btn = document.createElement('button');
            btn.className       = 'ng-rf-pill';
            btn.dataset.planIdx = r.planIdx;
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', 'false');
            btn.textContent = r.label;
            (function (pi) {
                btn.addEventListener('click', function () { onPillClick(pi); });
            }(r.planIdx));
            bar.appendChild(btn);
            _pills.push(btn);
        });

        var anchor = topBar.parentNode;
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(bar, anchor.nextSibling);
        }

        syncPills();
        injectToggleBtn();
        revealTopBar();
        restoreOpenState();

        if (_selected.length > 0) scheduleFilterPasses();
    }

    function removeBar() {
        var rf  = document.getElementById('ng-room-filter');
        var btn = document.getElementById('ng-rf-toggle');
        var bb  = document.getElementById('ng-dd-back-btn');
        /* Save open state so the next buildBar() can restore it */
        _stripWasOpen = !!(rf && rf.classList.contains('ng-rf--open'));
        if (rf)  rf.remove();
        if (btn) btn.remove();
        if (bb)  bb.remove();
        hideMobileBackdrop();
        _pills = [];
        log('removeBar: bar cleared (pills:', _pills.length, ')');
    }

    /* Restore strip open state after a rebuild and manage mobile backdrop. */
    function restoreOpenState() {
        if (!_stripWasOpen) return;
        _stripWasOpen = false;
        var rf  = document.getElementById('ng-room-filter');
        var btn = document.getElementById('ng-rf-toggle');
        if (rf)  rf.classList.add('ng-rf--open');
        if (btn) { btn.classList.add('ng-rf-toggle-btn--open'); btn.setAttribute('aria-expanded', 'true'); }
        showMobileBackdrop();
    }

    /* Inject a "← Dynamic Dashboard" back button into the topbar (#tbFilters),
       placed before the room combobox. Only shown when the user arrived here
       via DD's openRoomPlan(). */
    function injectDDBackButton() {
        if (!_cameFromDD) return;
        if (document.getElementById('ng-dd-back-btn')) return;

        /* Verify DD is enabled on this install */
        try {
            var rs = angular.element(document.body).injector().get('$rootScope');
            if (!rs.config || !rs.config.EnableTabDashboardDynamic) {
                log('injectDDBackButton: DD not enabled, skipping');
                return;
            }
        } catch (e) { return; }

        var tbFilters = document.getElementById('tbFilters');
        if (!tbFilters) { log('injectDDBackButton: #tbFilters not found'); return; }

        var btn = document.createElement('button');
        btn.id        = 'ng-dd-back-btn';
        btn.className = 'ng-dd-back-btn';
        btn.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
        btn.setAttribute('title', 'Back to Dynamic Dashboard');
        btn.addEventListener('click', function () {
            log('DD back button clicked — reloading to DD');
            if (window.myglobals) { window.myglobals.LastPlanSelected = 0; }
            _cameFromDD    = false;
            _selected      = [];
            _savedMainPath = null;   /* clear so next DD navigation hits full-reset */
            _savedSelected = null;   /* branch, not the restore branch, ensuring    */
            removeBar();             /* _cameFromDD is properly re-set              */
            /* Reload the route — since _forceClassicDashboard is false, DD renders.
               Check $$phase to avoid $apply-already-in-progress errors. */
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
                log('DD back: $route.reload failed, using hash round-trip', e);
                /* Force a hash round-trip so Angular sees the change even when
                   we're already at #/Dashboard (same hash = no hashchange event). */
                var base = window.location.href.replace(/#.*$/, '');
                window.location.replace(base + '#/');
                setTimeout(function () { window.location.hash = '#/Dashboard'; }, 30);
            }
        });

        /* Insert as the first child of #tbFilters so it appears left of the search */
        tbFilters.insertBefore(btn, tbFilters.firstChild);
        log('injectDDBackButton: back button injected into #tbFilters');
    }

    /* Apply the filter once all selected plans are present in the cache.
       Called from buildBar() so the filter is never applied before the
       API data is ready. */
    function applyWhenCached() {
        log('applyWhenCached: _selected=', _selected,
            '| cached:', Object.keys(_planCache).length, 'plans');
        var missing = _selected.filter(function (p) {
            return !_planCache.hasOwnProperty(p);
        });
        if (!missing.length) {
            log('applyWhenCached: all plans cached — applying filter now');
            applyFilter();
            return;
        }
        log('applyWhenCached: waiting for', missing.length, 'uncached plan(s):', missing);
        var done = 0;
        missing.forEach(function (p) {
            fetchPlan(p, function () {
                if (++done === missing.length) {
                    log('applyWhenCached: all', missing.length, 'plan(s) loaded — applying filter');
                    applyFilter();
                }
            });
        });
    }

    function buildBar() {
        /* Phase 1: wait for #topBar */
        var topBar = document.getElementById('topBar');
        if (!topBar) {
            if (_topbarRetries < MAX_TOPBAR) {
                _topbarRetries++;
                scheduleBuildBar(100);
            } else { revealTopBar(); }
            return;
        }
        _topbarRetries = 0;

        log('buildBar: _selected=', _selected, '_cameFromDD=', _cameFromDD,
            '_preserveNextRoute=', _preserveNextRoute);

        /* Clear LastPlanSelected now that the dashboard controller has already
           read it (controller runs on $viewContentLoaded; buildBar fires after).
           Keeping it alive through $routeChangeSuccess lets the controller choose
           used=all (planIdx > 0) instead of used=true (plan 0 = favourites only). */
        if (window.myglobals && window.myglobals.LastPlanSelected) {
            log('buildBar: clearing LastPlanSelected (was', window.myglobals.LastPlanSelected, ')');
            window.myglobals.LastPlanSelected = 0;
        }

        /* Detect mobile dashboard + attach mobile search (independent of comboroom) */
        setupMobilePage();

        /* Phase 2: no comboroom.
           On category pages (Switches, Temperature, etc.) comboroom is absent, but
           if we already know the room plans we can still show and apply the filter. */
        var sel = document.getElementById('comboroom');
        if (!sel) {
            if (_planOptions.length >= 2 && _selected.length > 0) {
                log('buildBar: no comboroom — category page with active filter, using cache');
                buildBarFromCache();
            } else {
                log('buildBar: no comboroom → removeBar');
                removeBar(); revealTopBar();
            }
            return;
        }

        /* Phase 3: comboroom exists but not populated yet */
        var opts = readOptions();
        log('buildBar: readOptions returned', opts.length, 'options (dd: filtered)',
            opts.map(function(o){ return o.label + '('+o.planIdx+')'; }));
        if (opts.length < 2) {
            if (_comboRetries < MAX_COMBO) {
                _comboRetries++;
                scheduleBuildBar(300);
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
                if (nativePlanIdx && nativePlanIdx !== '0' &&
                        nativePlanIdx.indexOf('dd:') !== 0) {
                    log('buildBar: auto-activating pill from native comboroom', nativePlanIdx);
                    _selected   = [nativePlanIdx];
                    _cameFromDD = !!(window.myglobals && window.myglobals.LastPlanSelected);
                }
            }
        }

        /* Already correct number of pills? Sync + reveal. */
        var existing = document.getElementById('ng-room-filter');
        if (existing && _pills.length === opts.length) {
            log('buildBar: pills already built — sync only');
            syncPills();
            injectToggleBtn();
            injectDDBackButton();
            revealTopBar();
            /* Set comboroom to the right plan so Domoticz loads the correct
               device set (single room → specific plan → used=all → all devices;
               multi-room → plan 0 → used=true → favourites).
               Only schedule filter passes when no reload was triggered. */
            if (!(_selected.length > 0 && ensureDevicesLoaded()) && _selected.length > 0) {
                scheduleFilterPasses();
            }
            return;
        }

        /* Rebuild from scratch */
        log('buildBar: rebuilding pill bar from scratch');
        removeBar();

        var bar = document.createElement('div');
        bar.id = 'ng-room-filter';
        bar.setAttribute('role', 'tablist');
        bar.setAttribute('aria-label', 'Filter by room');

        /* Panel title — visible only in mobile drawer (hidden via CSS on desktop) */
        var titleEl = document.createElement('span');
        titleEl.className = 'ng-rf-panel-title';
        titleEl.setAttribute('aria-hidden', 'true');
        titleEl.textContent = 'Rooms';
        bar.appendChild(titleEl);

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
        restoreOpenState();

        /* Set comboroom to the right plan so Domoticz loads the correct device set.
           Single room → specific plan option → used=all → ALL devices in the room.
           Multi-room  → plan 0 + patched service → used=all, plan=0 → ALL devices.
           Only schedule filter passes when no reload was triggered. */
        var reloading = _selected.length > 0 && ensureDevicesLoaded();
        preFetchAll();

        if (!reloading && _selected.length > 0) scheduleFilterPasses();
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
                var path = currentHashPath();
                log('$routeChangeStart path=', path, '_selected=', _selected);

                /* Cancel any pending buildBar timer so stale retry loops from the
                   previous page (e.g. DD view's Phase-1 topbar-wait) don't fire
                   on the newly loaded page and trigger a spurious forceAllIfNeeded. */
                if (_buildBarTimer !== null) {
                    clearTimeout(_buildBarTimer);
                    _buildBarTimer = null;
                    log('$routeChangeStart: cancelled stale _buildBarTimer');
                }

                /* Preemptive cloak: if we're about to land on the classic dashboard
                   via DD's openRoomPlan(), hide the view immediately — before Angular
                   renders a single card — so the forceAllIfNeeded reload is invisible. */
                var ddPlan = window.myglobals && Number(window.myglobals.LastPlanSelected);
                if (ddPlan && !isDetailPath(path)) {
                    log('$routeChangeStart: DD room plan detected (', ddPlan, ') — preemptive cloak');
                    document.body.classList.add('ng-rf-reloading');
                }

                /* If no rooms are active, ensure the all-devices flag is cleared BEFORE
                   the incoming route's controller calls loadFavorites.  This prevents
                   leftover _ngRfLoadAllDevices=true from a previous multi-room session
                   from causing the new page to load all (including unused) devices. */
                if (_selected.length === 0) {
                    _loadAllMode = false;
                    window._ngRfLoadAllDevices = false;
                }

                /* Save the active selection before leaving a main list page so we
                   can restore it if the user returns from a detail sub-page. */
                if (!isDetailPath(path) && _selected.length > 0) {
                    _savedMainPath = path;
                    _savedSelected = _selected.slice();
                    log('$routeChangeStart: saved selection for', path, _selected);
                }
            });

            $rs.$on('$routeChangeSuccess', function () {
                if (_preserveNextRoute) {
                    log('$routeChangeSuccess: preserveNextRoute — skipping teardown');
                    _preserveNextRoute = false;
                    return;
                }

                var newPath = currentHashPath();
                log('$routeChangeSuccess path=', newPath,
                    '_savedMainPath=', _savedMainPath,
                    'myglobals.LastPlanSelected=',
                    window.myglobals && window.myglobals.LastPlanSelected);

                if (isDetailPath(newPath)) {
                    log('$routeChangeSuccess: detail page → remove bar, keep _selected');
                    removeBar();
                    document.body.classList.remove('ng-mobile-dashboard');

                } else if (_savedMainPath && newPath === _savedMainPath) {
                    log('$routeChangeSuccess: returning to', newPath, '— restoring', _savedSelected);
                    removeBar();
                    document.body.classList.remove('ng-mobile-dashboard');
                    _selected      = _savedSelected ? _savedSelected.slice() : [];
                    _savedSelected = null;
                    _savedMainPath = null;
                    if (_selected.length > 0) {
                        log('$routeChangeSuccess: cloaking for filter restore');
                        document.body.classList.add('ng-rf-reloading');
                        setTimeout(uncloak, 2000);
                    }

                } else {
                    removeBar();
                    document.body.classList.remove('ng-mobile-dashboard');
                    _savedSelected = null;
                    _savedMainPath = null;

                    /* Detect DD→classic navigation via openRoomPlan():
                       $routeChangeSuccess fires BEFORE the classic dashboard
                       controller runs.  We intentionally do NOT clear
                       LastPlanSelected here — the dashboard controller reads it
                       to decide whether to use used=all (planIdx > 0, loads every
                       device in the plan) or used=true (plan 0, favourites only).
                       buildBar() clears it once the view has loaded. */
                    var ddPlan = window.myglobals &&
                                 Number(window.myglobals.LastPlanSelected);
                    if (ddPlan) {
                        log('$routeChangeSuccess: DD room plan detected, planIdx=', ddPlan,
                            '— cloaking and setting _selected (LastPlanSelected kept for controller)');
                        _selected              = [String(ddPlan)];
                        _cameFromDD            = true;
                        _loadAllMode           = false;
                        window._ngRfLoadAllDevices = false;
                        document.body.classList.add('ng-rf-reloading');
                        setTimeout(uncloak, 2000);
                    } else {
                        /* Normal tab navigation — preserve the active room selection
                           so the filter stays consistent across Switches / Temp / etc. */
                        log('$routeChangeSuccess: new main page — preserving selection', _selected);
                        _cameFromDD = false;
                        /* _selected, _loadAllMode, and window._ngRfLoadAllDevices kept */
                    }
                }

                _topbarRetries = 0;
                _comboRetries  = 0;
                if (_safetyTimer) clearTimeout(_safetyTimer);
            });

            $rs.$on('$viewContentLoaded', function () {
                log('$viewContentLoaded — scheduling buildBar in 150ms');
                _topbarRetries = 0;
                _comboRetries  = 0;
                scheduleRevealFallback();
                scheduleBuildBar(150);
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
        scheduleBuildBar(300);
        attachHooks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
