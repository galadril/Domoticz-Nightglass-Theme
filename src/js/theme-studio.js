/*  ═══════════════════════════════════════════════════════════════
    Theme Assistant — guided palette maker, contrast checker, undo bar.

    Opens as a dialog (NGStudio.open) from the settings panel header.
    Nothing is written until Apply.  Works only on the 18 colour settings (COLOR_SNAPSHOT_KEYS in
    search.js) through dzNightglassSettings.set(), so presets, export
    and import keep working unchanged.  Everything is local/offline.

    Pure maths (OKLCH, WCAG, generatePalette, fixContrast) has no DOM
    access and is exposed on window.NGStudio for testing.
    ═══════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var G = typeof window !== 'undefined' ? window : globalThis;

    /* ── Colour maths ─────────────────────────────────────────── */

    function normHex(h) {
        if (typeof h !== 'string') return null;
        h = h.trim().replace(/^#/, '');
        if (/^[0-9a-f]{3}$/i.test(h)) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        return /^[0-9a-f]{6}$/i.test(h) ? '#' + h.toLowerCase() : null;
    }
    function toLin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
    function fromLin(x) {
        x = Math.max(0, Math.min(1, x));
        return Math.round((x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055) * 255);
    }
    function hexToLin(hex) {
        var h = normHex(hex) || '#000000';
        return [1, 3, 5].map(function (i) { return toLin(parseInt(h.substr(i, 2), 16)); });
    }
    function linToHex(lin) {
        return '#' + lin.map(function (v) { var s = fromLin(v).toString(16); return s.length < 2 ? '0' + s : s; }).join('');
    }
    function hexToOklch(hex) {
        var c = hexToLin(hex);
        var l = Math.cbrt(0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2]);
        var m = Math.cbrt(0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2]);
        var s = Math.cbrt(0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2]);
        var L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
        var a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
        var b = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
        var h = Math.atan2(b, a) * 180 / Math.PI;
        return { L: L, C: Math.sqrt(a * a + b * b), h: h < 0 ? h + 360 : h };
    }
    function oklchToLin(L, C, h) {
        var hr = h * Math.PI / 180, a = C * Math.cos(hr), b = C * Math.sin(hr);
        var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
        var m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
        var s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
        return [
            4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
        ];
    }
    function inGamut(lin) {
        return lin.every(function (v) { return v >= -0.0005 && v <= 1.0005; });
    }
    /* Out-of-gamut colours lose chroma (binary search), never lightness/hue. */
    function oklchToHex(L, C, h) {
        L = Math.max(0, Math.min(1, L));
        C = Math.max(0, C);
        var lin = oklchToLin(L, C, h);
        if (!inGamut(lin)) {
            var lo = 0, hi = C;
            for (var i = 0; i < 24; i++) {
                var mid = (lo + hi) / 2;
                if (inGamut(oklchToLin(L, mid, h))) lo = mid; else hi = mid;
            }
            lin = oklchToLin(L, lo, h);
        }
        return linToHex(lin);
    }
    function lum(hex) {
        var c = hexToLin(hex);
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    function ratio(a, b) {
        var x = lum(a), y = lum(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }

    /* Step L by 0.01 until ok(hex) holds (max 60 steps), keeping hue and chroma. */
    function stepL(hex, dir, ok) {
        var lch = hexToOklch(hex), cur = hex;
        if (ok(cur)) return { hex: cur, ok: true, steps: 0 };
        for (var i = 1; i <= 60; i++) {
            var L = lch.L + dir * 0.01 * i;
            if (L < 0 || L > 1) break;
            cur = oklchToHex(L, lch.C, lch.h);
            if (ok(cur)) return { hex: cur, ok: true, steps: i };
        }
        return { hex: cur, ok: false, steps: 60 };
    }
    function fixContrast(fg, bg, target) {
        var dir = hexToOklch(fg).L >= hexToOklch(bg).L ? 1 : -1;
        return stepL(fg, dir, function (c) { return ratio(c, bg) >= target; });
    }

    /* Accent must clear 4.5:1 on the surface AND carry white button text at
       3:1.  On dark surfaces that is a narrow lightness window, so search
       outward from the current lightness (then with less chroma). */
    function accentOk(c, surface) { return ratio(c, surface) >= 4.5 && ratio(c, '#ffffff') >= 3; }
    function fitAccent(hex, surface) {
        var lch = hexToOklch(hex), scales = [1, 0.75, 0.5];
        for (var s = 0; s < scales.length; s++) {
            for (var i = 0; i <= 60; i++) {
                for (var sg = 0; sg < (i === 0 ? 1 : 2); sg++) {
                    var L = lch.L + (sg ? -1 : 1) * 0.01 * i;
                    if (L < 0.2 || L > 0.95) continue;
                    var c = oklchToHex(L, lch.C * scales[s], lch.h);
                    if (accentOk(c, surface)) return { hex: c, ok: true };
                }
            }
        }
        var f = fixContrast(hex, surface, 4.5);
        return { hex: f.hex, ok: false };
    }

    /* ── Checker rows ─────────────────────────────────────────── */

    function kit() { return G.dzNightglassSettings && G.dzNightglassSettings.colorKit; }

    /* One row per tested pair.  fg/bg take a palette (18-key object). */
    function buildRows(pal) {
        var tiers = kit().textTiers, out = [];
        [false, true].forEach(function (isLight) {
            var S = isLight ? 'Light' : '', mode = isLight ? 'light' : 'dark';
            var K = function (n) { return n + S; };
            var surf = function (p) { return p[K('surfaceColor')]; };
            var add = function (id, label, thr, key, kind, fg, bg) {
                var r = { id: mode + ':' + id, mode: mode, label: label, thr: thr, key: key, kind: kind, fg: fg, bg: bg, isLight: isLight };
                r.fgHex = fg(pal); r.bgHex = bg(pal);
                r.ratio = ratio(r.fgHex, r.bgHex);
                r.pass = r.ratio >= thr - 1e-9;
                out.push(r);
            };
            [['surfaceColor', 'Surface'], ['bgColor', 'Cards'], ['pageBgColor', 'Page']].forEach(function (b) {
                [['text', 'Text', 4.5, function (t) { return t; }],
                 ['soft', 'Soft text', 4.5, function (t) { return tiers(t, isLight).soft; }],
                 ['muted', 'Muted text', 3.0, function (t) { return tiers(t, isLight).muted; }]
                ].forEach(function (t) {
                    add(t[0] + '-' + b[0], t[1] + ' on ' + b[1].toLowerCase(), t[2], K('textColor'), 'text',
                        function (p) { return t[3](p[K('textColor')]); },
                        function (p) { return p[K(b[0])]; });
                });
            });
            add('accent', 'Accent on surface', 4.5, K('accentColor'), 'accent',
                function (p) { return p[K('accentColor')]; }, surf);
            add('btn', 'White button text on accent', 3.0, K('accentColor'), 'accent',
                function () { return '#ffffff'; }, function (p) { return p[K('accentColor')]; });
            [['danger', 'Danger'], ['warning', 'Warning'], ['success', 'Success']].forEach(function (sm) {
                add(sm[0], sm[1] + ' on surface', 3.0, K(sm[0] + 'Color'), 'sem',
                    function (p) { return p[K(sm[0] + 'Color')]; }, surf);
            });
        });
        return out;
    }

    function clonePal(p) { var o = {}; for (var k in p) o[k] = p[k]; return o; }

    /* Fix one row: returns { key, from, to, ok }.  Only edits the row's key. */
    function fixRow(pal, row) {
        var from = pal[row.key], res;
        if (row.kind === 'accent') {
            res = fitAccent(from, pal[row.isLight ? 'surfaceColorLight' : 'surfaceColor']);
        } else {
            var bgL = hexToOklch(row.bgHex).L;
            var dir = hexToOklch(from).L >= bgL ? 1 : -1;
            res = stepL(from, dir, function (c) {
                var p = clonePal(pal); p[row.key] = c;
                return ratio(row.fg(p), row.bg(p)) >= row.thr - 1e-9;
            });
        }
        return { key: row.key, from: from, to: res.hex, ok: res.ok };
    }

    /* Fix every failing row (a few passes: edits interact).  Pure. */
    function fixAll(pal) {
        var p = clonePal(pal), changes = {}, i;
        for (var pass = 0; pass < 4; pass++) {
            var failing = buildRows(p).filter(function (r) { return !r.pass; }), moved = false;
            for (i = 0; i < failing.length; i++) {
                var cur = buildRows(p).filter(function (r) { return r.id === failing[i].id; })[0];
                if (cur.pass) continue;
                var f = fixRow(p, cur);
                if (f.to !== p[f.key]) {
                    if (!changes[f.key]) changes[f.key] = { key: f.key, from: p[f.key], to: f.to };
                    changes[f.key].to = f.to;
                    p[f.key] = f.to;
                    moved = true;
                }
            }
            if (!moved) break;
        }
        var list = Object.keys(changes).map(function (k) { return changes[k]; })
            .filter(function (c) { return c.from !== c.to; });
        return { pal: p, changes: list, remaining: buildRows(p).filter(function (r) { return !r.pass; }) };
    }

    /* ── Palette generator ────────────────────────────────────── */

    var STYLES = ['balanced', 'vivid', 'muted', 'mono'];
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function hueDiff(a, b) { var d = ((b - a + 540) % 360) - 180; return d; } /* signed shortest arc a→b */

    function generatePalette(accentHex, style) {
        var acc = normHex(accentHex) || '#4e9af1';
        if (STYLES.indexOf(style) === -1) style = 'balanced';
        var a = hexToOklch(acc);
        var h0 = a.h, C0 = a.C;
        /* Near-grey input has no meaningful hue; keep neutrals neutral. */
        var cN = style === 'mono' ? 0 : clamp(C0 * 0.12, 0.005, 0.025);
        if (style === 'muted') cN = cN * 0.6;
        if (style === 'vivid') cN = Math.min(0.03, cN * 1.2);
        var accC = { balanced: Math.max(C0, 0.12), vivid: Math.max(C0 * 1.15, 0.17),
                     muted: clamp(C0 * 0.6, 0.06, 0.10), mono: Math.max(C0, 0.12) }[style];
        var semC = { balanced: [0.15, 0.14], vivid: [0.18, 0.16], muted: [0.09, 0.09], mono: [0.07, 0.07] }[style];

        var N = function (L) { return oklchToHex(L, cN, h0); };
        var pal = {
            pageBgColor: N(0.16), bgColor: N(0.20), surfaceColor: N(0.235), borderColor: N(0.32), textColor: N(0.93),
            pageBgColorLight: N(0.955), bgColorLight: N(0.99), surfaceColorLight: N(0.97), borderColorLight: N(0.86), textColorLight: N(0.20)
        };
        pal.accentColor = fitAccent(oklchToHex(clamp(a.L, 0.68, 0.78), accC, h0), pal.surfaceColor).hex;
        pal.accentColorLight = fitAccent(oklchToHex(clamp(a.L, 0.52, 0.58), accC, h0), pal.surfaceColorLight).hex;

        [['danger', 25], ['warning', 75], ['success', 150]].forEach(function (sm) {
            var h = sm[1], d = hueDiff(h, h0);
            if (Math.abs(d) >= 30) h = (h + d * 0.15 + 360) % 360;
            var dk = oklchToHex(0.68, semC[0], h), lt = oklchToHex(0.52, semC[1], h);
            pal[sm[0] + 'Color'] = fixContrast(dk, pal.surfaceColor, 3).hex;
            pal[sm[0] + 'ColorLight'] = fixContrast(lt, pal.surfaceColorLight, 3).hex;
        });
        /* Final guarantee: text tiers, anything the steps above missed. */
        return fixAll(pal).pal;
    }

    function badge(r) { return !r.pass ? 'Fail' : (r.ratio >= 7 ? 'AAA' : 'AA'); }


    /* ── Assistant dialog ─────────────────────────────────────── */

    var ST_LABEL = { balanced: 'Balanced', vivid: 'Vivid', muted: 'Muted', mono: 'Mono' };
    var ST_DESC = {
        balanced: 'Even, easy on the eyes', vivid: 'Richer, more saturated',
        muted: 'Softer, calmer colours', mono: 'Grey surfaces, accent only'
    };
    var KEY_LABEL = {
        accentColor: 'Accent', dangerColor: 'Danger', warningColor: 'Warning', successColor: 'Success',
        pageBgColor: 'Page background', bgColor: 'Navbar & cards', surfaceColor: 'Card surface',
        borderColor: 'Borders', textColor: 'Text'
    };
    /* Accents of the built-in presets (themes/*.json) plus a few extras. */
    var SUGGESTED = [
        ['#4e9af1', 'Nightglass blue'], ['#268bd2', 'Solarized blue'], ['#29b6f6', 'Ocean'], ['#4dd0e1', 'Arctic'],
        ['#88c0d0', 'Nord frost'], ['#4caf7d', 'Forest'], ['#00e676', 'Matrix green'], ['#f0a832', 'Amber'],
        ['#ffb300', 'Solar flare'], ['#e05555', 'Crimson'], ['#ff2d95', 'Neon pink'], ['#f772d0', 'Synthwave'],
        ['#e8a0b0', 'Rose gold'], ['#bd93f9', 'Dracula purple'], ['#c8a0ff', 'Violet'], ['#b0b0b0', 'Graphite'],
        ['#7c4dff', 'Indigo'], ['#26a69a', 'Teal'], ['#8bc34a', 'Lime'], ['#ff7043', 'Coral']
    ];

    var state = {
        accent: null, style: 'balanced', undo: [],
        step: 1, pal: null, applied: false, base: null, note: '',
        el: null, prevFocus: null, onKey: null, timer: null
    };

    function S() { return G.dzNightglassSettings; }
    function currentPal() {
        var p = {};
        kit().keys.forEach(function (k) { p[k] = normHex(S().get(k)) || '#000000'; });
        return p;
    }
    function esc(s) { return G.ngEsc ? G.ngEsc(String(s)) : String(s).replace(/[&<>"']/g, ''); }
    function $(id) { return document.getElementById(id); }
    function regen() { state.pal = generatePalette(state.accent, state.style); state.note = ''; }
    function failing(pal) { return buildRows(pal).filter(function (r) { return !r.pass; }); }

    /* ── Preview: scoped custom properties on the preview element only ── */

    function previewHtml(pal) {
        var tiers = kit().textTiers;
        return [false, true].map(function (isLight) {
            var K = function (n) { return pal[n + (isLight ? 'Light' : '')]; };
            var t = tiers(K('textColor'), isLight);
            var vars = '--ngta-page:' + K('pageBgColor') + ';--ngta-nav:' + K('bgColor') + ';--ngta-card:' + K('surfaceColor') +
                ';--ngta-border:' + K('borderColor') + ';--ngta-text:' + K('textColor') + ';--ngta-soft:' + t.soft +
                ';--ngta-muted:' + t.muted + ';--ngta-accent:' + K('accentColor') + ';--ngta-danger:' + K('dangerColor') +
                ';--ngta-warning:' + K('warningColor') + ';--ngta-success:' + K('successColor') + ';';
            var card = function (name, sub, on) {
                return '<div class="ng-ta-pv-card"><div class="ng-ta-pv-ico' + (on ? ' ng-ta-pv-ico--on' : '') + '"><i class="fa-solid fa-lightbulb"></i></div>' +
                    '<div class="ng-ta-pv-title">' + name + '</div><div class="ng-ta-pv-sub">' + sub + '</div></div>';
            };
            return '<div class="ng-ta-pv" style="' + vars + '" aria-hidden="true">' +
                '<div class="ng-ta-pv-label"><i class="fa-solid fa-' + (isLight ? 'sun' : 'moon') + '"></i> ' + (isLight ? 'Light' : 'Dark') + '</div>' +
                '<div class="ng-ta-pv-nav"><span class="ng-ta-pv-nav-on">Dashboard</span><span>Switches</span><span>Temp</span></div>' +
                '<div class="ng-ta-pv-cards">' + card('Living room', '21.5 &deg;C', true) + card('Hallway', 'Off', false) + '</div>' +
                '<div class="ng-ta-pv-row"><span class="ng-ta-pv-btn">Turn on</span>' +
                '<span class="ng-ta-pv-chip"><i class="ng-ta-pv-dot"></i>Online</span></div>' +
                '<div class="ng-ta-pv-slider"><span class="ng-ta-pv-fill"></span><span class="ng-ta-pv-thumb"></span></div>' +
                '</div>';
        }).join('');
    }

    /* ── Step bodies ──────────────────────────────────────────── */

    function step1Html() {
        var sw = SUGGESTED.map(function (s) {
            return '<button type="button" class="ng-ta-swatch" data-ta-accent="' + s[0] + '" style="background:' + s[0] + ';" ' +
                'title="' + esc(s[1]) + '" aria-label="' + esc(s[1] + ' ' + s[0]) + '" aria-pressed="false"></button>';
        }).join('');
        var chips = STYLES.map(function (s) {
            return '<button type="button" role="radio" class="ng-ta-chip" data-ta-style="' + s + '" aria-checked="false">' +
                '<span class="ng-ta-chip-name">' + ST_LABEL[s] + '</span><span class="ng-ta-chip-desc">' + ST_DESC[s] + '</span></button>';
        }).join('');
        return '<h3 class="ng-ta-h">Pick an accent</h3>' +
            '<p class="ng-ta-p">Choose a starting colour. The assistant builds a matching dark and light palette from it.</p>' +
            '<div class="ng-ta-swatches" role="group" aria-label="Suggested accents">' + sw + '</div>' +
            '<div class="ng-ta-custom"><label class="ng-ta-field"><span>Custom</span>' +
            '<input type="color" id="ngTaColor" value="' + state.accent + '" aria-label="Custom accent colour"></label>' +
            '<label class="ng-ta-field"><span>Hex</span>' +
            '<input type="text" id="ngTaHex" class="ng-ta-hex" value="' + state.accent + '" maxlength="7" spellcheck="false" autocomplete="off"></label></div>' +
            '<div class="ng-ta-sub">Style</div><div class="ng-ta-chips" role="radiogroup" aria-label="Palette style">' + chips + '</div>' +
            '<div class="ng-ta-sub">Live preview <small>nothing changes on the page until you apply</small></div>' +
            '<div class="ng-ta-preview" id="ngTaPreview">' + previewHtml(state.pal) + '</div>';
    }

    function rowsHtml(pal) {
        var rows = buildRows(pal), html = '';
        ['dark', 'light'].forEach(function (mode) {
            var list = rows.filter(function (r) { return r.mode === mode; });
            var bad = list.filter(function (r) { return !r.pass; }).length;
            html += '<div class="ng-ta-mode"><i class="fa-solid fa-' + (mode === 'dark' ? 'moon' : 'sun') + '"></i> ' +
                (mode === 'dark' ? 'Dark' : 'Light') + ' mode ' +
                '<span class="ng-ta-count' + (bad ? ' ng-ta-count--bad' : '') + '">' + (bad ? bad + ' failing' : 'all pass') + '</span></div>';
            list.forEach(function (r) {
                var fix = '';
                if (!r.pass) {
                    var f = fixRow(pal, r);
                    fix = f.to === f.from
                        ? '<span class="ng-ta-nofix">No automatic fix</span>'
                        : '<button type="button" class="ng-ta-fix" data-ta-fix="' + esc(r.id) + '">Fix</button>' +
                          '<span class="ng-ta-fixinfo">' + esc(KEY_LABEL[r.key.replace(/Light$/, '')] || r.key) + ' ' +
                          '<i class="ng-ta-dot" style="background:' + f.from + ';"></i>&rarr;<i class="ng-ta-dot" style="background:' + f.to + ';"></i></span>';
                }
                html += '<div class="ng-ta-row' + (r.pass ? '' : ' ng-ta-row--fail') + '">' +
                    '<span class="ng-ta-sample" style="color:' + r.fgHex + ';background:' + r.bgHex + ';">Aa</span>' +
                    '<span class="ng-ta-row-label">' + esc(r.label) + '</span>' +
                    '<span class="ng-ta-ratio">' + r.ratio.toFixed(2) + ':1 <small>min ' + r.thr.toFixed(1) + '</small></span>' +
                    '<span class="ng-ta-badge ng-ta-badge--' + badge(r).toLowerCase() + '">' + badge(r) + '</span>' +
                    '<span class="ng-ta-fixcell">' + fix + '</span></div>';
            });
        });
        return html;
    }

    function step2Html() {
        var bad = failing(state.pal).length;
        return '<h3 class="ng-ta-h">Check readability</h3>' +
            '<p class="ng-ta-p">Text and buttons need enough contrast to read. AA is the standard; AAA is extra comfortable. ' +
            'Checks update as you change the accent or style.</p>' +
            '<div class="ng-ta-checkbar"><span class="ng-ta-summary' + (bad ? ' ng-ta-summary--bad' : '') + '" id="ngTaSummary">' +
            (bad ? bad + ' pair' + (bad > 1 ? 's' : '') + ' below target' : 'All pairs pass') + '</span>' +
            '<button type="button" class="ng-ta-btn" data-ta-act="fixall"' + (bad ? '' : ' disabled') + '><i class="fa-solid fa-screwdriver-wrench"></i> Fix all</button></div>' +
            '<div class="ng-ta-note" id="ngTaNote" role="status">' + esc(state.note) + '</div>' +
            '<div class="ng-ta-rows" id="ngTaRows">' + rowsHtml(state.pal) + '</div>';
    }

    function step3Html() {
        var oldPal = state.applied && state.base ? state.base : currentPal();
        var keys = kit().keys, html = '';
        var changed = keys.filter(function (k) { return normHex(oldPal[k]) !== normHex(state.pal[k]); }).length;
        keys.forEach(function (k) {
            var base = k.replace(/Light$/, ''), light = k !== base;
            var same = normHex(oldPal[k]) === normHex(state.pal[k]);
            html += '<div class="ng-ta-sumrow' + (same ? ' ng-ta-sumrow--same' : '') + '">' +
                '<span class="ng-ta-sumlabel"><i class="fa-solid fa-' + (light ? 'sun' : 'moon') + '"></i> ' + esc(KEY_LABEL[base] || base) + '</span>' +
                '<i class="ng-ta-dot ng-ta-dot--lg" style="background:' + oldPal[k] + ';" title="' + oldPal[k] + '"></i>' +
                '<i class="fa-solid fa-arrow-right ng-ta-arrow"></i>' +
                '<i class="ng-ta-dot ng-ta-dot--lg" style="background:' + state.pal[k] + ';" title="' + state.pal[k] + '"></i>' +
                '<span class="ng-ta-hexs">' + esc(state.pal[k]) + '</span></div>';
        });
        var head = '<h3 class="ng-ta-h">' + (state.applied ? 'Applied' : 'Apply') + '</h3>';
        var body;
        if (state.applied) {
            body = '<p class="ng-ta-p"><i class="fa-solid fa-circle-check ng-ta-ok"></i> Your new colours are live. Not what you wanted? ' +
                '<button type="button" class="ng-ta-btn" data-ta-act="undo"><i class="fa-solid fa-rotate-left"></i> Undo</button></p>' +
                '<div class="ng-ta-save"><label class="ng-ta-field ng-ta-field--grow"><span>Save as my preset</span>' +
                '<input type="text" id="ngTaPresetName" class="ng-ta-name" maxlength="40" placeholder="Preset name" autocomplete="off"></label>' +
                '<button type="button" class="ng-ta-btn" data-ta-act="save"><i class="fa-solid fa-bookmark"></i> Save</button></div>' +
                '<div class="ng-ta-note" id="ngTaSaveNote" role="status"></div>';
        } else {
            body = '<p class="ng-ta-p">' + (changed ? changed + ' of ' + keys.length + ' colours will change.' : 'These colours are already applied.') +
                ' Nothing is saved until you press Apply. Close the dialog to cancel.</p>';
        }
        return head + body + '<div class="ng-ta-summary-list">' + html + '</div>';
    }

    /* ── Actions ──────────────────────────────────────────────── */

    /* Write key→hex changes, remembering the previous values for Undo. */
    function commit(label, values) {
        var snap = {}, n = 0;
        Object.keys(values).forEach(function (k) {
            var old = S().get(k);
            if (normHex(old) === normHex(values[k])) return;
            snap[k] = old; n++;
        });
        if (!n) return 0;
        state.undo.push({ label: label, snap: snap });
        Object.keys(snap).forEach(function (k) { S().set(k, values[k]); });
        kit().rerenderPanel();
        refreshBar();
        return n;
    }

    function undo() {
        var u = state.undo.pop();
        if (!u) return;
        Object.keys(u.snap).forEach(function (k) { S().set(k, u.snap[k]); });
        state.applied = false;
        kit().rerenderPanel();
        refreshBar();
        if (state.el) renderStep();
    }

    /* Sticky 'Applied. Undo' bar (body-level so it survives panel re-renders).
       Hidden while the dialog is open: the dialog carries its own Undo. */
    function refreshBar() {
        var bar = $('ng-studio-undo');
        if (!state.undo.length || state.el) { if (bar) bar.classList.remove('ng-studio-undo--show'); return; }
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'ng-studio-undo';
            bar.className = 'ng-studio-undo';
            bar.setAttribute('role', 'status');
            bar.innerHTML = '<span class="ng-studio-undo-msg"></span>' +
                '<button type="button" class="ng-studio-undo-btn">Undo</button>' +
                '<button type="button" class="ng-studio-undo-x" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>';
            bar.querySelector('.ng-studio-undo-btn').addEventListener('click', undo);
            bar.querySelector('.ng-studio-undo-x').addEventListener('click', function () {
                state.undo = [];
                refreshBar();
            });
            document.body.appendChild(bar);
        }
        bar.querySelector('.ng-studio-undo-msg').textContent = 'Applied –';
        setTimeout(function () { bar.classList.add('ng-studio-undo--show'); }, 10);
    }

    function applyDraft() {
        state.base = currentPal();
        var n = commit('Applied ' + ST_LABEL[state.style].toLowerCase() + ' palette', state.pal);
        state.applied = true;
        renderStep();
        return n;
    }

    /* ── Rendering ────────────────────────────────────────────── */

    function renderStep() {
        var el = state.el;
        if (!el) return;
        var body = el.querySelector('#ngTaBody');
        body.innerHTML = state.step === 1 ? step1Html() : state.step === 2 ? step2Html() : step3Html();
        body.scrollTop = 0;
        if (state.step === 1) syncControls();
        el.querySelectorAll('.ng-ta-step').forEach(function (b) {
            var n = parseInt(b.getAttribute('data-ta-step'), 10);
            b.classList.toggle('ng-ta-step--active', n === state.step);
            b.classList.toggle('ng-ta-step--done', n < state.step);
            if (n === state.step) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
        });
        var back = el.querySelector('[data-ta-act="back"]');
        var next = el.querySelector('.ng-ta-btn--primary');
        back.style.visibility = state.step === 1 ? 'hidden' : 'visible';
        if (state.step === 3) {
            next.innerHTML = state.applied ? '<i class="fa-solid fa-check"></i> Done' : '<i class="fa-solid fa-wand-magic-sparkles"></i> Apply';
            next.setAttribute('data-ta-act', state.applied ? 'done' : 'apply');
        } else {
            next.innerHTML = 'Next <i class="fa-solid fa-arrow-right"></i>';
            next.setAttribute('data-ta-act', 'next');
        }
    }

    /* Mark the active swatch / style chip. */
    function syncControls() {
        var el = state.el;
        if (!el) return;
        el.querySelectorAll('.ng-ta-swatch').forEach(function (b) {
            var on = b.getAttribute('data-ta-accent') === state.accent;
            b.classList.toggle('ng-ta-swatch--active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        el.querySelectorAll('.ng-ta-chip').forEach(function (b) {
            var on = b.getAttribute('data-ta-style') === state.style;
            b.classList.toggle('ng-ta-chip--active', on);
            b.setAttribute('aria-checked', on ? 'true' : 'false');
        });
    }

    function onDraftChanged(fromHex, fromColor) {
        regen();
        var pv = $('ngTaPreview');
        if (pv) pv.innerHTML = previewHtml(state.pal);
        var c = $('ngTaColor'), t = $('ngTaHex');
        if (c && !fromColor) c.value = state.accent;
        if (t && !fromHex) t.value = state.accent;
        syncControls();
    }

    function setAccent(hex, fromHex, fromColor) {
        var h = normHex(hex);
        if (!h) return;
        state.accent = h;
        onDraftChanged(fromHex, fromColor);
    }

    function goStep(n) {
        state.step = Math.max(1, Math.min(3, n));
        renderStep();
    }

    function onClick(e) {
        var t = e.target && e.target.closest ? e.target : null;
        if (!t) return;
        var b;
        if ((b = t.closest('[data-ta-accent]'))) { setAccent(b.getAttribute('data-ta-accent')); return; }
        if ((b = t.closest('[data-ta-style]'))) { state.style = b.getAttribute('data-ta-style'); onDraftChanged(); return; }
        if ((b = t.closest('[data-ta-step]'))) { goStep(parseInt(b.getAttribute('data-ta-step'), 10)); return; }
        if ((b = t.closest('[data-ta-fix]'))) {
            var row = buildRows(state.pal).filter(function (x) { return x.id === b.getAttribute('data-ta-fix'); })[0];
            if (!row) return;
            var f = fixRow(state.pal, row);
            if (f.to !== f.from) state.pal[f.key] = f.to;
            state.note = 'Fixed ' + row.label.toLowerCase() + '.' + (f.ok ? '' : ' Still below target.');
            renderStep();
            return;
        }
        if (!(b = t.closest('[data-ta-act]'))) return;
        switch (b.getAttribute('data-ta-act')) {
            case 'close': case 'done': close(); break;
            case 'back': goStep(state.step - 1); break;
            case 'next': goStep(state.step + 1); break;
            case 'apply': applyDraft(); break;
            case 'undo': undo(); break;
            case 'fixall':
                var r = fixAll(state.pal);
                state.pal = r.pal;
                state.note = r.changes.length
                    ? 'Fixed ' + r.changes.length + ' colour' + (r.changes.length > 1 ? 's' : '') +
                      (r.remaining.length ? '; ' + r.remaining.length + ' pair(s) still below target. Try another accent.' : '.')
                    : 'Nothing could be fixed automatically. Try another accent.';
                renderStep();
                break;
            case 'save':
                var inp = $('ngTaPresetName'), note = $('ngTaSaveNote');
                var name = inp ? inp.value.trim() : '';
                if (!name) { if (note) note.textContent = 'Give the preset a name first.'; if (inp) inp.focus(); break; }
                kit().savePreset(name);
                kit().rerenderPanel();
                if (note) note.textContent = 'Saved “' + name + '” to Theme Presets.';
                break;
            case 'finetune':
                close();
                var target = document.querySelector('.ng-settings-section--colors');
                if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                break;
        }
    }

    function onInput(e) {
        var t = e.target;
        if (t.id === 'ngTaColor') {
            clearTimeout(state.timer);
            state.timer = setTimeout(function () { setAccent(t.value, false, true); }, 30);
        } else if (t.id === 'ngTaHex') {
            if (normHex(t.value)) setAccent(t.value, true, false);
        }
    }

    function focusables() {
        var list = state.el.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])');
        return Array.prototype.filter.call(list, function (n) {
            return !n.disabled && n.style.visibility !== 'hidden' && n.offsetParent !== null;
        });
    }

    function onKey(e) {
        if (!state.el) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
        if (e.key === 'Tab') {
            var f = focusables();
            if (!f.length) { e.preventDefault(); return; }
            var first = f[0], last = f[f.length - 1], a = document.activeElement;
            if (!state.el.contains(a)) { e.preventDefault(); first.focus(); }
            else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
        }
    }

    function open() {
        if (!kit()) return;
        if (state.el) close();
        var old = $('ng-ta-overlay');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        state.accent = normHex(S().get('accentColor')) || '#4e9af1';
        state.step = 1;
        state.applied = false;
        state.base = null;
        regen();
        state.prevFocus = document.activeElement;

        var ov = document.createElement('div');
        ov.id = 'ng-ta-overlay';
        ov.className = 'ng-ta-overlay';
        ov.innerHTML =
            '<div class="ng-ta-dialog" role="dialog" aria-modal="true" aria-labelledby="ngTaTitle" aria-describedby="ngTaSub">' +
            '<div class="ng-ta-header"><div class="ng-ta-title-wrap">' +
            '<div class="ng-ta-title" id="ngTaTitle"><i class="fa-solid fa-wand-magic-sparkles"></i><span>Theme Assistant</span></div>' +
            '<div class="ng-ta-subtitle" id="ngTaSub">Pick an accent and get a readable dark and light theme in three steps.</div></div>' +
            '<button type="button" class="ng-ta-close" data-ta-act="close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="ng-ta-steps" role="group" aria-label="Steps">' +
            '<button type="button" class="ng-ta-step" data-ta-step="1"><span class="ng-ta-step-n">1</span> Accent</button>' +
            '<button type="button" class="ng-ta-step" data-ta-step="2"><span class="ng-ta-step-n">2</span> Readability</button>' +
            '<button type="button" class="ng-ta-step" data-ta-step="3"><span class="ng-ta-step-n">3</span> Apply</button></div>' +
            '<div class="ng-ta-body" id="ngTaBody" tabindex="-1"></div>' +
            '<div class="ng-ta-footer">' +
            '<button type="button" class="ng-ta-link" data-ta-act="finetune"><i class="fa-solid fa-sliders"></i> Fine-tune manually</button>' +
            '<div class="ng-ta-footer-btns">' +
            '<button type="button" class="ng-ta-btn" data-ta-act="back"><i class="fa-solid fa-arrow-left"></i> Back</button>' +
            '<button type="button" class="ng-ta-btn ng-ta-btn--primary" data-ta-act="next">Next</button></div></div>' +
            '</div>';
        state.el = ov;
        document.body.appendChild(ov);
        if (G.ngSetDialogOpen) G.ngSetDialogOpen('assistant', true);
        refreshBar();

        ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
        ov.addEventListener('click', onClick);
        ov.addEventListener('input', onInput);
        ov.addEventListener('blur', function (e) {
            if (e.target && e.target.id === 'ngTaHex') e.target.value = state.accent;
        }, true);
        state.onKey = onKey;
        document.addEventListener('keydown', onKey, true);

        renderStep();
        if (G.requestAnimationFrame) G.requestAnimationFrame(function () { ov.classList.add('ng-ta-overlay--open'); });
        else ov.classList.add('ng-ta-overlay--open');
        var first = ov.querySelector('.ng-ta-swatch--active') || ov.querySelector('.ng-ta-swatch') || ov.querySelector('.ng-ta-dialog');
        if (first && first.focus) first.focus();
    }

    function close() {
        var ov = state.el;
        if (!ov) return;
        state.el = null;
        clearTimeout(state.timer);
        document.removeEventListener('keydown', state.onKey, true);
        if (G.ngSetDialogOpen) G.ngSetDialogOpen('assistant', false);
        ov.classList.remove('ng-ta-overlay--open');
        setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 260);
        /* The panel may have re-rendered (Apply), so look the opener up again. */
        var pf = state.prevFocus && document.body.contains(state.prevFocus) ? state.prevFocus : $('ngAssistantBtn');
        if (pf && pf.focus) pf.focus();
        refreshBar();
    }

    /* Hook the header button (called after every panel render). */
    function bind(container) {
        var btn = container && container.querySelector && container.querySelector('#ngAssistantBtn');
        if (btn) btn.addEventListener('click', function (e) { e.preventDefault(); open(); });
    }

    G.NGStudio = {
        open: open,
        close: close,
        bind: bind,
        undo: undo,
        /* pure helpers (also used by the node test script) */
        math: {
            normHex: normHex, hexToOklch: hexToOklch, oklchToHex: oklchToHex, lum: lum, ratio: ratio,
            fixContrast: fixContrast, fitAccent: fitAccent, generatePalette: generatePalette,
            buildRows: buildRows, fixRow: fixRow, fixAll: fixAll, STYLES: STYLES
        }
    };
}());
