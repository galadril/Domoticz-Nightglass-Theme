/* ── Feature 14: Room Filter Pill-Bar ──────────────────────────────
   Zero-reload client-side filter.

   On init, fetches all used devices (with PlanIDs) once and builds
   the plan→device cache.  All filtering is pure DOM show/hide —
   no comboroom manipulation, no Angular route reloads.

   Angular's dashboardService.loadFavorites is patched to always
   return all used devices (not just favourites), so every device
   is in the DOM and room filtering is always instant.

   #tbFiltRooms stays hidden via CSS across all route changes.
──────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    /* ── Debug logging ──────────────────────────────────────────── */

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

    var _pills          = [];     /* pill button elements */
    var _planOptions    = [];     /* [{label, index, planIdx}] */
    var _selected       = [];     /* planIdx strings currently active */
    var _planCache      = {};     /* planIdx → {deviceIdx: true} */
    var _topbarRetries  = 0;
    var _comboRetries   = 0;
    var MAX_TOPBAR      = 15;     /* × 100ms = 1.5s */
    var MAX_COMBO       = 8;      /* × 300ms = 2.4s */
    var _safetyTimer    = null;
    var _buildBarTimer  = null;
    var _cameFromDD     = false;
    var _$route         = null;
    var _stripWasOpen   = false;
    var _svcPatched     = false;

    /* Plan cache readiness — callbacks queued until first device fetch completes */
    var _planCacheReady     = false;
    var _planCacheCallbacks = [];

    /* ══ Route path helpers ══════════════════════════════════════════ */

    function currentHashPath() {
        return (window.location.hash || '').replace(/^#\/?/, '').replace(/\?.*$/, '');
    }

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
        if (open) { showMobileBackdrop(); } else { hideMobileBackdrop(); }
    }

    /* ── Mobile backdrop helpers ────────────────────────────────── */

    function showMobileBackdrop() {
        if (window.innerWidth > 768) return;
        if (document.getElementById('ng-rf-backdrop')) return;
        var bd = document.createElement('div');
        bd.id = 'ng-rf-backdrop';
        bd.addEventListener('click', closeDrawer);
        document.body.appendChild(bd);
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

    /* ══ Plan cache ══════════════════════════════════════════════════ */

    /* Build planIdx → {deviceIdx: true} map from device PlanIDs arrays.
       Called from initDeviceData() and from the loadFavorites patch when
       fresh device data arrives from the dashboard. */
    function buildPlanMapFromDevices(devices) {
        var map = {};
        (devices || []).forEach(function (d) {
            var idx = String(d.idx);
            (d.PlanIDs || []).forEach(function (planId) {
                var key = String(planId);
                if (!map[key]) map[key] = {};
                map[key][idx] = true;
            });
        });
        _planCache = map;

        if (!_planCacheReady) {
            _planCacheReady = true;
            var cbs = _planCacheCallbacks;
            _planCacheCallbacks = [];
            log('buildPlanMapFromDevices: cache ready —', Object.keys(map).length, 'plans,', (devices || []).length, 'devices');
            cbs.forEach(function (fn) { fn(); });
        } else {
            log('buildPlanMapFromDevices: cache refreshed —', Object.keys(map).length, 'plans');
        }
    }

    /* Call cb immediately if cache is ready, otherwise queue it. */
    function whenPlanCacheReady(cb) {
        if (_planCacheReady) { cb(); return; }
        _planCacheCallbacks.push(cb);
    }

    /* Fetch all used devices and plan list once on module init.
       Provides plan→device membership data for filtering on any page,
       including non-dashboard pages where loadFavorites is never called. */
    function initDeviceData() {
        /* All used devices — PlanIDs field gives room membership */
        $.getJSON('json.htm?type=command&param=getdevices&filter=all&used=true&order=Name')
            .done(function (data) {
                buildPlanMapFromDevices(data.result || []);
            })
            .fail(function () {
                /* Mark ready so filter callbacks don't hang indefinitely */
                _planCacheReady = true;
                var cbs = _planCacheCallbacks;
                _planCacheCallbacks = [];
                log('initDeviceData: device fetch failed — plan cache empty');
                cbs.forEach(function (fn) { fn(); });
            });

        /* Plan names — needed for pill labels on pages without #comboroom */
        if (_planOptions.length < 2) {
            $.getJSON('json.htm?type=command&param=getplans&order=name&used=true')
                .done(function (data) {
                    if (!data.result || !data.result.length) return;
                    var opts = [{ label: 'All', index: 0, planIdx: '0' }];
                    data.result.forEach(function (plan, i) {
                        opts.push({ label: plan.Name, index: i + 1, planIdx: String(plan.idx) });
                    });
                    if (opts.length >= 2) {
                        _planOptions = opts;
                        log('initDeviceData: loaded', opts.length, 'plan options');
                        scheduleBuildBar(50);   /* rebuild bar now that options are known */
                    }
                });
        }
    }

    /* ══ Combobox options ═══════════════════════════════════════════ */

    function readOptions() {
        var sel = document.getElementById('comboroom');
        if (!sel || !sel.options.length) return [];
        return Array.prototype.slice.call(sel.options).map(function (o, i) {
            var planIdx = (o.value || '').replace(/^(?:number|string):/, '');
            return { label: o.textContent.trim(), index: i, planIdx: planIdx };
        }).filter(function (r) {
            if (r.planIdx.charAt(0) === '?') return false;
            if (r.planIdx.indexOf('dd:') === 0) return false;
            return true;
        });
    }

    /* ══ DOM card helpers ═══════════════════════════════════════════ */

    function cardIdx(card) {
        var id = card.id || '';
        var m  = id.match(/_(\d+)$/) || id.match(/^(\d+)$/);
        return m ? m[1] : null;
    }

    function getCards() {
        var cards = [];
        document.querySelectorAll('.movable').forEach(function (el) { cards.push(el); });
        document.querySelectorAll('.span4.itemBlock').forEach(function (el) {
            if (!el.closest('.movable')) cards.push(el);
        });
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
        document.body.classList.remove('ng-rf-reloading');
    }

    /* Run applyFilter at staggered intervals to catch late-rendering cards
       (Angular's ng-repeat may need several digest cycles to paint all cards). */
    function scheduleFilterPasses() {
        [100, 350, 700].forEach(function (delay) {
            setTimeout(function () {
                if (_selected.length > 0) applyFilter();
            }, delay);
        });
    }

    /* ══ Pill selection logic ════════════════════════════════════════ */

    /* Zero-reload pill handler.
       No comboroom manipulation — just toggle selection and re-filter. */
    function onPillClick(planIdx) {
        if (planIdx === '0') {
            _selected = [];
        } else {
            var pos = _selected.indexOf(planIdx);
            if (pos !== -1) {
                _selected.splice(pos, 1);
            } else {
                _selected.push(planIdx);
            }
        }

        syncPills();
        whenPlanCacheReady(applyFilter);
    }

    function syncPills() {
        _pills.forEach(function (pill) {
            var pi     = pill.dataset.planIdx;
            var active = (pi === '0') ? _selected.length === 0
                                      : _selected.indexOf(pi) !== -1;
            pill.classList.toggle('ng-rf-pill--active', active);
            pill.setAttribute('aria-selected', String(active));
        });

        var btn   = document.getElementById('ng-rf-toggle');
        var count = btn && btn.querySelector('.ng-rf-toggle-count');
        if (count) {
            count.textContent   = _selected.length > 0 ? String(_selected.length) : '';
            count.style.display = _selected.length > 0 ? 'inline-flex' : 'none';
        }
        if (btn) {
            btn.classList.toggle('ng-rf-toggle-btn--filtered', _selected.length > 0);
        }
    }

    /* ══ Mobile dashboard helpers ════════════════════════════════════ */

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

    function setupMobilePage() {
        var isMobile = !!document.querySelector('.dashboardMobile');
        document.body.classList.toggle('ng-mobile-dashboard', isMobile);
        if (isMobile) {
            setTimeout(attachMobileSearch, 200);
        }
    }

    /* ══ Build / remove bar ═════════════════════════════════════════ */

    /* Build or sync the pill bar using already-cached _planOptions.
       Used on category pages (Switches, Temperature, etc.) where #comboroom
       is absent but room plans are known from initDeviceData(). */
    function buildBarFromCache() {
        var topBar = document.getElementById('topBar');
        if (!topBar || _planOptions.length < 2) { removeBar(); revealTopBar(); return; }

        var existing = document.getElementById('ng-room-filter');
        if (existing && _pills.length === _planOptions.length) {
            log('buildBarFromCache: pills already built — sync only');
            syncPills();
            injectToggleBtn();
            revealTopBar();
            if (_selected.length > 0) {
                whenPlanCacheReady(applyFilter);
                scheduleFilterPasses();
            }
            return;
        }

        removeBar();
        var bar = document.createElement('div');
        bar.id = 'ng-room-filter';
        bar.setAttribute('role', 'tablist');
        bar.setAttribute('aria-label', 'Filter by room');

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

        if (_selected.length > 0) {
            whenPlanCacheReady(applyFilter);
            scheduleFilterPasses();
        }
    }

    function removeBar() {
        var rf  = document.getElementById('ng-room-filter');
        var btn = document.getElementById('ng-rf-toggle');
        var bb  = document.getElementById('ng-dd-back-btn');
        _stripWasOpen = !!(rf && rf.classList.contains('ng-rf--open'));
        if (rf)  rf.remove();
        if (btn) btn.remove();
        if (bb)  bb.remove();
        hideMobileBackdrop();
        _pills = [];
        log('removeBar: bar cleared');
    }

    function restoreOpenState() {
        if (!_stripWasOpen) return;
        _stripWasOpen = false;
        var rf  = document.getElementById('ng-room-filter');
        var btn = document.getElementById('ng-rf-toggle');
        if (rf)  rf.classList.add('ng-rf--open');
        if (btn) { btn.classList.add('ng-rf-toggle-btn--open'); btn.setAttribute('aria-expanded', 'true'); }
        showMobileBackdrop();
    }

    /* Inject a "← Dynamic Dashboard" back button into the topbar. */
    function injectDDBackButton() {
        if (!_cameFromDD) return;
        if (document.getElementById('ng-dd-back-btn')) return;

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
            log('DD back button clicked');
            if (window.myglobals) { window.myglobals.LastPlanSelected = 0; }
            _cameFromDD    = false;
            _selected      = [];
            removeBar();
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
                var base = window.location.href.replace(/#.*$/, '');
                window.location.replace(base + '#/');
                setTimeout(function () { window.location.hash = '#/Dashboard'; }, 30);
            }
        });

        tbFilters.insertBefore(btn, tbFilters.firstChild);
        log('injectDDBackButton: injected');
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

        log('buildBar: _selected=', _selected, '_cameFromDD=', _cameFromDD);

        /* Clear LastPlanSelected after the dashboard controller has read it. */
        if (window.myglobals && window.myglobals.LastPlanSelected) {
            log('buildBar: clearing LastPlanSelected (was', window.myglobals.LastPlanSelected, ')');
            window.myglobals.LastPlanSelected = 0;
        }

        setupMobilePage();

        /* Phase 2: no comboroom — category page (Switches, Temp, etc.).
           Use plan options from initDeviceData() to show filter bar. */
        var sel = document.getElementById('comboroom');
        if (!sel) {
            if (_planOptions.length >= 2) {
                log('buildBar: no comboroom — building from cache');
                buildBarFromCache();
            } else {
                log('buildBar: no comboroom, no plan options → removeBar');
                removeBar(); revealTopBar();
            }
            return;
        }

        /* Phase 3: comboroom exists but not populated yet */
        var opts = readOptions();
        log('buildBar: readOptions returned', opts.length, 'options');
        if (opts.length < 2) {
            if (_comboRetries < MAX_COMBO) {
                _comboRetries++;
                scheduleBuildBar(300);
            } else { removeBar(); revealTopBar(); }
            return;
        }
        _comboRetries = 0;
        _planOptions  = opts;

        /* Auto-activate pill from DD's pre-selected comboroom value */
        if (_selected.length === 0 && sel.selectedIndex > 0) {
            var nativeOpt     = sel.options[sel.selectedIndex];
            var nativePlanIdx = (nativeOpt.value || '').replace(/^(?:number|string):/, '');
            if (nativePlanIdx && nativePlanIdx !== '0' && nativePlanIdx.indexOf('dd:') !== 0) {
                log('buildBar: auto-activating pill from native comboroom', nativePlanIdx);
                _selected   = [nativePlanIdx];
                _cameFromDD = !!(window.myglobals && window.myglobals.LastPlanSelected);
            }
        }

        /* Already correct number of pills? Sync and apply filter. */
        var existing = document.getElementById('ng-room-filter');
        if (existing && _pills.length === opts.length) {
            log('buildBar: pills already built — sync only');
            syncPills();
            injectToggleBtn();
            injectDDBackButton();
            revealTopBar();
            if (_selected.length > 0) {
                whenPlanCacheReady(applyFilter);
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

        var titleEl = document.createElement('span');
        titleEl.className = 'ng-rf-panel-title';
        titleEl.setAttribute('aria-hidden', 'true');
        titleEl.textContent = 'Rooms';
        bar.appendChild(titleEl);

        opts.forEach(function (r) {
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
        injectDDBackButton();
        revealTopBar();
        restoreOpenState();

        if (_selected.length > 0) {
            whenPlanCacheReady(applyFilter);
            scheduleFilterPasses();
        }
    }

    /* ══ Angular service patch ══════════════════════════════════════
       Patches dashboardService.loadFavorites to always return ALL used
       devices (not just favourites).  This ensures every device is in
       the DOM so room filtering is always a pure client-side operation.
       Also patches livesocket.getJson to drop the favourite flag on
       live-refresh calls so the displayed set stays consistent. */
    function patchAngularServices() {
        if (_svcPatched) return;
        try {
            var inj = angular.element(document.body).injector();

            var svc = inj.get('dashboardService');
            if (!svc.__ngRfPatched) {
                var api      = inj.get('domoticzApi');
                svc.loadFavorites = function () {
                    log('loadFavorites: patched — loading all used devices');
                    return api.sendRequest({
                        type: 'command', param: 'getdevices',
                        filter: 'all', used: 'true', favorite: 0,
                        order: '[Order]', plan: 0
                    }).then(function (data) {
                        var devices = data.result || [];
                        /* Keep plan cache up to date with fresh server data */
                        buildPlanMapFromDevices(devices);
                        return {
                            devices:        devices,
                            lastUpdateTime: data.ActTime ? parseInt(data.ActTime) : 0,
                            sunrise:        data.Sunrise,
                            sunset:         data.Sunset,
                            serverTime:     data.ServerTime
                        };
                    });
                };
                svc.__ngRfPatched = true;
            }

            var ls = inj.get('livesocket');
            if (!ls.__ngRfPatched) {
                var origGetJson = ls.getJson.bind(ls);
                ls.getJson = function (url, cb) {
                    if (typeof url === 'string' && url.indexOf('param=getdevices') !== -1) {
                        url = url.replace(/\bfavorite=1\b/, 'favorite=0');
                    }
                    return origGetJson.call(this, url, cb);
                };
                ls.__ngRfPatched = true;
            }

            _svcPatched = true;
            log('patchAngularServices: done');
        } catch (e) {
            log('patchAngularServices: failed — will retry on next hook', e);
        }
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

            /* Patch dashboard service now that Angular is available */
            patchAngularServices();

            $rs.$on('$routeChangeStart', function () {
                var path = currentHashPath();
                log('$routeChangeStart path=', path, '_selected=', _selected);

                /* Cancel any pending buildBar retry from the previous page */
                if (_buildBarTimer !== null) {
                    clearTimeout(_buildBarTimer);
                    _buildBarTimer = null;
                }

                /* Preemptive cloak when arriving from DD's openRoomPlan() */
                var ddPlan = window.myglobals && Number(window.myglobals.LastPlanSelected);
                if (ddPlan && !isDetailPath(path)) {
                    document.body.classList.add('ng-rf-reloading');
                }
            });

            $rs.$on('$routeChangeSuccess', function () {
                var newPath = currentHashPath();
                log('$routeChangeSuccess path=', newPath);

                if (isDetailPath(newPath)) {
                    /* Detail pages (e.g. Devices/42/Edit) — hide bar, keep selection */
                    removeBar();
                    document.body.classList.remove('ng-mobile-dashboard');

                } else {
                    /* Main list page — remove and rebuild bar on $viewContentLoaded.
                       _selected persists naturally so the filter stays active. */
                    removeBar();
                    document.body.classList.remove('ng-mobile-dashboard');

                    /* Detect DD→classic navigation via openRoomPlan() */
                    var ddPlan = window.myglobals && Number(window.myglobals.LastPlanSelected);
                    if (ddPlan) {
                        log('$routeChangeSuccess: DD room plan', ddPlan, '— pre-selecting');
                        _selected   = [String(ddPlan)];
                        _cameFromDD = true;
                        setTimeout(function () { document.body.classList.remove('ng-rf-reloading'); }, 2000);
                    } else {
                        /* Normal navigation — preserve active room selection */
                        _cameFromDD = false;
                        log('$routeChangeSuccess: preserving selection', _selected);
                    }
                }

                _topbarRetries = 0;
                _comboRetries  = 0;
                if (_safetyTimer) clearTimeout(_safetyTimer);
            });

            $rs.$on('$viewContentLoaded', function () {
                log('$viewContentLoaded — scheduling buildBar');
                _topbarRetries = 0;
                _comboRetries  = 0;
                scheduleRevealFallback();
                scheduleBuildBar(150);

                /* Retry patching in case the first attempt was too early */
                if (!_svcPatched) patchAngularServices();
            });

            /* Re-apply filter after Angular updates device cards */
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
        initDeviceData();
        scheduleBuildBar(300);
        attachHooks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
