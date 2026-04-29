/* -- Promote status text to bigtext when bigtext is empty ---------- */
/*    Runs after Angular renders each digest cycle.                   */

(function () {
    'use strict';

    function promoteStatusToBigtext() {
        var cards = document.querySelectorAll(
            'table[id^="itemtable"] tbody tr'
        );
        for (var i = 0; i < cards.length; i++) {
            var tr = cards[i];
            var bigtext = tr.querySelector('td#bigtext');
            var status  = tr.querySelector('td#status');
            if (!bigtext || !status) continue;

            var btText = (bigtext.textContent || '').replace(/\s+/g, ' ').trim();
            var stText = (status.textContent  || '').replace(/\s+/g, ' ').trim();

            if (!btText && stText) {
                bigtext.innerHTML = status.innerHTML;
                status.innerHTML  = '';
            }
        }
    }

    /* Register with the icon-replacement burst so all DOM changes land
       in the same batch as icon replacement, reducing layout reflows.  */
    window._dzExtraProcessors = window._dzExtraProcessors || [];
    window._dzExtraProcessors.push(promoteStatusToBigtext);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', promoteStatusToBigtext);
    } else {
        promoteStatusToBigtext();
    }

    var _timer = null;
    var observer = new MutationObserver(function () {
        clearTimeout(_timer);
        _timer = setTimeout(promoteStatusToBigtext, 200);
    });

    function startPromoteObserver() {
        var target = document.getElementById('dashcontent') ||
                     document.getElementById('main-content') ||
                     document.body;
        if (target) {
            observer.observe(target, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startPromoteObserver);
    } else {
        startPromoteObserver();
    }
})();


/* -- Text device card enhancement --------------------------------- */
/*    For "General, Text" devices the bigtext contains long messages  */
/*    that don't fit the hero-value style. Move the full text into    */
/*    the status area as a scrollable message block and show a        */
/*    truncated preview in bigtext.                                   */

(function () {
    'use strict';

    var maxPreviewLen = 60;

    function processTextDevices() {
        var cards = document.querySelectorAll(
            'table[id^="itemtable"] tbody tr'
        );
        for (var i = 0; i < cards.length; i++) {
            var tr = cards[i];
            if (tr.getAttribute('data-dz-text-done')) continue;

            var typeTd  = tr.querySelector('td#type');
            if (!typeTd) continue;
            var typeText = (typeTd.textContent || '').trim();
            if (!/\bText\b/i.test(typeText)) continue;

            var bigtext = tr.querySelector('td#bigtext');
            var status  = tr.querySelector('td#status');
            if (!bigtext || !status) continue;

            /* Extract and decode the bigtext cell content.
               Domoticz can double-escape HTML entities (&amp;nbsp; instead
               of &nbsp;, &lt;br&gt; instead of <br>).  One decode pass via
               a <textarea> (RCDATA: entities decoded, tags kept as text)
               normalises both cases so the content can be re-inserted as
               HTML and rendered naturally by the browser.  Styling (spans,
               min-width columns, images) from the device plugin is preserved
               this way; extracting plain text would lose the visual spacing
               built into the markup. */
            var rawHtml = bigtext.innerHTML || '';
            var tmp = document.createElement('textarea');
            tmp.innerHTML = rawHtml;
            var decoded = tmp.value;          /* entities decoded, tags intact */

            /* Parse the decoded HTML once into a temporary container.
               Moving parsed DOM nodes into msgDiv avoids a second innerHTML
               assignment and limits the innerHTML surface to one call on
               content already in the page's own trusted DOM. */
            var tmpDiv = document.createElement('div');
            tmpDiv.innerHTML = decoded; /* lgtm[js/xss-through-dom] */
            var plainText = (tmpDiv.textContent || tmpDiv.innerText || '').replace(/\s+/g, ' ').trim();
            if (!plainText) continue;

            tr.setAttribute('data-dz-text-done', '1');

            var itemBlock = tr.closest('.itemBlock');
            if (itemBlock) itemBlock.classList.add('dz-text-device');

            status.textContent = '';
            var msgDiv = document.createElement('div');
            msgDiv.className = 'dz-text-msg';
            /* Move already-parsed nodes — no second HTML re-parse. */
            while (tmpDiv.firstChild) {
                msgDiv.appendChild(tmpDiv.firstChild);
            }
            status.appendChild(msgDiv);

            if (plainText.length > maxPreviewLen) {
                bigtext.textContent = plainText.substring(0, maxPreviewLen) + '…';
            }
        }
    }

    window._dzExtraProcessors = window._dzExtraProcessors || [];
    window._dzExtraProcessors.push(processTextDevices);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processTextDevices);
    } else {
        processTextDevices();
    }

    var _timer = null;
    var observer = new MutationObserver(function () {
        clearTimeout(_timer);
        _timer = setTimeout(processTextDevices, 250);
    });

    function startObserver() {
        var target = document.getElementById('dashcontent') ||
                     document.getElementById('main-content') ||
                     document.body;
        if (target) {
            observer.observe(target, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }
})();


/* -- Format last-update timestamps + strip "Type:" prefix --------- */
/*    Runs after Angular renders each digest cycle.                   */

(function () {
    'use strict';

    /* Resolve locale: prefer Domoticz's own language setting ($.i18n from
       i18next 1.8.0), fall back to the browser's navigator.language.
       Domoticz uses plain ISO 639-1 codes ("nl", "de", "fr" …) which are
       valid BCP 47 tags and work directly with Intl APIs.               */
    function dzLocale() {
        try {
            var lng = $ && $.i18n && typeof $.i18n.lng === 'function' && $.i18n.lng();
            if (lng && lng !== 'cimode') return lng;
        } catch (e) { /* ignore */ }
        return navigator.language || undefined;
    }

    function formatTimestamp(raw) {
        var m = raw.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
        if (!m) return null;

        var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
        var now       = new Date();
        var today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var yesterday = new Date(today.getTime() - 86400000);
        var cardDay   = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        var locale = dzLocale();
        var time   = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
        var rtf    = window.Intl && Intl.RelativeTimeFormat
                     ? new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
                     : null;

        if (cardDay.getTime() === today.getTime()) {
            return (rtf ? rtf.format(0, 'day') : 'today') + ' ' + time;
        }
        if (cardDay.getTime() === yesterday.getTime()) {
            return (rtf ? rtf.format(-1, 'day') : 'yesterday') + ' ' + time;
        }
        return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' }) + ', ' + time;
    }

    /* Register with the icon-replacement burst so footer injection lands
       in the same batch as icon replacement, reducing layout reflows.  */
    window._dzExtraProcessors = window._dzExtraProcessors || [];
    window._dzExtraProcessors.push(processCards);

    function processCards() {
        /* Dashboard cards: div.item.itemBlock
           Temperature/weather tab views: .itemBlock (custom element) > div.item
           Guard with table[id^="itemtable"] to skip any non-card matches.  */
        var cards = document.querySelectorAll('div.item.itemBlock, .itemBlock > div.item');
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];

            /* Skip anything that isn't a real device card */
            if (!card.querySelector('table[id^="itemtable"]')) continue;

            var lu = card.querySelector('td#lastupdate');
            if (!lu) continue;

            /* Get or create the pinned footer div */
            var footer = card.querySelector('.dz-card-footer');
            if (!footer) {
                footer = document.createElement('div');
                footer.className = 'dz-card-footer';
                var luSpan = document.createElement('span');
                luSpan.className = 'dz-time';
                footer.appendChild(luSpan);
                card.appendChild(footer);
            }

            var luSpan = footer.querySelector('.dz-time');

            /* Update timestamp */
            if (lu) {
                var raw = (lu.textContent || '').trim();
                var tsM = raw.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
                if (tsM) luSpan.dataset.ts = new Date(+tsM[1], +tsM[2]-1, +tsM[3], +tsM[4], +tsM[5]).getTime();
                var formatted = formatTimestamp(raw) || raw;
                if (luSpan.textContent !== formatted) luSpan.textContent = formatted;
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processCards);
    } else {
        processCards();
    }
// Ensure icons are replaced when switching tabs in dynamic dashboard widgets (handles ng-show/ng-hide/class changes)
document.addEventListener('DOMContentLoaded', function () {
    var tabObserver = new MutationObserver(function(mutations) {
        var needsUpdate = false;
        mutations.forEach(function(m) {
            if (m.type === 'attributes' && (m.attributeName === 'class' || m.attributeName === 'style')) {
                needsUpdate = true;
            }
        });
        if (needsUpdate) {
            if (window._dzScheduleBurst) window._dzScheduleBurst();
            processCards();
        }
    });
    function observeTabs() {
        var tabLists = document.querySelectorAll('.dd-favorites-tabs');
        tabLists.forEach(function(tabList) {
            tabObserver.observe(tabList, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
        });
    }
    observeTabs();
    // Also re-observe if new tab lists are added dynamically
    var bodyObserver = new MutationObserver(function() { observeTabs(); });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
});

    var _timer = null;
    var observer = new MutationObserver(function () {
        clearTimeout(_timer);
        _timer = setTimeout(processCards, 200);
    });

    function startObserver() {
        var target = document.getElementById('dashcontent') ||
                     document.getElementById('main-content') ||
                     document.body;
        if (target) observer.observe(target, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }
// Ensure icons are replaced when switching tabs in dynamic dashboard widgets (handles tab content visibility)
document.addEventListener('DOMContentLoaded', function () {
    function observeFavoritesTabContent() {
        var containers = document.querySelectorAll('.dd-favorites-main');
        containers.forEach(function(container) {
            if (container._dzTabContentObserved) return;
            var observer = new MutationObserver(function(mutations) {
                var needsUpdate = false;
                mutations.forEach(function(m) {
                    if (m.type === 'childList' || (m.type === 'attributes' && (m.attributeName === 'class' || m.attributeName === 'style'))) {
                        needsUpdate = true;
                    }
                });
                if (needsUpdate) {
                    if (window._dzScheduleBurst) window._dzScheduleBurst();
                    processCards();
                }
            });
            observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
            container._dzTabContentObserved = true;
        });
    }
    observeFavoritesTabContent();
    // Re-observe if new tab content containers are added dynamically
    var bodyObserver = new MutationObserver(function() { observeFavoritesTabContent(); });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
});
})();


(function () {
    'use strict';
    /* Map moon phase slugs → FA icon + optional extra CSS class.
       Northern-hemisphere convention:
         waxing = right outer edge lit  → fa-moon flipped via dz-moon-waxing
         waning = left outer edge lit   → fa-moon as-is
       fa-circle-half-stroke shows the RIGHT half solid; flip it for last quarter. */
    var moonPhaseMap = {
        'new':             { icon: 'fa-circle',             cls: 'dz-moon-new'    },
        'waxing-crescent': { icon: 'fa-moon',               cls: 'dz-moon-waxing' },
        'first-quarter':   { icon: 'fa-circle-half-stroke', cls: ''               },
        'waxing-gibbous':  { icon: 'fa-moon',               cls: 'dz-moon-waxing' },
        'full':            { icon: 'fa-circle',             cls: ''               },
        'waning-gibbous':  { icon: 'fa-moon',               cls: ''               },
        'last-quarter':    { icon: 'fa-circle-half-stroke', cls: 'dz-moon-waxing' },
        'waning-crescent': { icon: 'fa-moon',               cls: ''               },
    };

    function replaceMoonImages() {
        var imgs = document.querySelectorAll('.dd-moon-image img');
        imgs.forEach(function (img) {
            if (img.classList.contains('dz-moon-replaced')) return;
            var src = img.getAttribute('src') || '';
            var alt = (img.getAttribute('alt') || '').toLowerCase();
            var phase = null;
            var match = src.match(/moon-([a-z-]+)\.png/i);
            if (match) phase = match[1];
            else if (alt) phase = alt.replace(/ /g, '-');
            var entry = moonPhaseMap[phase] || { icon: 'fa-moon', cls: '' };
            var i = document.createElement('i');
            i.className = 'fa-solid ' + entry.icon + ' dz-moon-fa' + (entry.cls ? ' ' + entry.cls : '');
            i.title = img.alt || phase || 'Moon';
            img.style.display = 'none';
            img.classList.add('dz-moon-replaced');
            img.parentNode.insertBefore(i, img);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', replaceMoonImages);
    } else {
        replaceMoonImages();
    }
    window.addEventListener('hashchange', replaceMoonImages);
    window._dzExtraProcessors = window._dzExtraProcessors || [];
    window._dzExtraProcessors.push(replaceMoonImages);
})();


/* ══════════════════════════════════════════════════════════════════
   MIND-BLOWING FEATURES
   ══════════════════════════════════════════════════════════════════ */


/* ── Features: 3D Tilt · Temperature Accent · Ambient Glow · Staleness · Flash observer ── */
(function () {
    'use strict';

    /* ── 3D Card Tilt (Feature 3) ─────────────────────────────────── */
    var TILT_MAX = 3; // degrees

    function applyTilt(card) {
        if (card._dzTiltAttached) return;
        card._dzTiltAttached = true;
        card.classList.add('dz-tilt-enabled');
        card.addEventListener('mousemove', function (e) {
            var rect = card.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            var dx = (e.clientX - cx) / (rect.width / 2);
            var dy = (e.clientY - cy) / (rect.height / 2);
            var rx = (-dy * TILT_MAX).toFixed(1);
            var ry = ( dx * TILT_MAX).toFixed(1);
            card.style.transform = 'perspective(700px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
        });
        card.addEventListener('mouseleave', function () {
            card.style.transform = '';
        });
    }

    /* ── Temperature-Reactive Card Accent (Feature 4) ─────────────── */
    var TEMP_ACCENT = [
        [  0, '#29b6f6'], //  ≤ 0 °C — ice blue
        [  5, '#29b6f6'], //  ≤ 5   — cold
        [ 10, '#4dd0e1'], //  ≤ 10  — cool
        [ 15, '#66bb6a'], //  ≤ 15  — mild
        [ 20, '#4caf7d'], //  ≤ 20  — comfortable
        [ 25, '#ffa726'], //  ≤ 25  — warm
        [ 30, '#ff7043'], //  ≤ 30  — hot
        [999, '#e05555']  //  > 30  — very hot
    ];

    function tempToAccentColor(c) {
        for (var i = 0; i < TEMP_ACCENT.length; i++) {
            if (c <= TEMP_ACCENT[i][0]) return TEMP_ACCENT[i][1];
        }
        return '#e05555';
    }

    function parseCelsius(text) {
        // Match "21.5 °C", "21.5°C", "21.5 C", "21.5 °F", "21.5 F" etc.
        var m = text.match(/([-\d.]+)\s*°?\s*([CF])\b/i);
        if (!m) return null;
        var v = parseFloat(m[1]);
        if (m[2].toUpperCase() === 'F') v = (v - 32) * 5 / 9;
        return v;
    }

    /* ── UV / Rain / Wind / Visibility accent colors ─────────────── */

    // UV index (WHO scale 0–11+)
    var UV_ACCENT = [
        [ 2, '#4caf7d'], // low
        [ 5, '#f0a832'], // moderate
        [ 7, '#ff7043'], // high
        [10, '#e05555'], // very high
        [99, '#9c27b0']  // extreme
    ];

    // Rain (mm — daily accumulation or current rate)
    var RAIN_ACCENT = [
        [  0, '#555770'], // dry
        [  2, '#64b5f6'], // light
        [ 10, '#1e88e5'], // moderate
        [ 25, '#1565c0'], // heavy
        [999, '#0d47a1']  // very heavy
    ];

    // Wind speed (m/s)
    var WIND_ACCENT = [
        [  1, '#b0b3c6'], // calm
        [  3, '#4caf7d'], // light breeze
        [  8, '#f0a832'], // moderate
        [ 14, '#ff7043'], // strong
        [999, '#e05555']  // storm
    ];

    // Visibility (km)
    var VIS_ACCENT = [
        [  1, '#e05555'], // very poor
        [  2, '#ff7043'], // poor
        [  5, '#f0a832'], // moderate
        [ 10, '#4e9af1'], // good
        [999, '#4caf7d']  // excellent
    ];

    function accentFromScale(scale, value) {
        for (var i = 0; i < scale.length; i++) {
            if (value <= scale[i][0]) return scale[i][1];
        }
        return scale[scale.length - 1][1];
    }

    function firstNumber(text) {
        var m = text.match(/([\d.]+)/);
        return m ? parseFloat(m[1]) : null;
    }

    // Convert wind speed to m/s regardless of unit
    function parseWindMs(text) {
        var m;
        m = text.match(/([\d.]+)\s*km\/h/i);
        if (m) return parseFloat(m[1]) / 3.6;
        m = text.match(/([\d.]+)\s*mph/i);
        if (m) return parseFloat(m[1]) * 0.447;
        m = text.match(/([\d.]+)\s*Bft/i);
        if (m) return parseFloat(m[1]); // Beaufort ≈ m/s close enough for color scale
        m = text.match(/([\d.]+)\s*m\/s/i);
        if (m) return parseFloat(m[1]);
        return null;
    }

    // Parse visibility, normalise to km
    function parseVisKm(text) {
        var m;
        m = text.match(/([\d.]+)\s*km/i);
        if (m) return parseFloat(m[1]);
        m = text.match(/([\d.]+)\s*m\b/i); // metres, not m/s
        if (m) return parseFloat(m[1]) / 1000;
        return null;
    }

    /* ── Bar-range accent: read configured ranges from Angular scope ── */

    function hexToRgbArr(hex) {
        if (!hex || hex[0] !== '#') return null;
        var n = parseInt(hex.slice(1), 16);
        if (isNaN(n)) return null;
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function rgbArrToHex(rgb) {
        return '#' + ((1 << 24) | (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]).toString(16).slice(1);
    }

    function lerpColor(c1, c2, t) {
        var a = hexToRgbArr(c1), b = hexToRgbArr(c2);
        if (!a || !b) return c1;
        return rgbArrToHex([
            Math.round(a[0] + (b[0] - a[0]) * t),
            Math.round(a[1] + (b[1] - a[1]) * t),
            Math.round(a[2] + (b[2] - a[2]) * t)
        ]);
    }

    function hexToRgba(hex, alpha) {
        var rgb = hexToRgbArr(hex);
        if (!rgb) return hex;
        return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + alpha + ')';
    }

    function resolveBarRangeGradient(card) {
        if (!window.angular) return null;
        var lastupdate = card.querySelector('td#lastupdate');
        if (!lastupdate) return null;
        var dzBarEl = lastupdate.querySelector('dz-bar');
        if (!dzBarEl) return null;
        try {
            var scope = angular.element(dzBarEl).isolateScope();
            if (!scope) return null;
            var ranges = scope.ranges;
            var val    = parseFloat(scope.value);
            if (!Array.isArray(ranges) || !ranges.length || isNaN(val)) return null;

            var sorted = ranges.map(function (r) {
                return { from: parseFloat(r.from), to: parseFloat(r.to), color: r.color };
            }).filter(function (r) { return !isNaN(r.from) && !isNaN(r.to) && r.color; });
            if (!sorted.length) return null;

            sorted.sort(function (a, b) { return Math.min(a.from, a.to) - Math.min(b.from, b.to); });

            // Compute the full span across all ranges
            var globalMin = Math.min(sorted[0].from, sorted[0].to);
            var globalMax = Math.max(sorted[sorted.length - 1].from, sorted[sorted.length - 1].to);
            var span = globalMax - globalMin;
            if (span <= 0) return null;

            // Build gradient stops: full opacity up to current value, low opacity beyond
            var valPct = Math.max(0, Math.min(100, ((val - globalMin) / span) * 100));
            var ACTIVE_ALPHA = 1;
            var FADED_ALPHA  = 0.25;
            var BLEND_HALF   = 2.0; // % on each side of a range boundary to blend across
            var stops = [];
            for (var i = 0; i < sorted.length; i++) {
                var lo = Math.min(sorted[i].from, sorted[i].to);
                var hi = Math.max(sorted[i].from, sorted[i].to);
                var pctStart = ((lo - globalMin) / span) * 100;
                var pctEnd   = ((hi - globalMin) / span) * 100;
                var col = sorted[i].color;
                // Shrink each range inward at boundaries shared with adjacent ranges so
                // CSS interpolates across the gap — producing a smooth color blend.
                var adjStart = pctStart + (i > 0 ? BLEND_HALF : 0);
                var adjEnd   = pctEnd   - (i < sorted.length - 1 ? BLEND_HALF : 0);

                if (pctEnd <= valPct) {
                    stops.push(hexToRgba(col, ACTIVE_ALPHA) + ' ' + adjStart.toFixed(1) + '%');
                    stops.push(hexToRgba(col, ACTIVE_ALPHA) + ' ' + adjEnd.toFixed(1) + '%');
                } else if (pctStart >= valPct) {
                    stops.push(hexToRgba(col, FADED_ALPHA) + ' ' + adjStart.toFixed(1) + '%');
                    stops.push(hexToRgba(col, FADED_ALPHA) + ' ' + adjEnd.toFixed(1) + '%');
                } else {
                    var clampedStart = Math.min(adjStart, valPct);
                    var clampedEnd   = Math.max(adjEnd,   valPct);
                    stops.push(hexToRgba(col, ACTIVE_ALPHA) + ' ' + clampedStart.toFixed(1) + '%');
                    stops.push(hexToRgba(col, ACTIVE_ALPHA) + ' ' + valPct.toFixed(1) + '%');
                    stops.push(hexToRgba(col, FADED_ALPHA)  + ' ' + valPct.toFixed(1) + '%');
                    stops.push(hexToRgba(col, FADED_ALPHA)  + ' ' + clampedEnd.toFixed(1) + '%');
                }
            }
            var gradient = 'linear-gradient(to right, ' + stops.join(', ') + ')';

            // Interpolated color at current value for the accent fallback
            var color = sorted[0].color;
            for (var j = 0; j < sorted.length; j++) {
                var rLo = Math.min(sorted[j].from, sorted[j].to);
                var rHi = Math.max(sorted[j].from, sorted[j].to);
                if (val >= rLo && val <= rHi) {
                    var t = (rHi - rLo) > 0 ? (val - rLo) / (rHi - rLo) : 0.5;
                    var next = (j + 1 < sorted.length) ? sorted[j + 1].color : null;
                    color = next ? lerpColor(sorted[j].color, next, t) : sorted[j].color;
                    break;
                }
            }

            return { gradient: gradient, color: color, valPct: valPct };
        } catch (e) {
            return null;
        }
    }

    function resolveBarRangeColor(card) {
        if (!window.angular) return null;
        var lastupdate = card.querySelector('td#lastupdate');
        if (!lastupdate) return null;
        var dzBarEl = lastupdate.querySelector('dz-bar');
        if (!dzBarEl) return null;
        try {
            var scope = angular.element(dzBarEl).isolateScope();
            if (!scope) return null;
            var ranges = scope.ranges;
            var val    = parseFloat(scope.value);
            if (!Array.isArray(ranges) || !ranges.length || isNaN(val)) return null;

            var sorted = ranges.map(function (r) {
                return { from: parseFloat(r.from), to: parseFloat(r.to), color: r.color };
            }).filter(function (r) { return !isNaN(r.from) && !isNaN(r.to) && r.color; });
            if (!sorted.length) return null;

            sorted.sort(function (a, b) { return Math.min(a.from, a.to) - Math.min(b.from, b.to); });

            for (var i = 0; i < sorted.length; i++) {
                var lo = Math.min(sorted[i].from, sorted[i].to);
                var hi = Math.max(sorted[i].from, sorted[i].to);
                if (val >= lo && val <= hi) {
                    var t = (hi - lo) > 0 ? (val - lo) / (hi - lo) : 0.5;
                    var next = (i + 1 < sorted.length) ? sorted[i + 1].color : null;
                    var prev = (i - 1 >= 0) ? sorted[i - 1].color : null;
                    if (next) return lerpColor(sorted[i].color, next, t);
                    if (prev) return lerpColor(prev, sorted[i].color, t);
                    return sorted[i].color;
                }
            }

            var firstLo = Math.min(sorted[0].from, sorted[0].to);
            if (val < firstLo) return sorted[0].color;
            return sorted[sorted.length - 1].color;
        } catch (e) {
            return null;
        }
    }

    function resolveAccentColor(btText, iconCls) {
        // Temperature
        var c = parseCelsius(btText);
        if (c === null && /fa-temperature|fa-thermometer/.test(iconCls)) {
            var nm = btText.match(/([-\d.]+)/);
            if (nm) c = parseFloat(nm[1]);
        }
        if (c !== null && !isNaN(c)) return tempToAccentColor(c);

        // UV (fa-sun shared with lux — use value range to distinguish: UV 0–12, lux can be 0–100000)
        if (/fa-sun/.test(iconCls)) {
            var n = firstNumber(btText);
            if (n !== null && n <= 15) return accentFromScale(UV_ACCENT, n);
        }

        // Rain
        if (/fa-cloud-showers|fa-cloud-rain|fa-droplet/.test(iconCls)) {
            var n = firstNumber(btText);
            if (n !== null) return accentFromScale(RAIN_ACCENT, n);
        }

        // Wind
        if (/fa-wind/.test(iconCls)) {
            var ms = parseWindMs(btText);
            if (ms === null) ms = firstNumber(btText); // fallback bare number
            if (ms !== null) return accentFromScale(WIND_ACCENT, ms);
        }

        // Visibility
        if (/fa-eye/.test(iconCls)) {
            var km = parseVisKm(btText);
            if (km === null) km = firstNumber(btText);
            if (km !== null) return accentFromScale(VIS_ACCENT, km);
        }

        return null;
    }

    /* ── Staleness Indicator (Feature 9) ─────────────────────────── */
    var STALE_MS = 24 * 60 * 60 * 1000; // 1 day

    function parseFooterDate(span) {
        /* Prefer the machine-readable epoch stored by processCards */
        var ts = span && span.dataset && span.dataset.ts;
        if (ts) return new Date(+ts);
        return null; // no data-ts → stale
    }

    function updateStaleness(card) {
        var span = card.querySelector('.dz-time');
        if (!span) return;
        var date = parseFooterDate(span);
        if (date && (Date.now() - date) < STALE_MS) {
            card.classList.remove('dz-stale');
        } else {
            card.classList.add('dz-stale');
        }
    }

    /* ── Main enhancement loop ───────────────────────────────────── */
    function enhanceCards() {
        var cards = document.querySelectorAll('div.item.itemBlock, .itemBlock > div.item');
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (!card.querySelector('table[id^="itemtable"]')) continue;

            applyTilt(card);
            updateStaleness(card);

            var bigtext = card.querySelector('td#bigtext');
            if (bigtext) {
                // Bar ranges (user-configured) take priority; fall back to our sensor-based color
                var rangeResult = resolveBarRangeGradient(card);
                if (rangeResult) {
                    card.classList.add('dz-temp-accent');
                    card.style.setProperty('--dz-temp-accent', rangeResult.color);
                } else {
                    var accentColor = resolveBarRangeColor(card);
                    if (!accentColor) {
                        var btText = bigtext.textContent || '';
                        var accentIcon = card.querySelector('i.dz-fa-device');
                        var accentCls  = accentIcon ? (accentIcon.className || '') : '';
                        accentColor = resolveAccentColor(btText, accentCls);
                    }
                    if (accentColor) {
                        card.classList.add('dz-temp-accent');
                        card.style.setProperty('--dz-temp-accent', accentColor);
                    }
                }
            }

        }
    }

    /* ── State-Change Flash (Feature 2) ──────────────────────────── */
    (function () {
        var stateObs = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                if (m.attributeName !== 'data-dz-state') return;
                var icon = m.target;
                var newState = icon.getAttribute('data-dz-state');
                // Walk up to card
                var el = icon;
                var card = null;
                while (el && el !== document.body) {
                    if (el.classList && el.classList.contains('item') && el.classList.contains('itemBlock')) {
                        card = el; break;
                    }
                    el = el.parentElement;
                }
                if (!card) return;

                // Flash ring
                card.classList.remove('dz-flash-on', 'dz-flash-off');
                void card.offsetWidth; // force reflow to restart animation
                card.classList.add(newState === 'on' ? 'dz-flash-on' : 'dz-flash-off');
                card.addEventListener('animationend', function rm() {
                    card.removeEventListener('animationend', rm);
                    card.classList.remove('dz-flash-on', 'dz-flash-off');
                });

            });
        });

        function watchIcons() {
            var icons = document.querySelectorAll('i.dz-fa-device:not([data-dz-watched])');
            icons.forEach(function (icon) {
                icon.setAttribute('data-dz-watched', '1');
                stateObs.observe(icon, { attributes: true, attributeFilter: ['data-dz-state'] });
            });
        }

        var domWatch = new MutationObserver(function () { watchIcons(); });
        function start() {
            watchIcons();
            domWatch.observe(document.body, { childList: true, subtree: true });
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
    })();

    window._dzExtraProcessors = window._dzExtraProcessors || [];
    window._dzExtraProcessors.push(enhanceCards);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enhanceCards);
    } else {
        enhanceCards();
    }
    window.addEventListener('hashchange', function () { setTimeout(enhanceCards, 350); });
})();


/* ── Update Page Enhancer ───────────────────────────────────────── */
/* Transforms the stock Domoticz update/restart page into the
   Nightglass styled version with SVG progress ring, icon wrap,
   and themed console output section.                              */
(function () {
    'use strict';

    var enhanced = false;

    function enhanceUpdatePage() {
        var uc = document.getElementById('updatecontent');
        if (!uc || enhanced) return;

        var center = uc.querySelector('center');
        if (!center) return;

        enhanced = true;

        /* ── 1. Inject spinning icon wrap before h1 ─────────────── */
        var h1 = center.querySelector('h1');
        if (h1 && !center.querySelector('.update-icon-wrap')) {
            var iconWrap = document.createElement('div');
            iconWrap.className = 'update-icon-wrap';
            iconWrap.innerHTML = '<i class="fa-solid fa-arrow-rotate-right update-spin-icon"></i>';
            center.insertBefore(iconWrap, h1);
        }

        /* ── 2. Hide the stock canvas progress (styled via CSS) ──── */
        var divProg = document.getElementById('divprogress');
        if (divProg) {

            /* ── 3. Style the warning span ──────────────────────── */
            var warnSpan = divProg.querySelector('span[ng-bind-html="bottomText"]');
            if (warnSpan && !warnSpan.classList.contains('update-warning')) {
                warnSpan.classList.add('update-warning');
                if (!warnSpan.querySelector('i')) {
                    warnSpan.insertAdjacentHTML('afterbegin', '<i class="fa-solid fa-triangle-exclamation"></i> ');
                }
            }
        }

        /* ── 4. Wrap the console output section ─────────────────── */
        var consoleEl = document.getElementById('updateconsole');
        if (consoleEl && !consoleEl.closest('.update-output-section')) {
            var showDiv = consoleEl.parentElement;
            if (showDiv) {
                showDiv.classList.add('update-output-section');
                /* Replace the plain h4 with themed one */
                var h4 = showDiv.querySelector('h4');
                if (h4 && !h4.querySelector('i')) {
                    h4.innerHTML = '<i class="fa-solid fa-terminal"></i> ' + h4.textContent;
                }
                /* Strip inline styles from pre so CSS takes over */
                consoleEl.removeAttribute('style');
            }
        }
    }

    /* Run on load and watch for the update page appearing */
    function init() {
        enhanceUpdatePage();
        var obs = new MutationObserver(function () {
            if (!enhanced) enhanceUpdatePage();
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    window.addEventListener('hashchange', function () {
        enhanced = false;
        setTimeout(enhanceUpdatePage, 300);
    });
})();
