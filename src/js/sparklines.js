(function () {
    'use strict';

    var SENSORS    = ['temp', 'counter', 'Percentage', 'uv', 'rain', 'wind'];
    var VALUE_KEYS = ['v', 'v_max', 'te', 'hu', 'ba', 'sp', 'u', 'lux', 'mm', 'baro'];
    var cache      = {}; // idx → values[]

    function svgSparkline(values, idx) {
        var W = 100, H = 100;
        // Leave breathing room top/bottom so the line isn't clipped
        var TOP = 15, BOT = 5;
        var min = Infinity, max = -Infinity;
        for (var i = 0; i < values.length; i++) {
            if (values[i] < min) min = values[i];
            if (values[i] > max) max = values[i];
        }
        var range = max - min || 1;
        var step  = W / (values.length - 1);
        var pts   = values.map(function (v, i) {
            var x = (i * step).toFixed(2);
            var y = (TOP + (1 - (v - min) / range) * (H - TOP - BOT)).toFixed(2);
            return x + ',' + y;
        });
        var linePts  = pts.join(' ');
        // Close the area path along the bottom edge
        var areaPath = 'M' + pts[0] +
                       ' L' + pts.join(' L') +
                       ' L' + (W) + ',' + H + ' L0,' + H + ' Z';
        // Resolve accent color at render time (CSS vars don't resolve in innerHTML SVGs)
        var color = getComputedStyle(document.documentElement)
                        .getPropertyValue('--dz-accent-color').trim() || '#4e9af1';
        var gid = 'dzsg' + (idx || '0');
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"' +
               ' xmlns="http://www.w3.org/2000/svg">' +
               '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
               '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.9"/>' +
               '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.1"/>' +
               '</linearGradient></defs>' +
               '<path d="' + areaPath + '" fill="url(#' + gid + ')"/>' +
               '<polyline points="' + linePts + '" fill="none" stroke="' + color + '"' +
               ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
               '</svg>';
    }

    // Base path: strips the hash and trailing filename, keeps the directory
    // e.g. "http://server:8080/"        → ""
    //      "http://server/domoticz/"    → "domoticz/"
    var BASE = (function () {
        var p = window.location.pathname.replace(/\/[^/]*$/, '/');
        return p;
    })();

    function tryNextSensor(idx, wrap, si) {
        if (si >= SENSORS.length) return;
        var url = BASE + 'json.htm?type=command&param=graph&sensor=' + SENSORS[si] + '&idx=' + idx + '&range=day';
        fetch(url, { credentials: 'same-origin', cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var result = data && data.result;
                if (!result || !result.length) { tryNextSensor(idx, wrap, si + 1); return; }
                var field = null;
                VALUE_KEYS.forEach(function (k) {
                    if (field === null && result[0][k] !== undefined) field = k;
                });
                if (!field) { tryNextSensor(idx, wrap, si + 1); return; }
                var vals = result.map(function (r) { return parseFloat(r[field]); })
                                 .filter(function (v) { return !isNaN(v); });
                if (vals.length < 4) { tryNextSensor(idx, wrap, si + 1); return; }
                cache[idx] = vals;
                wrap.innerHTML = svgSparkline(vals, idx);
                wrap.style.display = '';
            })
            .catch(function () { tryNextSensor(idx, wrap, si + 1); });
    }

    function getCardIdx(card) {
        // Primary: Angular scope has item.idx
        if (window.angular) {
            try {
                var scope = angular.element(card).scope();
                if (scope) {
                    var item = scope.item || scope.device || scope.widget;
                    if (item && item.idx) return String(item.idx);
                }
            } catch (e) {}
        }
        // Fallback: numeric suffix in the itemtable id
        var tbl = card.querySelector('table[id^="itemtable"]');
        if (tbl) {
            var m = tbl.id.match(/\d+/);
            if (m) return m[0];
        }
        return null;
    }

    function addSparklines() {
        var cards = document.querySelectorAll('div.item.itemBlock, .itemBlock > div.item');
        for (var c = 0; c < cards.length; c++) {
            var card = cards[c];
            if (card.querySelector('.dz-sparkline-wrap')) continue;
            if (!card.querySelector('table[id^="itemtable"]')) continue;
            // Any card showing a numeric reading is a candidate
            var bigtext = card.querySelector('td#bigtext');
            if (!bigtext || !/\d/.test(bigtext.textContent || '')) continue;
            var idx = getCardIdx(card);
            if (!idx) continue;
            // Ensure card is a positioning context for the absolute overlay
            card.style.position = 'relative';
            var wrap = document.createElement('div');
            wrap.className = 'dz-sparkline-wrap';
            wrap.style.display = 'none';
            // Insert as first child so it sits behind all card content
            card.insertBefore(wrap, card.firstChild);
            if (cache[idx]) {
                wrap.innerHTML = svgSparkline(cache[idx], idx);
                wrap.style.display = '';
            } else {
                tryNextSensor(idx, wrap, 0);
            }
        }
    }

    // addSparklines is NOT in _dzExtraProcessors (avoids flooding param=graph calls).
    // It runs on DOMContentLoaded (with retries, since Angular renders after DOMContentLoaded),
    // on hashchange, and on Angular's $routeChangeSuccess.
    function scheduleSparklineInit() {
        // Three retries to catch Angular's lazy rendering on initial load / route change
        setTimeout(addSparklines, 400);
        setTimeout(addSparklines, 1200);
        setTimeout(addSparklines, 2500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleSparklineInit);
    } else {
        scheduleSparklineInit();
    }
    window.addEventListener('hashchange', scheduleSparklineInit);

    // ── Sparkline Auto-Refresh ────────────────────────────────────────
    // Re-fetches a device's sparkline data when its displayed value changes,
    // using a rolling 1-hour window to keep datasets lean on always-on tablets.

    var MAX_POINTS       = 60;         // rolling cap: ~1 h at 1-min update intervals
    var REFRESH_COOLDOWN = 30 * 1000;  // ignore re-triggers for same device within 30 s
    var lastRefresh      = {};         // idx → timestamp (ms)

    function findCardByIdx(idx) {
        var tbl = document.getElementById('itemtable' + idx);
        if (!tbl) return null;
        var el = tbl.parentElement;
        while (el && el !== document.body) {
            if (el.classList.contains('itemBlock')) return el;
            if (el.classList.contains('item') &&
                el.parentElement && el.parentElement.classList.contains('itemBlock')) return el;
            el = el.parentElement;
        }
        return null;
    }

    function refreshSingle(idx) {
        var now = Date.now();
        if (lastRefresh[idx] && (now - lastRefresh[idx]) < REFRESH_COOLDOWN) return;
        lastRefresh[idx] = now;

        // Guard: only fetch for cards that already have a sparkline wrap.
        // Do NOT capture card/wrap here — Angular can re-render the card while
        // the HTTP request is in flight, leaving those references stale/detached.
        var guardCard = findCardByIdx(idx);
        if (!guardCard || !guardCard.querySelector('.dz-sparkline-wrap')) return;

        (function fetchHour(si) {
            if (si >= SENSORS.length) return;
            var url = BASE + 'json.htm?type=command&param=graph&sensor=' + SENSORS[si] +
                      '&idx=' + idx + '&range=hour';
            fetch(url, { credentials: 'same-origin', cache: 'no-store' })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    var result = data && data.result;
                    if (!result || !result.length) { fetchHour(si + 1); return; }
                    var field = null;
                    VALUE_KEYS.forEach(function (k) {
                        if (field === null && result[0][k] !== undefined) field = k;
                    });
                    if (!field) { fetchHour(si + 1); return; }
                    var vals = result.map(function (r) { return parseFloat(r[field]); })
                                     .filter(function (v) { return !isNaN(v); });
                    if (vals.length < 2) { fetchHour(si + 1); return; }
                    if (vals.length > MAX_POINTS) vals = vals.slice(vals.length - MAX_POINTS);
                    cache[idx] = vals;
                    // Re-look up card and wrap from live DOM — the pre-fetch
                    // reference (guardCard) may now be detached/stale.
                    var card = findCardByIdx(idx);
                    if (!card) return;
                    var wrap = card.querySelector('.dz-sparkline-wrap');
                    if (!wrap) {
                        // Wrap was removed while request was in flight — re-insert.
                        card.style.position = 'relative';
                        wrap = document.createElement('div');
                        wrap.className = 'dz-sparkline-wrap';
                        card.insertBefore(wrap, card.firstChild);
                    }
                    wrap.innerHTML = svgSparkline(vals, idx);
                    wrap.style.display = '';
                })
                .catch(function () { fetchHour(si + 1); });
        })(0);
    }

    // Read the current bigtext value from the DOM and append to cache — no HTTP.
    function appendFromBigtext(idx, td) {
        if (!cache[idx]) return;
        var text = td ? (td.textContent || td.innerText || '') : '';
        var val = parseSparklineValue(text);
        if (isNaN(val)) return;
        cache[idx].push(val);
        if (cache[idx].length > MAX_POINTS) cache[idx].splice(0, cache[idx].length - MAX_POINTS);
        lastRefresh[idx] = Date.now();
        var snap = cache[idx].slice();
        setTimeout(function () {
            var card = findCardByIdx(idx);
            if (!card) return;
            var wrap = card.querySelector('.dz-sparkline-wrap');
            if (!wrap) return;
            wrap.innerHTML = svgSparkline(snap, idx);
            wrap.style.display = '';
        }, 0);
    }

    // Watch for bigtext mutations (Angular rewrites text nodes when a device updates)
    var _sparkObs = null;
    function startSparklineObserver() {
        if (_sparkObs || !window.MutationObserver) return;
        _sparkObs = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var target = mutations[i].target;
                var td = null;
                if (target.id === 'bigtext' && target.tagName === 'TD') {
                    td = target;
                } else if (target.querySelector) {
                    td = target.querySelector('td#bigtext');
                }
                if (!td) continue;
                var card = td.closest
                    ? td.closest('div.item.itemBlock, .itemBlock > div.item')
                    : null;
                if (!card) continue;
                var idx = getCardIdx(card);
                // Use DOM value directly — zero HTTP calls
                if (idx) appendFromBigtext(idx, td);
            }
        });
        if (!document.body) return;
        _sparkObs.observe(document.body, { subtree: true, childList: true });
    }

    // Safety-net: re-fetch graph data every 10 min as absolute fallback.
    // Normal updates come from device_update (WebSocket) + bigtext DOM observer.
    function schedulePeriodicRefresh() {
        setInterval(function () {
            var cards = document.querySelectorAll('div.item.itemBlock, .itemBlock > div.item');
            for (var c = 0; c < cards.length; c++) {
                var wrap = cards[c].querySelector('.dz-sparkline-wrap');
                if (!wrap || wrap.style.display === 'none') continue;
                var idx = getCardIdx(cards[c]);
                if (idx) refreshSingle(idx);
            }
        }, 10 * 60 * 1000); // 10-min absolute fallback only
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startSparklineObserver);
    } else {
        startSparklineObserver();
    }
    schedulePeriodicRefresh();

    // ── WebSocket-driven sparkline updates ───────────────────────────
    // Appends new sensor values directly from Angular's device_update event
    // (broadcast whenever Domoticz's WebSocket feed delivers a device change),
    // completely replacing the HTTP-fetch path for subsequent data points.

    function parseSparklineValue(data) {
        // Extracts the leading numeric value from strings like "21.5 C",
        // "45 %", "250 Watt", "1.234 kWh", etc.  Returns NaN for non-numeric
        // payloads like "On" / "Off" so those are silently skipped.
        if (!data) return NaN;
        var m = String(data).match(/^-?[\d.]+/);
        return m ? parseFloat(m[0]) : NaN;
    }

    function wsAppendSparkline(device) {
        var idx = String(device.idx || device.ID || '');
        if (!idx || !cache[idx]) return; // only update sparklines already seeded with history

        var val = parseSparklineValue(device.Data || '');
        if (isNaN(val)) return;

        // Append and trim rolling window
        cache[idx].push(val);
        if (cache[idx].length > MAX_POINTS) cache[idx].splice(0, cache[idx].length - MAX_POINTS);

        // Update lastRefresh immediately so the periodic-refresh path won't
        // fire an HTTP fetch for 30 s after this real-time update.
        lastRefresh[idx] = Date.now();

        // Defer DOM update to AFTER Angular's digest cycle.  The $on handler
        // fires while Angular is still digesting; updating innerHTML now can
        // be overwritten when Angular finishes re-rendering the card bindings.
        // setTimeout(fn, 0) lets Angular finish first.
        var snapCache = cache[idx].slice(); // snapshot so late mutations don't affect this paint
        setTimeout(function () {
            var card = findCardByIdx(idx);
            if (!card) return;
            var wrap = card.querySelector('.dz-sparkline-wrap');
            if (!wrap) {
                // Angular re-rendered the card and removed our wrap — re-insert it
                card.style.position = 'relative';
                wrap = document.createElement('div');
                wrap.className = 'dz-sparkline-wrap';
                card.insertBefore(wrap, card.firstChild);
            }
            wrap.innerHTML = svgSparkline(snapCache, idx);
            wrap.style.display = '';
        }, 0);
    }

    function refreshAllVisible() {
        // Refresh every visible sparkline card via HTTP (respects REFRESH_COOLDOWN).
        // Called on time_update (~60 s) so sparklines stay fresh even when
        // device_update events are not broadcast for sensor-type devices.
        var cards = document.querySelectorAll('div.item.itemBlock, .itemBlock > div.item');
        for (var c = 0; c < cards.length; c++) {
            var wrap = cards[c].querySelector('.dz-sparkline-wrap');
            if (!wrap || wrap.style.display === 'none') continue;
            var idx = getCardIdx(cards[c]);
            if (idx) refreshSingle(idx);
        }
    }

    // Flash a device card when it receives a WebSocket update.
    // Works for ALL device types (sensors included), not just those whose icon src changes.
    var _flashTs = {}; // idx → last flash timestamp (prevents rapid re-flashing)
    var FLASH_MIN_INTERVAL = 1500; // ms

    function wsFlashCard(device) {
        var idx = String(device.idx || device.ID || '');
        if (!idx) return;
        var now = Date.now();
        if (_flashTs[idx] && now - _flashTs[idx] < FLASH_MIN_INTERVAL) return;
        _flashTs[idx] = now;

        var s = device.Status || '';
        var on = (['On', 'Group On', 'Chime', 'Panic', 'Mixed'].indexOf(s) >= 0 ||
                  s.indexOf('Set ') === 0 || s.indexOf('NightMode') === 0 || s.indexOf('Disco ') === 0);
        // Sensors have no binary state — always use the positive (blue) flash
        var hasBinary = (device.Type === 'Scene' || device.Type === 'Group' ||
                         (device.SwitchType && device.SwitchType.length > 0));
        var cls = (!hasBinary || on) ? 'dz-flash-on' : 'dz-flash-off';

        setTimeout(function () {
            // Primary lookup: standard dashboard/switch card via itemtable{idx}
            var flashEl = findCardByIdx(idx);

            // Always use the outermost itemBlock so outline isn't clipped by inner overflow
            if (flashEl && !flashEl.classList.contains('itemBlock')) {
                var outer = flashEl.closest ? flashEl.closest('.itemBlock') : flashEl.parentElement;
                if (outer) flashEl = outer;
            }

            // Fallback: weather widgets use id="{idx}" directly inside #weatherwidgets
            if (!flashEl) {
                var byId = document.getElementById(idx);
                if (byId) flashEl = byId;
            }

            // Fallback: any element whose id ends with the idx (covers various page templates)
            if (!flashEl) {
                var any = document.querySelector('[id$="_' + idx + '"], [id="domoticz_' + idx + '"]');
                if (any) flashEl = any;
            }

            if (!flashEl) return;

            flashEl.classList.remove('dz-flash-on', 'dz-flash-off');
            void flashEl.offsetWidth; // reflow so animation restarts if already playing
            flashEl.classList.add(cls);
            flashEl.addEventListener('animationend', function rm() {
                flashEl.removeEventListener('animationend', rm);
                flashEl.classList.remove('dz-flash-on', 'dz-flash-off');
            });
        }, 0);
    }

    function attachSparklineWsHook() {
        if (!window.angular) { setTimeout(attachSparklineWsHook, 600); return; }
        var bodyEl = angular.element(document.body);
        if (!bodyEl || !bodyEl.injector || !bodyEl.injector()) { setTimeout(attachSparklineWsHook, 400); return; }
        try {
            var $rootScope = bodyEl.injector().get('$rootScope');
            $rootScope.$on('device_update', function (evt, device) {
                wsAppendSparkline(device);
                wsFlashCard(device);
            });
            $rootScope.$on('scene_update', function (evt, scene) {
                wsFlashCard(scene);
            });
            // Re-seed sparklines after Angular route changes
            $rootScope.$on('$routeChangeSuccess', function () {
                scheduleSparklineInit();
            });
        } catch (e) {
            setTimeout(attachSparklineWsHook, 600);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachSparklineWsHook);
    } else {
        attachSparklineWsHook();
    }
})();
