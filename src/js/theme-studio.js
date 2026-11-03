/*  ═══════════════════════════════════════════════════════════════
    Theme Studio — palette maker, contrast checker, undo bar.

    Works only on the 18 colour settings (COLOR_SNAPSHOT_KEYS in
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

    /* ── UI (only runs inside the settings panel) ─────────────── */

    var state = { accent: null, style: 'balanced', undo: [], lastChanges: null };
    var ST_LABEL = { balanced: 'Balanced', vivid: 'Vivid', muted: 'Muted', mono: 'Mono' };

    function S() { return G.dzNightglassSettings; }
    function currentPal() {
        var p = {};
        kit().keys.forEach(function (k) { p[k] = normHex(S().get(k)) || '#000000'; });
        return p;
    }
    function esc(s) { return G.ngEsc ? G.ngEsc(String(s)) : String(s).replace(/[&<>"']/g, ''); }
    function $(id) { return document.getElementById(id); }

    function previewHtml(pal) {
        var tiers = kit().textTiers;
        return [false, true].map(function (isLight) {
            var K = function (n) { return pal[n + (isLight ? 'Light' : '')]; };
            var soft = tiers(K('textColor'), isLight).soft;
            return '<div class="ng-studio-pv" style="background:' + K('pageBgColor') + ';">' +
                '<div class="ng-studio-pv-label" style="color:' + soft + ';"><i class="fa-solid fa-' + (isLight ? 'sun' : 'moon') + '"></i> ' + (isLight ? 'Light' : 'Dark') + '</div>' +
                '<div class="ng-studio-pv-nav" style="background:' + K('bgColor') + ';border-bottom:2px solid ' + K('accentColor') + ';"></div>' +
                '<div class="ng-studio-pv-card" style="background:' + K('surfaceColor') + ';border:1px solid ' + K('borderColor') + ';">' +
                '<div class="ng-studio-pv-title" style="color:' + K('textColor') + ';">Living room</div>' +
                '<div class="ng-studio-pv-sub" style="color:' + soft + ';">21.5 &deg;C &middot; updated today</div>' +
                '<div class="ng-studio-pv-row">' +
                '<span class="ng-studio-pv-btn" style="background:' + K('accentColor') + ';color:#ffffff;">Turn on</span>' +
                '<span class="ng-studio-pv-dot" style="background:' + K('dangerColor') + ';"></span>' +
                '<span class="ng-studio-pv-dot" style="background:' + K('warningColor') + ';"></span>' +
                '<span class="ng-studio-pv-dot" style="background:' + K('successColor') + ';"></span>' +
                '</div></div></div>';
        }).join('');
    }

    function rowsHtml(pal) {
        var rows = buildRows(pal), html = '';
        ['dark', 'light'].forEach(function (mode) {
            var list = rows.filter(function (r) { return r.mode === mode; });
            var bad = list.filter(function (r) { return !r.pass; }).length;
            html += '<div class="ng-studio-mode"><i class="fa-solid fa-' + (mode === 'dark' ? 'moon' : 'sun') + '"></i> ' +
                (mode === 'dark' ? 'Dark' : 'Light') + ' mode ' +
                '<span class="ng-studio-mode-count' + (bad ? ' ng-studio-mode-count--bad' : '') + '">' +
                (bad ? bad + ' failing' : 'all pass') + '</span></div>';
            list.forEach(function (r) {
                var b = badge(r);
                html += '<div class="ng-studio-row' + (r.pass ? '' : ' ng-studio-row--fail') + '">' +
                    '<span class="ng-studio-sample" style="color:' + r.fgHex + ';background:' + r.bgHex + ';">Aa</span>' +
                    '<span class="ng-studio-row-label">' + esc(r.label) + '</span>' +
                    '<span class="ng-studio-ratio">' + r.ratio.toFixed(2) + ':1 <small>min ' + r.thr.toFixed(1) + '</small></span>' +
                    '<span class="ng-studio-badge ng-studio-badge--' + b.toLowerCase() + '">' + b + '</span>' +
                    (r.pass ? '<span class="ng-studio-fix-slot"></span>' :
                        '<button type="button" class="ng-studio-fix" data-ng-studio-fix="' + esc(r.id) + '">Fix</button>') +
                    '</div>';
            });
        });
        return html;
    }

    function changesHtml() {
        var c = state.lastChanges;
        if (!c) return '';
        var h = '<div class="ng-studio-changes-title">' + esc(c.title) + '</div>';
        c.list.forEach(function (x) {
            h += '<div class="ng-studio-change"><span class="ng-studio-chip" style="background:' + x.from + ';"></span>' +
                '<span>' + esc(x.key) + '</span> ' + x.from + ' &rarr; ' + x.to +
                ' <span class="ng-studio-chip" style="background:' + x.to + ';"></span></div>';
        });
        (c.notes || []).forEach(function (n) { h += '<div class="ng-studio-note">' + esc(n) + '</div>'; });
        return h;
    }

    function sectionHtml() {
        if (!kit()) return '';
        if (!state.accent) state.accent = normHex(S().get('accentColor')) || '#4e9af1';
        var pal = generatePalette(state.accent, state.style);
        var opts = STYLES.map(function (s) {
            return '<option value="' + s + '"' + (s === state.style ? ' selected' : '') + '>' + ST_LABEL[s] + '</option>';
        }).join('');
        return '<div class="ng-settings-section ng-settings-section--full ng-studio" id="ngStudio">' +
            '<div class="ng-section-header"><i class="fa-solid fa-wand-magic-sparkles"></i> Theme Studio</div>' +
            '<div class="ng-studio-controls">' +
            '<label class="ng-studio-field"><span>Accent</span>' +
            '<input type="color" id="ngStudioColor" value="' + state.accent + '">' +
            '<input type="text" id="ngStudioHex" class="ng-studio-hex" value="' + state.accent + '" maxlength="7" spellcheck="false"></label>' +
            '<label class="ng-studio-field"><span>Style</span><select class="ng-select" id="ngStudioStyle">' + opts + '</select></label>' +
            '<button type="button" class="ng-action-chip ng-studio-btn" id="ngStudioApply"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate &amp; Apply</button>' +
            '<button type="button" class="ng-action-chip ng-studio-btn" id="ngStudioSave" title="Save the colours currently applied as a preset"><i class="fa-solid fa-bookmark"></i> Save as my preset</button>' +
            '</div>' +
            '<div class="ng-studio-preview" id="ngStudioPreview">' + previewHtml(pal) + '</div>' +
            '<div class="ng-studio-check-head"><div class="ng-studio-check-title"><i class="fa-solid fa-circle-half-stroke"></i> Contrast checker <span class="ng-studio-summary" id="ngStudioSummary"></span></div>' +
            '<div class="ng-studio-check-actions">' +
            '<button type="button" class="ng-action-chip ng-studio-btn" id="ngStudioRecheck"><i class="fa-solid fa-rotate"></i> Re-check</button>' +
            '<button type="button" class="ng-action-chip ng-studio-btn" id="ngStudioFixAll"><i class="fa-solid fa-screwdriver-wrench"></i> Fix all</button>' +
            '</div></div>' +
            '<div class="ng-studio-rows" id="ngStudioRows"></div>' +
            '<div class="ng-studio-changes" id="ngStudioChanges">' + changesHtml() + '</div>' +
            '</div>';
    }

    /* ── Actions ──────────────────────────────────────────────── */

    /* Write a set of key→hex changes, remembering the previous values for Undo. */
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
        state.lastChanges = null;
        kit().rerenderPanel();
        refreshBar();
    }

    function refreshBar() {
        var bar = $('ng-studio-undo');
        if (!state.undo.length) { if (bar) bar.classList.remove('ng-studio-undo--show'); return; }
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
        bar.querySelector('.ng-studio-undo-msg').textContent = state.undo[state.undo.length - 1].label + ' –';
        /* next frame so the slide-in transition runs */
        setTimeout(function () { bar.classList.add('ng-studio-undo--show'); }, 10);
    }

    function listChanges(title, changes, remaining) {
        state.lastChanges = {
            title: title, list: changes,
            notes: remaining && remaining.length
                ? ['Still below target: ' + remaining.map(function (r) { return r.mode + ' ' + r.label.toLowerCase(); }).join(', ') +
                    '. Pick a different base colour for these.']
                : []
        };
    }

    function renderChecker() {
        var rowsEl = $('ngStudioRows');
        if (!rowsEl || !kit()) return;
        var pal = currentPal();
        rowsEl.innerHTML = rowsHtml(pal);
        var bad = buildRows(pal).filter(function (r) { return !r.pass; }).length;
        var sum = $('ngStudioSummary');
        if (sum) {
            sum.textContent = bad ? bad + ' failing' : 'all pass';
            sum.className = 'ng-studio-summary' + (bad ? ' ng-studio-summary--bad' : '');
        }
        var fa = $('ngStudioFixAll');
        if (fa) fa.disabled = !bad;
    }

    function updatePreview() {
        var pv = $('ngStudioPreview');
        if (pv) pv.innerHTML = previewHtml(generatePalette(state.accent, state.style));
    }

    function setAccent(hex, fromColorInput) {
        var h = normHex(hex);
        if (!h) return;
        state.accent = h;
        var c = $('ngStudioColor'), t = $('ngStudioHex');
        if (c && !fromColorInput) c.value = h;
        if (t && fromColorInput) t.value = h;
        updatePreview();
    }

    var _recheckT = null;
    function bind(container) {
        if (!kit() || !$('ngStudio')) return;
        var color = $('ngStudioColor'), hex = $('ngStudioHex');
        color.addEventListener('input', function () { setAccent(color.value, true); });
        hex.addEventListener('input', function () { if (normHex(hex.value)) setAccent(hex.value, false); });
        $('ngStudioStyle').addEventListener('change', function () { state.style = this.value; updatePreview(); });

        $('ngStudioApply').addEventListener('click', function () {
            var pal = generatePalette(state.accent, state.style);
            var left = buildRows(pal).filter(function (r) { return !r.pass; });
            state.lastChanges = null;
            var n = commit('Applied ' + ST_LABEL[state.style].toLowerCase() + ' palette', pal);
            if (!n) { var ch = $('ngStudioChanges'); if (ch) ch.textContent = 'These colours are already applied.'; }
            if (left.length) {
                listChanges('Generated palette has pairs below target', [], left);
                var c = $('ngStudioChanges');
                if (c) c.innerHTML = changesHtml();
            }
        });

        $('ngStudioSave').addEventListener('click', function () {
            var name = prompt('Enter a name for this preset:', '');
            if (name === null || !name.trim()) return;
            kit().savePreset(name.trim());
            kit().rerenderPanel();
        });

        $('ngStudioRecheck').addEventListener('click', renderChecker);

        $('ngStudioFixAll').addEventListener('click', function () {
            var r = fixAll(currentPal());
            if (!r.changes.length) { listChanges('Nothing could be fixed automatically', [], r.remaining); $('ngStudioChanges').innerHTML = changesHtml(); return; }
            var vals = {};
            r.changes.forEach(function (c) { vals[c.key] = c.to; });
            listChanges('Fixed ' + r.changes.length + ' colour' + (r.changes.length > 1 ? 's' : ''), r.changes, r.remaining);
            commit('Fixed ' + r.changes.length + ' colour' + (r.changes.length > 1 ? 's' : ''), vals);
        });

        $('ngStudioRows').addEventListener('click', function (e) {
            var btn = e.target.closest('[data-ng-studio-fix]');
            if (!btn) return;
            var pal = currentPal();
            var row = buildRows(pal).filter(function (x) { return x.id === btn.getAttribute('data-ng-studio-fix'); })[0];
            if (!row) return;
            var f = fixRow(pal, row);
            var after = clonePal(pal); after[f.key] = f.to;
            var remaining = buildRows(after).filter(function (x) { return x.id === row.id && !x.pass; });
            if (f.to === f.from) {
                listChanges('Could not improve ' + row.label.toLowerCase(), [], remaining);
                $('ngStudioChanges').innerHTML = changesHtml();
                return;
            }
            listChanges('Fixed ' + row.label.toLowerCase(), [{ key: f.key, from: f.from, to: f.to }], remaining);
            var v = {}; v[f.key] = f.to;
            commit('Fixed ' + row.label.toLowerCase(), v);
        });

        /* Re-check shortly after the user edits a colour by hand. */
        if (!container._ngStudioEdit) {   /* container survives panel re-renders */
            container._ngStudioEdit = true;
            container.addEventListener('pointerup', onEdit);
            container.addEventListener('keyup', onEdit);
            container.addEventListener('change', onEdit);
        }
        function onEdit(e) {
            if (!e.target.closest || !e.target.closest('.ng-color-wrap')) return;
            clearTimeout(_recheckT);
            _recheckT = setTimeout(renderChecker, 500);
        }

        renderChecker();
        refreshBar();
    }

    G.NGStudio = {
        sectionHtml: sectionHtml,
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
