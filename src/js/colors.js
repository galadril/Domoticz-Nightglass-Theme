/*
 *  Nightglass — shared colour kit
 *
 *  Every colour picker in the theme (the bar-range dialog, the device
 *  RGB/RGBW popup, the settings panel, the per-device icon override
 *  editor) feeds one "recently used" list, so a colour tuned on one
 *  device is a single click away on the next instead of a hex string to
 *  copy across.
 *
 *  The list is per browser (localStorage) rather than a Domoticz user
 *  variable: it changes on nearly every drag, and it is a convenience
 *  rather than a setting worth syncing.
 *
 *  window.ngColors
 *      .normalize(v)   → '#rrggbb' | null   (accepts #abc, ABC, #AABBCC)
 *      .recent()       → array, newest first, at most MAX entries
 *      .remember(hex)  → record a colour the user actually committed to
 *      .onChange(fn)   → subscribe; returns an unsubscribe function
 *      .buildRow(opts) → a ready-made, self-updating swatch strip
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'ng-recent-colors';
    var MAX = 5;

    var _listeners = [];

    function normalize(v) {
        if (typeof v !== 'string') return null;
        var hex = v.trim().replace(/^#/, '');
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
        return '#' + hex.toLowerCase();
    }

    function load() {
        var raw = null;
        try { raw = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) {}
        if (!Array.isArray(raw)) return [];
        var out = [];
        raw.forEach(function (c) {
            var hex = normalize(c);
            if (hex && out.indexOf(hex) === -1) out.push(hex);
        });
        return out.slice(0, MAX);
    }

    var _list = load();

    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_list)); } catch (e) {}
    }

    /* Fan out to subscribers, dropping those whose row has been torn down
       with the dialog that owned it.  `seen` guards rows that were built
       detached and are appended a moment later. */
    function notify() {
        var snapshot = _list.slice();
        _listeners = _listeners.filter(function (l) {
            if (l.el) {
                var attached = document.contains(l.el);
                if (l.seen && !attached) return false;
                if (attached) l.seen = true;
            }
            try { l.fn(snapshot); } catch (e) {}
            return true;
        });
    }

    function remember(color) {
        var hex = normalize(color);
        if (!hex) return;
        var at = _list.indexOf(hex);
        if (at === 0) return;               /* already the newest — nothing moved */
        if (at !== -1) _list.splice(at, 1);
        _list.unshift(hex);
        _list = _list.slice(0, MAX);
        save();
        notify();
    }

    function onChange(fn, el) {
        var entry = { fn: fn, el: el || null, seen: false };
        _listeners.push(entry);
        return function off() {
            var i = _listeners.indexOf(entry);
            if (i !== -1) _listeners.splice(i, 1);
        };
    }

    /* A label plus up to MAX swatch buttons, re-rendering itself whenever
       the list changes so several pickers can be open at once.
         opts.onPick(hex)  — required to be useful; fired on click
         opts.label        — heading text, default "Recent"
         opts.emptyText    — placeholder while nothing has been picked yet
         opts.className    — extra class for context-specific spacing      */
    function buildRow(opts) {
        opts = opts || {};

        var row = document.createElement('div');
        row.className = 'ng-recent' + (opts.className ? ' ' + opts.className : '');

        var label = document.createElement('span');
        label.className = 'ng-recent-label';
        label.textContent = opts.label || 'Recent';
        row.appendChild(label);

        var strip = document.createElement('div');
        strip.className = 'ng-recent-swatches';
        row.appendChild(strip);

        function render(list) {
            strip.textContent = '';
            row.classList.toggle('ng-recent--empty', !list.length);
            if (!list.length) {
                var empty = document.createElement('span');
                empty.className = 'ng-recent-empty';
                empty.textContent = opts.emptyText || 'Colours you pick show up here';
                strip.appendChild(empty);
                return;
            }
            list.forEach(function (hex) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'ng-recent-swatch';
                btn.style.background = hex;
                btn.title = hex;
                btn.setAttribute('data-color', hex);
                btn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (opts.onPick) opts.onPick(hex);
                });
                strip.appendChild(btn);
            });
        }

        render(_list.slice());
        onChange(render, row);
        return row;
    }

    window.ngColors = {
        MAX: MAX,
        normalize: normalize,
        recent: function () { return _list.slice(); },
        remember: remember,
        onChange: onChange,
        buildRow: buildRow
    };
}());
