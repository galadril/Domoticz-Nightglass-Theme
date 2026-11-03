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
var fixtures = {
    used: [
        { idx: '7', Name: 'Kept', Type: 'Light/Switch', SwitchType: 'On/Off', Image: '', Icon: '', CustomImage: 0, HardwareName: 'HW', PlanIDs: [1], LastUpdate: '2099-01-01 00:00:00' },
        { idx: '8', Name: 'Bare switch', Type: 'Light/Switch', SwitchType: 'On/Off', Image: '', Icon: '', CustomImage: 0, HardwareName: 'HW', PlanIDs: [1], LastUpdate: '2099-01-01 00:00:00' }
    ],
    unused: [{ idx: '12', Name: 'Spare', HardwareName: 'HW' }],
    schedules: [], plans: [{ idx: 1, Name: 'Living' }]
};

var el = function () {
    var e = { innerHTML: '', textContent: '', disabled: false, scrollTop: 0, listeners: {}, className: '', id: '',
        classList: { add: function () {}, remove: function () {} },
        setAttribute: function () {}, getAttribute: function () { return null; },
        addEventListener: function (t, f) { e.listeners[t] = f; },
        querySelector: function () { return stubChild; }, querySelectorAll: function () { return []; },
        contains: function () { return true; }, focus: function () {}, parentNode: null };
    return e;
};
var stubChild = el();
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
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ status: 'OK', result: r }); } });
};

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

/* ── Browser: a run is read-only ───────────────────────────────── */
function act(overlay, name, attrs) {
    var target = { closest: function () { return { getAttribute: function (a) { return a === 'data-act' ? name : (attrs || {})[a] || null; } }; } };
    overlay.listeners.click({ target: target });
}

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

    D._browser.close();
    assert.deepStrictEqual(toggles[toggles.length - 1], ['doctor', false]);
    console.log('doctor tests passed');
}()).catch(function (e) { console.error(e); process.exit(1); });
