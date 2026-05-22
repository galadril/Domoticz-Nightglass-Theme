/* ── Feature 14: Filter Bar ─────────────────────────────────────────
   Multi-dimensional device filter: Rooms, Type, Hardware, Favourites.

   On init, fetches all used devices (with PlanIDs) once and builds
   a device map and plan cache.  All filtering is pure DOM show/hide —
   no comboroom manipulation, no Angular route reloads.

   Angular's dashboardService.loadFavorites is patched to always return
   all used devices so every device is in the DOM for client-side filtering.

   Filter dimensions are computed from what's on the current page:
     Rooms    — from PlanIDs; persists across all page navigations
     Type     — SwitchType / sensor Type; pruned when not relevant on new page
     Hardware — HardwareName; pruned when not relevant on new page
     Show     — Favourites toggle; pruned when not relevant on new page

   Filters are AND-ed across dimensions, OR-ed within each dimension.
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

    var _pills          = [];     /* all pill button elements (flat) */
    var _planOptions    = [];     /* [{label, index, planIdx}] — room options */
    var _activeFilters  = {       /* currently active filter values per dimension */
        rooms:     [],
        types:     [],
        hardware:  [],
        favorites: false
    };
    var _planCache      = {};     /* planIdx → {deviceIdx: true} */
    var _deviceMap      = {};     /* idx → device object from API */
    var _filterSections = [];     /* [{id, label, values:[{value,label}]}] for current page */

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
        btn.setAttribute('aria-label',    'Toggle filters');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML =
            '<i class="fa-solid fa-sliders"></i>' +
            '<span class="ng-rf-toggle-label">Filters</span>' +
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

    /* ══ Plan cache + device map ════════════════════════════════════ */

    /* Build planIdx → {deviceIdx: true} map and idx → device object map. */
    function buildPlanMapFromDevices(devices) {
        var planMap = {};
        var devMap  = {};
        (devices || []).forEach(function (d) {
            var idx = String(d.idx);
            devMap[idx] = d;
            (d.PlanIDs || []).forEach(function (planId) {
                var key = String(planId);
                if (!planMap[key]) planMap[key] = {};
                planMap[key][idx] = true;
            });
        });
        _planCache = planMap;
        _deviceMap = devMap;

        if (!_planCacheReady) {
            _planCacheReady = true;
            var cbs = _planCacheCallbacks;
            _planCacheCallbacks = [];
            log('buildPlanMapFromDevices: cache ready —',
                Object.keys(planMap).length, 'plans,', (devices || []).length, 'devices');
            cbs.forEach(function (fn) { fn(); });

            /* Trigger bar rebuild in case it was already shown without device data */
            var existingBar = document.getElementById('ng-room-filter');
            if (existingBar) scheduleBuildBar(50);
        } else {
            log('buildPlanMapFromDevices: cache refreshed');
        }
    }

    /* Call cb immediately if cache is ready, otherwise queue it. */
    function whenPlanCacheReady(cb) {
        if (_planCacheReady) { cb(); return; }
        _planCacheCallbacks.push(cb);
    }

    /* Fetch all used devices and plan list once on module init. */
    function initDeviceData() {
        $.getJSON('json.htm?type=command&param=getdevices&filter=all&used=true&order=Name')
            .done(function (data) {
                buildPlanMapFromDevices(data.result || []);
            })
            .fail(function () {
                _planCacheReady = true;
                var cbs = _planCacheCallbacks;
                _planCacheCallbacks = [];
                log('initDeviceData: device fetch failed — caches empty');
                cbs.forEach(function (fn) { fn(); });
            });

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
                        scheduleBuildBar(50);
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

    /* ══ Device type label ══════════════════════════════════════════
       Returns a user-friendly label for use in the Type filter.
       Switch devices use SwitchType; sensor devices use Type/SubType. */

    function getDeviceTypeLabel(device) {
        if (!device) return null;

        /* Switch/light devices — use SwitchType for fine-grained grouping */
        if (device.SwitchType) {
            var st = device.SwitchType;
            if (st === 'On/Off Switch')          return 'Switch';
            if (st === 'Contact')                return 'Contact';
            if (st === 'Doorbell')               return 'Doorbell';
            if (st === 'Motion Sensor')          return 'Motion';
            if (st === 'Smoke Detector')         return 'Smoke';
            if (st.indexOf('Door Lock') === 0)   return 'Door Lock';
            if (st.indexOf('Push') === 0)        return 'Push Button';
            if (st.indexOf('Blind') !== -1 ||
                st.indexOf('Venetian') !== -1 ||
                st.indexOf('Curtain') !== -1 ||
                st.indexOf('Shutter') !== -1)    return 'Blind / Shutter';
            return st;   /* Dimmer, Fan, Color Switch, Selector, etc. */
        }

        var type    = (device.Type    || '').trim();
        var subtype = (device.SubType || '').trim();

        /* Scenes / Groups */
        if (type === 'Scene') return 'Scene';
        if (type === 'Group') return 'Group';

        /* Temperature compound types */
        if (type.indexOf('Temp') !== -1 && type.indexOf('Humidity') !== -1) return 'Temp + Humidity';
        if (type.indexOf('Temp') !== -1 && type.indexOf('Baro') !== -1)     return 'Temp + Humidity';
        if (type.indexOf('Temp') !== -1)     return 'Temperature';
        if (type.indexOf('Humidity') === 0)  return 'Humidity';

        /* Weather */
        if (type.indexOf('Wind') === 0)  return 'Wind';
        if (type.indexOf('Rain') === 0)  return 'Rain';
        if (type.indexOf('UV') === 0)    return 'UV';

        /* Energy / Utility */
        if (type === 'P1 Smart Meter')   return 'P1 Meter';
        if (type === 'Energy' || subtype === 'kWh') return 'Energy';
        if (type === 'Usage')            return 'Usage';
        if (type === 'Air Quality')      return 'Air Quality';
        if (type === 'Lux')              return 'Lux';
        if (type === 'Weight')           return 'Weight';
        if (type === 'Current')          return 'Current';
        if (type === 'Current/Energy')   return 'Energy';

        /* Generic sub-types */
        var subtypeMap = {
            'Percentage': 'Percentage',
            'Voltage':    'Voltage',
            'Current':    'Current',
            'Text':       'Text',
            'Alert':      'Alert',
            'Sound Level':'Sound Level',
            'Waterflow':  'Waterflow',
            'Pressure':   'Pressure',
            'Distance':   'Distance',
            'Custom Sensor': 'Custom',
            'Thermostat Mode': 'Thermostat',
            'Thermostat Fan Mode': 'Thermostat',
            'SetPoint':   'Setpoint'
        };
        if (subtypeMap[subtype]) return subtypeMap[subtype];

        return subtype || type || null;
    }

    /* ══ Filter section computation ═════════════════════════════════ */

    function uniqueSortedValues(devices, fn) {
        var seen = {};
        var result = [];
        devices.forEach(function (d) {
            var v = fn(d);
            if (v && !seen[v]) { seen[v] = true; result.push(v); }
        });
        return result.sort();
    }

    /* Compute filter sections from devices currently rendered on the page.
       Called at the start of each buildBar() cycle so sections reflect
       the actual content of the current route. */
    function computePageFilterSections() {
        _filterSections = [];

        /* Rooms section — from _planOptions (always available if plans exist) */
        if (_planOptions.length >= 2) {
            _filterSections.push({
                id:     'rooms',
                label:  'Rooms',
                values: _planOptions.slice(1).map(function (o) {
                    return { value: o.planIdx, label: o.label };
                })
            });
        }

        /* For type / hardware / favourites sections, look at devices
           currently in the DOM and cross-reference with _deviceMap */
        var cards   = getCards();
        var devices = [];
        cards.forEach(function (card) {
            var idx = cardIdx(card);
            if (idx && _deviceMap[idx]) devices.push(_deviceMap[idx]);
        });

        if (!devices.length) return;   /* no device data yet — rooms only */

        /* Type section — only shown when 2+ distinct types exist on this page */
        var typeValues = uniqueSortedValues(devices, getDeviceTypeLabel);
        if (typeValues.length >= 2) {
            _filterSections.push({
                id:     'types',
                label:  'Type',
                values: typeValues.map(function (v) { return { value: v, label: v }; })
            });
        }

        /* Hardware section — only shown when 2+ distinct hardware sources */
        var hwValues = uniqueSortedValues(devices, function (d) {
            return (d.HardwareName || '').trim() || null;
        });
        if (hwValues.length >= 2) {
            _filterSections.push({
                id:     'hardware',
                label:  'Hardware',
                values: hwValues.map(function (v) { return { value: v, label: v }; })
            });
        }

        /* Favourites section — only shown when the page has a mix of
           favourited and non-favourited devices */
        var hasFavs    = devices.some(function (d) { return d.Favorite == 1; });
        var hasNonFavs = devices.some(function (d) { return d.Favorite != 1; });
        if (hasFavs && hasNonFavs) {
            _filterSections.push({
                id:     'favorites',
                label:  'Show',
                values: [{ value: 'favorites', label: 'Favourites ★' }]
            });
        }
    }

    /* Remove active filter values that no longer exist in the new sections.
       Called after computePageFilterSections() on each page change.
       Rooms are never pruned — they persist across all navigations. */
    function pruneActiveFiltersForSections() {
        var findSection = function (id) {
            for (var i = 0; i < _filterSections.length; i++) {
                if (_filterSections[i].id === id) return _filterSections[i];
            }
            return null;
        };

        var typeSection = findSection('types');
        if (typeSection) {
            var validTypes = typeSection.values.map(function (v) { return v.value; });
            _activeFilters.types = _activeFilters.types.filter(function (t) {
                return validTypes.indexOf(t) !== -1;
            });
        } else {
            _activeFilters.types = [];
        }

        var hwSection = findSection('hardware');
        if (hwSection) {
            var validHW = hwSection.values.map(function (v) { return v.value; });
            _activeFilters.hardware = _activeFilters.hardware.filter(function (h) {
                return validHW.indexOf(h) !== -1;
            });
        } else {
            _activeFilters.hardware = [];
        }

        if (!findSection('favorites')) {
            _activeFilters.favorites = false;
        }
    }

    /* ══ Filter application ═════════════════════════════════════════
       AND across dimensions, OR within each dimension.
       Devices with no _deviceMap entry are kept visible (safe default). */

    function applyFilter() {
        var roomsActive = _activeFilters.rooms.length    > 0;
        var typesActive = _activeFilters.types.length    > 0;
        var hwActive    = _activeFilters.hardware.length > 0;
        var favsActive  = _activeFilters.favorites;
        var cards       = getCards();

        cards.forEach(function (card) {
            var idx  = cardIdx(card);
            var dev  = idx ? _deviceMap[idx] : null;
            var show = true;

            if (idx) {
                /* Rooms: device must belong to at least one selected plan */
                if (roomsActive) {
                    var inRoom = false;
                    for (var i = 0; i < _activeFilters.rooms.length; i++) {
                        var set = _planCache[_activeFilters.rooms[i]];
                        if (set && set[idx]) { inRoom = true; break; }
                    }
                    if (!inRoom) show = false;
                }

                if (show && typesActive && dev) {
                    if (_activeFilters.types.indexOf(getDeviceTypeLabel(dev)) === -1) show = false;
                }

                if (show && hwActive && dev) {
                    var hw = (dev.HardwareName || '').trim();
                    if (_activeFilters.hardware.indexOf(hw) === -1) show = false;
                }

                if (show && favsActive && dev) {
                    if (dev.Favorite != 1) show = false;
                }
            }
            /* idx-less cards (can't determine device) are always kept visible */

            card.classList.toggle('ng-rf-filtered', !show);
        });

        /* Hide dashboard sections that have no visible cards */
        document.querySelectorAll('section.dashCategory').forEach(function (sec) {
            var hasVisible = !!sec.querySelector(
                '.movable:not(.ng-rf-filtered), tr[id]:not(.ng-rf-filtered)'
            );
            sec.classList.toggle('ng-rf-section-hidden', !hasVisible);
        });

        syncPills();
        document.body.classList.remove('ng-rf-reloading');
    }

    /* Run applyFilter at staggered intervals to catch late-rendering cards. */
    function scheduleFilterPasses() {
        [100, 350, 700].forEach(function (delay) {
            setTimeout(function () {
                if (isAnyFilterActive()) applyFilter();
            }, delay);
        });
    }

    /* ══ Pill selection logic ════════════════════════════════════════ */

    function isAnyFilterActive() {
        return _activeFilters.rooms.length    > 0 ||
               _activeFilters.types.length    > 0 ||
               _activeFilters.hardware.length > 0 ||
               _activeFilters.favorites;
    }

    /* Unified pill click handler.
       dim   = 'rooms' | 'types' | 'hardware' | 'favorites'
       value = '' → clear this dimension ("All" pill)
               specific value → toggle that value on/off */
    function onPillClick(dim, value) {
        if (value === '') {
            /* "All" pill — clear this dimension */
            if (dim === 'favorites') {
                _activeFilters.favorites = false;
            } else {
                _activeFilters[dim] = [];
            }
        } else if (dim === 'favorites') {
            /* Favourites is a simple toggle: "All" → "Favourites" → "All" */
            _activeFilters.favorites = true;
        } else {
            var arr = _activeFilters[dim];
            var pos = arr.indexOf(value);
            if (pos !== -1) {
                arr.splice(pos, 1);
            } else {
                arr.push(value);
            }
        }

        syncPills();
        whenPlanCacheReady(applyFilter);
    }

    function syncPills() {
        _pills.forEach(function (pill) {
            var dim   = pill.dataset.dim;
            var value = pill.dataset.value;
            var active;

            if (value === '') {
                /* "All" pill — active when dimension has no active values */
                active = (dim === 'favorites')
                    ? !_activeFilters.favorites
                    : (_activeFilters[dim] || []).length === 0;
            } else if (dim === 'favorites') {
                active = _activeFilters.favorites;
            } else {
                active = (_activeFilters[dim] || []).indexOf(value) !== -1;
            }

            pill.classList.toggle('ng-rf-pill--active', active);
            pill.setAttribute('aria-selected', String(active));
        });

        /* Toggle button count badge */
        var btn   = document.getElementById('ng-rf-toggle');
        var count = btn && btn.querySelector('.ng-rf-toggle-count');
        var total = _activeFilters.rooms.length +
                    _activeFilters.types.length +
                    _activeFilters.hardware.length +
                    (_activeFilters.favorites ? 1 : 0);
        if (count) {
            count.textContent   = total > 0 ? String(total) : '';
            count.style.display = total > 0 ? 'inline-flex' : 'none';
        }
        if (btn) {
            btn.classList.toggle('ng-rf-toggle-btn--filtered', total > 0);
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
        if (isMobile) setTimeout(attachMobileSearch, 200);
    }

    /* ══ Build filter panel DOM ══════════════════════════════════════
       Called with the #ng-room-filter container; adds one .ng-rf-section
       per computed filter dimension with an "All" pill + value pills. */

    function buildFilterPanel(bar) {
        _pills = [];

        _filterSections.forEach(function (section) {
            var secEl = document.createElement('div');
            secEl.className  = 'ng-rf-section';
            secEl.dataset.dim = section.id;

            var labelEl = document.createElement('span');
            labelEl.className   = 'ng-rf-section-label';
            labelEl.textContent = section.label;
            secEl.appendChild(labelEl);

            var pillsEl = document.createElement('div');
            pillsEl.className = 'ng-rf-pills';

            /* "All" pill clears this dimension */
            var allBtn = document.createElement('button');
            allBtn.className = 'ng-rf-pill';
            allBtn.dataset.dim   = section.id;
            allBtn.dataset.value = '';
            allBtn.setAttribute('role', 'tab');
            allBtn.setAttribute('aria-selected', 'false');
            allBtn.textContent = 'All';
            (function (dim) {
                allBtn.addEventListener('click', function () { onPillClick(dim, ''); });
            }(section.id));
            pillsEl.appendChild(allBtn);
            _pills.push(allBtn);

            /* Value pills */
            section.values.forEach(function (v) {
                var btn = document.createElement('button');
                btn.className = 'ng-rf-pill';
                btn.dataset.dim   = section.id;
                btn.dataset.value = v.value;
                btn.setAttribute('role', 'tab');
                btn.setAttribute('aria-selected', 'false');
                btn.textContent = v.label;
                (function (dim, val) {
                    btn.addEventListener('click', function () { onPillClick(dim, val); });
                }(section.id, v.value));
                pillsEl.appendChild(btn);
                _pills.push(btn);
            });

            secEl.appendChild(pillsEl);
            bar.appendChild(secEl);
        });
    }

    /* ══ Build / remove bar ═════════════════════════════════════════ */

    /* Build from cache — used on category pages without #comboroom */
    function buildBarFromCache() {
        var topBar = document.getElementById('topBar');
        if (!topBar || _filterSections.length === 0) { removeBar(); revealTopBar(); return; }

        /* Check if bar already matches current sections (section count match) */
        var existing = document.getElementById('ng-room-filter');
        var existingSections = existing ? existing.querySelectorAll('.ng-rf-section').length : 0;
        if (existing && existingSections === _filterSections.length) {
            log('buildBarFromCache: sections match — sync only');
            syncPills();
            injectToggleBtn();
            revealTopBar();
            if (isAnyFilterActive()) {
                whenPlanCacheReady(applyFilter);
                scheduleFilterPasses();
            }
            return;
        }

        removeBar();
        var bar = createFilterBar();

        var anchor = topBar.parentNode;
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(bar, anchor.nextSibling);
        }

        syncPills();
        injectToggleBtn();
        revealTopBar();
        restoreOpenState();

        if (isAnyFilterActive()) {
            whenPlanCacheReady(applyFilter);
            scheduleFilterPasses();
        }
    }

    /* Create the #ng-room-filter element with panel title + sections */
    function createFilterBar() {
        var bar = document.createElement('div');
        bar.id = 'ng-room-filter';
        bar.setAttribute('role', 'tablist');
        bar.setAttribute('aria-label', 'Filter devices');

        var titleEl = document.createElement('span');
        titleEl.className = 'ng-rf-panel-title';
        titleEl.setAttribute('aria-hidden', 'true');
        titleEl.textContent = 'Filters';
        bar.appendChild(titleEl);

        buildFilterPanel(bar);
        return bar;
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

    /* Inject a "← Dynamic Dashboard" back button */
    function injectDDBackButton() {
        if (!_cameFromDD) return;
        if (document.getElementById('ng-dd-back-btn')) return;

        try {
            var rs = angular.element(document.body).injector().get('$rootScope');
            if (!rs.config || !rs.config.EnableTabDashboardDynamic) return;
        } catch (e) { return; }

        var tbFilters = document.getElementById('tbFilters');
        if (!tbFilters) return;

        var btn = document.createElement('button');
        btn.id        = 'ng-dd-back-btn';
        btn.className = 'ng-dd-back-btn';
        btn.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
        btn.setAttribute('title', 'Back to Dynamic Dashboard');
        btn.addEventListener('click', function () {
            if (window.myglobals) { window.myglobals.LastPlanSelected = 0; }
            _cameFromDD               = false;
            _activeFilters.rooms      = [];
            _activeFilters.types      = [];
            _activeFilters.hardware   = [];
            _activeFilters.favorites  = false;
            removeBar();
            try {
                var inj    = angular.element(document.body).injector();
                var $route = _$route || inj.get('$route');
                var $rsc   = inj.get('$rootScope');
                if ($rsc.$$phase) { $route.reload(); }
                else { $rsc.$apply(function () { $route.reload(); }); }
            } catch (e) {
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
            if (_topbarRetries < MAX_TOPBAR) { _topbarRetries++; scheduleBuildBar(100); }
            else { revealTopBar(); }
            return;
        }
        _topbarRetries = 0;

        log('buildBar: _activeFilters.rooms=', _activeFilters.rooms, '_cameFromDD=', _cameFromDD);

        /* Clear LastPlanSelected after the dashboard controller has read it */
        if (window.myglobals && window.myglobals.LastPlanSelected) {
            window.myglobals.LastPlanSelected = 0;
        }

        setupMobilePage();

        /* Compute filter sections from current page devices */
        computePageFilterSections();
        pruneActiveFiltersForSections();

        /* Phase 2: no comboroom (category pages) — use plan options from initDeviceData */
        var sel = document.getElementById('comboroom');
        if (!sel) {
            if (_filterSections.length > 0) {
                log('buildBar: no comboroom — building from cache');
                buildBarFromCache();
            } else {
                log('buildBar: no comboroom, no sections → removeBar');
                removeBar(); revealTopBar();
            }
            return;
        }

        /* Phase 3: comboroom exists but not populated yet */
        var opts = readOptions();
        log('buildBar: readOptions returned', opts.length, 'options');
        if (opts.length < 2) {
            if (_comboRetries < MAX_COMBO) { _comboRetries++; scheduleBuildBar(300); }
            else { removeBar(); revealTopBar(); }
            return;
        }
        _comboRetries = 0;
        _planOptions  = opts;

        /* Re-compute sections now that _planOptions is set from live comboroom */
        computePageFilterSections();
        pruneActiveFiltersForSections();

        /* Auto-activate room pill from DD's pre-selected comboroom value */
        if (_activeFilters.rooms.length === 0 && sel.selectedIndex > 0) {
            var nativeOpt     = sel.options[sel.selectedIndex];
            var nativePlanIdx = (nativeOpt.value || '').replace(/^(?:number|string):/, '');
            if (nativePlanIdx && nativePlanIdx !== '0' && nativePlanIdx.indexOf('dd:') !== 0) {
                log('buildBar: auto-activating room pill', nativePlanIdx);
                _activeFilters.rooms = [nativePlanIdx];
                _cameFromDD = !!(window.myglobals && window.myglobals.LastPlanSelected);
            }
        }

        /* Already correct sections? Sync and apply filter */
        var existing = document.getElementById('ng-room-filter');
        var existingSections = existing ? existing.querySelectorAll('.ng-rf-section').length : 0;
        if (existing && existingSections === _filterSections.length) {
            log('buildBar: sections match — sync only');
            syncPills();
            injectToggleBtn();
            injectDDBackButton();
            revealTopBar();
            if (isAnyFilterActive()) {
                whenPlanCacheReady(applyFilter);
                scheduleFilterPasses();
            }
            return;
        }

        /* Rebuild */
        log('buildBar: rebuilding filter bar');
        removeBar();

        if (_filterSections.length === 0) { revealTopBar(); return; }

        var bar    = createFilterBar();
        var anchor = topBar.parentNode;
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(bar, anchor.nextSibling);
        }

        syncPills();
        injectToggleBtn();
        injectDDBackButton();
        revealTopBar();
        restoreOpenState();

        if (isAnyFilterActive()) {
            whenPlanCacheReady(applyFilter);
            scheduleFilterPasses();
        }
    }

    /* ══ Angular service patch ══════════════════════════════════════
       Always loads all used devices (not just favourites) so every device
       is in the DOM for client-side filtering.  Keeps device map fresh. */

    function patchAngularServices() {
        if (_svcPatched) return;
        try {
            var inj = angular.element(document.body).injector();

            var svc = inj.get('dashboardService');
            if (!svc.__ngRfPatched) {
                var api = inj.get('domoticzApi');
                svc.loadFavorites = function () {
                    log('loadFavorites: patched — loading all used devices');
                    return api.sendRequest({
                        type: 'command', param: 'getdevices',
                        filter: 'all', used: 'true', favorite: 0,
                        order: '[Order]', plan: 0
                    }).then(function (data) {
                        var devices = data.result || [];
                        buildPlanMapFromDevices(devices);   /* keep maps fresh */
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
            log('patchAngularServices: failed — will retry', e);
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

            patchAngularServices();

            $rs.$on('$routeChangeStart', function () {
                var path = currentHashPath();
                log('$routeChangeStart path=', path);

                if (_buildBarTimer !== null) {
                    clearTimeout(_buildBarTimer);
                    _buildBarTimer = null;
                }

                /* Preemptive cloak for DD openRoomPlan() navigation */
                var ddPlan = window.myglobals && Number(window.myglobals.LastPlanSelected);
                if (ddPlan && !isDetailPath(path)) {
                    document.body.classList.add('ng-rf-reloading');
                }
            });

            $rs.$on('$routeChangeSuccess', function () {
                var newPath = currentHashPath();
                log('$routeChangeSuccess path=', newPath);

                if (isDetailPath(newPath)) {
                    removeBar();
                    document.body.classList.remove('ng-mobile-dashboard');
                } else {
                    removeBar();
                    document.body.classList.remove('ng-mobile-dashboard');

                    var ddPlan = window.myglobals && Number(window.myglobals.LastPlanSelected);
                    if (ddPlan) {
                        log('$routeChangeSuccess: DD room plan', ddPlan);
                        _activeFilters.rooms = [String(ddPlan)];
                        _cameFromDD = true;
                        setTimeout(function () {
                            document.body.classList.remove('ng-rf-reloading');
                        }, 2000);
                    } else {
                        /* Normal navigation — rooms filter persists; type/hardware
                           will be pruned on the next buildBar() call */
                        _cameFromDD = false;
                        log('$routeChangeSuccess: preserving filters', _activeFilters);
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
                if (!_svcPatched) patchAngularServices();
            });

            $rs.$on('device_update', function () {
                if (isAnyFilterActive()) setTimeout(applyFilter, 80);
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
