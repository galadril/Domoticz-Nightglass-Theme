/* ── Feature 14: Filter Bar ─────────────────────────────────────────
   Multi-dimensional device filter: Rooms, Type, Hardware, Favourites.

   On init, fetches all used devices (with PlanIDs) once and builds
   a device map and plan cache.  All filtering is pure DOM show/hide —
   no comboroom manipulation, no Angular route reloads.

   Angular's dashboardService.loadFavorites is patched to return all used
   devices (when Dynamic Dashboard is enabled) so every device is in the DOM
   for client-side filtering.  When DD is disabled the Dashboard retains its
   default favorites-only load and filters are scoped to those favorites.

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
        favorites: false,
        state:     null           /* null = all, 'on' = active, 'off' = inactive */
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
    var _viewTimers     = [];     /* late-render rebuild timers; cleared on route change */

    var _planCacheReady     = false;
    var _planCacheCallbacks = [];

    var _pendingDDPlan  = null;   /* plan IDX captured from LastPlanSelected before zeroing */
    var _prevPath       = null;   /* hash path of the last successfully loaded route */

    /* ══ Route path helpers ══════════════════════════════════════════ */

    function currentHashPath() {
        return (window.location.hash || '').replace(/^#\/?/, '').replace(/\?.*$/, '');
    }

    function isDetailPath(path) {
        return !!path && path.indexOf('/') !== -1;
    }

    function isDynamicDashboardEnabled() {
        try {
            var rs = angular.element(document.body).injector().get('$rootScope');
            return !!(rs.config && rs.config.EnableTabDashboardDynamic);
        } catch (e) { return false; }
    }

    /* Returns 'on', 'off', or null (unrecognised / not binary) for a device. */
    function getDeviceStateLabel(dev) {
        if (!dev) return null;
        var s = (dev.Status || '').trim().toLowerCase();
        if (!s || s === 'unavailable') return null;
        if (s === 'on'  || s === 'open'   || s === 'unlocked' ||
            s === 'alert' || s === 'motion' || s === 'opened') return 'on';
        if (s === 'off' || s === 'closed' || s === 'locked'   ||
            s === 'normal' || s === 'no motion') return 'off';
        /* Dimmer/selector — treat non-zero Level as on */
        if (typeof dev.Level !== 'undefined') return dev.Level > 0 ? 'on' : 'off';
        return null;
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
        /* No viewport-width guard — the CSS media query controls visibility,
           so the backdrop is display:none on desktop even if it exists in the DOM.
           This avoids mismatches between JS innerWidth and CSS breakpoints. */
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
        /* Mobile layout: lights use <tbody ng-repeat><tr id="light_NNN">;
           scenes/temp/weather/utility use <tr id="..."> directly in tbody.
           Sibling slider rows (no id) are handled via CSS adjacent-sibling rule. */
        document.querySelectorAll('.dashboardMobile table.mobileitem tbody tr[id]').forEach(function (el) {
            cards.push(el);
        });
        return cards;
    }

    /* Return all devices from _deviceMap that belong on the current route.
       Used for computing filter sections (always reflects the full set of
       available devices, regardless of what is currently rendered in the DOM).
       Exception: when the Dynamic Dashboard is disabled and the path is the
       plain Dashboard, only favorites are loaded into the DOM so sections must
       be computed from favorites only to keep filters in sync. */
    function getRouteDevices() {
        var allDevs = [];
        Object.keys(_deviceMap).forEach(function (k) { allDevs.push(_deviceMap[k]); });
        if (!allDevs.length) return [];

        var path = currentHashPath().toLowerCase();

        /* Plain Dashboard without DD — only favorites are rendered */
        if ((path === 'dashboard' || path === '') && !isDynamicDashboardEnabled()) {
            return allDevs.filter(function (d) { return d.Favorite == 1; });
        }

        if (path === 'lightswitches' || path === 'switches' || path === 'lights') {
            return allDevs.filter(function (d) {
                if (d.SwitchType) return true;
                var t = (d.Type || '').toLowerCase();
                return t.indexOf('light') === 0 || t.indexOf('blind') === 0 ||
                       t.indexOf('color switch') === 0 || t.indexOf('curtain') === 0 ||
                       t.indexOf('security') === 0 || t.indexOf('fan') === 0 ||
                       t.indexOf('rfy') === 0 || t.indexOf('chime') === 0;
            });
        }
        if (path === 'temperature') {
            return allDevs.filter(function (d) {
                return typeof d.Temp !== 'undefined' || typeof d.Humidity !== 'undefined';
            });
        }
        if (path === 'weather') {
            return allDevs.filter(function (d) {
                return typeof d.Rain !== 'undefined' || typeof d.Direction !== 'undefined' ||
                       typeof d.Barometer !== 'undefined' || typeof d.UVI !== 'undefined' ||
                       typeof d.Visibility !== 'undefined' || typeof d.Radiation !== 'undefined';
            });
        }
        if (path === 'utility') {
            return allDevs.filter(function (d) {
                return typeof d.Counter !== 'undefined' ||
                       d.Type === 'Energy' || d.SubType === 'kWh' ||
                       d.Type === 'Air Quality' || d.Type === 'Lux' ||
                       d.Type === 'Usage' || d.Type === 'Power' ||
                       d.Type === 'Weight' || d.SubType === 'Percentage' ||
                       d.SubType === 'Voltage' || d.SubType === 'Current' ||
                       d.SubType === 'Text' || d.SubType === 'Alert';
            });
        }
        if (path === 'scenes') {
            return allDevs.filter(function (d) {
                return (d.Type || '').indexOf('Scene') === 0 ||
                       (d.Type || '').indexOf('Group') === 0;
            });
        }
        /* Dashboard or unknown route — all devices */
        return allDevs;
    }

    /* Return the devices relevant to the current page for applyFilter() use.
       Prefers actual DOM cards (needed for show/hide to work); falls back to
       getRouteDevices() when Angular hasn't finished rendering cards yet.
       Deduplicates by idx: a Temp+Hum sensor appears in both temperature[] and
       weather[] DOM sections but must be counted only once. */
    function getPageDevices() {
        var cards   = getCards();
        var seen    = {};
        var domDevs = [];
        cards.forEach(function (card) {
            var idx = cardIdx(card);
            if (idx && _deviceMap[idx] && !seen[idx]) {
                seen[idx] = true;
                domDevs.push(_deviceMap[idx]);
            }
        });
        if (domDevs.length > 0) return domDevs;
        return getRouteDevices();
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

    /* Returns the device set used for filter sections and pill counts.
       On the plain Dashboard (no DD) the mobile template only renders the
       five supported categories (scenes, lights, temp, weather, utility).
       Favorites of other types (Setpoints, P1 Meter, etc.) are in _deviceMap
       as Favorite=1 but never appear in the DOM.  Scoping to DOM devices here
       prevents showing filter pills for categories the user cannot see.
       All other routes use getRouteDevices() for pre-render accuracy. */

    /* True when the mobile dashboard is a plain favorites-only (or DOM-scoped) view.
       Two scenarios where we scope to DOM devices:
         B) DD enabled but Domoticz fell back to mobile view (e.g. MobileType
            setting) without room context (_cameFromDD = false) → favorites only
         C) DD disabled → always favorites only

       Scenario A (DD + room selection, _cameFromDD = true) intentionally returns
       false so that getFilterableDevices() uses getRouteDevices() — the full 86-
       device set.  This ensures the filter panel shows ALL types and hardware
       options (with room-adjusted counts), not just those for the selected room,
       so the user can clear the room filter to reveal all devices.
    */
    function isOnMobileDashboardView() {
        var path = currentHashPath().toLowerCase();
        if (path !== 'dashboard' && path !== '') return false;
        if (!isDynamicDashboardEnabled()) return true;
        // DD on: use DOM devices only when NOT from a DD room selection
        return !_cameFromDD && !!document.querySelector('.dashboardMobile');
    }

    function getFilterableDevices() {
        return isOnMobileDashboardView() ? getPageDevices() : getRouteDevices();
    }

    /* ══ Filter section computation ═════════════════════════════════ */

    /* Returns a string that uniquely identifies the current section structure
       (which dimensions exist and which values each one contains).
       Used by buildBar / buildBarFromCache to detect when a rebuild is needed
       rather than relying on section-count alone (which misses value changes). */
    function sectionFingerprint() {
        return _filterSections.map(function (s) {
            return s.id + ':' + s.values.map(function (v) { return v.value; }).join(',');
        }).join('|');
    }

    /* Returns unique values from devices via fn(), sorted by descending device count
       so the most-populated filter options appear first. */
    function uniqueValuesByCount(devices, fn) {
        var counts = {};
        devices.forEach(function (d) {
            var v = fn(d);
            if (v) counts[v] = (counts[v] || 0) + 1;
        });
        return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
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

        /* Use getFilterableDevices() which scopes to DOM devices on the mobile
           Dashboard (so only devices actually rendered in the 5 mobile categories
           are counted) and to getRouteDevices() everywhere else. */
        var devices = getFilterableDevices();

        if (!devices.length) return;   /* _deviceMap not ready yet — rooms only */

        /* Type section — only shown when 2+ distinct types exist on this page */
        var typeValues = uniqueValuesByCount(devices, getDeviceTypeLabel);
        if (typeValues.length >= 2) {
            _filterSections.push({
                id:     'types',
                label:  'Type',
                values: typeValues.map(function (v) { return { value: v, label: v }; })
            });
        }

        /* Hardware section — only shown when 2+ distinct hardware sources */
        var hwValues = uniqueValuesByCount(devices, function (d) {
            return (d.HardwareName || '').trim() || null;
        });
        if (hwValues.length >= 2) {
            _filterSections.push({
                id:     'hardware',
                label:  'Hardware',
                values: hwValues.map(function (v) { return { value: v, label: v }; })
            });
        }

        /* Status section — only when devices have a recognisable mix of on/off states */
        var hasOn  = devices.some(function (d) { return getDeviceStateLabel(d) === 'on';  });
        var hasOff = devices.some(function (d) { return getDeviceStateLabel(d) === 'off'; });
        if (hasOn && hasOff) {
            _filterSections.push({
                id:     'state',
                label:  'Status',
                values: [
                    { value: 'on',  label: 'On / Active'   },
                    { value: 'off', label: 'Off / Inactive' }
                ]
            });
        }

        /* Favourites section — only shown when the page has a mix of
           favourited and non-favourited devices.  Skip on the plain Dashboard
           when DD is disabled: it already shows only favorites, so this filter
           would be redundant. */
        if (!isOnMobileDashboardView()) {
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

        if (!findSection('state')) {
            _activeFilters.state = null;
        }

        if (!findSection('favorites')) {
            _activeFilters.favorites = false;
        }
    }

    /* ══ Filter application ═════════════════════════════════════════
       AND across dimensions, OR within each dimension.
       Devices with no _deviceMap entry are kept visible (safe default). */

    function applyFilter() {
        var roomsActive   = _activeFilters.rooms.length    > 0;
        var typesActive   = _activeFilters.types.length    > 0;
        var hwActive      = _activeFilters.hardware.length > 0;
        var favsActive    = _activeFilters.favorites;
        var stateActive   = _activeFilters.state !== null;
        var cards         = getCards();
        /* Track unique device idx to avoid double-counting devices that appear in
           multiple mobile sections (e.g. a Temp+Hum sensor in both temperature
           and weather sections). */
        var visibleIdxs = {};
        var totalIdxs   = {};

        cards.forEach(function (card) {
            var idx  = cardIdx(card);
            var dev  = idx ? _deviceMap[idx] : null;
            var show = true;

            if (idx) {
                totalIdxs[idx] = true;

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

                if (show && stateActive && dev) {
                    if (getDeviceStateLabel(dev) !== _activeFilters.state) show = false;
                }

                if (show && favsActive && dev) {
                    if (dev.Favorite != 1) show = false;
                }

                if (show) visibleIdxs[idx] = true;
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

        /* Result summary — counts unique devices, not DOM rows */
        var visibleCount = Object.keys(visibleIdxs).length;
        var totalCount   = Object.keys(totalIdxs).length;
        var summaryEl = document.getElementById('ng-rf-summary');
        if (summaryEl && totalCount > 0) {
            summaryEl.textContent = isAnyFilterActive()
                ? ('Showing ' + visibleCount + ' of ' + totalCount + ' devices')
                : (totalCount + ' devices');
        }

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
               _activeFilters.favorites                ||
               _activeFilters.state !== null;
    }

    /* ══ Pill count computation ══════════════════════════════════════
       Returns how many route devices would be visible if the given
       pill were the only active value in its dimension, keeping all
       other currently active filters unchanged.
       Returns null when device data or plan cache isn't ready yet. */
    function countForPill(dim, value) {
        if (!_planCacheReady) return null;
        var devices = getFilterableDevices();
        if (!devices.length) return null;

        /* Build a hypothetical filter state, overriding only this dim */
        var hypo = {
            rooms:     _activeFilters.rooms.slice(),
            types:     _activeFilters.types.slice(),
            hardware:  _activeFilters.hardware.slice(),
            favorites: _activeFilters.favorites,
            state:     _activeFilters.state
        };
        if (dim === 'favorites') {
            hypo.favorites = (value === 'favorites');
        } else if (dim === 'state') {
            hypo.state = (value === '') ? null : value;
        } else if (value === '') {
            hypo[dim] = [];
        } else {
            hypo[dim] = [value];
        }

        return devices.filter(function (dev) {
            var idx = String(dev.idx);

            if (hypo.rooms.length > 0) {
                var inRoom = false;
                for (var i = 0; i < hypo.rooms.length; i++) {
                    var set = _planCache[hypo.rooms[i]];
                    if (set && set[idx]) { inRoom = true; break; }
                }
                if (!inRoom) return false;
            }

            if (hypo.types.length > 0) {
                if (hypo.types.indexOf(getDeviceTypeLabel(dev)) === -1) return false;
            }

            if (hypo.hardware.length > 0) {
                var hw = (dev.HardwareName || '').trim();
                if (hypo.hardware.indexOf(hw) === -1) return false;
            }

            if (hypo.state !== null) {
                if (getDeviceStateLabel(dev) !== hypo.state) return false;
            }

            if (hypo.favorites) {
                if (dev.Favorite != 1) return false;
            }

            return true;
        }).length;
    }

    function clearAllFilters() {
        _activeFilters.rooms     = [];
        _activeFilters.types     = [];
        _activeFilters.hardware  = [];
        _activeFilters.favorites = false;
        _activeFilters.state     = null;
        syncPills();
        applyFilter();
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
            } else if (dim === 'state') {
                _activeFilters.state = null;
            } else {
                _activeFilters[dim] = [];
            }
        } else if (dim === 'favorites') {
            /* Favourites is a simple toggle: "All" → "Favourites" → "All" */
            _activeFilters.favorites = true;
        } else if (dim === 'state') {
            /* State is exclusive: clicking the active value toggles back to All */
            _activeFilters.state = (_activeFilters.state === value) ? null : value;
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
                if (dim === 'favorites') {
                    active = !_activeFilters.favorites;
                } else if (dim === 'state') {
                    active = _activeFilters.state === null;
                } else {
                    active = (_activeFilters[dim] || []).length === 0;
                }
            } else if (dim === 'favorites') {
                active = _activeFilters.favorites;
            } else if (dim === 'state') {
                active = _activeFilters.state === value;
            } else {
                active = (_activeFilters[dim] || []).indexOf(value) !== -1;
            }

            pill.classList.toggle('ng-rf-pill--active', active);
            pill.setAttribute('aria-selected', String(active));

            /* Count badge — only on value pills, not the "All" pill */
            if (value !== '') {
                var badge = pill.querySelector('.ng-rf-pill-count');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'ng-rf-pill-count';
                    pill.appendChild(badge);
                }
                var n = countForPill(dim, value);
                if (n !== null) {
                    var prev = badge.dataset.prevCount;
                    if (prev !== undefined && prev !== String(n)) {
                        badge.classList.remove('ng-rf-count-pulse');
                        void badge.offsetWidth;  /* reflow to restart animation */
                        badge.classList.add('ng-rf-count-pulse');
                    }
                    badge.dataset.prevCount = String(n);
                    badge.textContent = String(n);
                    badge.style.display = '';
                    pill.classList.toggle('ng-rf-pill--zero', n === 0);
                } else {
                    badge.style.display = 'none';
                }
            }
        });

        /* Toggle button count badge */
        var btn   = document.getElementById('ng-rf-toggle');
        var count = btn && btn.querySelector('.ng-rf-toggle-count');
        var total = _activeFilters.rooms.length +
                    _activeFilters.types.length +
                    _activeFilters.hardware.length +
                    (_activeFilters.state !== null ? 1 : 0) +
                    (_activeFilters.favorites ? 1 : 0);
        if (count) {
            count.textContent   = total > 0 ? String(total) : '';
            count.style.display = total > 0 ? 'inline-flex' : 'none';
        }
        if (btn) {
            btn.classList.toggle('ng-rf-toggle-btn--filtered', total > 0);
        }

        /* Show/hide "Clear all filters" button */
        var clearBtn = document.getElementById('ng-rf-clear-all');
        if (clearBtn) {
            clearBtn.style.display = isAnyFilterActive() ? 'block' : 'none';
        }

        /* Active-filter chip bar */
        updateChipBar();
    }

    /* ══ Active filter chip bar ══════════════════════════════════════
       Compact removable chips shown in the topbar when filters are active
       and the panel is closed. */

    function getActiveChips() {
        var chips = [];
        var i, opt;

        for (i = 0; i < _activeFilters.rooms.length; i++) {
            var planIdx = _activeFilters.rooms[i];
            var label   = planIdx;
            for (var j = 0; j < _planOptions.length; j++) {
                if (_planOptions[j].planIdx === planIdx) { label = _planOptions[j].label; break; }
            }
            chips.push({ dim: 'rooms', value: planIdx, label: label });
        }
        for (i = 0; i < _activeFilters.types.length; i++) {
            chips.push({ dim: 'types', value: _activeFilters.types[i], label: _activeFilters.types[i] });
        }
        for (i = 0; i < _activeFilters.hardware.length; i++) {
            chips.push({ dim: 'hardware', value: _activeFilters.hardware[i], label: _activeFilters.hardware[i] });
        }
        if (_activeFilters.state !== null) {
            chips.push({ dim: 'state', value: _activeFilters.state,
                         label: _activeFilters.state === 'on' ? 'On / Active' : 'Off / Inactive' });
        }
        if (_activeFilters.favorites) {
            chips.push({ dim: 'favorites', value: 'favorites', label: 'Favourites ★' });
        }
        return chips;
    }

    function updateChipBar() {
        var toggleBtn = document.getElementById('ng-rf-toggle');
        if (!toggleBtn) return;

        var bar = document.getElementById('ng-rf-chip-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'ng-rf-chip-bar';
            toggleBtn.parentNode.insertBefore(bar, toggleBtn.nextSibling);
        }

        /* Clear */
        while (bar.firstChild) bar.removeChild(bar.firstChild);

        var chips = getActiveChips();
        chips.forEach(function (chip) {
            var el    = document.createElement('span');
            el.className = 'ng-rf-chip';

            var lbl = document.createElement('span');
            lbl.className   = 'ng-rf-chip-label';
            lbl.textContent = chip.label;

            var rm = document.createElement('button');
            rm.className       = 'ng-rf-chip-remove';
            rm.setAttribute('aria-label', 'Remove filter: ' + chip.label);
            rm.textContent = '×';

            ;(function (c) {
                rm.addEventListener('click', function (e) {
                    e.stopPropagation();
                    if (c.dim === 'favorites') {
                        _activeFilters.favorites = false;
                    } else if (c.dim === 'state') {
                        _activeFilters.state = null;
                    } else {
                        var arr = _activeFilters[c.dim];
                        var pos = arr.indexOf(c.value);
                        if (pos !== -1) arr.splice(pos, 1);
                    }
                    syncPills();
                    whenPlanCacheReady(applyFilter);
                });
            }(chip));

            el.appendChild(lbl);
            el.appendChild(rm);
            bar.appendChild(el);
        });

        bar.style.display = chips.length > 0 ? '' : 'none';
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

    /* Re-apply mobile slider widths using Domoticz's own formula.
       Domoticz runs ResizeDimSliders() at t+100ms after data loads; at that
       moment the mobileitem layout may not be finalised and it measures ~64px,
       giving a 1px track width.  We repeat the measurement at a later time
       when the layout is stable and the sliders are in the DOM. */
    function fixMobileSliderWidths() {
        var tables = document.querySelectorAll('.dashboardMobile .mobileitem');
        if (!tables.length) return;
        /* Use the widest rendered mobileitem (ng-rf-section-hidden ones have 0) */
        var w = 0;
        tables.forEach(function (t) {
            var tw = t.offsetWidth;
            if (tw > w) w = tw;
        });
        if (w < 100) return;   /* layout not stable yet — skip silently */
        var trackW = w - 63;
        if (trackW <= 0) return;
        document.querySelectorAll(
            '.dashboardMobile .mobileitem .dimslidernorm,' +
            '.dashboardMobile .mobileitem .dimslidersmall'
        ).forEach(function (el) {
            el.style.width = trackW + 'px';
        });
    }

    function setupMobilePage() {
        var isMobile = !!document.querySelector('.dashboardMobile');
        document.body.classList.toggle('ng-mobile-dashboard', isMobile);
        if (isMobile) {
            setTimeout(attachMobileSearch, 200);
            /* Run at 300ms and 700ms to cover both fast and slow data-load paths */
            setTimeout(fixMobileSliderWidths, 300);
            setTimeout(fixMobileSliderWidths, 700);
        }
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
            labelEl.className = 'ng-rf-section-label';
            labelEl.appendChild(document.createTextNode(section.label));

            var chevron = document.createElement('i');
            chevron.className = 'fa-solid fa-chevron-down ng-rf-section-chevron';
            chevron.setAttribute('aria-hidden', 'true');
            labelEl.appendChild(chevron);

            /* Restore + toggle collapse state (mobile drawer only;
               CSS keeps the chevron hidden on desktop so clicking there
               has no visible effect and the pills stay visible). */
            var collapseKey = 'ng-rf-col-' + section.id;
            if (localStorage.getItem(collapseKey) === '1') {
                secEl.classList.add('ng-rf-section--collapsed');
            }
            (function (el, key) {
                labelEl.addEventListener('click', function () {
                    var collapsed = el.classList.toggle('ng-rf-section--collapsed');
                    localStorage.setItem(key, collapsed ? '1' : '0');
                });
            }(secEl, collapseKey));

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

        /* Check if bar already matches current sections (full fingerprint match) */
        var existing = document.getElementById('ng-room-filter');
        var newFp    = sectionFingerprint();
        if (existing && existing.dataset.ngRfFp === newFp) {
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
        bar.dataset.ngRfFp = sectionFingerprint();
        bar.setAttribute('role', 'tablist');
        bar.setAttribute('aria-label', 'Filter devices');

        var titleEl = document.createElement('span');
        titleEl.className = 'ng-rf-panel-title';
        titleEl.setAttribute('aria-hidden', 'true');
        titleEl.textContent = 'Filters';

        var closeBtn = document.createElement('button');
        closeBtn.className = 'ng-rf-drawer-close';
        closeBtn.setAttribute('aria-label', 'Close filters');
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.addEventListener('click', closeDrawer);
        titleEl.appendChild(closeBtn);

        bar.appendChild(titleEl);

        var summaryEl = document.createElement('div');
        summaryEl.id        = 'ng-rf-summary';
        summaryEl.className = 'ng-rf-summary';
        bar.appendChild(summaryEl);

        var clearBtn = document.createElement('button');
        clearBtn.id        = 'ng-rf-clear-all';
        clearBtn.className = 'ng-rf-clear-all';
        clearBtn.textContent = '× Clear all filters';
        clearBtn.style.display = 'none';   /* shown by syncPills when any filter is active */
        clearBtn.addEventListener('click', clearAllFilters);
        bar.appendChild(clearBtn);

        buildFilterPanel(bar);
        return bar;
    }

    function removeBar() {
        var rf  = document.getElementById('ng-room-filter');
        var btn = document.getElementById('ng-rf-toggle');
        var bb  = document.getElementById('ng-dd-back-btn');
        var cb  = document.getElementById('ng-rf-chip-bar');
        _stripWasOpen = !!(rf && rf.classList.contains('ng-rf--open'));
        if (rf)  rf.remove();
        if (btn) btn.remove();
        if (bb)  bb.remove();
        if (cb)  cb.remove();
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

        /* Auto-activate room pill when comboroom has a non-"All" value but our filter
           bar has no rooms selected (e.g. hard-reload on a room URL, or comboroom
           changed natively).  DD → Dashboard flow sets _activeFilters.rooms via
           $routeChangeSuccess/_pendingDDPlan so this block is skipped in that case. */
        if (_activeFilters.rooms.length === 0 && sel.selectedIndex > 0) {
            var nativeOpt     = sel.options[sel.selectedIndex];
            var nativePlanIdx = (nativeOpt.value || '').replace(/^(?:number|string):/, '');
            if (nativePlanIdx && nativePlanIdx !== '0' && nativePlanIdx.indexOf('dd:') !== 0) {
                log('buildBar: auto-activating room pill from comboroom', nativePlanIdx);
                _activeFilters.rooms = [nativePlanIdx];
            }
        }

        /* Already correct sections? Sync and apply filter */
        var existing = document.getElementById('ng-room-filter');
        var newFp    = sectionFingerprint();
        if (existing && existing.dataset.ngRfFp === newFp) {
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
       Ensures the Dashboard page always loads all used devices (not just
       favourites) so every device is in the DOM for client-side filtering.

       Three layers, from lowest to highest level:

       1. domoticzApi.sendRequest — patched first because it is loaded at
          app bootstrap (never lazy).  Any getdevices call on the Dashboard
          route gets favorite:0 / plan:0 regardless of caller.  This catches
          the race where dashboardService is lazy-loaded AFTER the controller
          already fires its first loadFavorites() call.

       2. dashboardService.loadFavorites — patched when the service becomes
          available (may be after layer 1).  Replaces the entire method so
          it always returns all used devices with no plan filter.

       3. livesocket.getJson — URL-level patch for the legacy RefreshFavorites
          polling path that builds the URL string directly.                  */

    function patchAngularServices() {
        if (_svcPatched) return;
        try {
            var inj = angular.element(document.body).injector();

            /* Layer 1: domoticzApi.sendRequest (always available at boot) */
            var api = inj.get('domoticzApi');
            if (!api.__ngRfPatched) {
                var origSendRequest = api.sendRequest.bind(api);
                api.sendRequest = function (params) {
                    /* On the Dashboard route, force all-device loading only when
                       the Dynamic Dashboard is enabled (so the filter bar can
                       show all devices for client-side filtering).  When DD is
                       disabled the plain Dashboard keeps its default
                       favorites-only behaviour. */
                    if (params && params.param === 'getdevices') {
                        var path = currentHashPath().toLowerCase();
                        if ((path === 'dashboard' || path === '') && isDynamicDashboardEnabled()) {
                            params = Object.assign({}, params, {
                                favorite: 0, plan: 0, used: 'true'
                            });
                        }
                    }
                    return origSendRequest(params);
                };
                api.__ngRfPatched = true;
                log('patchAngularServices: domoticzApi.sendRequest patched');
            }

            /* Layer 2: dashboardService.loadFavorites (lazy-loaded; may not
               exist yet — skip silently and catch on next $viewContentLoaded) */
            try {
                var svc = inj.get('dashboardService');
                if (svc && !svc.__ngRfPatched) {
                    var origLoadFavorites = svc.loadFavorites.bind(svc);
                    svc.loadFavorites = function () {
                        if (!isDynamicDashboardEnabled()) {
                            log('loadFavorites: DD disabled — using original favorites behaviour');
                            return origLoadFavorites();
                        }
                        log('loadFavorites: patched — loading all used devices');
                        return api.sendRequest({
                            type: 'command', param: 'getdevices',
                            filter: 'all', used: 'true', favorite: 0,
                            order: '[Order]', plan: 0
                        }).then(function (data) {
                            var devices = data.result || [];
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
                    log('patchAngularServices: dashboardService.loadFavorites patched');
                }
            } catch (e) { /* dashboardService not loaded yet — layer 1 covers us */ }

            /* Layer 3: livesocket.getJson URL-level patch */
            var ls = inj.get('livesocket');
            if (!ls.__ngRfPatched) {
                var origGetJson = ls.getJson.bind(ls);
                ls.getJson = function (url, cb) {
                    if (typeof url === 'string' && url.indexOf('param=getdevices') !== -1 &&
                            isDynamicDashboardEnabled()) {
                        url = url.replace(/\bfavorite=1\b/, 'favorite=0');
                        url = url.replace(/\bplan=\d+\b/, 'plan=0');
                    }
                    return origGetJson.call(this, url, cb);
                };
                ls.__ngRfPatched = true;
                log('patchAngularServices: livesocket.getJson patched');
            }

            _svcPatched = true;
            log('patchAngularServices: done');
        } catch (e) {
            log('patchAngularServices: failed — will retry', e);
        }
    }

    /* Re-apply layer 2 (dashboardService) after a lazy-load.  Called from
       $viewContentLoaded in case dashboardService wasn't available earlier. */
    function patchDashboardServiceIfNeeded() {
        if (!_svcPatched) return;   /* full patch not done yet — don't bother */
        try {
            var inj = angular.element(document.body).injector();
            var svc = inj.get('dashboardService');
            var api = inj.get('domoticzApi');
            if (svc && !svc.__ngRfPatched) {
                var origLoadFav = svc.loadFavorites.bind(svc);
                svc.loadFavorites = function () {
                    if (!isDynamicDashboardEnabled()) {
                        log('patchDashboardServiceIfNeeded: DD disabled — using original favorites behaviour');
                        return origLoadFav();
                    }
                    return api.sendRequest({
                        type: 'command', param: 'getdevices',
                        filter: 'all', used: 'true', favorite: 0,
                        order: '[Order]', plan: 0
                    }).then(function (data) {
                        var devices = data.result || [];
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
                log('patchDashboardServiceIfNeeded: dashboardService.loadFavorites patched');
            }
        } catch (e) { /* service still not loaded — layer 1 is active */ }
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
                _viewTimers.forEach(clearTimeout);
                _viewTimers = [];

                /* Capture and immediately zero LastPlanSelected so the incoming
                   DashboardDesktopController (which instantiates between
                   $routeChangeStart and $routeChangeSuccess) sees plan=0 and
                   loads ALL devices rather than only the selected room's devices.
                   We store the room in _pendingDDPlan and apply it to the filter
                   bar ourselves in $routeChangeSuccess. */
                var ddPlan = window.myglobals && Number(window.myglobals.LastPlanSelected);
                if (ddPlan && !isDetailPath(path)) {
                    _pendingDDPlan = String(ddPlan);
                    window.myglobals.LastPlanSelected = 0;
                    document.body.classList.add('ng-rf-reloading');
                    log('$routeChangeStart: captured DD plan', _pendingDDPlan, '— zeroed LastPlanSelected');
                }
            });

            $rs.$on('$routeChangeSuccess', function () {
                var newPath = currentHashPath();
                var prevWasDetail = isDetailPath(_prevPath);
                log('$routeChangeSuccess path=', newPath, 'prevPath=', _prevPath);

                if (isDetailPath(newPath)) {
                    removeBar();
                    document.body.classList.remove('ng-mobile-dashboard');
                } else {
                    removeBar();
                    document.body.classList.remove('ng-mobile-dashboard');

                    /* _pendingDDPlan was captured (and LastPlanSelected zeroed) in
                       $routeChangeStart so the controller loaded all devices. */
                    if (_pendingDDPlan) {
                        log('$routeChangeSuccess: applying DD room filter', _pendingDDPlan);
                        _activeFilters.rooms = [_pendingDDPlan];
                        _cameFromDD = true;
                        _pendingDDPlan = null;
                        setTimeout(function () {
                            document.body.classList.remove('ng-rf-reloading');
                            fixMobileSliderWidths();
                        }, 2000);
                    } else {
                        _pendingDDPlan = null;
                        _cameFromDD = false;
                        if (prevWasDetail) {
                            /* Returning from a detail page — restore all filters as-is */
                            log('$routeChangeSuccess: returning from detail, preserving all filters', _activeFilters);
                        } else {
                            /* Category → category navigation — keep rooms, reset the rest */
                            _activeFilters.types     = [];
                            _activeFilters.hardware  = [];
                            _activeFilters.favorites = false;
                            _activeFilters.state     = null;
                            log('$routeChangeSuccess: category nav, reset type/hw/favs, rooms=', _activeFilters.rooms);
                        }
                    }
                }

                _prevPath      = newPath;
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
                /* Layer 2 catch-up: dashboardService is lazy-loaded; it becomes
                   available after the route resolves.  Apply the loadFavorites
                   patch now so future calls (refresh, re-renders) use it. */
                patchDashboardServiceIfNeeded();

                /* Schedule late-render rebuilds.  Angular's ng-repeat may need
                   several digest cycles before all device cards are in the DOM.
                   These retries pick up type/hardware sections that were missed
                   on the first 150ms pass.  Timers are cancelled on route change. */
                _viewTimers = [450, 1100].map(function (delay) {
                    return setTimeout(buildBar, delay);
                });
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
