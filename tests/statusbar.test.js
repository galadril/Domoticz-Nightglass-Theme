/* Status bar tests: node tests/statusbar.test.js
   Runs src/js/statusbar.js against a tiny stubbed window/document/fetch/angular
   to prove the clickable pills: attributes only once the idx is known, one
   delegated handler, verified route, keyboard, hash fallback, lights pill inert. */
'use strict';
var assert = require('assert');
var fs = require('fs');
var path = require('path');

/* ── Minimal DOM ───────────────────────────────────────────────── */
var registry = {}, listeners = {}, timers = [];
function makeEl(id, cls) {
    var attrs = {}, classes = (cls || '').split(/\s+/).filter(Boolean);
    var el = {
        id: id, title: '', hidden: false, style: {}, parent: null, children: [],
        classList: {
            add: function (c) { if (classes.indexOf(c) < 0) classes.push(c); },
            remove: function (c) { classes = classes.filter(function (x) { return x !== c; }); },
            contains: function (c) { return classes.indexOf(c) >= 0; },
            toggle: function (c, on) { if (on === undefined) on = classes.indexOf(c) < 0; on ? this.add(c) : this.remove(c); return on; }
        },
        setAttribute: function (k, v) { attrs[k] = String(v); },
        getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
        removeAttribute: function (k) { delete attrs[k]; },
        hasAttribute: function (k) { return k in attrs; },
        querySelector: function (sel) { return { textContent: '', className: '', style: {} }; },
        closest: function (sel) {
            for (var n = this; n; n = n.parent) {
                if (sel.charAt(0) === '.' && n.classList.contains(sel.slice(1))) return n;
                if (sel.charAt(0) === '#' && n.id === sel.slice(1)) return n;
            }
            return null;
        },
        addEventListener: function () {}, appendChild: function () {}, remove: function () {},
        click: function () { dispatch('click', { target: this }); },
        offsetWidth: 0
    };
    var html = '';
    Object.defineProperty(el, 'innerHTML', {
        get: function () { return html; },
        set: function (h) {
            html = h;
            h.replace(/<(?:div|button)\b([^>]*)>/g, function (m, a) {
                var i = /\bid="([^"]+)"/.exec(a);
                if (!i) return m;
                var c = /\bclass="([^"]*)"/.exec(a);
                var child = makeEl(i[1], c ? c[1] : '');
                child.parent = el;
                var t = /\btitle="([^"]*)"/.exec(a);
                if (t) child.title = t[1];
                if (/\bhidden\b/.test(a)) child.hidden = true;
                registry[i[1]] = child;
                return m;
            });
        }
    });
    return el;
}
function dispatch(type, ev) {
    ev.preventDefault = function () { ev.prevented = true; };
    (listeners[type] || []).forEach(function (fn) { fn(ev); });
    return ev;
}

var fetchCalls = [], devices = {}, es = {}, hashWrites = [];
global.document = {
    readyState: 'complete', hidden: false,
    body: { classList: { add: function () {}, remove: function () {} }, appendChild: function () {} },
    addEventListener: function (t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
    getElementById: function (id) { return registry[id] || null; },
    createElement: function () { return makeEl('', ''); }
};
var loc = { _h: '' };
Object.defineProperty(loc, 'hash', { get: function () { return loc._h; }, set: function (v) { loc._h = v; hashWrites.push(v); } });
global.window = { location: loc };
global.localStorage = { getItem: function () { return '0'; }, setItem: function () {} };
global.setTimeout = function (fn) { timers.push(fn); return 0; };
global.setInterval = function () { return 0; };
global.clearTimeout = function () {};
global.fetch = function (url) {
    fetchCalls.push(url);
    var body = { status: 'OK', result: [] };
    if (/getenergydashboarddevices/.test(url)) body = { status: 'OK', result: { ESettings: es } };
    else if (/rid=(\d+)/.test(url)) { var d = devices[/rid=(\d+)/.exec(url)[1]]; body = { status: 'OK', result: d ? [d] : [] }; }
    return Promise.resolve({ ok: true, json: function () { return Promise.resolve(body); } });
};
function flush() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }

var paths = [];
function installAngular() {
    global.angular = { element: function () { return { injector: function () { return { get: function (n) {
        if (n === '$location') return { path: function (p) { paths.push(p); } };
        if (n === '$rootScope') return { $apply: function (f) { f(); } };
    } }; } }; } };
    window.angular = global.angular;
}
function removeAngular() { delete global.angular; delete window.angular; }

es = { idP1: 11, idSolar: 12, idBatterySoc: -1, idBatteryWatt: 13, idGas: 14, idWater: 15, idOutsideTempSensor: 16 };
devices = {
    11: { idx: '11', Usage: '500 Watt', UsageDeliv: '0 Watt' },
    12: { idx: '12', Usage: '1200 Watt' },
    13: { idx: '13', Usage: '300 Watt' },
    14: { idx: '14', CounterToday: '1.2 m3' },
    15: { idx: '15', CounterToday: '0.2 m3' },
    16: { idx: '16', Temp: 12.3 }
};

var SLOTS = { power: 11, solar: 12, battery: 13, gas: 14, water: 15, temp: 16 };
function pill(id) { return registry['ng-sb-' + id]; }
function interactive(el) {
    return el.getAttribute('role') === 'button' && el.getAttribute('tabindex') === '0' &&
           !!el.getAttribute('data-idx') && /^Open log: /.test(el.getAttribute('aria-label')) && el.classList.contains('ng-sb-slot--link');
}

(async function () {
    var src = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'statusbar.js'), 'utf8');
    installAngular();
    new Function(src)();
    /* Before the energy data arrives nothing is clickable */
    Object.keys(SLOTS).forEach(function (id) { assert.ok(!interactive(pill(id)), id + ' inert before data'); });
    await flush();

    /* 1. interactive only with a known idx; lights never */
    Object.keys(SLOTS).forEach(function (id) {
        assert.ok(interactive(pill(id)), id + ' interactive');
        assert.strictEqual(pill(id).getAttribute('data-idx'), String(SLOTS[id]), id + ' idx');
    });
    assert.ok(/Open log: Solar/.test(pill('solar').title));
    var lights = pill('lights');
    assert.ok(!interactive(lights) && lights.getAttribute('role') === null && lights.getAttribute('tabindex') === null &&
              !lights.classList.contains('ng-sb-slot--link'), 'lights pill untouched');

    /* 2. one delegated click handler per event type, verified route, every pill */
    Object.keys(SLOTS).forEach(function (id) {
        paths.length = 0;
        pill(id).click();
        assert.deepStrictEqual(paths, ['/Devices/' + SLOTS[id] + '/Log'], id + ' route');
    });
    paths.length = 0; lights.click();
    assert.deepStrictEqual(paths, [], 'lights click navigates nowhere');
    assert.strictEqual(hashWrites.length, 0);

    /* 3. keyboard */
    ['Enter', ' '].forEach(function (k) {
        paths.length = 0;
        var ev = dispatch('keydown', { key: k, target: pill('gas') });
        assert.deepStrictEqual(paths, ['/Devices/14/Log'], k + ' activates');
        assert.ok(ev.prevented, k + ' default prevented');
    });
    paths.length = 0;
    dispatch('keydown', { key: 'a', target: pill('gas') });
    dispatch('keydown', { key: 'Enter', target: lights });
    assert.deepStrictEqual(paths, [], 'other keys and lights ignored');

    /* 4. battery: SoC device preferred over the watt device */
    es.idBatterySoc = 17; devices[17] = { idx: '17', Data: '80%' };
    window.ngStatusBarUpdate({ idx: '13' });
    timers.pop()();
    await flush();
    assert.strictEqual(pill('battery').getAttribute('data-idx'), '17', 'battery prefers SoC idx');

    /* 5. data goes missing -> interactivity removed, original title restored */
    delete devices[14];
    window.ngStatusBarUpdate({ idx: '11' });
    timers.pop()();
    await flush();
    assert.ok(!interactive(pill('gas')) && pill('gas').getAttribute('role') === null && pill('gas').getAttribute('data-idx') === null, 'gas inert again');
    assert.strictEqual(pill('gas').title, 'Gas today');
    paths.length = 0; pill('gas').click();
    assert.deepStrictEqual(paths, [], 'removed pill no longer navigates');

    /* 6. no angular -> location.hash fallback */
    removeAngular();
    hashWrites.length = 0;
    pill('power').click();
    assert.deepStrictEqual(hashWrites, ['/Devices/11/Log'], 'hash fallback');

    /* 7. temp pill without an outside sensor (legacy guess) stays inert */
    installAngular();
    es.idOutsideTempSensor = 0;
    window.ngStatusBarUpdate({ idx: '11' });
    timers.pop()();
    await flush();
    assert.ok(!interactive(pill('temp')), 'legacy temp pill inert');

    /* 8. only read calls were made */
    assert.strictEqual(fetchCalls.every(function (u) { return /^json\.htm\?type=command&param=get/.test(u); }), true, 'only read calls');
    console.log('statusbar tests passed');
}()).catch(function (e) { console.error(e); process.exit(1); });
