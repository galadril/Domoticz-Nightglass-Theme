/* ── Feature 15: Attention Center ───────────────────────────────────
   One drawer for "things that need a human": low batteries, devices that
   stopped reporting, and timers that cannot fire.  Reuses the notification
   panel's slide-in pattern (340 px right drawer, bottom sheet on mobile).

   Keyboard shortcut: A  (toggle open / close)
   Entry points:      status-bar chip #ng-sb-attn, command palette, A key
   Settings:          attentionCenter, attentionBatteryThreshold,
                      attentionStaleHours, attentionSections,
                      attentionSnoozed, attentionToast

   API assumptions (could not be verified against a live Domoticz):
   - json.htm?type=command&param=getdevices&filter=all&used=true&order=Name
       -> { status:'OK', result:[ { idx, Name, BatteryLevel, LastUpdate,
            Type, SubType, SwitchType, HardwareName, ... } ] }
       BatteryLevel 255 (or absent) means "no battery". LastUpdate is a local
       time string "YYYY-MM-DD HH:MM:SS".
   - json.htm?type=schedules&filter=device
       -> { status:'OK', result:[ { TimerID, DeviceRowID, Name, Active,
            Type, ... } ] }   Active is "true"/"false" (or boolean).
       Domoticz has no "last run failed" state, so the Timers section is a
       heuristic: disabled timers, or timers pointing at a device that is no
       longer in the used-device list.  Any failure hides the section.

   Nothing is created and nothing is requested unless the attentionCenter
   setting is on when the stored settings have loaded.
──────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var POLL_MS       = 5 * 60 * 1000;
    var CACHE_MS      = 60 * 1000;
    var RENDER_DEBOUNCE = 500;
    var ROW_LIMIT     = 50;
    var EVENT_LIMIT   = 10;
    var ALL_SECTIONS  = ['battery', 'stale', 'timers', 'events'];

    var SECTION_META = {
        battery: { title: 'Low battery',       icon: 'fa-battery-quarter' },
        stale:   { title: 'Offline / stale',   icon: 'fa-plug-circle-xmark' },
        timers:  { title: 'Timers to check',   icon: 'fa-clock' },
        events:  { title: 'Recent events',     icon: 'fa-bell' }
    };

    var _devices    = {};      // idx -> device (from getdevices, patched live)
    var _devTs      = 0;       // when getdevices last succeeded
    var _devPromise = null;
    var _devError   = false;
    var _timers     = [];
    var _timersOk   = false;   // false until a schedules call succeeded
    var _panel      = null;
    var _open       = false;
    var _lastFocus  = null;
    var _renderTimer = null;
    var _pollTimer  = null;
    var _knownLow   = null;    // idx -> true; null until first load (no toast storm)
    var _collapsed  = {};
    var _expanded   = {};
    var _snoozeOpen = null;    // key of the row whose snooze choices are showing

    /* ── Helpers ───────────────────────────────────────────────── */

    function settings() { return window.dzNightglassSettings; }
    function getSetting(k) { var s = settings(); return s ? s.get(k) : undefined; }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function keyOf(v) { return String(v == null ? '' : v).replace(/[^\w\-]/g, ''); }

    function parseJson(raw, fallback) {
        try {
            var v = typeof raw === 'string' ? JSON.parse(raw || 'null') : raw;
            return (v && typeof v === 'object') ? v : fallback;
        } catch (e) { return fallback; }
    }

    function threshold() {
        var n = parseInt(getSetting('attentionBatteryThreshold'), 10);
        return n > 0 ? n : 20;
    }

    function enabledSections() {
        var a = parseJson(getSetting('attentionSections'), ALL_SECTIONS);
        return Array.isArray(a) ? a : ALL_SECTIONS;
    }

    /* "YYYY-MM-DD HH:MM:SS" is server-local wall time, not UTC. Build the Date
       from components so it is read in the browser's local zone rather than
       relying on engine-specific Date string parsing. */
    function parseLastUpdate(str) {
        if (!str) return null;
        var m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (!m) return null;
        var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
        return isNaN(d.getTime()) ? null : d;
    }

    function isStale(date) {
        if (window.ngIsStale) return window.ngIsStale(date);
        var h = parseFloat(getSetting('attentionStaleHours')) || 24;
        return (Date.now() - date.getTime()) >= h * 3600000;
    }

    function ago(ms) {
        var m = Math.floor(ms / 60000);
        if (m < 60)   return Math.max(m, 1) + 'm ago';
        var h = Math.floor(m / 60);
        if (h < 48)   return h + 'h ago';
        return Math.floor(h / 24) + 'd ago';
    }

    /* ── Snooze store (setting attentionSnoozed: idx -> epoch ms, 0 = forever) ── */

    function snoozeMap() { return parseJson(getSetting('attentionSnoozed'), {}); }

    function isSnoozed(key, map) {
        map = map || snoozeMap();
        if (!Object.prototype.hasOwnProperty.call(map, key)) return false;
        var v = +map[key];
        return v === 0 || v > Date.now();
    }

    function snooze(key, ms) {
        var map = snoozeMap();
        var now = Date.now();
        Object.keys(map).forEach(function (k) {          // drop expired entries
            if (+map[k] !== 0 && +map[k] <= now) delete map[k];
        });
        map[key] = ms === 0 ? 0 : now + ms;
        saveSnoozed(map);
    }

    function saveSnoozed(map) {
        var s = settings();
        if (s) s.set('attentionSnoozed', JSON.stringify(map));
        scheduleRender(0);
    }

    function activeSnoozeCount() {
        var map = snoozeMap();
        return Object.keys(map).filter(function (k) { return isSnoozed(k, map); }).length;
    }

    /* ── Data ──────────────────────────────────────────────────── */

    function isVirtualOrGroup(d) {
        var t = String(d.Type || '').toLowerCase();
        if (t === 'scene' || t === 'group') return true;
        var hw = String(d.HardwareName || '') + ' ' + String(d.HardwareType || '');
        return /dummy|virtual/i.test(hw);
    }

    function fetchDevices(force) {
        if (!force && _devPromise) return _devPromise;
        if (!force && _devTs && (Date.now() - _devTs) < CACHE_MS) return Promise.resolve();
        _devPromise = fetch('json.htm?type=command&param=getdevices&filter=all&used=true&order=Name',
                            { credentials: 'same-origin', cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                var map = {};
                ((data && data.result) || []).forEach(function (d) {
                    if (d && d.idx != null) map[String(d.idx)] = d;
                });
                _devices = map;
                _devTs = Date.now();
                _devError = false;
            })
            .catch(function () { _devError = true; })
            .then(function () { _devPromise = null; });
        return _devPromise;
    }

    function fetchTimers() {
        return fetch('json.htm?type=schedules&filter=device',
                     { credentials: 'same-origin', cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                if (!data || (data.status && data.status !== 'OK')) throw new Error('bad status');
                _timers = Array.isArray(data.result) ? data.result : [];
                _timersOk = true;
            })
            .catch(function () { _timers = []; _timersOk = false; });
    }

    function refresh() {
        return Promise.all([fetchDevices(true), fetchTimers()]).then(function () {
            checkNewLowBattery();
            scheduleRender(0);
        });
    }

    /* Open uses the 60 s getdevices cache; the timer list is always re-read. */
    function refreshForOpen() {
        return Promise.all([fetchDevices(false), fetchTimers()]).then(function () {
            checkNewLowBattery();
            scheduleRender(0);
        });
    }

    /* ── Compute ───────────────────────────────────────────────── */

    function batteryItems() {
        var th = threshold(), out = [];
        Object.keys(_devices).forEach(function (k) {
            var d = _devices[k];
            if (d.BatteryLevel == null || d.BatteryLevel === '') return;
            var lvl = Number(d.BatteryLevel);
            if (isNaN(lvl) || lvl === 255 || lvl < 0) return;   // 255 = no battery
            if (lvl <= th) out.push({ key: keyOf(d.idx), dev: d, level: lvl });
        });
        out.sort(function (a, b) { return a.level - b.level; });
        return out;
    }

    function lastSeen(d) {
        var t = parseLastUpdate(d.LastUpdate);
        var ms = t ? t.getTime() : 0;
        if (d._ngSeen && d._ngSeen > ms) ms = d._ngSeen;    // live update seen
        return ms || null;
    }

    function staleItems() {
        var out = [];
        Object.keys(_devices).forEach(function (k) {
            var d = _devices[k];
            if (isVirtualOrGroup(d)) return;
            var ms = lastSeen(d);
            if (!ms) return;                                // no timestamp: do not guess
            if (isStale(new Date(ms))) out.push({ key: keyOf(d.idx), dev: d, ts: ms });
        });
        out.sort(function (a, b) { return a.ts - b.ts; });  // longest silent first
        return out;
    }

    function timerItems() {
        if (!_timersOk) return [];
        var haveDevs = _devTs > 0;
        var out = [];
        _timers.forEach(function (t) {
            var active = !(t.Active === false || String(t.Active).toLowerCase() === 'false');
            var devId = t.DeviceRowID != null ? String(t.DeviceRowID) : (t.DevID != null ? String(t.DevID) : '');
            var isScene = /scene|group/i.test(String(t.Type || ''));
            var dev = _devices[devId];
            var reason = null;
            if (!active) reason = 'Disabled';
            else if (haveDevs && devId && !isScene && !dev) reason = 'Device unused or missing';
            if (!reason) return;
            out.push({
                key: 't' + keyOf(t.TimerID != null ? t.TimerID : devId + '-' + (t.Time || '')),
                timer: t, dev: dev || null, reason: reason
            });
        });
        return out;
    }

    function visible(items) {
        var map = snoozeMap();
        return items.filter(function (it) { return !isSnoozed(it.key, map); });
    }

    function compute() {
        var on = enabledSections();
        var res = {
            battery: on.indexOf('battery') >= 0 ? visible(batteryItems()) : [],
            stale:   on.indexOf('stale')   >= 0 ? visible(staleItems())   : [],
            timers:  on.indexOf('timers')  >= 0 ? visible(timerItems())   : []
        };
        return res;
    }

    function getCounts() {
        var c = compute();
        var severe = c.stale.length > 0 || c.battery.some(function (it) { return it.level <= 10; });
        var total = c.battery.length + c.stale.length + c.timers.length;
        return {
            battery: c.battery.length, stale: c.stale.length, timers: c.timers.length,
            total: total, severity: total === 0 ? 'none' : (severe ? 'danger' : 'warning')
        };
    }

    function checkNewLowBattery() {
        var now = {};
        var snz = snoozeMap();
        var fresh = [];
        batteryItems().forEach(function (it) {
            now[it.key] = true;
            if (_knownLow && !_knownLow[it.key] && !isSnoozed(it.key, snz)) fresh.push(it);
        });
        _knownLow = now;                                    // first load only sets the baseline
        if (!fresh.length || !getSetting('attentionToast') || typeof window.ngShowToast !== 'function') return;
        var first = fresh[0];
        window.ngShowToast({
            icon:  'fa-battery-quarter',
            color: 'var(--dz-warning)',
            title: 'Low battery',
            body:  esc(first.dev.Name) + ' · ' + first.level + '%' +
                   (fresh.length > 1 ? ' (+' + (fresh.length - 1) + ' more)' : ''),
            onClick: function () { openPanel(); }
        });
    }

    /* ── Live patching ─────────────────────────────────────────── */

    function onDeviceUpdate(d) {
        if (!d) return;
        var idx = String(d.idx != null ? d.idx : (d.ID != null ? d.ID : ''));
        var cur = _devices[idx];
        if (cur) {
            if (d.BatteryLevel !== undefined) cur.BatteryLevel = d.BatteryLevel;
            if (d.LastUpdate   !== undefined) cur.LastUpdate   = d.LastUpdate;
            if (d.Name         !== undefined) cur.Name         = d.Name;
            cur._ngSeen = Date.now();           // any update proves the device is alive
            checkNewLowBattery();
        }
        scheduleRender(RENDER_DEBOUNCE);
    }

    function scheduleRender(ms) {
        clearTimeout(_renderTimer);
        _renderTimer = setTimeout(function () { _renderTimer = null; render(); }, ms);
    }

    /* ── Rendering ─────────────────────────────────────────────── */

    function announce() {
        var c = getCounts();
        try {
            document.dispatchEvent(new CustomEvent('ng-attention-change', { detail: c }));
        } catch (e) {}
        return c;
    }

    function rowHtml(section, it) {
        var key = it.key, d = it.dev, name, meta = '', icon, cls = '';
        if (section === 'battery') {
            name = d.Name;
            icon = it.level <= 10 ? 'fa-battery-empty' : 'fa-battery-quarter';
            meta = it.level + '%';
            cls  = it.level <= 10 ? ' ng-attn-row--danger' : '';
        } else if (section === 'stale') {
            name = d.Name;
            icon = 'fa-plug-circle-xmark';
            meta = ago(Date.now() - it.ts);
            cls  = ' ng-attn-row--danger';
        } else {
            name = (d && d.Name) || it.timer.Name || ('Timer ' + key.slice(1));
            icon = 'fa-clock';
            meta = it.reason;
        }
        var navigable = !!d;
        var snz = _snoozeOpen === key;
        return '<div class="ng-attn-row' + cls + (snz ? ' ng-attn-row--snz' : '') + '" role="listitem" data-key="' + esc(key) + '">' +
                '<button type="button" class="ng-attn-row-main' + (navigable ? '' : ' ng-attn-row-main--static') + '"' +
                    (navigable ? ' data-act="nav" data-idx="' + esc(keyOf(d.idx)) + '"' : ' tabindex="-1"') + '>' +
                    '<i class="fa-solid ' + icon + ' ng-attn-row-icon" aria-hidden="true"></i>' +
                    '<span class="ng-attn-row-name">' + esc(name) + '</span>' +
                    '<span class="ng-attn-row-meta">' + esc(meta) + '</span>' +
                '</button>' +
                '<button type="button" class="ng-attn-snz-btn" data-act="snz-toggle" aria-label="Snooze ' + esc(name) + '" title="Snooze">' +
                    '<i class="fa-solid fa-bell-slash" aria-hidden="true"></i></button>' +
                (snz ?
                '<div class="ng-attn-snz-choices">' +
                    '<button type="button" data-act="snz" data-ms="86400000">24 hours</button>' +
                    '<button type="button" data-act="snz" data-ms="604800000">7 days</button>' +
                    '<button type="button" data-act="snz" data-ms="0">Forever</button>' +
                '</div>' : '') +
            '</div>';
    }

    function sectionHtml(section, items, note) {
        var meta = SECTION_META[section];
        var open = !_collapsed[section];
        var limit = _expanded[section] ? items.length : ROW_LIMIT;
        var body = '';
        if (open) {
            if (note) body += '<div class="ng-attn-note">' + note + '</div>';
            if (!items.length) {
                body += '<div class="ng-attn-none">All clear</div>';
            } else {
                body += '<div class="ng-attn-rows" role="list">';
                for (var i = 0; i < items.length && i < limit; i++) body += rowHtml(section, items[i]);
                body += '</div>';
                if (items.length > limit) {
                    body += '<button type="button" class="ng-attn-more" data-act="more" data-section="' + section + '">' +
                            'Show all ' + items.length + '</button>';
                }
            }
        }
        return '<section class="ng-attn-sec" data-section="' + section + '">' +
            '<button type="button" class="ng-attn-sec-hdr" data-act="collapse" data-section="' + section +
                '" aria-expanded="' + open + '">' +
                '<i class="fa-solid ' + meta.icon + ' ng-attn-sec-icon" aria-hidden="true"></i>' +
                '<span class="ng-attn-sec-title">' + meta.title + '</span>' +
                '<span class="ng-attn-sec-count' + (items.length ? ' ng-attn-sec-count--on' : '') + '">' + items.length + '</span>' +
                '<i class="fa-solid fa-chevron-down ng-attn-chev' + (open ? '' : ' ng-attn-chev--closed') + '" aria-hidden="true"></i>' +
            '</button>' + body + '</section>';
    }

    function eventsHtml() {
        var evs = (window.ngNotifGetEvents ? window.ngNotifGetEvents() : []).slice(-EVENT_LIMIT).reverse();
        var meta = SECTION_META.events;
        var open = !_collapsed.events;
        var body = '';
        if (open) {
            if (!evs.length) {
                body += '<div class="ng-attn-none">No recent events</div>';
            } else {
                body += '<div class="ng-attn-rows" role="list">';
                evs.forEach(function (ev, i) {
                    var nav = !!ev.device;
                    body += '<div class="ng-attn-row" role="listitem">' +
                        '<button type="button" class="ng-attn-row-main' + (nav ? '' : ' ng-attn-row-main--static') + '"' +
                            (nav ? ' data-act="ev-nav" data-ev="' + (evs.length - 1 - i) + '"' : ' tabindex="-1"') + '>' +
                            '<i class="fa-solid ' + esc(ev.icon || 'fa-circle-dot') + ' ng-attn-row-icon" aria-hidden="true"></i>' +
                            '<span class="ng-attn-row-name">' + esc(ev.name) + '</span>' +
                            '<span class="ng-attn-row-meta">' + esc(ev.status) + ' · ' + esc(ev.time) + '</span>' +
                        '</button></div>';
                });
                body += '</div>';
            }
            body += '<button type="button" class="ng-attn-more" data-act="events-full">Open full history</button>';
        }
        return '<section class="ng-attn-sec" data-section="events">' +
            '<button type="button" class="ng-attn-sec-hdr" data-act="collapse" data-section="events" aria-expanded="' + open + '">' +
                '<i class="fa-solid ' + meta.icon + ' ng-attn-sec-icon" aria-hidden="true"></i>' +
                '<span class="ng-attn-sec-title">' + meta.title + '</span>' +
                '<span class="ng-attn-sec-count' + (evs.length ? ' ng-attn-sec-count--on' : '') + '">' + evs.length + '</span>' +
                '<i class="fa-solid fa-chevron-down ng-attn-chev' + (open ? '' : ' ng-attn-chev--closed') + '" aria-hidden="true"></i>' +
            '</button>' + body + '</section>';
    }

    function render() {
        var c = announce();
        if (!_panel || !_open) return;
        var res = compute();
        var on = enabledSections();
        var html = '';

        if (_devError && !_devTs) {
            html += '<div class="ng-attn-note ng-attn-note--err">Could not load devices.</div>';
        }
        if (on.indexOf('battery') >= 0) html += sectionHtml('battery', res.battery);
        if (on.indexOf('stale') >= 0)   html += sectionHtml('stale', res.stale);
        if (on.indexOf('timers') >= 0 && _timersOk) {
            html += sectionHtml('timers', res.timers,
                'Heuristic: Domoticz does not record failed timer runs, so this lists disabled timers ' +
                'and timers whose device is unused or gone.');
        }
        if (on.indexOf('events') >= 0)  html += eventsHtml();

        var snoozed = activeSnoozeCount();
        if (snoozed) {
            html += '<div class="ng-attn-foot">' + snoozed + ' snoozed · ' +
                    '<button type="button" class="ng-attn-link" data-act="unsnooze-all">Clear snoozes</button></div>';
        }

        var body = _panel.querySelector('.ng-attn-body');
        var scroll = body.scrollTop;
        body.innerHTML = html;
        body.scrollTop = scroll;

        var cnt = _panel.querySelector('.ng-attn-count');
        cnt.textContent = String(c.total);
        cnt.setAttribute('aria-label', c.total + (c.total === 1 ? ' item needs attention' : ' items need attention'));
        cnt.className = 'ng-attn-count ng-attn-count--' + c.severity;
    }

    /* ── Panel ─────────────────────────────────────────────────── */

    function buildPanel() {
        if (_panel) return _panel;
        _panel = document.createElement('div');
        _panel.id = 'ng-attn-panel';
        _panel.setAttribute('role', 'dialog');
        _panel.setAttribute('aria-modal', 'true');
        _panel.setAttribute('aria-label', 'Attention Center');
        _panel.innerHTML =
            '<div class="ng-attn-hdr">' +
                '<span class="ng-attn-title"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Attention</span>' +
                '<span class="ng-attn-count ng-attn-count--none" aria-label="0 items need attention">0</span>' +
                '<button type="button" class="ng-attn-hdr-btn" data-act="refresh" aria-label="Refresh" title="Refresh">' +
                    '<i class="fa-solid fa-rotate" aria-hidden="true"></i></button>' +
                '<button type="button" class="ng-attn-hdr-btn ng-attn-x-btn" data-act="close" aria-label="Close panel">' +
                    '<i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
            '</div>' +
            '<div class="ng-attn-body"></div>';
        _panel.addEventListener('click', onPanelClick);
        document.body.appendChild(_panel);
        return _panel;
    }

    function onPanelClick(e) {
        var el = e.target.closest('[data-act]');
        if (!el || !_panel.contains(el)) return;
        var act = el.getAttribute('data-act');
        var row = el.closest('.ng-attn-row');
        var key = row && row.getAttribute('data-key');

        if (act === 'close') { closePanel(); }
        else if (act === 'refresh') { refresh(); }
        else if (act === 'collapse') {
            var s = el.getAttribute('data-section');
            _collapsed[s] = !_collapsed[s];
            render();
        }
        else if (act === 'more') {
            _expanded[el.getAttribute('data-section')] = true;
            render();
        }
        else if (act === 'snz-toggle') {
            _snoozeOpen = (_snoozeOpen === key) ? null : key;
            render();
        }
        else if (act === 'snz') {
            _snoozeOpen = null;
            if (key) snooze(key, parseInt(el.getAttribute('data-ms'), 10));
        }
        else if (act === 'unsnooze-all') { saveSnoozed({}); }
        else if (act === 'nav') {
            var d = _devices[el.getAttribute('data-idx')];
            if (d && typeof window.ngNavigateToDevice === 'function') {
                closePanel();
                window.ngNavigateToDevice(d);
            }
        }
        else if (act === 'ev-nav') {
            var evs = (window.ngNotifGetEvents ? window.ngNotifGetEvents() : []).slice(-EVENT_LIMIT).reverse();
            var ev = evs[evs.length - 1 - parseInt(el.getAttribute('data-ev'), 10)];
            if (ev && ev.device && typeof window.ngNavigateToDevice === 'function') {
                closePanel();
                window.ngNavigateToDevice(ev.device);
            }
        }
        else if (act === 'events-full') {
            closePanel();
            if (window.ngNotifOpen) window.ngNotifOpen();
        }
    }

    function openPanel() {
        /* One drawer at a time */
        if (window.ngNotifClose) window.ngNotifClose();
        buildPanel();
        _lastFocus = document.activeElement;
        _snoozeOpen = null;
        _open = true;
        render();
        _panel.classList.add('ng-attn-panel--open');
        document.addEventListener('keydown', _escHandler);
        var x = _panel.querySelector('.ng-attn-x-btn');
        if (x) { try { x.focus({ preventScroll: true }); } catch (e) {} }
        refreshForOpen();
    }

    function closePanel() {
        if (!_open) return;
        _open = false;
        if (_panel) _panel.classList.remove('ng-attn-panel--open');
        document.removeEventListener('keydown', _escHandler);
        if (_lastFocus && _lastFocus.focus && document.body.contains(_lastFocus)) {
            try { _lastFocus.focus({ preventScroll: true }); } catch (e) {}
        }
        _lastFocus = null;
    }

    function _escHandler(e) { if (e.key === 'Escape') closePanel(); }

    function togglePanel() { _open ? closePanel() : openPanel(); }

    /* ── Wiring ────────────────────────────────────────────────── */

    function attachAngularHooks() {
        if (!window.angular) { setTimeout(attachAngularHooks, 600); return; }
        var bodyEl = angular.element(document.body);
        if (!bodyEl || !bodyEl.injector || !bodyEl.injector()) {
            setTimeout(attachAngularHooks, 400);
            return;
        }
        try {
            bodyEl.injector().get('$rootScope').$on('device_update', function (e, d) { onDeviceUpdate(d); });
        } catch (e) {
            setTimeout(attachAngularHooks, 600);
        }
    }

    function start() {
        if (!getSetting('attentionCenter')) return;   // disabled: no DOM, no requests

        window.ngAttention = { refresh: refresh, open: openPanel, close: closePanel, getCounts: getCounts };

        /* Close on outside click (chip click is handled by the chip itself) */
        document.addEventListener('click', function (e) {
            if (!_open || !_panel) return;
            if (_panel.contains(e.target)) return;
            if (e.target.closest && e.target.closest('#ng-sb-attn')) return;
            closePanel();
        }, true);

        /* Chip in the status bar */
        document.addEventListener('click', function (e) {
            var chip = e.target.closest && e.target.closest('#ng-sb-attn');
            if (chip) togglePanel();
        });

        /* Keyboard shortcut: A — same guard as the N handler in notifications.js,
           plus the dialog gate so it never fires behind a modal. */
        document.addEventListener('keydown', function (e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' ||
                e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key !== 'a' && e.key !== 'A') return;
            if (document.body.classList.contains('ng-dialog-open') ||
                (window.ngDialogOpen && window.ngDialogOpen())) return;
            togglePanel();
        });

        /* Poll only while the tab is visible */
        _pollTimer = setInterval(function () {
            if (document.visibilityState === 'visible') refresh();
        }, POLL_MS);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && (Date.now() - _devTs) > POLL_MS) refresh();
        });

        attachAngularHooks();
        refresh();
    }

    function init() {
        var s = settings();
        if (s && s.whenReady) s.whenReady(start);
        else setTimeout(init, 300);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
