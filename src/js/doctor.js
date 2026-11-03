/* ── Doctor: read-only Domoticz setup health check ───────────────────
   One drawer that audits the Domoticz setup and the theme's own stored
   settings.  Runs ON DEMAND only (settings button or command palette); never
   at page load and never on a timer.  It issues GET requests only and changes
   nothing in Domoticz: findings link to the relevant Domoticz page.

   Entry points: Settings panel "Setup health" Run button, command palette
                 row "Run Doctor".  API: window.ngDoctor.{run,open,close}.
   Settings:     doctor, doctorIgnored, doctorChecks, doctorStaleDays,
                 doctorNameMax, doctorLastRun

   Requests per run (4-5 GETs, cached 60 s):
     getdevices used=true, getdevices used=false, getschedules, getplans,
     getscenes.  A failed call makes the checks that need it report
     "could not check"; they are never counted as passing.

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

    /* 10: theme icon overrides for devices (or scenes) that no longer exist */
    function checkOrphanOverrides(overrides, used, unused, scenes) {
        var r = mk('orphanOverrides', 'Theme', 'suggestion', 'Icon overrides for deleted devices',
            'The theme stores styling for devices that are gone; it only wastes settings space.', '#/Settings');
        if (!Array.isArray(used) || !Array.isArray(unused) || !Array.isArray(scenes))
            return unknown(r, 'Devices or scenes could not be loaded');
        var all = {};
        used.concat(unused, scenes).forEach(function (d) { if (d && d.idx != null) all[String(d.idx)] = true; });
        var out = [];
        Object.keys(overrides || {}).forEach(function (k) {
            if (!all[k]) out.push({ name: (overrides[k] && overrides[k].name) || ('IDX ' + k), meta: 'idx ' + keyOf(k) });
        });
        return found(r, out);
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
       input: { used, unused, schedules, plans, scenes, overrides, blobBytes,
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
            case 'orphanOverrides': return checkOrphanOverrides(i.overrides, i.used, i.unused, i.scenes);
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

    if (typeof window === 'undefined') {
        module.exports = {
            checkNoRoom: checkNoRoom, checkDupNames: checkDupNames, normName: normName,
            checkUnused: checkUnused, checkBadNames: checkBadNames, checkDefaultIcon: checkDefaultIcon,
            checkStaleHardware: checkStaleHardware, checkOrphanTimers: checkOrphanTimers,
            checkStaleFavs: checkStaleFavs, checkOrphanOverrides: checkOrphanOverrides,
            checkBlob: checkBlob, checkDisabledHw: checkDisabledHw, runCheck: runCheck,
            summarize: summarize, isIgnored: isIgnored, CHECK_IDS: CHECK_IDS
        };
        return;
    }

    var _on = false, _wired = false;
    var _panel = null, _open = false, _lastFocus = null;
    var _raw = null, _rawTs = 0;           // cached fetch bundle
    var _results = null, _devMap = {}, _limited = false, _running = false, _runSeq = 0;
    var _expanded = {}, _ignoreOpen = null;

    function getSetting(k) { var s = window.dzNightglassSettings; return s ? s.get(k) : undefined; }

    function ignoreMap() { return parseJson(getSetting('doctorIgnored'), {}); }

    function saveIgnore(id, ms) {
        var map = ignoreMap(), now = Date.now();
        Object.keys(map).forEach(function (k) { if (+map[k] !== 0 && +map[k] <= now) delete map[k]; });
        if (ms === null) delete map[id]; else map[id] = ms === 0 ? 0 : now + ms;
        var s = window.dzNightglassSettings;
        if (s) s.set('doctorIgnored', JSON.stringify(map));
        render();
    }

    function enabledIds() {
        var a = parseJson(getSetting('doctorChecks'), []);
        a = Array.isArray(a) ? a.filter(function (x) { return CHECK_IDS.indexOf(x) >= 0; }) : [];
        return a.length ? a : CHECK_IDS;
    }

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
            getJson(base + 'getplans&order=name&displayhidden=1'),
            getJson(base + 'getscenes')
        ]).then(function (a) {
            _raw = { used: a[0], unused: a[1], schedules: a[2], plans: a[3], scenes: a[4] };
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
            used: raw.used, unused: raw.unused, schedules: raw.schedules,
            plans: raw.plans, scenes: raw.scenes,
            overrides: parseJson(getSetting('deviceIconOverrides'), {}),
            blobBytes: blobBytes, rawCollections: raws,
            staleDays: parseInt(getSetting('doctorStaleDays'), 10) || 30,
            nameMax: parseInt(getSetting('doctorNameMax'), 10) || 40,
            now: Date.now()
        };
    }

    /* Run the checks one per timer slice so 700+ devices never block the UI. */
    function runChecks(input, done) {
        var ids = enabledIds(), out = [], i = 0;
        (function step() {
            if (i >= ids.length) { done(out); return; }
            var r = null;
            try { r = runCheck(ids[i], input); } catch (e) { r = { id: ids[i], category: 'Theme', severity: 'info', title: ids[i], why: '', status: 'unknown', items: [], count: 0, note: 'Check failed' }; }
            if (r) out.push(r);
            i++;
            setTimeout(step, 0);
        }());
    }

    function run(force) {
        if (!_on) return Promise.resolve(null);
        var seq = ++_runSeq;
        _running = true;
        render();
        return fetchAll(!!force).then(function (raw) {
            _devMap = {};
            (raw.used || []).concat(raw.unused || []).forEach(function (d) { if (d && d.idx != null) _devMap[String(d.idx)] = d; });
            return new Promise(function (resolve) {
                runChecks(buildInput(raw), function (res) {
                    if (seq !== _runSeq) { resolve(null); return; }
                    _results = res;
                    _running = false;
                    var sum = summarize(res, ignoreMap());
                    var s = window.dzNightglassSettings;
                    if (s) s.set('doctorLastRun', JSON.stringify({ t: Date.now(), clean: sum.clean, total: sum.total }));
                    updateLastRunLabel();
                    render();
                    resolve(res);
                });
            });
        });
    }

    /* ── Rendering ─────────────────────────────────────────────── */

    function lastRunText() {
        var v = parseJson(getSetting('doctorLastRun'), null);
        if (!v || !v.t) return 'Not run yet';
        return 'Last run ' + ago(Date.now() - v.t) + ': ' + (+v.clean || 0) + ' of ' + (+v.total || 0) + ' checks clean';
    }
    window.ngDoctorLastRunText = lastRunText;

    function updateLastRunLabel() {
        var el = document.getElementById('ngDoctorLastRun');
        if (el) el.textContent = lastRunText();
    }

    function rowHtml(it) {
        var nav = it.idx && _devMap[it.idx];
        var inner = '<span class="ng-doc-row-name">' + esc(it.name) + '</span>' +
                    '<span class="ng-doc-row-meta">' + esc(it.meta || '') + '</span>';
        if (nav) {
            return '<button type="button" class="ng-doc-row ng-doc-row--nav" data-act="nav" data-idx="' + esc(keyOf(it.idx)) + '">' + inner + '</button>';
        }
        return '<div class="ng-doc-row">' + inner + '</div>';
    }

    function findingHtml(r) {
        var shown = _expanded[r.id] ? Math.min(r.items.length, ROW_CAP) : Math.min(r.items.length, ROW_PEEK);
        var rows = '';
        for (var i = 0; i < shown; i++) rows += rowHtml(r.items[i]);
        var more = '';
        var listed = Math.min(r.items.length, ROW_CAP);
        if (!_expanded[r.id] && r.count > shown && listed > shown) {
            more = '<button type="button" class="ng-doc-more" data-act="more" data-id="' + esc(r.id) + '">Show ' + (r.count - shown) + ' more</button>';
        } else if (r.count > shown) {
            more = '<div class="ng-doc-note">+' + (r.count - shown) + ' not listed</div>';
        }
        var ign = _ignoreOpen === r.id;
        return '<div class="ng-doc-find ng-doc-find--' + esc(r.severity) + '" data-id="' + esc(r.id) + '">' +
            '<div class="ng-doc-find-hdr">' +
                '<span class="ng-doc-sev ng-doc-sev--' + esc(r.severity) + '">' + esc(SEV_LABEL[r.severity] || '') + '</span>' +
                '<span class="ng-doc-find-title">' + esc(r.title) + '</span>' +
                '<span class="ng-doc-find-count">' + r.count + '</span>' +
            '</div>' +
            '<div class="ng-doc-why">' + esc(r.why) + '</div>' +
            (rows ? '<div class="ng-doc-rows">' + rows + '</div>' : '') + more +
            '<div class="ng-doc-actions">' +
                '<a class="ng-doc-link" href="' + esc(r.route) + '" data-act="open">Open in Domoticz</a>' +
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

    function render() {
        if (!_panel || !_open) return;
        var body = _panel.querySelector('.ng-doc-body');
        var head = _panel.querySelector('.ng-doc-headline');
        var html = '';
        if (_running && !_results) {
            html = '<div class="ng-doc-note">Checking your setup…</div>';
            head.textContent = 'Running…';
        } else if (!_results) {
            html = '<div class="ng-doc-note">Press Re-run to check your setup.</div>';
            head.textContent = '';
        } else {
            var map = ignoreMap(), now = Date.now();
            var sum = summarize(_results, map, now);
            head.textContent = sum.clean + ' of ' + sum.total + ' checks clean' + (_running ? ' (updating…)' : '');
            if (_limited) html += '<div class="ng-doc-note ng-doc-note--warn">Results limited to your account</div>';
            var ignored = [];
            CATEGORIES.forEach(function (cat) {
                var list = _results.filter(function (r) { return r.category === cat; });
                var secHtml = '';
                list.forEach(function (r) {
                    if (r.status === 'found' && isIgnored(map, r.id, now)) { ignored.push(r); return; }
                    if (r.status === 'found') secHtml += findingHtml(r);
                    else if (r.status === 'unknown') secHtml += '<div class="ng-doc-line ng-doc-line--unk"><i class="fa-solid fa-circle-question" aria-hidden="true"></i><span>' + esc(r.title) + ': could not check' + (r.note ? ' (' + esc(r.note) + ')' : '') + '</span></div>';
                    else secHtml += '<div class="ng-doc-line ng-doc-line--ok"><i class="fa-solid fa-circle-check" aria-hidden="true"></i><span>' + esc(r.title) + '</span></div>';
                });
                if (!secHtml) return;
                html += '<section class="ng-doc-sec"><div class="ng-doc-sec-hdr"><i class="fa-solid ' + CAT_ICON[cat] + '" aria-hidden="true"></i><span>' + cat + '</span></div>' + secHtml + '</section>';
            });
            if (ignored.length) {
                html += '<div class="ng-doc-foot">' + ignored.length + ' ignored · <button type="button" class="ng-doc-linkbtn" data-act="unignore-all">Clear ignores</button></div>';
            }
        }
        var top = body.scrollTop;
        body.innerHTML = html;
        body.scrollTop = top;
    }

    /* ── Panel ─────────────────────────────────────────────────── */

    function buildPanel() {
        if (_panel) return _panel;
        _panel = document.createElement('div');
        _panel.id = 'ng-doc-panel';
        _panel.setAttribute('role', 'dialog');
        _panel.setAttribute('aria-modal', 'true');
        _panel.setAttribute('aria-label', 'Setup health');
        _panel.innerHTML =
            '<div class="ng-doc-hdr">' +
                '<span class="ng-doc-title"><i class="fa-solid fa-stethoscope" aria-hidden="true"></i> Setup health</span>' +
                '<span class="ng-doc-headline" aria-live="polite"></span>' +
                '<button type="button" class="ng-doc-hdr-btn" data-act="rerun" aria-label="Re-run" title="Re-run">' +
                    '<i class="fa-solid fa-rotate" aria-hidden="true"></i></button>' +
                '<button type="button" class="ng-doc-hdr-btn ng-doc-x-btn" data-act="close" aria-label="Close panel">' +
                    '<i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
            '</div>' +
            '<div class="ng-doc-body"></div>';
        _panel.addEventListener('click', onPanelClick);
        document.body.appendChild(_panel);
        return _panel;
    }

    function onPanelClick(e) {
        var el = e.target.closest('[data-act]');
        if (!el || !_panel.contains(el)) return;
        var act = el.getAttribute('data-act');
        var id = el.getAttribute('data-id');
        if (act === 'close') closePanel();
        else if (act === 'rerun') run(true);
        else if (act === 'more') { _expanded[id] = true; render(); }
        else if (act === 'ign-toggle') { _ignoreOpen = (_ignoreOpen === id) ? null : id; render(); }
        else if (act === 'ign') { _ignoreOpen = null; saveIgnore(id, parseInt(el.getAttribute('data-ms'), 10)); }
        else if (act === 'unignore-all') {
            var s = window.dzNightglassSettings;
            if (s) s.set('doctorIgnored', '{}');
            render();
        }
        else if (act === 'open') { closePanel(); }          // anchor navigates by hash
        else if (act === 'nav') {
            var d = _devMap[el.getAttribute('data-idx')];
            if (d && typeof window.ngNavigateToDevice === 'function') { closePanel(); window.ngNavigateToDevice(d); }
        }
    }

    function openPanel() {
        if (!_on) return;
        if (window.ngNotifClose) window.ngNotifClose();
        if (window.ngAttention && window.ngAttention.close) window.ngAttention.close();
        buildPanel();
        _lastFocus = document.activeElement;
        _ignoreOpen = null;
        _open = true;
        render();
        _panel.classList.add('ng-doc-panel--open');
        document.addEventListener('keydown', _escHandler);
        var x = _panel.querySelector('.ng-doc-x-btn');
        if (x) { try { x.focus({ preventScroll: true }); } catch (e) {} }
        run(false);
    }

    function closePanel() {
        if (!_open) return;
        _open = false;
        if (_panel) _panel.classList.remove('ng-doc-panel--open');
        document.removeEventListener('keydown', _escHandler);
        if (_lastFocus && _lastFocus.focus && document.body.contains(_lastFocus)) {
            try { _lastFocus.focus({ preventScroll: true }); } catch (e) {}
        }
        _lastFocus = null;
    }

    function _escHandler(e) { if (e.key === 'Escape') closePanel(); }

    /* ── Wiring ────────────────────────────────────────────────── */

    function wire() {
        if (_wired) return;
        _wired = true;
        document.addEventListener('click', function (e) {
            if (!_on || !e.target.closest) return;
            if (e.target.closest('#ngDoctorRunBtn')) { openPanel(); return; }
            if (_open && _panel && !_panel.contains(e.target) && !e.target.closest('.dz-cmd-item')) closePanel();
        }, true);
    }

    function setRunBtn() {
        var b = document.getElementById('ngDoctorRunBtn');
        if (b) b.disabled = !_on;
    }

    function enable() {
        if (_on) return;
        _on = true;
        window.ngDoctor = { run: run, open: openPanel, close: closePanel };
        wire();
        setRunBtn();
    }

    function disable() {
        if (!_on) return;
        closePanel();
        _on = false;
        _runSeq++;
        _running = false;
        if (_panel && _panel.parentNode) _panel.parentNode.removeChild(_panel);
        _panel = null;
        delete window.ngDoctor;
        setRunBtn();
    }

    function apply() { if (getSetting('doctor')) enable(); else disable(); }
    window.ngDoctorApply = apply;

    function init() {
        var s = window.dzNightglassSettings;
        if (s && s.whenReady) s.whenReady(apply);
        else setTimeout(init, 300);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
