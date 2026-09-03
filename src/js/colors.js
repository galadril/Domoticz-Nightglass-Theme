/*
 *  Nightglass — shared colour kit
 *
 *  Every colour picker in the theme (the bar-range dialog, the device
 *  RGB/RGBW popup, the settings panel, the per-device icon override
 *  editor) feeds one "recently used" list, so a colour tuned on one
 *  device is a single click away on the next instead of a hex string to
 *  copy across.
 *
 *  Whites keep a list of their own rather than sharing that one. A colour
 *  temperature is not a hue: it drives a different control (the warmth
 *  bar), it is typed in kelvin rather than hex, and neither can stand in
 *  for the other — a green swatch on the White tab, or 3200 K where a hex
 *  belongs, is a question with no sensible answer. So there are two
 *  stores of the same shape, each shown only beside the control it can
 *  actually drive, and a session spent tuning whites never pushes the
 *  colours out of the other strip.
 *
 *  The lists are per browser (localStorage) rather than Domoticz user
 *  variables: they change on nearly every drag, and they are a
 *  convenience rather than a setting worth syncing.
 *
 *  window.ngColors                       window.ngKelvins
 *    .normalize(v) '#rrggbb' | null        .normalize(v) 2700…6500 | null
 *    .recent()     newest first, ≤ MAX     .recent()
 *    .remember(v)  record a commit         .remember(v)
 *    .onChange(fn) → unsubscribe fn        .onChange(fn)
 *    .buildRow(o)  self-updating strip     .buildRow(o)
 *                                          .K_MIN / .K_MAX  kelvin span
 *                                          .tint(k)  CSS colour for k
 */
(function () {
    'use strict';

    var MAX = 5;

    /* ── One recently-used list ──────────────────────────────────────
       Instantiated twice below. The two are independent down to their
       storage key and their subscriber list, so a white picked in one
       dialog never repaints a colour strip open beside it.

         opts.key         localStorage key
         opts.normalize   value → canonical value | null
         opts.paint       (button, value) → dress one swatch
         opts.rowClass    variant class for the whole strip
         opts.label       default heading
         opts.emptyText   default placeholder
       ─────────────────────────────────────────────────────────────── */
    function makeStore(opts) {
        var normalize = opts.normalize;
        var _listeners = [];

        function load() {
            var raw = null;
            try { raw = JSON.parse(localStorage.getItem(opts.key)); } catch (e) {}
            if (!Array.isArray(raw)) return [];
            var out = [];
            raw.forEach(function (c) {
                var v = normalize(c);
                if (v !== null && out.indexOf(v) === -1) out.push(v);
            });
            return out.slice(0, MAX);
        }

        var _list = load();

        function save() {
            try { localStorage.setItem(opts.key, JSON.stringify(_list)); } catch (e) {}
        }

        /* Fan out to subscribers, dropping those whose row has been torn
           down with the dialog that owned it.  `seen` guards rows that
           were built detached and are appended a moment later. */
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

        function remember(value) {
            var v = normalize(value);
            if (v === null) return;
            var at = _list.indexOf(v);
            if (at === 0) return;           /* already the newest — nothing moved */
            if (at !== -1) _list.splice(at, 1);
            _list.unshift(v);
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

        /* A label plus up to MAX swatch buttons, re-rendering itself
           whenever the list changes so several pickers can be open at
           once.
             o.onPick(value)  — required to be useful; fired on click
             o.label          — heading text, defaults per store
             o.emptyText      — placeholder while nothing is stored yet
             o.className      — extra class for context-specific spacing */
        function buildRow(o) {
            o = o || {};

            var row = document.createElement('div');
            row.className = 'ng-recent' +
                (opts.rowClass ? ' ' + opts.rowClass : '') +
                (o.className ? ' ' + o.className : '');

            var label = document.createElement('span');
            label.className = 'ng-recent-label';
            label.textContent = o.label || opts.label || 'Recent';
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
                    empty.textContent = o.emptyText || opts.emptyText ||
                                        'Colours you pick show up here';
                    strip.appendChild(empty);
                    return;
                }
                list.forEach(function (value) {
                    var btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'ng-recent-swatch';
                    opts.paint(btn, value);
                    btn.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (o.onPick) o.onPick(value);
                    });
                    strip.appendChild(btn);
                });
            }

            render(_list.slice());
            onChange(render, row);
            return row;
        }

        return {
            MAX: MAX,
            normalize: normalize,
            recent: function () { return _list.slice(); },
            remember: remember,
            onChange: onChange,
            buildRow: buildRow
        };
    }

    /* ── Hex colours ─────────────────────────────────────────────── */

    function normalizeHex(v) {
        if (typeof v !== 'string') return null;
        var hex = v.trim().replace(/^#/, '');
        if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
        return '#' + hex.toLowerCase();
    }

    window.ngColors = makeStore({
        key: 'ng-recent-colors',
        normalize: normalizeHex,
        emptyText: 'Colours you pick show up here',
        paint: function (btn, hex) {
            btn.style.background = hex;
            btn.title = hex;
            btn.setAttribute('data-color', hex);
        }
    });

    /* ── Colour temperatures ─────────────────────────────────────────
       The same nominal span both pickers map onto Domoticz's unitless
       0…255 warmth axis. Kept here so the two lists agree on what
       counts as a white, whichever picker recorded it. */
    var K_MIN = 2700;   /* warm end */
    var K_MAX = 6500;   /* cool end */

    /* Accepts 3200, "3200", "3200K", "3200 k". Rounded to 10 K to match
       what the pickers show: one step of the 256-step warmth axis is
       ~15 K, so a value dragged to and the same value typed have to land
       on one entry instead of stacking up as near-duplicates. */
    function normalizeKelvin(v) {
        var m = /^\s*(\d{3,5})\s*k?\s*$/i.exec(String(v == null ? '' : v));
        if (!m) return null;
        var k = Math.round(parseInt(m[1], 10) / 10) * 10;
        return (k < K_MIN || k > K_MAX) ? null : k;
    }

    /* The two-stop ramp the warmth cursor and the preview swatch already
       use, so a remembered white reads as the light it will give. */
    function tint(k) {
        var w = Math.max(0, Math.min(1, (K_MAX - k) / (K_MAX - K_MIN)));
        return 'rgb(' + Math.round(232 + (255 - 232) * w) + ',' +
                        Math.round(244 + (179 - 244) * w) + ',' +
                        Math.round(253 + ( 71 - 253) * w) + ')';
    }

    window.ngKelvins = makeStore({
        key: 'ng-recent-kelvins',
        normalize: normalizeKelvin,
        rowClass: 'ng-recent--kelvin',
        label: 'Recent whites',
        emptyText: 'Whites you pick show up here',
        /* The number is the whole point — these exist so an exact white
           can be returned to, not merely recognised — so the swatch
           carries it and the tint is the background it sits on. */
        paint: function (btn, k) {
            btn.style.background = tint(k);
            btn.textContent = String(k);
            btn.title = k + ' K';
            btn.setAttribute('data-kelvin', String(k));
        }
    });

    window.ngKelvins.K_MIN = K_MIN;
    window.ngKelvins.K_MAX = K_MAX;
    window.ngKelvins.tint = tint;
}());
