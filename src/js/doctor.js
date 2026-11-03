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
     - Rename (popup, then Apply)        -> renamedevice, with Undo (renames back)
     - Create group (popup, then Create) -> addscene + addscenedevice per light;
                                            Undo = deletescene, only for a group
                                            made in this dialog session
     - Assign room (confirmed)           -> addplanactivedevice; Undo =
                                            getplandevices + deleteplandevice
   Domoticz writes go through window.ngApiMutate (POST, like every other
   mutation in the theme); all of them are admin-only on the server.
   Everything else is a plain "Open in Domoticz" link.

   Entry points: Settings panel "Setup health" Run button, command palette
                 row "Run Doctor".  API: window.ngDoctor.{run,open,close}.
   Settings:     doctorIgnored, doctorChecks, doctorStaleDays, doctorNameMax

   Requests per run (GETs only, cached 60 s):
     getdevices used=true, getdevices used=false, getschedules, getplans,
     getscenes, and getscenedevices once per Domoticz Group (capped).
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

    /* Room suggestion: a plan whose name appears in the device name as whole
       words (case-insensitive).  Longest plan name wins; a tie is no
       suggestion.  Returns the plan idx as a string, or ''. */
    function wordsOf(n) {
        var s = String(n == null ? '' : n).toLowerCase();
        try { s = s.replace(/[^\p{L}\p{N}]+/gu, ' '); } catch (e) { s = s.replace(/[^a-z0-9]+/g, ' '); }
        return s.replace(/\s+/g, ' ').trim();
    }

    function suggestRoom(name, plans) {
        var hay = ' ' + wordsOf(name) + ' ', best = '', bestLen = 0, tie = false;
        (plans || []).forEach(function (p) {
            if (!p || p.Name === HIDDEN_PLAN) return;
            var w = wordsOf(p.Name);
            if (w.length < 3 || hay.indexOf(' ' + w + ' ') < 0) return;
            if (w.length > bestLen) { best = String(p.idx); bestLen = w.length; tie = false; }
            else if (w.length === bestLen && String(p.idx) !== best) tie = true;
        });
        return tie ? '' : best;
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
            if (ids.length === 0) out.push({ idx: devIdx(d), name: d.Name, meta: d.HardwareName || '', room: suggestRoom(d.Name, plans) });
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
            g.forEach(function (d) { out.push({ idx: devIdx(d), name: d.Name, meta: 'group "' + k + '" x' + g.length, dupKey: k }); });
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
            if (why) out.push({ idx: devIdx(d), name: d.Name, meta: why, renamable: true });
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

    /* ── Renaming (pure) ───────────────────────────────────────── */

    var NAME_HARD_MAX = 100;

    /* Domoticz strips markup from names itself; refuse < and > up front so what
       is stored is what was typed. */
    function validateName(value, max) {
        var n = String(value == null ? '' : value).trim();
        max = max > 0 ? max : NAME_HARD_MAX;
        if (!n) return { ok: false, name: n, error: 'Name cannot be empty' };
        if (n.length > max) return { ok: false, name: n, error: 'Name is longer than ' + max + ' characters' };
        if (/[<>]/.test(n)) return { ok: false, name: n, error: 'Name cannot contain < or >' };
        return { ok: true, name: n, error: '' };
    }

    /* rows: [{ idx, from, value }].  One error string per row ('' = fine). */
    function validateRows(rows) {
        var seen = {};
        rows.forEach(function (r) { var k = String(r.value || '').trim().toLowerCase(); if (k) seen[k] = (seen[k] || 0) + 1; });
        return rows.map(function (r) {
            var v = validateName(r.value);
            if (!v.ok) return v.error;
            if (seen[v.name.toLowerCase()] > 1) return 'Same name as another row';
            return '';
        });
    }

    /* 'Name 1', 'Name 2', ... for a duplicate set.  taken: names (any case) of
       OTHER devices that the new names must not collide with. */
    function suggestNumbering(devs, taken) {
        var used = {};
        (taken || []).forEach(function (n) { used[String(n).trim().toLowerCase()] = true; });
        if (!devs.length) return [];
        var base = parseFamilyName(devs[0].name).base || String(devs[0].name).trim();
        var n = 0;
        return devs.map(function (d) {
            var cand;
            do { n++; cand = base + ' ' + n; } while (used[cand.toLowerCase()]);
            return { idx: String(d.idx), from: d.name, to: cand };
        });
    }

    /* ── Naming families + groups (pure) ───────────────────────── */

    /* Same light rules as the status bar (statusbar.js isLightDevice), copied
       because that module does not export them. */
    var LIGHT_TYPES = ['Light/Switch', 'Lighting 1', 'Lighting 2', 'Lighting 5',
                       'Lighting 6', 'Color Switch', 'Home Confort'];
    var LIGHT_SWITCHTYPES = ['On/Off', 'Dimmer'];
    var SIDE_RE = /^(links|rechts|left|right|boven|onder|top|bottom|voor|achter|front|back)$/i;

    function isLight(d) {
        return LIGHT_TYPES.indexOf(d.Type) !== -1 && LIGHT_SWITCHTYPES.indexOf(d.SwitchType) !== -1;
    }

    function letterCount(s) { return String(s).replace(/[^A-Za-zÀ-ɏ]/g, '').length; }

    /* -> { base, kind: 'num' | 'letter' | 'side' | 'bare', num }
       Only 1-2 digit numbers count ('Kamer 101' is a name, not number 101). */
    function parseFamilyName(name) {
        var s = String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
        var m = s.match(/^(.*?[^\s\d_-])[\s_-]*(\d{1,2})$/);
        if (m) return { base: m[1], kind: 'num', num: parseInt(m[2], 10) };
        m = s.match(/^(.*\S) ([A-Za-z])$/);
        if (m && m[1].indexOf(' ') >= 0) return { base: m[1], kind: 'letter', num: null };
        m = s.match(/^(.*\S) (\S+)$/);
        if (m && SIDE_RE.test(m[2])) return { base: m[1], kind: 'side', num: null };
        return { base: s, kind: 'bare', num: null };
    }

    /* Detect families among light switches.  A family is >= 2 members that
       share a base AND the same kind of suffix (numbers, letters, or sides).
       A bare name joins a numbered family only ('Lamp', 'Lamp 2', 'Lamp3').
       Returns [{ base, kind, members: [{idx, name, num, kind}] }]. */
    function detectFamilies(used) {
        var byKey = {};
        (used || []).forEach(function (d) {
            if (isSceneOrGroup(d) || !isLight(d)) return;
            var p = parseFamilyName(d.Name);
            if (letterCount(p.base) < 3) return;
            var k = p.base.toLowerCase();
            (byKey[k] = byKey[k] || []).push({ idx: devIdx(d), name: String(d.Name).trim(), base: p.base, kind: p.kind, num: p.num });
        });
        var out = [];
        Object.keys(byKey).sort().forEach(function (k) {
            var all = byKey[k], kind = '';
            ['num', 'side', 'letter'].some(function (c) {
                var n = all.filter(function (m) { return m.kind === c; }).length;
                if (n >= 2) { kind = c; return true; }
                return false;
            });
            if (!kind) return;
            var members = all.filter(function (m) { return m.kind === kind || (kind === 'num' && m.kind === 'bare'); });
            members.sort(function (a, b) { return Number(a.idx) - Number(b.idx); });
            out.push({ base: members[0].base, kind: kind, members: members });
        });
        return out;
    }

    /* Normalise a numbered family to 'Base 1', 'Base 2', ...  Existing numbers
       are kept when they are unique; bare names take the lowest free number;
       duplicate numbers fall back to a plain 1..N.  Returns only the changes
       [{ idx, from, to }].  outside: names of devices NOT in the family; a
       collision with one of them means no suggestion at all. */
    function numberingPlan(family, outside) {
        if (family.kind !== 'num') return [];
        var ms = family.members, base = family.base, nums = {}, dupes = false;
        ms.forEach(function (m) { if (m.num != null) { if (nums[m.num]) dupes = true; nums[m.num] = true; } });
        var target = {};
        if (dupes) {
            ms.slice().sort(function (a, b) { return (a.num || 0) - (b.num || 0) || Number(a.idx) - Number(b.idx); })
              .forEach(function (m, i) { target[m.idx] = i + 1; });
        } else {
            var n = 0;
            ms.forEach(function (m) {
                if (m.num != null) { target[m.idx] = m.num; return; }
                do { n++; } while (nums[n]);
                nums[n] = true; target[m.idx] = n;
            });
        }
        var taken = {};
        (outside || []).forEach(function (x) { taken[String(x).trim().toLowerCase()] = true; });
        var out = [];
        for (var i = 0; i < ms.length; i++) {
            var to = base + ' ' + target[ms[i].idx];
            if (taken[to.toLowerCase()]) return [];
            if (to !== ms[i].name) out.push({ idx: ms[i].idx, from: ms[i].name, to: to });
        }
        return out;
    }

    /* Join getscenes with per-group getscenedevices answers.  null when either
       is missing: coverage is then unknown, never "not covered".
       scenes: getscenes result[]; members: { sceneIdx: [deviceIdx...] }. */
    function buildGroups(scenes, members) {
        if (!Array.isArray(scenes) || !members) return null;
        var out = [];
        for (var i = 0; i < scenes.length; i++) {
            var sc = scenes[i];
            if (!sc || String(sc.Type).toLowerCase() !== 'group') continue;
            var m = members[String(sc.idx)];
            if (!Array.isArray(m)) return null;
            out.push({ idx: String(sc.idx), name: sc.Name, members: m.map(String) });
        }
        return out;
    }

    /* How well do existing groups cover these devices?
       full: one group holds them all.  partial: a group holds >= 2 of them
       (reports the ones missing from the best group).  none: otherwise. */
    function groupCoverage(idxs, groups) {
        idxs = idxs.map(String);
        var best = null, bestN = 0;
        (groups || []).forEach(function (g) {
            var set = {};
            g.members.forEach(function (x) { set[x] = true; });
            var n = idxs.filter(function (x) { return set[x]; }).length;
            if (n > bestN) { best = g; bestN = n; }
        });
        if (best && bestN === idxs.length) return { state: 'full', group: best, missing: [] };
        if (best && bestN >= 2) {
            var have = {};
            best.members.forEach(function (x) { have[x] = true; });
            return { state: 'partial', group: best, missing: idxs.filter(function (x) { return !have[x]; }) };
        }
        return { state: 'none', group: null, missing: idxs.slice() };
    }

    function checkFamilies(used, groups) {
        var r = mk('families', 'Names', 'suggestion', 'Light families: numbering and groups',
            'Lights that belong together should be named consistently and sit in a Domoticz group.', '#/Scenes');
        if (!Array.isArray(used)) return unknown(r, 'Devices could not be loaded');
        var all = used.filter(function (d) { return !isSceneOrGroup(d); });
        var out = [];
        detectFamilies(used).forEach(function (f) {
            var inFam = {};
            f.members.forEach(function (m) { inFam[m.idx] = true; });
            var outside = all.filter(function (d) { return !inFam[devIdx(d)]; }).map(function (d) { return d.Name; });
            var plan = numberingPlan(f, outside);
            var cov = groups ? groupCoverage(f.members.map(function (m) { return m.idx; }), groups) : null;
            var wantGroup = !!cov && cov.state !== 'full';
            if (!plan.length && !wantGroup) return;
            var bits = [f.members.length + ' lights'];
            if (plan.length) bits.push('numbering inconsistent');
            if (cov && cov.state === 'none') bits.push('not in a group');
            if (cov && cov.state === 'partial') {
                var nm = {};
                f.members.forEach(function (m) { nm[m.idx] = m.name; });
                bits.push('in "' + cov.group.name + '" but missing ' + cov.missing.map(function (x) { return nm[x]; }).join(', '));
            }
            out.push({ name: f.base, meta: bits.join(' · '),
                       family: { base: f.base, members: f.members, numbering: plan,
                                 coverage: cov, canGroup: wantGroup } });
        });
        if (!groups && !out.length) return unknown(r, 'Groups could not be loaded');
        return found(r, out);
    }

    var CHECK_IDS = ['noRoom', 'dupNames', 'unused', 'badNames', 'defaultIcon', 'staleHw',
                     'orphanTimers', 'staleFavs', 'orphanOverrides', 'blob', 'disabledHw', 'families'];

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
            case 'families':        return checkFamilies(i.used, i.groups);
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
            suggestRoom: suggestRoom, validateName: validateName, validateRows: validateRows,
            suggestNumbering: suggestNumbering, parseFamilyName: parseFamilyName,
            detectFamilies: detectFamilies, numberingPlan: numberingPlan, buildGroups: buildGroups,
            groupCoverage: groupCoverage, checkFamilies: checkFamilies,
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
    var _sub = null;                       // mini dialog above the Doctor: rename or create group
    var _subReturn = null;                 // focus selector to restore when it closes
    var _room = { sel: {}, checked: {}, bulk: '' };   // room picker state
    var _rowFail = {};                     // 'checkId:idx' -> true after a failed write
    var _createdGroups = {};               // scene idx -> true, groups made in THIS session
    var MAX_GROUPS = 60;                   // getscenedevices calls per run, at most

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

    /* Domoticz command through the theme's POST helper.  Resolves
       { ok, reason: 'auth'|'error', message }; never rejects.  Admin-only
       commands answer a non-admin with 401/403 (no_identity). */
    function mutate(params) {
        var f = window.ngApiMutate;
        if (typeof f !== 'function') return Promise.resolve({ ok: false, reason: 'error', message: 'Write helper not available' });
        var p = { type: 'command' };
        Object.keys(params).forEach(function (k) { p[k] = params[k]; });
        return Promise.resolve().then(function () { return f(p); }).then(function (d) {
            if (d && d.status === 'OK') return { ok: true, data: d };
            var auth = !!d && (d.error === 'no_identity' || d.httpStatus === 401 || d.httpStatus === 403 ||
                               /rights|admin|identity|permission|forbidden/i.test(String(d.message || d.error || '')));
            return { ok: false, reason: auth ? 'auth' : 'error', message: d && d.message ? String(d.message) : '' };
        }, function () { return { ok: false, reason: 'error', message: '' }; });
    }

    /* Run step(item) for each item in order.  Stops after the first result for
       which stopOn(result) is true.  Resolves [{ item, res }] for those run. */
    function seq(items, step, stopOn) {
        var out = [], stop = false;
        return items.reduce(function (p, it) {
            return p.then(function () {
                if (stop) return null;
                return step(it).then(function (res) {
                    out.push({ item: it, res: res });
                    if (!res.ok && stopOn && stopOn(res)) stop = true;
                });
            });
        }, Promise.resolve()).then(function () { return out; });
    }

    function noteAuth(results) {
        var denied = results.some(function (r) { return !r.res.ok && r.res.reason === 'auth'; });
        if (denied) _noAdmin = true;
        return denied;
    }
    function isAuth(res) { return res.reason === 'auth'; }

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

    /* getscenes, then the members of each Group (GET).  members is null when any
       of it failed or there are too many groups: coverage is then "unknown". */
    function loadGroups() {
        var base = 'type=command&param=';
        return getJson(base + 'getscenes&displayhidden=1').then(function (sc) {
            if (!sc) return { scenes: null, members: null };
            var gs = sc.filter(function (x) { return x && String(x.Type).toLowerCase() === 'group'; });
            if (gs.length > MAX_GROUPS) return { scenes: sc, members: null };
            var members = {};
            return Promise.all(gs.map(function (g) {
                return getJson(base + 'getscenedevices&idx=' + encodeURIComponent(g.idx) + '&isscene=false').then(function (r) {
                    members[String(g.idx)] = r === null ? null :
                        r.map(function (x) { return String(x.DevRealIdx != null ? x.DevRealIdx : x.DevID); });
                });
            })).then(function () {
                var ok = gs.every(function (g) { return Array.isArray(members[String(g.idx)]); });
                return { scenes: sc, members: ok ? members : null };
            });
        });
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
            loadGroups()
        ]).then(function (a) {
            _raw = { used: a[0], unused: a[1], schedules: a[2], plans: a[3],
                     scenes: a[4].scenes, groupMembers: a[4].members };
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
            groups: buildGroups(raw.scenes, raw.groupMembers),
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
    function recheck(ids) {
        if (!_raw || !_results) return;
        [].concat(ids).forEach(function (id) {
            var r = null;
            try { r = runCheck(id, buildInput(_raw)); } catch (e) { r = failedResult(id); }
            if (!r) return;
            for (var i = 0; i < _results.length; i++) if (_results[i].id === id) { _results[i] = r; break; }
        });
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
        _rowFail = {};
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

    function canWrite() { return !_noAdmin && typeof window.ngApiMutate === 'function'; }

    function planOptions(selected) {
        var h = '<option value="">Room\u2026</option>';
        ((_raw && _raw.plans) || []).forEach(function (p) {
            if (!p || p.Name === HIDDEN_PLAN) return;
            h += '<option value="' + esc(keyOf(p.idx)) + '"' + (String(p.idx) === String(selected) ? ' selected' : '') + '>' + esc(p.Name) + '</option>';
        });
        return h;
    }

    function planName(idx) {
        var plans = (_raw && _raw.plans) || [];
        for (var i = 0; i < plans.length; i++) if (String(plans[i].idx) === String(idx)) return plans[i].Name;
        return 'room ' + idx;
    }

    function roomOf(it) { return _room.sel[it.idx] !== undefined ? _room.sel[it.idx] : (it.room || ''); }

    function btnHtml(label, act, attrs, cls) {
        var a = '';
        Object.keys(attrs || {}).forEach(function (k) { a += ' data-' + k + '="' + esc(keyOf(attrs[k])) + '"'; });
        return '<button type="button" class="ng-doc-btn' + (cls ? ' ' + cls : '') + '" data-act="' + act + '"' + a + '>' + esc(label) + '</button>';
    }

    function rowHtml(r, it, n) {
        var nav = it.idx && _devMap[it.idx];
        var pre = '', post = '';
        if (r.id === 'noRoom' && nav && canWrite()) {
            pre = '<input type="checkbox" class="ng-doc-chk" data-act="room-chk" data-idx="' + esc(keyOf(it.idx)) + '"' +
                  (_room.checked[it.idx] ? ' checked' : '') + ' aria-label="Select ' + esc(it.name) + '">';
            post = '<select class="ng-doc-select" data-act="room-pick" data-idx="' + esc(keyOf(it.idx)) + '" aria-label="Room for ' + esc(it.name) + '">' +
                   planOptions(roomOf(it)) + '</select>' +
                   btnHtml('Assign', 'room-one', { idx: it.idx });
        }
        if (nav && canWrite() && (r.id === 'dupNames' || (r.id === 'badNames' && it.renamable))) {
            post += btnHtml('Rename', 'rename', { id: r.id, idx: it.idx });
        }
        if (it.family && canWrite()) {
            if (it.family.numbering.length) post += btnHtml('Fix numbering', 'fam-num', { n: n });
            if (it.family.canGroup) post += btnHtml('Create group', 'fam-group', { n: n });
        }
        if (_rowFail[r.id + ':' + it.idx]) post += '<span class="ng-doc-rowstate ng-doc-rowstate--bad" role="status">Failed</span>';
        var name = nav
            ? '<button type="button" class="ng-doc-row-name ng-doc-row-name--nav" data-act="nav" data-idx="' + esc(keyOf(it.idx)) + '">' + esc(it.name) + '</button>'
            : '<span class="ng-doc-row-name">' + esc(it.name) + '</span>';
        var act = '';
        if (r.id === 'defaultIcon' && nav && canWrite() && typeof window.dzSetDeviceIcon === 'function') {
            act = '<button type="button" class="ng-doc-btn" data-act="seticon" data-idx="' + esc(keyOf(it.idx)) + '">Set icon</button>';
        } else if (r.id === 'orphanOverrides' && it.orphan && canWrite()) {
            act = '<button type="button" class="ng-doc-btn ng-doc-btn--danger" data-act="rm-one" data-idx="' + esc(keyOf(it.idx)) + '">Remove</button>';
        }
        return '<div class="ng-doc-row">' + pre + name +
               '<span class="ng-doc-row-meta">' + esc(it.meta || '') + '</span>' + post + act + '</div>';
    }

    function roomConfirmHtml() {
        var n = _confirm.pairs.length, lines = '';
        _confirm.pairs.slice(0, 12).forEach(function (p) {
            lines += '<li>' + esc(p.name) + ' \u2192 ' + esc(p.planName) + '</li>';
        });
        if (n > 12) lines += '<li>and ' + (n - 12) + ' more</li>';
        return '<div class="ng-doc-confirm ng-doc-confirm--neutral" role="group" aria-label="Confirm rooms">' +
            '<div class="ng-doc-confirm-title">Put ' + n + (n === 1 ? ' device' : ' devices') + ' in a room:</div>' +
            '<ul>' + lines + '</ul>' +
            '<div class="ng-doc-confirm-btns">' +
                btnHtml('Assign ' + n, 'room-go', {}) +
                btnHtml('Cancel', 'rm-cancel', {}) +
            '</div></div>';
    }

    function confirmHtml(r) {
        if (!_confirm || _confirm.id !== r.id) return '';
        if (_confirm.kind === 'rooms') return roomConfirmHtml();
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
        for (var i = 0; i < shown; i++) rows += rowHtml(r, r.items[i], i);
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
        var bulk = '';
        if (r.id === 'noRoom' && canWrite() && r.items.length > 0) {
            var nSug = r.items.filter(function (it) { return it.room && _devMap[it.idx]; }).length;
            bulk = '<div class="ng-doc-bulk">' +
                '<select class="ng-doc-select" data-act="room-bulk" aria-label="Room for the selected devices">' + planOptions(_room.bulk) + '</select>' +
                btnHtml('Assign selected', 'room-sel', {}) +
                (nSug ? btnHtml('Assign suggested (' + nSug + ')', 'room-sug', {}) : '') +
                '<span class="ng-doc-note-inline">New rooms are created in Domoticz.</span></div>';
        }
        return '<div class="ng-doc-find ng-doc-find--' + esc(r.severity) + '" data-id="' + esc(r.id) + '">' +
            '<div class="ng-doc-find-hdr">' +
                '<span class="ng-doc-sev ng-doc-sev--' + esc(r.severity) + '">' + esc(SEV_LABEL[r.severity] || '') + '</span>' +
                '<span class="ng-doc-find-title">' + esc(r.title) + '</span>' +
                '<span class="ng-doc-find-count">' + r.count + '</span>' +
            '</div>' +
            '<div class="ng-doc-why">' + esc(r.why) + '</div>' +
            (rows ? '<div class="ng-doc-rows">' + rows + '</div>' : '') + more + bulk +
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
        if (_noAdmin) html += '<div class="ng-doc-note ng-doc-note--warn">Changing devices, rooms and groups needs an admin account</div>';
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

    var FOCUS_ATTRS = ['data-act', 'data-id', 'data-idx', 'data-cat', 'data-ms', 'data-n'];

    function captureSel() {
        var ae = document.activeElement;
        if (!ae || !_overlay || !_overlay.contains(ae) || !ae.getAttribute) return null;
        var sel = '';
        FOCUS_ATTRS.forEach(function (a) { var v = ae.getAttribute(a); if (v != null) sel += '[' + a + '="' + v + '"]'; });
        return sel || null;
    }

    function restoreSel(sel, within) {
        if (!sel || !_overlay) return false;
        var again = null;
        try { again = (within || _overlay).querySelector(sel); } catch (e) {}
        if (again) { try { again.focus({ preventScroll: true }); } catch (e) {} return true; }
        return false;
    }

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
            '</div>' +
            '<div class="ng-doc-sub-slot"></div>';
        o.addEventListener('click', onClick);
        o.addEventListener('input', onInput);
        o.addEventListener('change', onChange);
        o.addEventListener('keydown', onTrapKey);
        return o;
    }

    function focusables() {
        var dlg = _overlay && _overlay.querySelector(_sub ? '.ng-doc-subdlg' : '.ng-doc-dialog');
        if (!dlg) return [];
        return Array.prototype.filter.call(
            dlg.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled])'),
            function (el) { return el.offsetParent !== null || el === document.activeElement; });
    }

    function onTrapKey(e) {
        if (e.key === 'Enter' && _sub && _sub.kind === 'rename' && e.target && e.target.getAttribute &&
            e.target.getAttribute('data-act') === 'rn-input') {
            e.preventDefault();
            applyRename(e.target.getAttribute('data-idx'));
            return;
        }
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
        if (_sub) { if (!_sub.busy) closeSub(); return; }   // the mini dialog closes first, alone
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
        else if (act === 'rename') askRename(id, idx);
        else if (act === 'fam-num' || act === 'fam-group') famAction(act, parseInt(el.getAttribute('data-n'), 10));
        else if (act === 'room-one') askAssign('one', idx);
        else if (act === 'room-sel') askAssign('selected');
        else if (act === 'room-sug') askAssign('suggested');
        else if (act === 'room-go') doAssign();
        else if (act === 'sub-close') { if (_sub && !_sub.busy) closeSub(); }
        else if (act === 'sub-backdrop') { if (e.target === el && _sub && !_sub.busy) closeSub(); }
        else if (act === 'rn-one') applyRename(idx);
        else if (act === 'rn-all') applyRename(null);
        else if (act === 'rn-suggest') suggestRows();
        else if (act === 'gp-go') createGroup();
    }

    function onInput(e) {
        var el = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
        if (!el || !_sub) return;
        var act = el.getAttribute('data-act');
        if (act === 'rn-input' && _sub.kind === 'rename') {
            var row = subRow(el.getAttribute('data-idx'));
            if (row) { row.value = el.value; if (row.state === 'fail') { row.state = ''; row.msg = ''; } }
            updateSubInPlace();
        } else if (act === 'gp-name' && _sub.kind === 'group') {
            _sub.name = el.value;
            updateSubInPlace();
        }
    }

    function onChange(e) {
        var el = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
        if (!el) return;
        var act = el.getAttribute('data-act'), idx = el.getAttribute('data-idx');
        if (act === 'room-pick') { _room.sel[idx] = el.value; render(); }
        else if (act === 'room-chk') { if (el.checked) _room.checked[idx] = true; else delete _room.checked[idx]; }
        else if (act === 'room-bulk') { _room.bulk = el.value; }
        else if (act === 'gp-mem' && _sub && _sub.kind === 'group') {
            _sub.members.forEach(function (m) { if (String(m.idx) === String(idx)) m.checked = !!el.checked; });
            updateSubInPlace();
        }
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
        if (_undo.ops) { undoOps(); return; }
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

    /* ── Mini dialog (rename / create group), above the Doctor ─── */

    function findResult(id) {
        for (var i = 0; _results && i < _results.length; i++) if (_results[i].id === id) return _results[i];
        return null;
    }

    function subRow(idx) {
        if (!_sub || !_sub.rows) return null;
        for (var i = 0; i < _sub.rows.length; i++) if (String(_sub.rows[i].idx) === String(idx)) return _sub.rows[i];
        return null;
    }

    function rowChanged(r) { return r.state !== 'ok' && String(r.value).trim() !== r.from; }

    /* One error per row; only changed rows show one. */
    function renameErrors() {
        var errs = validateRows(_sub.rows);
        return errs.map(function (e, i) { return rowChanged(_sub.rows[i]) ? e : ''; });
    }

    function groupError() {
        var v = validateName(_sub.name);
        if (!v.ok) return v.error;
        if (groupNameTaken(v.name)) return 'A group or scene with this name already exists';
        var n = _sub.members.filter(function (m) { return m.checked; }).length;
        if (n < 2) return 'Pick at least 2 lights';
        return '';
    }

    function groupNameTaken(n) {
        var l = String(n).trim().toLowerCase();
        return ((_raw && _raw.scenes) || []).some(function (x) { return x && String(x.Name).trim().toLowerCase() === l; });
    }

    function renameRowHtml(r, i, errs) {
        var changed = rowChanged(r), id = 'ng-doc-ri-' + keyOf(r.idx);
        var err = r.state === 'fail' ? r.msg : errs[i];
        var right = r.state === 'ok'
            ? '<span class="ng-doc-rowstate ng-doc-rowstate--ok" role="status">Renamed</span>'
            : (canWrite() ? '<button type="button" class="ng-doc-btn" data-act="rn-one" data-idx="' + esc(keyOf(r.idx)) + '"' +
                ((!changed || err || _sub.busy) ? ' disabled' : '') + '>Rename</button>' : '');
        return '<div class="ng-doc-sub-row">' +
            '<label class="ng-doc-sub-lbl" for="' + id + '">Current name: <b>' + esc(r.from) + '</b></label>' +
            '<div class="ng-doc-sub-line"><input type="text" class="ng-doc-input" id="' + id + '" data-act="rn-input" data-idx="' + esc(keyOf(r.idx)) +
                '" value="' + esc(r.value) + '" maxlength="' + NAME_HARD_MAX + '" autocomplete="off" aria-describedby="' + id + '-e"' + (_sub.busy ? ' disabled' : '') + '>' +
                right + '</div>' +
            '<div class="ng-doc-sub-err" id="' + id + '-e" data-err="' + esc(keyOf(r.idx)) + '" role="alert">' + esc(err || '') + '</div></div>';
    }

    function subHtml() {
        if (!_sub) return '';
        var body = '', foot = '', title = '';
        if (_sub.kind === 'rename') {
            var errs = renameErrors(), rows = '', many = _sub.rows.length > 1;
            var nChanged = _sub.rows.filter(rowChanged).length;
            var okAll = nChanged > 0 && errs.every(function (e) { return !e; });
            title = many ? 'Rename ' + _sub.rows.length + ' devices' : 'Rename device';
            _sub.rows.forEach(function (r, i) { rows += renameRowHtml(r, i, errs); });
            body = '<div class="ng-doc-warnbox" role="note"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>' +
                '<span>Domoticz scripts, dzVents, Blockly events and external integrations that refer to the old name will stop matching.</span></div>' +
                (many ? '<div class="ng-doc-sub-tools"><button type="button" class="ng-doc-btn" data-act="rn-suggest"' + (_sub.busy ? ' disabled' : '') + '>Suggest numbering</button></div>' : '') +
                rows + (_sub.msg ? '<div class="ng-doc-sub-err" role="alert">' + esc(_sub.msg) + '</div>' : '');
            foot = (many && canWrite() ? '<button type="button" class="ng-doc-btn" data-act="rn-all"' + ((!okAll || _sub.busy) ? ' disabled' : '') + '>Rename all (' + nChanged + ')</button>' : '') +
                '<button type="button" class="ng-doc-btn" data-act="sub-close"' + (_sub.busy ? ' disabled' : '') + '>Close</button>';
        } else if (_sub.kind === 'group') {
            var gerr = groupError(), mem = '', log = '';
            title = 'Create group';
            _sub.members.forEach(function (m) {
                mem += '<label class="ng-doc-sub-mem"><input type="checkbox" class="ng-doc-chk" data-act="gp-mem" data-idx="' + esc(keyOf(m.idx)) + '"' +
                    (m.checked ? ' checked' : '') + (_sub.busy || _sub.done ? ' disabled' : '') + '><span>' + esc(m.name) + '</span></label>';
            });
            _sub.log.forEach(function (l) { log += '<li class="' + (l.bad ? 'ng-doc-log-bad' : '') + '">' + esc(l.text) + '</li>'; });
            body = '<div class="ng-doc-warnbox ng-doc-warnbox--info" role="note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i>' +
                '<span>This adds a new Domoticz Group and puts the ticked lights in it. Existing groups and scenes are not changed.</span></div>' +
                '<div class="ng-doc-sub-row"><label class="ng-doc-sub-lbl" for="ng-doc-gp-name">Group name</label>' +
                '<div class="ng-doc-sub-line"><input type="text" class="ng-doc-input" id="ng-doc-gp-name" data-act="gp-name" value="' + esc(_sub.name) +
                    '" maxlength="' + NAME_HARD_MAX + '" autocomplete="off" aria-describedby="ng-doc-gp-err"' + (_sub.busy || _sub.done ? ' disabled' : '') + '></div>' +
                '<div class="ng-doc-sub-err" id="ng-doc-gp-err" data-gp-err="1" role="alert">' + esc(_sub.done ? '' : gerr) + '</div></div>' +
                '<fieldset class="ng-doc-sub-members"><legend>Lights in the group</legend>' + mem + '</fieldset>' +
                (log ? '<ul class="ng-doc-sub-log" role="status">' + log + '</ul>' : '');
            foot = (!_sub.done && canWrite() ? '<button type="button" class="ng-doc-btn" data-act="gp-go"' + ((gerr || _sub.busy) ? ' disabled' : '') + '>Create group</button>' : '') +
                (_sub.done && _undo && _undo.ops ? '<button type="button" class="ng-doc-btn ng-doc-btn--danger" data-act="undo">Undo (delete the new group)</button>' : '') +
                '<button type="button" class="ng-doc-btn" data-act="sub-close"' + (_sub.busy ? ' disabled' : '') + '>Close</button>';
        }
        return '<div class="ng-doc-sub" data-act="sub-backdrop">' +
            '<div class="ng-doc-subdlg" role="dialog" aria-modal="true" aria-labelledby="ng-doc-sub-title" tabindex="-1">' +
                '<div class="ng-doc-subhdr"><span class="ng-doc-title" id="ng-doc-sub-title">' + esc(title) + '</span>' +
                    '<button type="button" class="ng-doc-hdr-btn" data-act="sub-close" aria-label="Close"' + (_sub.busy ? ' disabled' : '') + '><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>' +
                '<div class="ng-doc-subbody">' + body + '</div>' +
                '<div class="ng-doc-subfoot">' + foot + '</div>' +
            '</div></div>';
    }

    function renderSub() {
        if (!_overlay || !_open) return;
        var slot = _overlay.querySelector('.ng-doc-sub-slot');
        var main = _overlay.querySelector('.ng-doc-dialog');
        if (!slot) return;
        var sel = _sub ? captureSel() : null;
        slot.innerHTML = subHtml();
        if (main && main.setAttribute) {
            if (_sub) main.setAttribute('inert', ''); else if (main.removeAttribute) main.removeAttribute('inert');
        }
        if (_sub && sel) restoreSel(sel, slot);
    }

    /* Typing: touch only the error text and button states, so focus and caret stay. */
    function updateSubInPlace() {
        if (!_sub || !_overlay) return;
        var q = function (s) { try { return _overlay.querySelector(s); } catch (e) { return null; } };
        if (_sub.kind === 'rename') {
            var errs = renameErrors(), nChanged = 0, all = true;
            _sub.rows.forEach(function (r, i) {
                var k = esc(keyOf(r.idx)), changed = rowChanged(r);
                if (changed) nChanged++;
                if (errs[i]) all = false;
                var e = q('[data-err="' + k + '"]'); if (e) e.textContent = r.state === 'fail' ? r.msg : errs[i];
                var b = q('[data-act="rn-one"][data-idx="' + k + '"]'); if (b) b.disabled = !changed || !!errs[i] || _sub.busy;
            });
            var ba = q('[data-act="rn-all"]'); if (ba) { ba.disabled = !(nChanged > 0 && all) || _sub.busy; ba.textContent = 'Rename all (' + nChanged + ')'; }
        } else if (_sub.kind === 'group') {
            var g = groupError();
            var ge = q('[data-gp-err]'); if (ge) ge.textContent = g;
            var gb = q('[data-act="gp-go"]'); if (gb) gb.disabled = !!g || _sub.busy;
        }
    }

    function openSub(sub) {
        _subReturn = captureSel();
        _sub = sub;
        if (window.ngSetDialogOpen) window.ngSetDialogOpen('doctor-sub', true);
        renderSub();
        var first = _overlay && _overlay.querySelector('.ng-doc-subdlg input, .ng-doc-subdlg button');
        if (first) { try { first.focus({ preventScroll: true }); if (first.select) first.select(); } catch (e) {} }
    }

    function closeSub() {
        if (!_sub) return;
        _sub = null;
        if (window.ngSetDialogOpen) window.ngSetDialogOpen('doctor-sub', false);
        renderSub();
        if (!restoreSel(_subReturn)) {
            var x = _overlay && _overlay.querySelector('.ng-doc-x-btn');
            if (x) { try { x.focus({ preventScroll: true }); } catch (e) {} }
        }
        _subReturn = null;
    }

    function adminBar() {
        _bar = { text: 'Changing devices, rooms and groups needs an admin account', warn: true };
    }

    /* ── Rename ────────────────────────────────────────────────── */

    function openRename(idxs, values) {
        var rows = [];
        idxs.forEach(function (i) {
            var d = _devMap[String(i)];
            if (!d) return;
            rows.push({ idx: String(i), from: String(d.Name), value: values && values[i] != null ? values[i] : String(d.Name), state: '', msg: '' });
        });
        if (rows.length) openSub({ kind: 'rename', rows: rows, busy: false, msg: '' });
    }

    function askRename(id, idx) {
        if (!canWrite()) return;
        var r = findResult(id);
        if (!r) return;
        var idxs = [String(idx)];
        if (id === 'dupNames') {
            var key = null;
            r.items.forEach(function (it) { if (String(it.idx) === String(idx)) key = it.dupKey; });
            idxs = r.items.filter(function (it) { return it.dupKey === key; }).map(function (it) { return it.idx; });
        }
        openRename(idxs);
    }

    function famAction(act, n) {
        var r = findResult('families');
        var it = r && r.items[n];
        if (!it || !it.family || !canWrite()) return;
        if (act === 'fam-num') {
            var vals = {};
            it.family.numbering.forEach(function (c) { vals[c.idx] = c.to; });
            openRename(it.family.numbering.map(function (c) { return c.idx; }), vals);
        } else {
            openSub({
                kind: 'group', name: it.family.base, busy: false, done: false, log: [],
                members: it.family.members.map(function (m) {
                    var d = _devMap[m.idx];
                    return { idx: m.idx, name: d ? String(d.Name) : m.name, checked: true };
                })
            });
        }
    }

    function suggestRows() {
        if (!_sub || _sub.kind !== 'rename' || _sub.busy) return;
        var inSet = {};
        _sub.rows.forEach(function (r) { inSet[r.idx] = true; });
        var taken = Object.keys(_devMap).filter(function (k) { return !inSet[k]; }).map(function (k) { return _devMap[k].Name; });
        var plan = suggestNumbering(_sub.rows.map(function (r) { return { idx: r.idx, name: r.from }; }), taken);
        plan.forEach(function (c, i) { _sub.rows[i].value = c.to; if (_sub.rows[i].state === 'fail') _sub.rows[i].state = ''; });
        renderSub();
    }

    /* idx = one row, null = every changed row.  Sequential; an auth refusal
       stops the batch. */
    function applyRename(idx) {
        if (!_sub || _sub.kind !== 'rename' || _sub.busy || !canWrite()) return;
        var rows = _sub.rows, errs = renameErrors(), todo = [];
        rows.forEach(function (r) {
            if (!rowChanged(r)) return;
            if (idx != null && r.idx !== String(idx)) return;
            todo.push(r);
        });
        if (!todo.length) return;
        if (todo.some(function (r) { return errs[rows.indexOf(r)]; })) return;
        _sub.busy = true; _sub.msg = '';
        renderSub();
        var ops = [], sub = _sub;
        seq(todo, function (r) {
            var name = validateName(r.value).name;
            return mutate({ param: 'renamedevice', idx: r.idx, name: name }).then(function (res) {
                if (res.ok) {
                    var old = r.from, d = _devMap[r.idx];
                    r.from = name; r.value = name; r.state = 'ok'; r.msg = '';
                    if (d) d.Name = name;
                    ops.push({ kind: 'rename', idx: r.idx, name: old });
                } else {
                    r.state = 'fail';
                    r.msg = res.reason === 'auth' ? 'Needs an admin account' : (res.message || 'Rename failed');
                }
                return res;
            });
        }, isAuth).then(function (results) {
            var denied = noteAuth(results);
            sub.busy = false;
            if (ops.length) {
                _undo = { ops: ops.slice().reverse() };
                _bar = { text: 'Renamed ' + ops.length + (ops.length === 1 ? ' device' : ' devices'), undo: true };
            } else if (denied) adminBar();
            if (denied) sub.msg = 'This needs an admin account';
            recheck(['dupNames', 'badNames', 'families']);
            var pending = sub.rows.some(function (r) { return rowChanged(r) || r.state === 'fail'; });
            if (_sub === sub && !pending && !denied) closeSub(); else renderSub();
        });
    }

    /* ── Create group ──────────────────────────────────────────── */

    function createGroup() {
        var sub = _sub;
        if (!sub || sub.kind !== 'group' || sub.busy || sub.done || !canWrite() || groupError()) return;
        var name = validateName(sub.name).name;
        var chosen = sub.members.filter(function (m) { return m.checked; });
        sub.busy = true; sub.log = [];
        renderSub();
        var log = function (text, bad) { sub.log.push({ text: text, bad: !!bad }); };
        var finish = function () { sub.busy = false; sub.done = true; renderSub(); };
        mutate({ param: 'addscene', name: name, scenetype: 1 }).then(function (res) {
            if (!res.ok) {
                if (res.reason === 'auth') { _noAdmin = true; adminBar(); log('This needs an admin account', true); }
                else log('Domoticz refused: ' + (res.message || 'the group could not be created'), true);
                log('Nothing was created.');
                finish();
                return null;
            }
            /* AddScene does not return the new idx: find it again by name. */
            return getJson('type=command&param=getscenes&displayhidden=1').then(function (sc) {
                var hit = null, l = name.toLowerCase();
                (sc || []).forEach(function (x) {
                    if (x && String(x.Type).toLowerCase() === 'group' && String(x.Name).trim().toLowerCase() === l) hit = x;
                });
                if (!hit) {
                    log('The group "' + name + '" was created, but could not be found again, so no lights were added. Check Domoticz.', true);
                    finish();
                    return null;
                }
                var gid = String(hit.idx), added = [];
                _createdGroups[gid] = true;
                _undo = { ops: [{ kind: 'deletegroup', idx: gid }] };
                log('Created group "' + name + '" (idx ' + gid + ')');
                if (_raw && _raw.scenes) _raw.scenes.push({ idx: gid, Name: name, Type: 'Group' });
                return seq(chosen, function (m) {
                    return mutate({ param: 'addscenedevice', idx: gid, devidx: m.idx, isscene: 'false' }).then(function (r) {
                        if (r.ok) { added.push(m.idx); log('Added ' + m.name); }
                        else {
                            if (r.reason === 'auth') _noAdmin = true;
                            log('Could not add ' + m.name + (r.message ? ': ' + r.message : ''), true);
                        }
                        return r;
                    });
                }, function () { return true; }).then(function () {
                    if (_raw && _raw.groupMembers) _raw.groupMembers[gid] = added;
                    recheck('families');
                    if (added.length === chosen.length) {
                        _bar = { text: 'Created group "' + name + '" with ' + added.length + ' lights', undo: true };
                        if (_sub === sub) closeSub(); else render();
                    } else {
                        log('Stopped after ' + added.length + ' of ' + chosen.length + ' lights. The group "' + name + '" exists in Domoticz with ' + added.length + ' of them.', true);
                        _bar = { text: 'Group "' + name + '" was created but is incomplete', warn: true, undo: true };
                        finish();
                    }
                });
            });
        });
    }

    /* ── Rooms ─────────────────────────────────────────────────── */

    function askAssign(mode, idx) {
        if (!canWrite()) return;
        var r = findResult('noRoom');
        if (!r || r.status !== 'found') return;
        var pairs = [];
        r.items.forEach(function (it) {
            if (!_devMap[it.idx]) return;
            var plan;
            if (mode === 'one') { if (String(it.idx) !== String(idx)) return; plan = roomOf(it); }
            else if (mode === 'selected') { if (!_room.checked[it.idx]) return; plan = _room.bulk; }
            else { if (!it.room) return; plan = it.room; }
            if (!plan) return;
            pairs.push({ idx: it.idx, name: it.name, plan: String(plan), planName: planName(plan) });
        });
        if (!pairs.length) {
            _bar = { text: mode === 'selected' ? 'Tick some devices and pick a room first' : 'Pick a room first', warn: true };
            render();
            return;
        }
        _confirm = { id: 'noRoom', kind: 'rooms', pairs: pairs };
        render();
    }

    function doAssign() {
        if (!_confirm || _confirm.kind !== 'rooms') return;
        /* Re-check at click time: skip devices that have a room by now. */
        var pairs = _confirm.pairs.filter(function (p) { var d = _devMap[p.idx]; return d && planIdsOf(d).length === 0; });
        _confirm = null;
        if (!pairs.length) { render(); return; }
        _bar = { text: 'Assigning rooms…' };
        render();
        var ops = [];
        seq(pairs, function (p) {
            return mutate({ param: 'addplanactivedevice', idx: p.plan, activetype: 0, activeidx: p.idx }).then(function (res) {
                if (res.ok) {
                    var d = _devMap[p.idx];
                    if (d) d.PlanIDs = [p.plan];
                    delete _room.checked[p.idx];
                    ops.push({ kind: 'unassign', idx: p.idx, plan: p.plan });
                } else _rowFail['noRoom:' + p.idx] = true;
                return res;
            });
        }, isAuth).then(function (results) {
            var denied = noteAuth(results), n = ops.length;
            _undo = n ? { ops: ops.slice().reverse() } : null;
            _bar = { text: 'Put ' + n + ' of ' + pairs.length + (pairs.length === 1 ? ' device' : ' devices') + ' in a room' +
                           (denied ? ' (needs an admin account)' : ''),
                     warn: n < pairs.length, undo: n > 0 };
            recheck('noRoom');
        });
    }

    /* ── Undo for rename / room / created group ────────────────── */

    function undoStep(op) {
        var d = _devMap[op.idx];
        if (op.kind === 'rename') {
            return mutate({ param: 'renamedevice', idx: op.idx, name: op.name }).then(function (res) {
                if (res.ok && d) d.Name = op.name;
                return res;
            });
        }
        if (op.kind === 'unassign') {
            return getJson('type=command&param=getplandevices&idx=' + encodeURIComponent(op.plan)).then(function (rows) {
                var hit = null;
                (rows || []).forEach(function (x) {
                    var dev = String(x.DevSceneRowID != null ? x.DevSceneRowID : x.devidx);
                    if (String(x.type) === '0' && dev === String(op.idx)) hit = x;
                });
                if (!hit) return { ok: false, reason: 'error', message: 'Room entry not found' };
                return mutate({ param: 'deleteplandevice', idx: hit.idx != null ? hit.idx : hit.ID }).then(function (res) {
                    if (res.ok && d) d.PlanIDs = [];
                    return res;
                });
            });
        }
        if (op.kind === 'deletegroup') {
            /* Only a group made in this dialog session is ever deleted. */
            if (!_createdGroups[op.idx]) return Promise.resolve({ ok: false, reason: 'error', message: 'Not created here' });
            return mutate({ param: 'deletescene', idx: op.idx }).then(function (res) {
                if (res.ok) {
                    delete _createdGroups[op.idx];
                    if (_raw && _raw.scenes) _raw.scenes = _raw.scenes.filter(function (x) { return String(x.idx) !== String(op.idx); });
                    if (_raw && _raw.groupMembers) delete _raw.groupMembers[op.idx];
                }
                return res;
            });
        }
        return Promise.resolve({ ok: false, reason: 'error' });
    }

    function undoOps() {
        var ops = _undo.ops;
        _undo = null;
        if (_sub && _sub.kind === 'group') closeSub();
        _bar = { text: 'Undoing…' };
        render();
        seq(ops, undoStep, isAuth).then(function (results) {
            var failed = results.filter(function (r) { return !r.res.ok; }).length + (ops.length - results.length);
            if (noteAuth(results)) adminBar();
            else _bar = failed ? { text: 'Undo incomplete: ' + failed + ' of ' + ops.length + ' steps failed', warn: true } : { text: 'Undone' };
            recheck(['dupNames', 'badNames', 'families', 'noRoom']);
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
        _sub = null; _room = { sel: {}, checked: {}, bulk: '' }; _rowFail = {};
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
        if (_sub) { _sub = null; if (window.ngSetDialogOpen) window.ngSetDialogOpen('doctor-sub', false); }
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
