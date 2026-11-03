/* ── Doctor: Domoticz setup health check ─────────────────────────────
   One centred dialog that audits the Domoticz setup and the theme's own
   stored settings.  Runs ON DEMAND only (settings button or command palette);
   never at page load and never on a timer.

   A RUN IS READ-ONLY: it issues GET requests only, writes no theme setting and
   posts nothing.  The last-run summary lives in memory plus localStorage
   ('ng-doctor-last', device-local, never synced).  Writes happen only on an
   explicit click:
     - Ignore / Clear ignores            -> doctorIgnored
     - Remove / Remove all (confirmed)   -> deviceIconOverrides, with Undo
     - Set icon (opens the Icon Studio)  -> the same setused call as the
                                            device page (window.dzSetDeviceIcon)
   Everything else is a plain "Open in Domoticz" link.

   Entry points: Settings panel "Setup health" Run button, command palette
                 row "Run Doctor".  API: window.ngDoctor.{run,open,close}.
   Settings:     doctorIgnored, doctorChecks, doctorStaleDays, doctorNameMax

   Requests per run (4 GETs, cached 60 s):
     getdevices used=true, getdevices used=false, getschedules, getplans.
   A failed call makes the checks that need it report "could not check";
   they are never counted as passing.

   The check functions below are PURE (plain data in, plain data out) so
   they can be unit-tested outside the browser; see module.exports at the end.
──────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var CACHE_MS   = 60 * 1000;
    var ROW_PEEK   = 5;       // rows shown before "show N more"
    var ROW_CAP    = 50;      // hard cap on listed rows per finding
    var BLOB_LIMIT = 16 * 1024;
    var BLOB_WARN  = 0.8;
    var HIDDEN_PLAN = '$Hidden Devices';
    var COLLECTION_KEYS = ['deviceIconOverrides', 'userPresets', 'toastBlacklist',
                           'statusBarLightsDevices', 'attentionSnoozed', 'attentionSections',
                           'doctorIgnored', 'doctorChecks'];
    var LAST_KEY   = 'ng-doctor-last';

    var CATEGORIES = ['Organisation', 'Names', 'Icons', 'Automation', 'Hardware', 'Theme'];
    var CAT_ICON = {
        Organisation: 'fa-layer-group', Names: 'fa-font', Icons: 'fa-icons',
        Automation: 'fa-clock', Hardware: 'fa-microchip', Theme: 'fa-palette'
    };
    var SEV_LABEL = { problem: 'Problem', suggestion: 'Suggestion', info: 'Info' };

    /* ── Pure helpers ──────────────────────────────────────────── */

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

    function parseLastUpdate(str) {
        if (!str) return null;
        var m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
        if (!m) return null;
        var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
        return isNaN(d.getTime()) ? null : d;
    }

    function ago(ms) {
        var m = Math.floor(ms / 60000);
        if (m < 60) return Math.max(m, 1) + 'm ago';
        var h = Math.floor(m / 60);
        if (h < 48) return h + 'h ago';
        return Math.floor(h / 24) + 'd ago';
    }

    function truthy(v) { return v === true || v === 1 || /^(true|1|yes)$/i.test(String(v)); }

    function isSceneOrGroup(d) {
        var t = String(d.Type || '').toLowerCase();
        return t === 'scene' || t === 'group';
    }

    function isVirtualHw(d) {
        return /dummy|virtual/i.test(String(d.HardwareName || '') + ' ' + String(d.HardwareType || ''));
    }

    function isInternalHw(d) {
        return /internal/i.test(String(d.HardwareName || '') + ' ' + String(d.HardwareType || ''));
    }

    function devIdx(d) { return String(d.idx != null ? d.idx : ''); }

    function mk(id, category, severity, title, why, route) {
        return { id: id, category: category, severity: severity, title: title, why: why,
                 route: route, status: 'ok', items: [], count: 0, note: '' };
    }
    function found(r, items, count) {
        r.items = items; r.count = count == null ? items.length : count;
        r.status = r.count > 0 ? 'found' : 'ok';
        return r;
    }
    function unknown(r, reason) { r.status = 'unknown'; r.note = reason || ''; return r; }

    /* ── Checks (pure) ─────────────────────────────────────────── */

    /* 1: used devices that sit in no room.  PlanIDs [0] means none; a device
       only in the "$Hidden Devices" plan is hidden on purpose, not roomless. */
    function planIdsOf(d) {
        var ids = [];
        if (Array.isArray(d.PlanIDs)) ids = d.PlanIDs.slice();
        else if (d.PlanID != null && d.PlanID !== '') ids = String(d.PlanID).split(',');
        return ids.map(function (x) { return String(x).trim(); })
                  .filter(function (x) { return x !== '' && x !== '0'; });
    }

    function checkNoRoom(used, plans) {
        var r = mk('noRoom', 'Organisation', 'suggestion', 'Devices in no room',
            'Devices without a room are harder to find and cannot be filtered by room.', '#/Plans');
        if (!Array.isArray(used) || !Array.isArray(plans)) return unknown(r, 'Devices or rooms could not be loaded');
        var hidden = {};
        plans.forEach(function (p) { if (p && p.Name === HIDDEN_PLAN) hidden[String(p.idx)] = true; });
        var out = [];
        used.forEach(function (d) {
            if (isSceneOrGroup(d) || truthy(d.IsSubDevice) || isInternalHw(d)) return;
            var ids = planIdsOf(d);
            if (ids.length === 0) out.push({ idx: devIdx(d), name: d.Name, meta: d.HardwareName || '' });
            /* ids present but all hidden -> hidden on purpose: not a finding */
        });
        return found(r, out);
    }

    /* 2: duplicate / near-duplicate names */
    function normName(n) {
        var s = String(n == null ? '' : n).toLowerCase();
        try { s = s.replace(/[^\p{L}\p{N}]+/gu, ' '); } catch (e) { s = s.replace(/[^a-z0-9]+/g, ' '); }
        s = s.replace(/\s+/g, ' ').trim();
        s = s.replace(/[\s\d]+$/, '').trim();   // strip trailing digits
        return s;
    }

    function checkDupNames(used) {
        var r = mk('dupNames', 'Names', 'suggestion', 'Duplicate or near-duplicate names',
            'Identical names make devices hard to tell apart in search, events and voice assistants.', '#/Devices');
        if (!Array.isArray(used)) return unknown(r, 'Devices could not be loaded');
        var groups = {};
        used.forEach(function (d) {
            if (isSceneOrGroup(d)) return;
            var k = normName(d.Name);
            if (!k) return;
            (groups[k] = groups[k] || []).push(d);
        });
        var out = [], nGroups = 0;
        Object.keys(groups).forEach(function (k) {
            var g = groups[k];
            if (g.length < 2) return;
            nGroups++;
            g.forEach(function (d) { out.push({ idx: devIdx(d), name: d.Name, meta: 'group "' + k + '" x' + g.length }); });
        });
        r.groups = nGroups;
        return found(r, out);
    }

    /* 3: unused devices (count only) */
    function checkUnused(unused) {
        var r = mk('unused', 'Organisation', 'info', 'Unused devices',
            'Devices that exist but are not enabled for use; harmless, but a long list can be tidied.', '#/Devices');
        if (!Array.isArray(unused)) return unknown(r, 'Unused devices could not be loaded');
        var items = unused.slice(0, ROW_PEEK).map(function (d) { return { name: d.Name, meta: d.HardwareName || '' }; });
        return found(r, items, unused.length);
    }

    /* 4: long / unclear names */
    var DEFAULT_NAME_RES = [
        /^unknown\b/i, /^0x[0-9a-f]+$/i, /^[0-9a-f]{6,}$/i,
        /^[a-z]+[ _]\d{4,}$/i
    ];

    function nameProblem(name, max) {
        var n = String(name == null ? '' : name).trim();
        if (!n) return 'empty';
        if (n.length > max) return 'longer than ' + max;
        if (/^\d+$/.test(n)) return 'only digits';
        for (var i = 0; i < DEFAULT_NAME_RES.length; i++) if (DEFAULT_NAME_RES[i].test(n)) return 'looks like a default name';
        return '';
    }

    function checkBadNames(used, nameMax) {
        var r = mk('badNames', 'Names', 'suggestion', 'Long or unclear names',
            'Very long, numeric or default-looking names are hard to read on cards and in lists.', '#/Devices');
        if (!Array.isArray(used)) return unknown(r, 'Devices could not be loaded');
        var max = nameMax > 0 ? nameMax : 40, out = [];
        used.forEach(function (d) {
            if (isSceneOrGroup(d)) return;
            var why = nameProblem(d.Name, max);
            if (why) out.push({ idx: devIdx(d), name: d.Name, meta: why });
        });
        return found(r, out);
    }

    /* 5: default / missing icon.  Conservative: only switch-like devices, never
       ones with a custom image, a Domoticz Icon, or a theme override.
       Live data: lights carry Image 'Light'; sensors carry an empty Image
       (normal); Icon holds a JSON shape when Domoticz owns the icon. */
    var NON_LIGHT_SWITCH = /motion|contact|smoke|doorbell|dusk|blind|lock|media|siren|door/i;

    function checkDefaultIcon(used, overrides) {
        var r = mk('defaultIcon', 'Icons', 'suggestion', 'Default icons',
            'These switches still use a generic icon that does not match what they are.', '#/Devices');
        if (!Array.isArray(used)) return unknown(r, 'Devices could not be loaded');
        overrides = overrides || {};
        var out = [];
        used.forEach(function (d) {
            if (isSceneOrGroup(d)) return;
            var sw = String(d.SwitchType || '');
            var typ = String(d.Type || '');
            if (!sw || !/light|switch|lighting|security|blinds|curtain/i.test(typ)) return;
            if (Number(d.CustomImage) > 0) return;
            if (d.Icon != null && String(d.Icon).trim() !== '' && String(d.Icon) !== '0') return;
            if (Object.prototype.hasOwnProperty.call(overrides, devIdx(d))) return;
            var img = String(d.Image || '');
            if (img === '' || /^(generic|unknown)$/i.test(img)) {
                out.push({ idx: devIdx(d), name: d.Name, meta: 'generic icon' });
            } else if (/^light$/i.test(img) && NON_LIGHT_SWITCH.test(sw)) {
                out.push({ idx: devIdx(d), name: d.Name, meta: sw + ' shown as a light' });
            }
        });
        return found(r, out);
    }

    /* 6: stale hardware: every device older than N days */
    function checkStaleHardware(used, staleDays, now) {
        var r = mk('staleHw', 'Hardware', 'problem', 'Hardware that stopped reporting',
            'Every device on this hardware is older than the threshold; it may be unplugged or disconnected.', '#/Hardware');
        if (!Array.isArray(used)) return unknown(r, 'Devices could not be loaded');
        var limit = (staleDays > 0 ? staleDays : 30) * 86400000;
        now = now || Date.now();
        var groups = {};
        used.forEach(function (d) {
            if (isSceneOrGroup(d) || isVirtualHw(d) || truthy(d.HardwareDisabled)) return;
            var key = d.HardwareName || (d.HardwareID != null ? 'Hardware ' + d.HardwareID : '');
            if (!key) return;
            var t = parseLastUpdate(d.LastUpdate);
            var g = groups[key] = groups[key] || { name: key, n: 0, newest: 0, parsed: 0 };
            g.n++;
            if (t) { g.parsed++; if (t.getTime() > g.newest) g.newest = t.getTime(); }
        });
        var out = [];
        Object.keys(groups).forEach(function (k) {
            var g = groups[k];
            if (!g.parsed || g.parsed !== g.n) return;       // never guess about missing timestamps
            if (now - g.newest >= limit) out.push({ name: g.name, meta: g.n + (g.n === 1 ? ' device' : ' devices') + ', newest ' + ago(now - g.newest), _ts: g.newest });
        });
        out.sort(function (a, b) { return a._ts - b._ts; });
        return found(r, out);
    }

    /* 7: timers pointing at a device that does not exist (used OR unused) */
    function checkOrphanTimers(used, unused, schedules) {
        var r = mk('orphanTimers', 'Automation', 'problem', 'Timers pointing at missing devices',
            'These timers target a device that no longer exists, so they can never do anything.', '#/Devices');
        if (!Array.isArray(used) || !Array.isArray(unused) || !Array.isArray(schedules))
            return unknown(r, 'Devices or timers could not be loaded');
        var all = {};
        used.concat(unused).forEach(function (d) { if (d && d.idx != null) all[String(d.idx)] = true; });
        var out = [];
        schedules.forEach(function (t) {
            if (/scene|group/i.test(String(t.Type || ''))) return;
            var id = t.DeviceRowID != null ? String(t.DeviceRowID) : '';
            if (!id || all[id]) return;
            out.push({ name: t.DevName || ('Device ' + id), meta: 'timer ' + keyOf(t.TimerID) + ', device ' + keyOf(id) });
        });
        return found(r, out);
    }

    /* 9: favourites that stopped updating */
    function checkStaleFavs(used, staleDays, now) {
        var r = mk('staleFavs', 'Organisation', 'suggestion', 'Stale favourites',
            'Favourites that have not updated for a long time clutter the dashboard.', '#/Dashboard');
        if (!Array.isArray(used)) return unknown(r, 'Devices could not be loaded');
        var limit = (staleDays > 0 ? staleDays : 30) * 86400000;
        now = now || Date.now();
        var out = [];
        used.forEach(function (d) {
            if (isSceneOrGroup(d) || isVirtualHw(d) || Number(d.Favorite) !== 1) return;
            var t = parseLastUpdate(d.LastUpdate);
            if (t && now - t.getTime() >= limit) out.push({ idx: devIdx(d), name: d.Name, meta: ago(now - t.getTime()), _ts: t.getTime() });
        });
        out.sort(function (a, b) { return a._ts - b._ts; });
        return found(r, out);
    }

    /* 10: theme icon overrides for devices that no longer exist.  "Exists"
       means present in the FULL device set (used + unused).  An empty full set
       is treated as a failed read, never as "everything was deleted". */
    function overrideIconOf(o) {
        o = o || {};
        return String(o.icon || o.iconOn || o.iconOff || '').trim();
    }

    function checkOrphanOverrides(overrides, used, unused) {
        var r = mk('orphanOverrides', 'Theme', 'suggestion', 'Icon overrides for deleted devices',
            'The theme stores icons for devices that are gone; it only wastes settings space.', '#/Settings');
        if (!Array.isArray(used) || !Array.isArray(unused) || used.length + unused.length === 0)
            return unknown(r, 'Devices could not be loaded');
        var all = {};
        used.concat(unused).forEach(function (d) { if (d && d.idx != null) all[String(d.idx)] = true; });
        var out = [];
        Object.keys(overrides || {}).forEach(function (k) {
            if (all[k]) return;
            var icon = overrideIconOf(overrides[k]);
            out.push({ idx: k, name: (overrides[k] && overrides[k].name) || ('Device ' + k),
                       meta: 'idx ' + keyOf(k) + ' \u00b7 ' + (icon || 'colours only'),
                       icon: icon, orphan: true });
        });
        return found(r, out);
    }

    /* Remove the given idx keys from an override map.  Pure: returns the new
       map and exactly what was taken out (for the confirm step and Undo).
       Only keys that are really in the map are removed. */
    function removeOverrides(map, idxs) {
        var next = {}, removed = [];
        var want = {};
        (idxs || []).forEach(function (i) { want[String(i)] = true; });
        Object.keys(map || {}).forEach(function (k) {
            if (want[k]) removed.push({ idx: k, icon: overrideIconOf(map[k]), entry: map[k] });
            else next[k] = map[k];
        });
        return { next: next, removed: removed };
    }

    /* 12: settings blob size and shape */
    function checkBlob(blobBytes, rawCollections) {
        var r = mk('blob', 'Theme', 'suggestion', 'Theme settings size and shape',
            'The server rejects theme settings over 16 KB, and unreadable fields are ignored.', '#/Settings');
        var items = [], sev = 'suggestion';
        if (typeof blobBytes === 'number' && blobBytes >= 0) {
            var pct = Math.round(blobBytes / BLOB_LIMIT * 100);
            if (blobBytes >= BLOB_LIMIT) { sev = 'problem'; items.push({ name: 'Settings are ' + pct + '% of the 16 KB limit', meta: blobBytes + ' bytes' }); }
            else if (blobBytes >= BLOB_LIMIT * BLOB_WARN) items.push({ name: 'Settings are ' + pct + '% of the 16 KB limit', meta: blobBytes + ' bytes' });
        } else if (!rawCollections) {
            return unknown(r, 'Settings are not available');
        }
        Object.keys(rawCollections || {}).forEach(function (k) {
            var v = rawCollections[k];
            if (v == null || v === '') return;
            if (typeof v === 'string') {
                try { var p = JSON.parse(v); if (p === null || typeof p !== 'object') throw 0; }
                catch (e) { items.push({ name: 'Field ' + k + ' is not valid JSON', meta: 'unreadable' }); }
            } else if (typeof v !== 'object') {
                items.push({ name: 'Field ' + k + ' has an unexpected type', meta: typeof v });
            }
        });
        r.severity = sev;
        return found(r, items);
    }

    /* 13: disabled hardware that still has used devices (info) */
    function checkDisabledHw(used) {
        var r = mk('disabledHw', 'Hardware', 'info', 'Disabled hardware with devices',
            'Hardware is switched off but its devices are still in use; they will not update.', '#/Hardware');
        if (!Array.isArray(used)) return unknown(r, 'Devices could not be loaded');
        var g = {};
        used.forEach(function (d) {
            if (!truthy(d.HardwareDisabled)) return;
            var k = d.HardwareName || 'Hardware ' + d.HardwareID;
            g[k] = (g[k] || 0) + 1;
        });
        return found(r, Object.keys(g).map(function (k) { return { name: k, meta: g[k] + (g[k] === 1 ? ' device' : ' devices') }; }));
    }

    var CHECK_IDS = ['noRoom', 'dupNames', 'unused', 'badNames', 'defaultIcon', 'staleHw',
                     'orphanTimers', 'staleFavs', 'orphanOverrides', 'blob', 'disabledHw'];

    /* Run one check by id against a plain input bundle.
       input: { used, unused, schedules, plans, overrides, blobBytes,
                rawCollections, staleDays, nameMax, now } (arrays null = failed call) */
    function runCheck(id, i) {
        switch (id) {
            case 'noRoom':          return checkNoRoom(i.used, i.plans);
            case 'dupNames':        return checkDupNames(i.used);
            case 'unused':          return checkUnused(i.unused);
            case 'badNames':        return checkBadNames(i.used, i.nameMax);
            case 'defaultIcon':     return checkDefaultIcon(i.used, i.overrides);
            case 'staleHw':         return checkStaleHardware(i.used, i.staleDays, i.now);
            case 'orphanTimers':    return checkOrphanTimers(i.used, i.unused, i.schedules);
            case 'staleFavs':       return checkStaleFavs(i.used, i.staleDays, i.now);
            case 'orphanOverrides': return checkOrphanOverrides(i.overrides, i.used, i.unused);
            case 'blob':            return checkBlob(i.blobBytes, i.rawCollections);
            case 'disabledHw':      return checkDisabledHw(i.used);
        }
        return null;
    }

    /* Ignore store: check id -> expiry epoch ms (0 = forever). */
    function isIgnored(map, id, now) {
        if (!map || !Object.prototype.hasOwnProperty.call(map, id)) return false;
        var v = +map[id];
        return v === 0 || v > (now || Date.now());
    }

    /* Headline numbers.  Clean = ok or info-only; ignored and unknown excluded. */
    function summarize(results, ignoreMap, now) {
        var total = 0, clean = 0, unk = 0, ign = 0;
        results.forEach(function (r) {
            if (r.status === 'unknown') { unk++; return; }
            if (isIgnored(ignoreMap, r.id, now) && r.status === 'found') { ign++; return; }
            total++;
            if (r.status === 'ok' || r.severity === 'info') clean++;
        });
        return { clean: clean, total: total, unknown: unk, ignored: ign };
    }

    /* ── Browser side ──────────────────────────────────────────── */

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            checkNoRoom: checkNoRoom, checkDupNames: checkDupNames, normName: normName,
            checkUnused: checkUnused, checkBadNames: checkBadNames, checkDefaultIcon: checkDefaultIcon,
            checkStaleHardware: checkStaleHardware, checkOrphanTimers: checkOrphanTimers,
            checkStaleFavs: checkStaleFavs, checkOrphanOverrides: checkOrphanOverrides,
            checkBlob: checkBlob, checkDisabledHw: checkDisabledHw, runCheck: runCheck,
            removeOverrides: removeOverrides, summarize: summarize, isIgnored: isIgnored,
            CHECK_IDS: CHECK_IDS
        };
    }
    if (typeof window === 'undefined') return;


    var _overlay = null, _open = false, _lastFocus = null, _closeTimer = null;
    var _raw = null, _rawTs = 0;           // cached fetch bundle
    var _results = null, _devMap = {}, _limited = false, _running = false, _runSeq = 0;
    var _expanded = {}, _collapsed = {}, _ignoreOpen = null, _confirm = null;
    var _bar = null;                       // { text, warn, undo } status line
    var _undo = null;                      // { prev: map } for the last removal
    var _noAdmin = false;                  // a write answered 401/403
    var _last = null;                      // { t, clean, total }, in memory

    function getSetting(k) { var s = window.dzNightglassSettings; return s ? s.get(k) : undefined; }
    function ignoreMap() { return parseJson(getSetting('doctorIgnored'), {}); }
    function overrideMap() { return parseJson(getSetting('deviceIconOverrides'), {}); }

    /* ── Writes: only ever called from a click handler ─────────── */

    function saveIgnore(id, ms) {
        var map = ignoreMap(), now = Date.now();
        Object.keys(map).forEach(function (k) { if (+map[k] !== 0 && +map[k] <= now) delete map[k]; });
        if (ms === null) delete map[id]; else map[id] = ms === 0 ? 0 : now + ms;
        var s = window.dzNightglassSettings;
        if (s) s.set('doctorIgnored', JSON.stringify(map));
        render();
    }

    function writeOverrides(map) {
        var s = window.dzNightglassSettings;
        if (!s) return false;
        s.set('deviceIconOverrides', JSON.stringify(map));
        if (typeof window._dzSetDeviceIconOverrides === 'function') window._dzSetDeviceIconOverrides(map);
        return true;
    }

    /* ── Reads ─────────────────────────────────────────────────── */

    function enabledIds() {
        var a = parseJson(getSetting('doctorChecks'), []);
        a = Array.isArray(a) ? a.filter(function (x) { return CHECK_IDS.indexOf(x) >= 0; }) : [];
        return a.length ? a : CHECK_IDS;
    }

    /* GET only.  Never pass a method or body here. */
    function getJson(params) {
        return fetch('json.htm?' + params, { credentials: 'same-origin', cache: 'no-store' })
            .then(function (r) {
                if (r.status === 401 || r.status === 403) { _limited = true; throw new Error('auth'); }
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                if (!data || (data.status && data.status !== 'OK')) throw new Error('bad status');
                return Array.isArray(data.result) ? data.result : [];
            })
            .catch(function () { return null; });
    }

    function fetchAll(force) {
        if (!force && _raw && (Date.now() - _rawTs) < CACHE_MS) return Promise.resolve(_raw);
        _limited = false;
        var base = 'type=command&param=';
        return Promise.all([
            getJson(base + 'getdevices&filter=all&used=true&order=Name'),
            getJson(base + 'getdevices&filter=all&used=false&order=Name'),
            getJson(base + 'getschedules'),
            getJson(base + 'getplans&order=name&displayhidden=1')
        ]).then(function (a) {
            _raw = { used: a[0], unused: a[1], schedules: a[2], plans: a[3] };
            _rawTs = Date.now();
            return _raw;
        });
    }

    function buildInput(raw) {
        var s = window.dzNightglassSettings;
        var raws = {};
        COLLECTION_KEYS.forEach(function (k) { raws[k] = getSetting(k); });
        var blobBytes = null;
        if (s && typeof s.blobSize === 'function') { try { blobBytes = s.blobSize(); } catch (e) {} }
        return {
            used: raw.used, unused: raw.unused, schedules: raw.schedules, plans: raw.plans,
            overrides: overrideMap(),
            blobBytes: blobBytes, rawCollections: raws,
            staleDays: parseInt(getSetting('doctorStaleDays'), 10) || 30,
            nameMax: parseInt(getSetting('doctorNameMax'), 10) || 40,
            now: Date.now()
        };
    }

    function failedResult(id) {
        return { id: id, category: 'Theme', severity: 'info', title: id, why: '', status: 'unknown', items: [], count: 0, note: 'Check failed' };
    }

    /* Run the checks one per timer slice so 700+ devices never block the UI. */
    function runChecks(input, done) {
        var ids = enabledIds(), out = [], i = 0;
        (function step() {
            if (i >= ids.length) { done(out); return; }
            var r = null;
            try { r = runCheck(ids[i], input); } catch (e) { r = failedResult(ids[i]); }
            if (r) out.push(r);
            i++;
            setTimeout(step, 0);
        }());
    }

    /* Re-run ONE check against the data already fetched (after a fix). */
    function recheck(id) {
        if (!_raw || !_results) return;
        var r = null;
        try { r = runCheck(id, buildInput(_raw)); } catch (e) { r = failedResult(id); }
        if (!r) return;
        for (var i = 0; i < _results.length; i++) if (_results[i].id === id) { _results[i] = r; break; }
        render();
    }

    function loadLast() {
        if (_last) return _last;
        try { _last = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch (e) { _last = null; }
        return _last;
    }

    function rememberRun(sum) {
        _last = { t: Date.now(), clean: sum.clean, total: sum.total };
        try { localStorage.setItem(LAST_KEY, JSON.stringify(_last)); } catch (e) {}
    }

    /* Read-only: GETs, in-memory state and the device-local localStorage key. */
    function run(force) {
        var seq = ++_runSeq;
        _running = true;
        _bar = null;
        render();
        return fetchAll(!!force).then(function (raw) {
            _devMap = {};
            (raw.used || []).concat(raw.unused || []).forEach(function (d) { if (d && d.idx != null) _devMap[String(d.idx)] = d; });
            return new Promise(function (resolve) {
                runChecks(buildInput(raw), function (res) {
                    if (seq !== _runSeq) { resolve(null); return; }
                    _results = res;
                    _running = false;
                    rememberRun(summarize(res, ignoreMap()));
                    updateLastRunLabel();
                    render();
                    resolve(res);
                });
            });
        });
    }

    /* ── Rendering ─────────────────────────────────────────────── */

    function lastRunText() {
        var v = loadLast();
        if (!v || !v.t) return 'Not run yet';
        return 'Last run ' + ago(Date.now() - v.t) + ': ' + (+v.clean || 0) + ' of ' + (+v.total || 0) + ' checks clean';
    }
    window.ngDoctorLastRunText = lastRunText;

    function updateLastRunLabel() {
        var el = document.getElementById('ngDoctorLastRun');
        if (el) el.textContent = lastRunText();
    }

    function canWrite() { return !_noAdmin; }

    function rowHtml(r, it) {
        var nav = it.idx && _devMap[it.idx];
        var name = nav
            ? '<button type="button" class="ng-doc-row-name ng-doc-row-name--nav" data-act="nav" data-idx="' + esc(keyOf(it.idx)) + '">' + esc(it.name) + '</button>'
            : '<span class="ng-doc-row-name">' + esc(it.name) + '</span>';
        var act = '';
        if (r.id === 'defaultIcon' && nav && canWrite() && typeof window.dzSetDeviceIcon === 'function') {
            act = '<button type="button" class="ng-doc-btn" data-act="seticon" data-idx="' + esc(keyOf(it.idx)) + '">Set icon</button>';
        } else if (r.id === 'orphanOverrides' && it.orphan && canWrite()) {
            act = '<button type="button" class="ng-doc-btn ng-doc-btn--danger" data-act="rm-one" data-idx="' + esc(keyOf(it.idx)) + '">Remove</button>';
        }
        return '<div class="ng-doc-row">' + name +
               '<span class="ng-doc-row-meta">' + esc(it.meta || '') + '</span>' + act + '</div>';
    }

    function confirmHtml(r) {
        if (!_confirm || _confirm.id !== r.id) return '';
        var lines = '', n = _confirm.items.length;
        _confirm.items.slice(0, 8).forEach(function (it) {
            lines += '<li>Device idx ' + esc(keyOf(it.idx)) + ': ' + esc(it.icon || 'colours only') + '</li>';
        });
        if (n > 8) lines += '<li>and ' + (n - 8) + ' more</li>';
        return '<div class="ng-doc-confirm" role="group" aria-label="Confirm removal">' +
            '<div class="ng-doc-confirm-title">This removes the theme icon override for ' + n + (n === 1 ? ' device' : ' devices') + ' that no longer exist:</div>' +
            '<ul>' + lines + '</ul>' +
            '<div class="ng-doc-confirm-btns">' +
                '<button type="button" class="ng-doc-btn ng-doc-btn--danger" data-act="rm-go">Remove ' + n + '</button>' +
                '<button type="button" class="ng-doc-btn" data-act="rm-cancel">Cancel</button>' +
            '</div></div>';
    }

    function findingHtml(r) {
        var listed = Math.min(r.items.length, ROW_CAP);
        var shown = _expanded[r.id] ? listed : Math.min(listed, ROW_PEEK);
        var rows = '';
        for (var i = 0; i < shown; i++) rows += rowHtml(r, r.items[i]);
        var more = '';
        if (!_expanded[r.id] && listed > shown) {
            more = '<button type="button" class="ng-doc-more" data-act="more" data-id="' + esc(r.id) + '">Show ' + (r.count - shown) + ' more</button>';
        } else if (r.count > shown) {
            more = '<div class="ng-doc-note">+' + (r.count - shown) + ' not listed</div>';
        }
        var ign = _ignoreOpen === r.id;
        var removeAll = '';
        if (r.id === 'orphanOverrides' && canWrite() && r.items.length > 0) {
            removeAll = '<button type="button" class="ng-doc-btn ng-doc-btn--danger" data-act="rm-all">Remove all (' + r.items.length + ')</button>';
        }
        return '<div class="ng-doc-find ng-doc-find--' + esc(r.severity) + '" data-id="' + esc(r.id) + '">' +
            '<div class="ng-doc-find-hdr">' +
                '<span class="ng-doc-sev ng-doc-sev--' + esc(r.severity) + '">' + esc(SEV_LABEL[r.severity] || '') + '</span>' +
                '<span class="ng-doc-find-title">' + esc(r.title) + '</span>' +
                '<span class="ng-doc-find-count">' + r.count + '</span>' +
            '</div>' +
            '<div class="ng-doc-why">' + esc(r.why) + '</div>' +
            (rows ? '<div class="ng-doc-rows">' + rows + '</div>' : '') + more +
            confirmHtml(r) +
            '<div class="ng-doc-actions">' +
                '<a class="ng-doc-link" href="' + esc(r.route) + '" data-act="open">Open in Domoticz</a>' +
                removeAll +
                '<button type="button" class="ng-doc-ignore-btn" data-act="ign-toggle" data-id="' + esc(r.id) + '">Ignore</button>' +
            '</div>' +
            (ign ?
            '<div class="ng-doc-ign-choices">' +
                '<button type="button" data-act="ign" data-id="' + esc(r.id) + '" data-ms="86400000">24 hours</button>' +
                '<button type="button" data-act="ign" data-id="' + esc(r.id) + '" data-ms="604800000">7 days</button>' +
                '<button type="button" data-act="ign" data-id="' + esc(r.id) + '" data-ms="0">Forever</button>' +
            '</div>' : '') +
        '</div>';
    }

    function barHtml() {
        if (!_bar) return '';
        return '<div class="ng-doc-bar' + (_bar.warn ? ' ng-doc-bar--warn' : '') + '" role="status">' +
            '<span class="ng-doc-bar-text">' + esc(_bar.text) + '</span>' +
            (_bar.undo ? '<button type="button" class="ng-doc-btn" data-act="undo">Undo</button>' : '') +
            '<button type="button" class="ng-doc-hdr-btn" data-act="bar-x" aria-label="Dismiss"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
        '</div>';
    }

    function bodyHtml(head) {
        if (_running && !_results) { head.text = 'Running…'; return '<div class="ng-doc-note">Checking your setup…</div>'; }
        if (!_results) { head.text = ''; return '<div class="ng-doc-note">Press Run again to check your setup.</div>'; }
        var map = ignoreMap(), now = Date.now(), html = '';
        var sum = summarize(_results, map, now);
        head.text = sum.clean + ' of ' + sum.total + ' checks clean' + (_running ? ' (updating…)' : '');
        if (_limited) html += '<div class="ng-doc-note ng-doc-note--warn">Results limited to your account</div>';
        if (_noAdmin) html += '<div class="ng-doc-note ng-doc-note--warn">Changing icons needs an admin account</div>';
        var ignored = [];
        CATEGORIES.forEach(function (cat) {
            var list = _results.filter(function (r) { return r.category === cat; });
            var body = '', nFind = 0;
            list.forEach(function (r) {
                if (r.status === 'found' && isIgnored(map, r.id, now)) { ignored.push(r); return; }
                if (r.status === 'found') { nFind++; body += findingHtml(r); }
                else if (r.status === 'unknown') body += '<div class="ng-doc-line ng-doc-line--unk"><i class="fa-solid fa-circle-question" aria-hidden="true"></i><span>' + esc(r.title) + ': could not check' + (r.note ? ' (' + esc(r.note) + ')' : '') + '</span></div>';
                else body += '<div class="ng-doc-line ng-doc-line--ok"><i class="fa-solid fa-circle-check" aria-hidden="true"></i><span>' + esc(r.title) + '</span></div>';
            });
            if (!body) return;
            var collapsed = Object.prototype.hasOwnProperty.call(_collapsed, cat) ? _collapsed[cat] : nFind === 0;
            html += '<section class="ng-doc-sec' + (collapsed ? ' ng-doc-sec--collapsed' : '') + '">' +
                '<button type="button" class="ng-doc-sec-hdr" data-act="cat" data-cat="' + cat + '" aria-expanded="' + (collapsed ? 'false' : 'true') + '">' +
                    '<i class="fa-solid ' + CAT_ICON[cat] + '" aria-hidden="true"></i><span class="ng-doc-sec-name">' + cat + '</span>' +
                    '<span class="ng-doc-find-count' + (nFind ? ' ng-doc-find-count--hot' : '') + '">' + (nFind ? nFind : 'clean') + '</span>' +
                    '<i class="fa-solid fa-chevron-down ng-doc-chev" aria-hidden="true"></i></button>' +
                (collapsed ? '' : '<div class="ng-doc-sec-body">' + body + '</div>') +
            '</section>';
        });
        if (ignored.length) {
            html += '<div class="ng-doc-foot">' + ignored.length + ' ignored · <button type="button" class="ng-doc-linkbtn" data-act="unignore-all">Clear ignores</button></div>';
        }
        return html;
    }

    var FOCUS_ATTRS = ['data-act', 'data-id', 'data-idx', 'data-cat', 'data-ms'];

    function render() {
        if (!_overlay || !_open) return;
        var body = _overlay.querySelector('.ng-doc-body');
        var headEl = _overlay.querySelector('.ng-doc-headline');
        var barEl = _overlay.querySelector('.ng-doc-bar-slot');
        var runBtn = _overlay.querySelector('[data-act="rerun"]');
        /* Remember the focused control so a re-render does not drop focus. */
        var ae = document.activeElement, sel = null;
        if (ae && _overlay.contains(ae) && ae.getAttribute) {
            sel = '';
            FOCUS_ATTRS.forEach(function (a) { var v = ae.getAttribute(a); if (v != null) sel += '[' + a + '="' + v + '"]'; });
            if (!sel) sel = null;
        }
        var head = { text: '' };
        var html = bodyHtml(head);
        headEl.textContent = head.text;
        if (runBtn) runBtn.disabled = _running;
        var top = body.scrollTop;
        body.innerHTML = html;
        body.scrollTop = top;
        barEl.innerHTML = barHtml();
        if (sel) {
            var again = null;
            try { again = _overlay.querySelector(sel); } catch (e) {}
            if (!again) again = _overlay.querySelector('.ng-doc-x-btn');
            if (again) { try { again.focus({ preventScroll: true }); } catch (e) {} }
        }
    }

    /* ── Dialog ────────────────────────────────────────────────── */

    function buildDialog() {
        var o = document.createElement('div');
        o.id = 'ng-doc-overlay';
        o.className = 'ng-doc-overlay';
        o.innerHTML =
            '<div class="ng-doc-dialog" role="dialog" aria-modal="true" aria-labelledby="ng-doc-title" tabindex="-1">' +
                '<div class="ng-doc-hdr">' +
                    '<span class="ng-doc-title" id="ng-doc-title"><i class="fa-solid fa-stethoscope" aria-hidden="true"></i> Setup health</span>' +
                    '<span class="ng-doc-headline" aria-live="polite"></span>' +
                    '<button type="button" class="ng-doc-btn ng-doc-rerun" data-act="rerun"><i class="fa-solid fa-rotate" aria-hidden="true"></i> Run again</button>' +
                    '<button type="button" class="ng-doc-hdr-btn ng-doc-x-btn" data-act="close" aria-label="Close"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
                '</div>' +
                '<div class="ng-doc-body"></div>' +
                '<div class="ng-doc-bar-slot"></div>' +
            '</div>';
        o.addEventListener('click', onClick);
        o.addEventListener('keydown', onTrapKey);
        return o;
    }

    function focusables() {
        var dlg = _overlay && _overlay.querySelector('.ng-doc-dialog');
        if (!dlg) return [];
        return Array.prototype.filter.call(
            dlg.querySelectorAll('button:not([disabled]), a[href]'),
            function (el) { return el.offsetParent !== null || el === document.activeElement; });
    }

    function onTrapKey(e) {
        if (e.key !== 'Tab') return;
        var f = focusables();
        if (!f.length) { e.preventDefault(); return; }
        var first = f[0], last = f[f.length - 1], a = document.activeElement;
        if (e.shiftKey && (a === first || !_overlay.contains(a))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (a === last || !_overlay.contains(a))) { e.preventDefault(); first.focus(); }
    }

    function studioOpen() { return !!document.querySelector('.ng-is-overlay'); }

    function onDocKey(e) {
        if (e.key !== 'Escape' || !_open) return;
        if (studioOpen()) return;                // the Icon Studio on top closes first
        e.preventDefault();
        e.stopPropagation();
        closeDialog();
    }

    function onClick(e) {
        if (e.target === _overlay) { closeDialog(); return; }
        var el = e.target.closest ? e.target.closest('[data-act]') : null;
        if (!el || !_overlay.contains(el)) return;
        var act = el.getAttribute('data-act');
        var id = el.getAttribute('data-id');
        var idx = el.getAttribute('data-idx');
        if (act === 'close') closeDialog();
        else if (act === 'rerun') { _confirm = null; run(true); }
        else if (act === 'more') { _expanded[id] = true; render(); }
        else if (act === 'cat') {
            _collapsed[el.getAttribute('data-cat')] = el.getAttribute('aria-expanded') === 'true';
            render();
        }
        else if (act === 'ign-toggle') { _ignoreOpen = (_ignoreOpen === id) ? null : id; render(); }
        else if (act === 'ign') { _ignoreOpen = null; saveIgnore(id, parseInt(el.getAttribute('data-ms'), 10)); }
        else if (act === 'unignore-all') {
            var s = window.dzNightglassSettings;
            if (s) s.set('doctorIgnored', '{}');
            render();
        }
        else if (act === 'open') { closeDialog(); }          // the anchor navigates by hash
        else if (act === 'nav') {
            var d = _devMap[idx];
            if (d && typeof window.ngNavigateToDevice === 'function') { closeDialog(); window.ngNavigateToDevice(d); }
        }
        else if (act === 'seticon') setIcon(idx);
        else if (act === 'rm-one' || act === 'rm-all') askRemove(act === 'rm-all' ? null : idx);
        else if (act === 'rm-cancel') { _confirm = null; render(); }
        else if (act === 'rm-go') doRemove();
        else if (act === 'undo') doUndo();
        else if (act === 'bar-x') { _bar = null; render(); }
    }

    /* ── Mitigations (each behind an explicit click) ───────────── */

    function orphanResult() {
        for (var i = 0; _results && i < _results.length; i++) if (_results[i].id === 'orphanOverrides') return _results[i];
        return null;
    }

    function askRemove(idx) {
        var r = orphanResult();
        if (!r || r.status !== 'found') return;
        var items = r.items.filter(function (it) { return it.orphan && (idx == null || String(it.idx) === String(idx)); });
        if (!items.length) return;
        _confirm = { id: 'orphanOverrides', items: items.map(function (it) { return { idx: it.idx, icon: it.icon }; }) };
        render();
    }

    function doRemove() {
        if (!_confirm) return;
        var idxs = _confirm.items.map(function (it) { return it.idx; });
        _confirm = null;
        /* Re-check at click time: never remove an override whose device has
           appeared since the run. */
        idxs = idxs.filter(function (i) { return !_devMap[String(i)]; });
        var prev = overrideMap();
        var res = removeOverrides(prev, idxs);
        if (!res.removed.length) { render(); return; }
        if (!writeOverrides(res.next)) { _bar = { text: 'Could not save theme settings', warn: true }; render(); return; }
        _undo = { prev: prev };
        var n = res.removed.length;
        _bar = { text: 'Removed ' + n + (n === 1 ? ' icon override' : ' icon overrides'), undo: true };
        recheck('orphanOverrides');
    }

    function doUndo() {
        if (!_undo) return;
        writeOverrides(_undo.prev);
        _undo = null;
        _bar = { text: 'Restored the removed icon overrides' };
        recheck('orphanOverrides');
    }

    function setIcon(idx) {
        var d = _devMap[idx];
        if (!d || typeof window.dzSetDeviceIcon !== 'function') return;
        window.dzSetDeviceIcon(idx, d, function (ok, reason) {
            if (!_open) return;
            if (reason === 'auth') {
                _noAdmin = true;
                _bar = { text: 'Changing icons needs an admin account', warn: true };
                render();
            } else if (ok) {
                _bar = { text: 'Icon saved for ' + (d.Name || 'device') };
                recheck('defaultIcon');
            } else {
                _bar = { text: 'Could not save the icon', warn: true };
                render();
            }
        });
    }

    /* ── Open / close ──────────────────────────────────────────── */

    function openDialog() {
        if (_open) return;
        if (window.ngNotifClose) window.ngNotifClose();
        if (window.ngAttention && window.ngAttention.close) window.ngAttention.close();
        clearTimeout(_closeTimer);
        var stale = document.getElementById('ng-doc-overlay');
        if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
        _lastFocus = document.activeElement;
        _ignoreOpen = null; _confirm = null; _bar = null; _undo = null;
        _overlay = buildDialog();
        document.body.appendChild(_overlay);
        _open = true;
        if (window.ngSetDialogOpen) window.ngSetDialogOpen('doctor', true);
        render();
        requestAnimationFrame(function () { if (_overlay) _overlay.classList.add('ng-doc-overlay--open'); });
        document.addEventListener('keydown', onDocKey, true);
        var x = _overlay.querySelector('.ng-doc-x-btn');
        if (x) { try { x.focus({ preventScroll: true }); } catch (e) {} }
        run(false);
    }

    function closeDialog() {
        if (!_open) return;
        _open = false;
        _runSeq++;
        _running = false;
        _undo = null;
        document.removeEventListener('keydown', onDocKey, true);
        if (window.ngSetDialogOpen) window.ngSetDialogOpen('doctor', false);
        var el = _overlay;
        _overlay = null;
        if (el) {
            el.classList.remove('ng-doc-overlay--open');
            _closeTimer = setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
        }
        if (_lastFocus && _lastFocus.focus && document.body.contains(_lastFocus)) {
            try { _lastFocus.focus({ preventScroll: true }); } catch (e) {}
        }
        _lastFocus = null;
    }

    /* ── Wiring ────────────────────────────────────────────────── */

    window.ngDoctor = { run: run, open: openDialog, close: closeDialog };

    document.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('#ngDoctorRunBtn')) openDialog();
    }, true);

    if (typeof module !== 'undefined' && module.exports) {
        module.exports._browser = { run: run, open: openDialog, close: closeDialog, lastRunText: lastRunText };
    }
}());
