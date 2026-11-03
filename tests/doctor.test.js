/* Doctor tests: node tests/doctor.test.js
   Pure checks run with fixtures; the browser path runs against stubbed
   window/document/fetch to prove a run is read-only. */
'use strict';
var assert = require('assert');
var path = require('path');

/* ── Stubs ─────────────────────────────────────────────────────── */
var fetchCalls = [], setCalls = [], lsWrites = [], toggles = [];
var settingsStore = {
    deviceIconOverrides: JSON.stringify({
        '5':  { icon: 'fa-solid fa-lightbulb', name: 'Gone lamp' },
        '99': { iconOn: 'fa-solid fa-fan', name: 'Gone fan' },
        '7':  { icon: 'fa-solid fa-plug', name: 'Kept' }
    }),
    doctorIgnored: '{}', doctorChecks: '[]'
};
function light(idx, name, plans, sw) {
    return { idx: String(idx), Name: name, Type: 'Light/Switch', SwitchType: sw || 'Dimmer', Image: 'Light', Icon: '', CustomImage: 0,
             HardwareName: 'HW', PlanIDs: plans, LastUpdate: '2099-01-01 00:00:00' };
}
var fixtures = {
    used: [
        { idx: '7', Name: 'Kept', Type: 'Light/Switch', SwitchType: 'On/Off', Image: '', Icon: '', CustomImage: 0, HardwareName: 'HW', PlanIDs: [1], LastUpdate: '2099-01-01 00:00:00' },
        { idx: '8', Name: 'Bare switch', Type: 'Light/Switch', SwitchType: 'On/Off', Image: '', Icon: '', CustomImage: 0, HardwareName: 'HW', PlanIDs: [1], LastUpdate: '2099-01-01 00:00:00' },
        light(20, 'Woonkamer Lamp', [1]), light(21, 'Woonkamer Lamp 2', [1]), light(22, 'Woonkamer Lamp3', [1]),
        light(30, 'Hal lamp', [0]), light(31, 'Living room spot', [0]), light(32, 'Garage plug', [0]),
        { idx: '40', Name: 'Kelder', Type: 'Temp', HardwareName: 'HW', PlanIDs: [1], LastUpdate: '2099-01-01 00:00:00' },
        { idx: '41', Name: 'Kelder', Type: 'Temp', HardwareName: 'HW', PlanIDs: [1], LastUpdate: '2099-01-01 00:00:00' },
        { idx: '50', Name: '<img src=x onerror=1>', Type: 'Temp', HardwareName: 'HW', PlanIDs: [1], LastUpdate: '2099-01-01 00:00:00' },
        { idx: '51', Name: '<img src=x onerror=1>', Type: 'Temp', HardwareName: 'HW', PlanIDs: [1], LastUpdate: '2099-01-01 00:00:00' }
    ],
    unused: [{ idx: '12', Name: 'Spare', HardwareName: 'HW' }],
    schedules: [], plans: [{ idx: 1, Name: 'Living' }, { idx: 2, Name: 'Hal' }, { idx: 3, Name: '$Hidden Devices' }],
    scenes: [{ idx: '5', Name: 'Group Lampen', Type: 'Group' }, { idx: '6', Name: 'Movie', Type: 'Scene' }],
    members: { '5': ['20', '21'] },
    planDevices: {}
};
var writes = [], mut = { deny: false, failAddDev: 0, addDevCount: 0, nextScene: 9, nextMap: 77 };

var el = function () {
    var e = { innerHTML: '', textContent: '', disabled: false, scrollTop: 0, listeners: {}, className: '', id: '',
        classList: { add: function () {}, remove: function () {} },
        setAttribute: function () {}, getAttribute: function () { return null; },
        addEventListener: function (t, f) { e.listeners[t] = f; },
        children: {},
        querySelector: function (sel) { return e.children[sel] || (e.children[sel] = el()); }, querySelectorAll: function () { return []; },
        removeAttribute: function () {},
        contains: function () { return true; }, focus: function () {}, parentNode: null };
    return e;
};
global.window = global;
global.localStorage = { getItem: function () { return null; }, setItem: function (k, v) { lsWrites.push(k); } };
global.requestAnimationFrame = function (f) { f(); };
global.document = {
    body: el(), activeElement: null,
    createElement: el, getElementById: function () { return null; }, querySelector: function () { return null; },
    addEventListener: function () {}, removeEventListener: function () {}
};
global.document.body.appendChild = function () {};
global.document.body.contains = function () { return true; };
global.ngSetDialogOpen = function (id, on) { toggles.push([id, on]); };
global.dzNightglassSettings = {
    get: function (k) { return settingsStore[k]; },
    set: function (k, v) { setCalls.push([k, v]); settingsStore[k] = v; },
    blobSize: function () { return 100; }
};
global.fetch = function (url, opts) {
    fetchCalls.push({ url: url, opts: opts || {} });
    var r = fixtures.used, u = String(url);
    if (/used=false/.test(u)) r = fixtures.unused;
    else if (/getschedules/.test(u)) r = fixtures.schedules;
    else if (/getplans/.test(u)) r = fixtures.plans;
    else if (/getscenedevices/.test(u)) {
        var sid = (u.match(/idx=(\d+)/) || [])[1];
        r = (fixtures.members[sid] || []).map(function (d) { return { ID: 'x', Name: 'n', DevID: d, DevRealIdx: d }; });
    }
    else if (/getscenes/.test(u)) r = fixtures.scenes;
    else if (/getplandevices/.test(u)) r = fixtures.planDevices[(u.match(/idx=(\d+)/) || [])[1]] || [];
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ status: 'OK', result: r }); } });
};

/* The theme's POST helper: every Domoticz write goes through it. */
function ok() { return Promise.resolve({ status: 'OK' }); }
global.ngApiMutate = function (p) {
    writes.push(JSON.parse(JSON.stringify(p)));
    if (mut.deny) return Promise.resolve({ status: 'ERR', error: 'no_identity', httpStatus: 403 });
    if (p.param === 'addscene') {
        var taken = fixtures.scenes.some(function (x) { return x.Name.toLowerCase() === String(p.name).toLowerCase(); });
        if (taken) return Promise.resolve({ status: 'ERR', message: 'A Scene with this Name already Exits!' });
        var id = String(mut.nextScene++);
        fixtures.scenes.push({ idx: id, Name: p.name, Type: p.scenetype === 1 ? 'Group' : 'Scene' });
        fixtures.members[id] = [];
    } else if (p.param === 'addscenedevice') {
        if (++mut.addDevCount === mut.failAddDev) return Promise.resolve({ status: 'ERR' });
        fixtures.members[p.idx].push(p.devidx);
    } else if (p.param === 'deletescene') {
        fixtures.scenes = fixtures.scenes.filter(function (x) { return x.idx !== String(p.idx); });
        delete fixtures.members[p.idx];
    } else if (p.param === 'addplanactivedevice') {
        (fixtures.planDevices[p.idx] = fixtures.planDevices[p.idx] || []).push(
            { idx: String(mut.nextMap++), devidx: String(p.activeidx), type: 0, DevSceneRowID: String(p.activeidx), Name: 'n', order: '1' });
    } else if (p.param === 'deleteplandevice') {
        Object.keys(fixtures.planDevices).forEach(function (k) {
            fixtures.planDevices[k] = fixtures.planDevices[k].filter(function (m) { return m.idx !== String(p.idx); });
        });
    }
    return ok();
};
var documentKeydown = null;
global.document.addEventListener = function (t, f) { if (t === 'keydown') documentKeydown = f; };

var D = require(path.join(__dirname, '..', 'src', 'js', 'doctor.js'));

/* ── Pure: orphan detection ────────────────────────────────────── */
var ov = JSON.parse(settingsStore.deviceIconOverrides);
var res = D.checkOrphanOverrides(ov, fixtures.used, fixtures.unused);
assert.strictEqual(res.status, 'found');
assert.deepStrictEqual(res.items.map(function (i) { return i.idx; }).sort(), ['5', '99']);
assert.strictEqual(res.items[0].icon !== '', true);
/* a device that is only in the UNUSED set is not deleted */
var ov2 = { '12': { icon: 'fa-solid fa-x' } };
assert.strictEqual(D.checkOrphanOverrides(ov2, fixtures.used, fixtures.unused).status, 'ok');
/* failed or empty reads never count as "everything deleted" */
assert.strictEqual(D.checkOrphanOverrides(ov, null, fixtures.unused).status, 'unknown');
assert.strictEqual(D.checkOrphanOverrides(ov, [], []).status, 'unknown');

/* ── Pure: removal + undo ──────────────────────────────────────── */
var rm = D.removeOverrides(ov, ['5', '404']);
assert.deepStrictEqual(Object.keys(rm.next).sort(), ['7', '99']);
assert.deepStrictEqual(rm.removed.map(function (x) { return x.idx + '=' + x.icon; }), ['5=fa-solid fa-lightbulb']);
assert.strictEqual(Object.keys(ov).length, 3, 'input map is not mutated');
assert.deepStrictEqual(Object.keys(D.removeOverrides(ov, ['5', '99']).next), ['7']);

/* ── Pure: name validation + numbering ─────────────────────────── */
assert.strictEqual(D.validateName('   ').ok, false);
assert.strictEqual(D.validateName('  Lamp  ').name, 'Lamp', 'trimmed');
assert.strictEqual(D.validateName(new Array(102).join('x')).ok, false, 'too long');
assert.strictEqual(D.validateName('a<b').ok, false, 'markup refused');
assert.deepStrictEqual(D.validateRows([{ value: 'A' }, { value: 'a' }, { value: 'B' }]).map(Boolean), [true, true, false], 'duplicates inside the set');
assert.deepStrictEqual(
    D.suggestNumbering([{ idx: '1', name: 'Kelder' }, { idx: '2', name: 'Kelder' }], ['kelder 1']).map(function (c) { return c.to; }),
    ['Kelder 2', 'Kelder 3'], 'skips names other devices use');

/* ── Pure: families (and near-misses that must not form one) ──── */
function L(idx, name, extra) { var d = { idx: String(idx), Name: name, Type: 'Light/Switch', SwitchType: 'Dimmer' }; Object.keys(extra || {}).forEach(function (k) { d[k] = extra[k]; }); return d; }
function famBases(list) { return D.detectFamilies(list).map(function (f) { return f.base + ':' + f.members.length; }); }
assert.deepStrictEqual(famBases([L(1, 'Woonkamer Lamp'), L(2, 'Woonkamer Lamp 2'), L(3, 'Woonkamer Lamp3')]), ['Woonkamer Lamp:3']);
assert.deepStrictEqual(famBases([L(1, 'Lamp links'), L(2, 'Lamp rechts')]), ['Lamp:2'], 'both sides');
assert.deepStrictEqual(famBases([L(1, 'Lamp'), L(2, 'Lamp links')]), [], 'one side word is not clear enough');
assert.deepStrictEqual(famBases([L(1, 'Lamp 1')]), [], 'a single light');
assert.deepStrictEqual(famBases([L(1, 'Lamp'), L(2, 'Lamp')]), [], 'identical bare names are a duplicate, not a family');
assert.deepStrictEqual(famBases([L(1, 'Lamp 1'), L(2, 'Lampje 2')]), [], 'different bases');
assert.deepStrictEqual(famBases([L(1, 'Ab 1'), L(2, 'Ab 2')]), [], 'base too short');
assert.deepStrictEqual(famBases([L(1, 'Kamer 101'), L(2, 'Kamer 102')]), [], 'long numbers are part of the name');
assert.deepStrictEqual(famBases([L(1, 'Sensor 1', { Type: 'Temp' }), L(2, 'Sensor 2', { Type: 'Temp' })]), [], 'not lights');
assert.deepStrictEqual(famBases([L(1, 'Blind 1', { SwitchType: 'Blinds' }), L(2, 'Blind 2', { SwitchType: 'Blinds' })]), [], 'blinds are not lights');
assert.deepStrictEqual(famBases([L(1, 'Lamp 1', { Type: 'Scene' }), L(2, 'Lamp 2', { Type: 'Group' })]), [], 'scenes and groups are skipped');
assert.deepStrictEqual(famBases([L(1, 'Tafel lamp A'), L(2, 'Tafel lamp B')]), ['Tafel lamp:2'], 'letters');

/* numbering */
function plan(list, outside) { return D.numberingPlan(D.detectFamilies(list)[0], outside || []).map(function (c) { return c.from + '>' + c.to; }); }
assert.deepStrictEqual(plan([L(1, 'Lamp'), L(2, 'Lamp 2'), L(3, 'Lamp3')]), ['Lamp>Lamp 1', 'Lamp3>Lamp 3']);
assert.deepStrictEqual(plan([L(1, 'Lamp 1'), L(2, 'Lamp 2')]), [], 'already consistent');
assert.deepStrictEqual(plan([L(1, 'Lamp 1'), L(2, 'Lamp 1'), L(3, 'Lamp 2')]), ['Lamp 1>Lamp 2', 'Lamp 2>Lamp 3'], 'duplicate numbers fall back to 1..N');
assert.deepStrictEqual(plan([L(1, 'Lamp'), L(2, 'Lamp 2'), L(3, 'Lamp3')], ['lamp 1']), [], 'collision with an outside name: no suggestion');
assert.deepStrictEqual(plan([L(1, 'Tafel lamp A'), L(2, 'Tafel lamp B')]), [], 'letters are never renumbered');

/* group coverage */
var G = [{ idx: '5', name: 'G5', members: ['1', '2'] }, { idx: '6', name: 'G6', members: ['3'] }];
assert.strictEqual(D.groupCoverage(['1', '2'], G).state, 'full');
assert.strictEqual(D.groupCoverage(['1', '2', '3'], G).state, 'partial');
assert.deepStrictEqual(D.groupCoverage(['1', '2', '3'], G).missing, ['3']);
assert.strictEqual(D.groupCoverage(['1', '3'], G).state, 'none', 'one light in a group is not coverage');
assert.strictEqual(D.groupCoverage(['8', '9'], G).state, 'none');
assert.strictEqual(D.buildGroups(fixtures.scenes, null), null, 'unknown members are not "no groups"');
assert.deepStrictEqual(D.buildGroups(fixtures.scenes, fixtures.members), [{ idx: '5', name: 'Group Lampen', members: ['20', '21'] }]);
var fam = D.checkFamilies(fixtures.used, D.buildGroups(fixtures.scenes, fixtures.members));
assert.strictEqual(fam.items.length, 1);
assert.strictEqual(fam.items[0].family.coverage.state, 'partial');
assert.strictEqual(fam.items[0].family.canGroup, true);
assert.strictEqual(D.checkFamilies([L(1, 'Lamp'), L(2, 'Lamp 2'), L(3, 'Lamp 3')], null).status, 'found', 'numbering still reported when groups could not be read');
assert.strictEqual(D.checkFamilies([L(1, 'Lamp 1'), L(2, 'Lamp 2')], null).status, 'unknown');
assert.strictEqual(D.checkFamilies([L(1, 'Lamp 1'), L(2, 'Lamp 2')], [{ idx: '1', name: 'g', members: ['1', '2'] }]).status, 'ok', 'consistent and grouped');

/* rooms */
var PL = [{ idx: 1, Name: 'Living' }, { idx: 2, Name: 'Hal' }, { idx: 3, Name: 'Living room' }, { idx: 4, Name: '$Hidden Devices' }];
assert.strictEqual(D.suggestRoom('Hal lamp', PL), '2');
assert.strictEqual(D.suggestRoom('living ROOM spot', PL), '3', 'longest name wins');
assert.strictEqual(D.suggestRoom('Hallway lamp', PL), '', 'whole words only');
assert.strictEqual(D.suggestRoom('Garage plug', PL), '');
assert.strictEqual(D.suggestRoom('Hidden Devices lamp', PL), '', 'hidden plan is never suggested');
var nr = D.checkNoRoom(fixtures.used, fixtures.plans);
assert.deepStrictEqual(nr.items.map(function (i) { return i.idx + '>' + i.room; }), ['30>2', '31>1', '32>']);

/* ── Browser: a run is read-only ───────────────────────────────── */
function stubEl(name, attrs) {
    attrs = attrs || {};
    return { value: attrs.value, checked: attrs.checked,
             getAttribute: function (a) { return a === 'data-act' ? name : attrs[a] || null; } };
}
function act(overlay, name, attrs) {
    var e = stubEl(name, attrs);
    overlay.listeners.click({ target: { closest: function () { return e; } } });
}
function typeInto(overlay, name, attrs) {
    var e = stubEl(name, attrs);
    overlay.listeners.input({ target: { closest: function () { return e; } } });
}
function change(overlay, name, attrs) {
    var e = stubEl(name, attrs);
    overlay.listeners.change({ target: { closest: function () { return e; } } });
}
function flush() { return new Promise(function (r) { setTimeout(r, 0); }); }
function sub(o) { return o.querySelector('.ng-doc-sub-slot').innerHTML; }
function main(o) { return o.querySelector('.ng-doc-body').innerHTML; }

(async function () {
    var captured = null;
    global.document.body.appendChild = function (o) { captured = o; };
    D._browser.open();
    await D._browser.run(true);
    assert.ok(fetchCalls.length >= 4, 'fetched');
    fetchCalls.forEach(function (c) {
        var m = (c.opts.method || 'GET').toUpperCase();
        assert.strictEqual(m, 'GET', 'only GET: ' + c.url);
        assert.ok(!c.opts.body, 'no body: ' + c.url);
    });
    assert.strictEqual(setCalls.length, 0, 'run made no dzNightglassSettings.set call');
    assert.strictEqual(writes.length, 0, 'run made no Domoticz write');
    assert.ok(fetchCalls.some(function (c) { return /getscenes/.test(c.url); }), 'read the scenes');
    assert.ok(fetchCalls.some(function (c) { return /getscenedevices&idx=5&isscene=false/.test(c.url); }), 'read the members of the group');
    assert.ok(!fetchCalls.some(function (c) { return /getscenedevices&idx=6/.test(c.url); }), 'scenes are not read as groups');
    assert.deepStrictEqual(lsWrites, ['ng-doctor-last'], 'only the device-local key was written');
    assert.deepStrictEqual(toggles[0], ['doctor', true]);
    assert.ok(/checks clean/.test(D._browser.lastRunText()));

    /* Remove one: confirm step first, then a single write, then Undo */
    var before = settingsStore.deviceIconOverrides;
    act(captured, 'rm-one', { 'data-idx': '5' });
    assert.strictEqual(setCalls.length, 0, 'confirm step writes nothing');
    act(captured, 'rm-go');
    assert.strictEqual(setCalls.length, 1);
    assert.strictEqual(setCalls[0][0], 'deviceIconOverrides');
    assert.deepStrictEqual(Object.keys(JSON.parse(setCalls[0][1])).sort(), ['7', '99']);
    act(captured, 'undo');
    assert.strictEqual(setCalls.length, 2);
    assert.deepStrictEqual(JSON.parse(setCalls[1][1]), JSON.parse(before), 'undo restores the previous map');

    /* Remove all */
    act(captured, 'rm-all');
    act(captured, 'rm-go');
    assert.deepStrictEqual(Object.keys(JSON.parse(setCalls[2][1])), ['7']);
    assert.strictEqual(fetchCalls.every(function (c) { return !c.opts.method || c.opts.method === 'GET'; }), true);

    /* ── Rename: preview, validation, exact calls, undo ───────────── */
    var html = main(captured);
    assert.ok(html.indexOf('<img src=x') < 0, 'names are escaped in rows');
    assert.ok(html.indexOf('data-act="rename"') >= 0, 'rename button offered');
    act(captured, 'rename', { 'data-id': 'dupNames', 'data-idx': '40' });
    assert.strictEqual(writes.length, 0, 'opening the popup writes nothing');
    assert.deepStrictEqual(toggles[toggles.length - 1], ['doctor-sub', true]);
    assert.ok(/stop matching/.test(sub(captured)), 'warns that scripts will stop matching');
    assert.ok(/data-idx="40"/.test(sub(captured)) && /data-idx="41"/.test(sub(captured)), 'whole duplicate set');
    act(captured, 'rn-suggest');
    assert.ok(/value="Kelder 1"/.test(sub(captured)) && /value="Kelder 2"/.test(sub(captured)), 'numbering proposed, editable');
    typeInto(captured, 'rn-input', { 'data-idx': '41', value: '  ' });
    act(captured, 'rn-all');
    await flush();
    assert.strictEqual(writes.length, 0, 'invalid input blocks the write');
    typeInto(captured, 'rn-input', { 'data-idx': '41', value: 'Kelder links' });
    act(captured, 'rn-all');
    await flush();
    assert.deepStrictEqual(writes, [
        { type: 'command', param: 'renamedevice', idx: '40', name: 'Kelder 1' },
        { type: 'command', param: 'renamedevice', idx: '41', name: 'Kelder links' }
    ]);
    assert.deepStrictEqual(toggles[toggles.length - 1], ['doctor-sub', false], 'popup closed after success');
    assert.strictEqual(fixtures.used.filter(function (d) { return d.idx === '40'; })[0].Name, 'Kelder 1', 'row updated');
    assert.ok(/Renamed 2 devices/.test(captured.querySelector('.ng-doc-bar-slot').innerHTML));
    writes.length = 0;
    act(captured, 'undo');
    await flush();
    assert.deepStrictEqual(writes, [
        { type: 'command', param: 'renamedevice', idx: '41', name: 'Kelder' },
        { type: 'command', param: 'renamedevice', idx: '40', name: 'Kelder' }
    ], 'undo renames back');
    writes.length = 0;

    /* escape of a hostile name inside the popup */
    act(captured, 'rename', { 'data-id': 'dupNames', 'data-idx': '50' });
    assert.ok(sub(captured).indexOf('<img') < 0 && sub(captured).indexOf('&lt;img') >= 0, 'popup escapes names');
    act(captured, 'sub-close');

    /* ESC closes only the popup */
    act(captured, 'rename', { 'data-id': 'dupNames', 'data-idx': '40' });
    var before = toggles.length;
    documentKeydown({ key: 'Escape', preventDefault: function () {}, stopPropagation: function () {} });
    assert.deepStrictEqual(toggles.slice(before), [['doctor-sub', false]], 'ESC closed only the mini dialog');

    /* ── Families: fix numbering through the same popup ────────────── */
    act(captured, 'fam-num', { 'data-n': '0' });
    assert.ok(/value="Woonkamer Lamp 1"/.test(sub(captured)) && /value="Woonkamer Lamp 3"/.test(sub(captured)), 'normalised names prefilled');
    act(captured, 'rn-all');
    await flush();
    assert.deepStrictEqual(writes, [
        { type: 'command', param: 'renamedevice', idx: '20', name: 'Woonkamer Lamp 1' },
        { type: 'command', param: 'renamedevice', idx: '22', name: 'Woonkamer Lamp 3' }
    ]);
    writes.length = 0;
    assert.ok(!/data-act="fam-num"/.test(main(captured)), 'numbering fixed: only the group suggestion is left');

    /* ── Create group: preview, name check, exact call sequence, undo ─ */
    act(captured, 'fam-group', { 'data-n': '0' });
    assert.ok(/value="Woonkamer Lamp"/.test(sub(captured)), 'default name is the family base');
    typeInto(captured, 'gp-name', { value: 'group LAMPEN' });
    act(captured, 'gp-go');
    await flush();
    assert.strictEqual(writes.length, 0, 'a taken name is caught before any write');
    assert.ok(/already exists/.test(captured.querySelector('[data-gp-err]').textContent), 'error shown live');
    typeInto(captured, 'gp-name', { value: 'Woonkamer Lamp' });
    change(captured, 'gp-mem', { 'data-idx': '21', checked: false });
    change(captured, 'gp-mem', { 'data-idx': '21', checked: true });
    act(captured, 'gp-go');
    await flush();
    assert.deepStrictEqual(writes, [
        { type: 'command', param: 'addscene', name: 'Woonkamer Lamp', scenetype: 1 },
        { type: 'command', param: 'addscenedevice', idx: '9', devidx: '20', isscene: 'false' },
        { type: 'command', param: 'addscenedevice', idx: '9', devidx: '21', isscene: 'false' },
        { type: 'command', param: 'addscenedevice', idx: '9', devidx: '22', isscene: 'false' }
    ]);
    assert.ok(!/data-act="fam-group"/.test(main(captured)), 'family is covered now');
    writes.length = 0;
    act(captured, 'undo');
    await flush();
    assert.deepStrictEqual(writes, [{ type: 'command', param: 'deletescene', idx: '9' }], 'undo deletes only the new group');
    assert.ok(fixtures.scenes.some(function (x) { return x.idx === '5'; }), 'existing group untouched');
    assert.ok(/data-act="fam-group"/.test(main(captured)), 'suggestion is back after undo');
    writes.length = 0;

    /* a failing member add stops the batch and reports what exists */
    mut.addDevCount = 0; mut.failAddDev = 2;
    act(captured, 'fam-group', { 'data-n': '0' });
    act(captured, 'gp-go');
    await flush();
    assert.deepStrictEqual(writes.map(function (w) { return w.param + (w.devidx ? ':' + w.devidx : ''); }),
        ['addscene', 'addscenedevice:20', 'addscenedevice:21'], 'stopped at the failure, no third add');
    assert.ok(/Stopped after 1 of 3/.test(sub(captured)) && /Created group/.test(sub(captured)), 'reports exactly what was created');
    writes.length = 0;
    act(captured, 'undo');
    await flush();
    assert.deepStrictEqual(writes, [{ type: 'command', param: 'deletescene', idx: '10' }]);
    writes.length = 0;
    mut.failAddDev = 0;

    /* ── Rooms: suggested default, confirm step, calls, undo ───────── */
    html = main(captured);
    assert.ok(/data-act="room-pick"/.test(html) && /data-act="room-chk"/.test(html), 'per-device picker and checkbox');
    act(captured, 'room-sug');
    assert.strictEqual(writes.length, 0, 'confirm step writes nothing');
    assert.ok(/Hal lamp \u2192 Hal/.test(main(captured)) && /Living room spot \u2192 Living/.test(main(captured)), 'confirm lists device to room');
    assert.ok(!/Garage plug \u2192/.test(main(captured)), 'no name match, not in the suggested set');
    act(captured, 'rm-cancel');
    act(captured, 'room-sug');
    act(captured, 'room-go');
    await flush();
    assert.deepStrictEqual(writes, [
        { type: 'command', param: 'addplanactivedevice', idx: '2', activetype: 0, activeidx: '30' },
        { type: 'command', param: 'addplanactivedevice', idx: '1', activetype: 0, activeidx: '31' }
    ]);
    writes.length = 0;
    fetchCalls.length = 0;
    act(captured, 'undo');
    await flush();
    assert.ok(fetchCalls.some(function (c) { return /getplandevices&idx=1/.test(c.url); }), 'undo looks the mapping up first');
    assert.deepStrictEqual(writes, [
        { type: 'command', param: 'deleteplandevice', idx: '78' },
        { type: 'command', param: 'deleteplandevice', idx: '77' }
    ], 'undo deletes the mapping rows it created');
    writes.length = 0;

    /* bulk: selected devices to one chosen room */
    change(captured, 'room-chk', { 'data-idx': '32', checked: true });
    act(captured, 'room-sel');
    assert.strictEqual(writes.length, 0);
    change(captured, 'room-bulk', { value: '1' });
    act(captured, 'room-sel');
    act(captured, 'room-go');
    await flush();
    assert.deepStrictEqual(writes, [{ type: 'command', param: 'addplanactivedevice', idx: '1', activetype: 0, activeidx: '32' }]);
    writes.length = 0;

    /* 401/403 stops the batch, hides the write buttons */
    mut.deny = true;
    act(captured, 'room-sug');
    act(captured, 'room-go');
    await flush();
    assert.strictEqual(writes.length, 1, 'batch stopped at the first refusal');
    assert.ok(/needs an admin account/.test(main(captured)), 'says an admin account is needed');
    assert.ok(!/data-act="room-one"/.test(main(captured)) && !/data-act="rename"/.test(main(captured)), 'write buttons hidden');
    mut.deny = false;
    writes.length = 0;

    assert.strictEqual(setCalls.filter(function (c) { return c[0] !== 'deviceIconOverrides'; }).length, 0, 'none of the new actions wrote a theme setting');
    assert.strictEqual(fetchCalls.every(function (c) { return !c.opts.method || c.opts.method === 'GET'; }), true, 'direct fetches stayed GET');

    D._browser.close();
    assert.deepStrictEqual(toggles[toggles.length - 1], ['doctor', false]);
    console.log('doctor tests passed');
}()).catch(function (e) { console.error(e); process.exit(1); });
