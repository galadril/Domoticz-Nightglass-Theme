(function () {
    'use strict';

    // ── State ──────────────────────────────────────────────────────
    var _overlay    = null;
    var _input      = null;
    var _list       = null;
    var _activeIdx  = -1;
    var _allDevices = [];       // full list from API
    var _recentMap  = {};       // idx → { device, ts }
    var _recentKeys = [];       // sorted idx list, most-recent first
    var _fetched    = false;

    // ── Device data ────────────────────────────────────────────────

    function fetchAll() {
        var url = 'json.htm?type=command&param=getdevices&filter=all&used=true&order=Name';
        fetch(url, { credentials: 'same-origin', cache: 'no-store' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data && data.result) { _allDevices = data.result; }
                _fetched = true;
            })
            .catch(function () { _fetched = true; });
    }

    function patchDevice(d) {
        var idx = String(d.idx || d.ID || '');
        if (!idx) return;
        for (var i = 0; i < _allDevices.length; i++) {
            if (String(_allDevices[i].idx) === idx) {
                var keys = Object.keys(d);
                for (var k = 0; k < keys.length; k++) _allDevices[i][keys[k]] = d[keys[k]];
                break;
            }
        }
        _recentMap[idx] = { device: d, ts: Date.now() };
        _recentKeys = Object.keys(_recentMap)
            .sort(function (a, b) { return _recentMap[b].ts - _recentMap[a].ts; })
            .slice(0, 24);
        if (_overlay && _input && !_input.value.trim()) render('');
    }

    // ── Icon lookup ────────────────────────────────────────────────

    function iconFor(device) {
        // 1. Best: read the already-resolved FA icon from the live DOM card
        var tbl = document.getElementById('itemtable' + device.idx);
        if (tbl) {
            var fa = tbl.querySelector('i.dz-fa-device');
            if (fa) {
                // Return the full icon class string (e.g. "fa-solid fa-lightbulb")
                var parts = fa.className.split(' ').filter(function (c) {
                    return c === 'fa-solid' || c === 'fa-regular' || c.indexOf('fa-') === 0;
                });
                // Remove helper classes
                parts = parts.filter(function (c) {
                    return c !== 'dz-fa-device' && c !== 'dz-wind';
                });
                if (parts.length) return parts.join(' ');
            }
        }
        // 2. Use the icon replacement system's resolver via TypeImg
        if (window._dzIconForDevice && device.TypeImg) {
            var r = window._dzIconForDevice(device);
            if (r && r.icon) return r.icon;
        }
        // 3. Last resort: basic type-based fallbacks
        var t  = (device.Type       || '').toLowerCase();
        var st = (device.SwitchType || '').toLowerCase();
        var sub = (device.SubType   || '').toLowerCase();
        if (t.indexOf('temp')    >= 0) return 'fa-solid fa-temperature-half';
        if (t.indexOf('color')   >= 0 || t.indexOf('light') >= 0) return 'fa-solid fa-lightbulb';
        if (t === 'scene')              return 'fa-solid fa-play-circle';
        if (t === 'group')              return 'fa-solid fa-layer-group';
        if (t.indexOf('wind')    >= 0) return 'fa-solid fa-wind';
        if (t.indexOf('rain')    >= 0) return 'fa-solid fa-cloud-showers-heavy';
        if (t.indexOf('humid')   >= 0) return 'fa-solid fa-droplet';
        if (t.indexOf('p1')      >= 0 || t.indexOf('usage') >= 0 ||
            sub.indexOf('electric')>= 0)  return 'fa-solid fa-bolt';
        if (t.indexOf('current') >= 0) return 'fa-solid fa-gauge';
        if (t.indexOf('general') >= 0 && sub.indexOf('counter') >= 0) return 'fa-solid fa-hashtag';
        if (st.indexOf('blind')  >= 0) return 'fa-solid fa-chevron-down';
        if (st.indexOf('door lock') >= 0) return 'fa-solid fa-lock';
        if (st.indexOf('door')   >= 0) return 'fa-solid fa-door-closed';
        if (st.indexOf('motion') >= 0) return 'fa-solid fa-person-running';
        if (st.indexOf('smoke')  >= 0) return 'fa-solid fa-triangle-exclamation';
        if (st.indexOf('contact')>= 0) return 'fa-solid fa-sensor';
        if (st.indexOf('dimmer') >= 0) return 'fa-solid fa-circle-half-stroke';
        return 'fa-solid fa-circle-dot';
    }

    // ── Device state helpers ───────────────────────────────────────

    function isOn(d) {
        var s = d.Status || '';
        return ['On','Group On','Chime','Panic','Mixed'].indexOf(s) >= 0 ||
               s.indexOf('Set ') === 0 ||
               s.indexOf('NightMode') === 0 ||
               s.indexOf('Disco ') === 0;
    }

    function isToggleable(d) {
        var t  = d.Type       || '';
        var st = d.SwitchType || '';
        if (t === 'Scene' || t === 'Group') return true;
        var lights = ['Light/Switch','Lighting 1','Lighting 2','Lighting 5',
                      'Lighting 6','Color Switch','Chime'];
        if (lights.indexOf(t) < 0) return false;
        var readOnly = ['Door Contact','Contact','Motion Sensor','Dusk Sensor'];
        return readOnly.indexOf(st) < 0;
    }

    function isDimmer(d) {
        return ['Dimmer','Blinds Percentage','Blinds % + Stop']
               .indexOf(d.SwitchType || '') >= 0;
    }

    // Derive a display unit for sensor devices that return bare numbers
    function _derivedUnit(d) {
        if (d.SensorUnit) return d.SensorUnit;
        var sub  = (d.SubType || '').toLowerCase();
        var type = (d.Type    || '').toLowerCase();
        var sw   = d.SwitchTypeVal;
        if (sub === 'electric' || type === 'usage')            return 'W';
        if (sub === 'gas'   || sub === 'water')                return 'm\u00b3';
        if (sub === 'kwh'   || sub === 'managed counter')      return 'kWh';
        if (sub === 'counter incremental')                     return '';
        if (sub === 'voltage' || sub === 'a/d')                return 'mV';
        if (sub === 'current' || type === 'current')           return 'A';
        if (sub === 'pressure')                                return 'Bar';
        if (sub === 'lux')                                     return 'lx';
        if (sub === 'percentage' || sub === 'humidity')        return '%';
        if (sub === 'visibility')                              return sw === 1 ? 'mi' : 'km';
        if (sub === 'solar radiation')                         return 'W/m\u00b2';
        if (type === 'rain')                                   return 'mm';
        return '';
    }

    function stateLabel(d) {
        // Toggleable devices: prefer Status ("On" / "Off" / "Set 75 %")
        if (isToggleable(d)) return d.Status || d.Data || '';
        var data = (d.Data || '').trim();
        if (!data) return d.Status || '';

        // Take only the first ';'- or newline-separated segment
        var first = data.split(/[;\n]/)[0].trim();

        // Strip "Label: value" prefixes produced by P1/counter devices
        // e.g. "Usage1: 1234.567 kWh" → "1234.567 kWh"
        first = first.replace(/^[A-Za-z][A-Za-z0-9 _]*:\s*/, '');

        // If the result is still a bare number, append the derived unit
        if (/^-?\d+(\.\d+)?$/.test(first)) {
            var unit = _derivedUnit(d);
            if (unit) first += '\u00a0' + unit;
        }

        return first || d.Status || '';
    }

    // Maps a device to the Domoticz Angular route where it appears
    function deviceRoute(d) {
        var t  = (d.Type        || '').toLowerCase();
        var st = (d.SwitchType  || '').toLowerCase();
        if (t === 'scene' || t === 'group')                        return '/Scenes';
        if (t.indexOf('temp') >= 0 || t.indexOf('humid') >= 0)    return '/Temperature';
        if (t.indexOf('wind') >= 0 || t.indexOf('rain') >= 0 ||
            t.indexOf('uv')   >= 0 || t.indexOf('baro') >= 0)     return '/Weather';
        if (t.indexOf('light')   >= 0 || t.indexOf('color')  >= 0 ||
            t.indexOf('lighting')>= 0 || t.indexOf('chime')  >= 0 ||
            st.indexOf('dimmer') >= 0 || st.indexOf('blind')  >= 0 ||
            st.indexOf('door')   >= 0 || st.indexOf('motion') >= 0 ||
            st.indexOf('contact')>= 0 || st.indexOf('smoke')  >= 0)
                                                                   return '/LightSwitches';
        return '/Utility';
    }

    // ── API calls ──────────────────────────────────────────────────

    function apiToggle(d, cb) {
        var param = (d.Type === 'Scene' || d.Type === 'Group')
            ? 'switchscene' : 'switchlight';
        var cmd;
        if (d.Type === 'Group') {
            cmd = isOn(d) ? 'Off' : 'On';
        } else if (d.Type === 'Scene') {
            cmd = 'On';
        } else {
            cmd = 'Toggle';
        }
        fetch('json.htm?type=command&param=' + param +
              '&idx=' + d.idx + '&switchcmd=' + cmd,
              { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function () {
                if (cmd === 'Toggle') {
                    d.Status = isOn(d) ? 'Off' : 'On';
                } else {
                    d.Status = cmd;
                }
                if (cb) cb(d);
            })
            .catch(function () {});
    }

    function apiSetLevel(d, level, cb) {
        fetch('json.htm?type=command&param=switchlight&idx=' + d.idx +
              '&switchcmd=Set+Level&level=' + level,
              { credentials: 'same-origin' })
            .then(function () { if (cb) cb(); })
            .catch(function () {});
    }

    // ── Fuzzy search ───────────────────────────────────────────────

    function matches(name, q) {
        if (!q) return true;
        var n = name.toLowerCase(), ql = q.toLowerCase();
        if (n.indexOf(ql) >= 0) return true;
        var qi = 0;
        for (var i = 0; i < n.length && qi < ql.length; i++) {
            if (n[i] === ql[qi]) qi++;
        }
        return qi === ql.length;
    }

    function score(name, q) {
        var n = name.toLowerCase(), ql = q.toLowerCase();
        if (n === ql)                  return 120;
        if (n.indexOf(ql) === 0)       return 100;
        if (n.indexOf(ql) > 0)         return 80;
        var words = n.split(/[\s_\-]+/);
        for (var w = 0; w < words.length; w++) {
            if (words[w].indexOf(ql) === 0) return 70;
        }
        return 30;
    }

    // ── DOM helpers ────────────────────────────────────────────────

    function esc(s) {
        return String(s || '')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function highlight(text, q) {
        if (!q) return esc(text);
        var escaped = esc(text);
        var qe = esc(q);
        var idx = escaped.toLowerCase().indexOf(qe.toLowerCase());
        if (idx < 0) return escaped;
        return escaped.slice(0, idx) +
               '<mark class="dz-cmd-mark">' + escaped.slice(idx, idx + qe.length) + '</mark>' +
               escaped.slice(idx + qe.length);
    }

    // ── Render ─────────────────────────────────────────────────────

    function render(query) {
        if (!_list) return;
        var q      = query.trim();
        var items;
        var showRecent = !q;

        if (!_fetched && _allDevices.length === 0) {
            _list.innerHTML =
                '<div class="dz-cmd-loading">' +
                '<i class="fa-solid fa-circle-notch fa-spin"></i> Loading devices\u2026</div>';
            return;
        }

        if (showRecent) {
            // Default: show favorites (Favorite == 1), sorted by name
            var favs = _allDevices.filter(function (d) { return d.Favorite == 1; });
            favs.sort(function (a, b) { return (a.Name || '').localeCompare(b.Name || ''); });
            if (favs.length > 0) {
                items = favs.slice(0, 12);
            } else {
                // No favorites set — fall back to recently changed
                var recentDevices = _recentKeys
                    .map(function (k) { return _recentMap[k] && _recentMap[k].device; })
                    .filter(Boolean)
                    .slice(0, 8);
                var seen = {};
                recentDevices.forEach(function (d) { seen[String(d.idx)] = true; });
                var fill = _allDevices
                    .filter(function (d) { return !seen[String(d.idx)]; })
                    .slice(0, Math.max(0, 8 - recentDevices.length));
                items = recentDevices.concat(fill);
            }
        } else {
            items = _allDevices
                .filter(function (d) { return matches(d.Name || '', q); })
                .sort(function (a, b) { return score(b.Name||'',q) - score(a.Name||'',q); })
                .slice(0, 12);
        }

        _list.innerHTML = '';
        _activeIdx = -1;

        if (items.length === 0) {
            _list.innerHTML = '<div class="dz-cmd-empty">No devices found for \u201c' + esc(q) + '\u201d</div>';
            return;
        }

        if (showRecent) {
            var hdr2 = document.createElement('div');
            hdr2.className = 'dz-cmd-section';
            var favCount = _allDevices.filter(function (d) { return d.Favorite == 1; }).length;
            hdr2.textContent = favCount > 0 ? 'Favorites' : 'Recently Changed';
            _list.appendChild(hdr2);
        } else {
            // Show "Search Results" header when actively searching
            var hdr3 = document.createElement('div');
            hdr3.className = 'dz-cmd-section';
            hdr3.textContent = 'Search Results';
            _list.appendChild(hdr3);
        }

        items.forEach(function (device, i) {
            _list.appendChild(buildItem(device, i, q));
        });
    }

    function buildItem(device, index, query) {
        var el  = document.createElement('div');
        var on  = isOn(device);
        var tog = isToggleable(device);
        var dim = isDimmer(device);
        el.className = 'dz-cmd-item';
        el.setAttribute('data-index', index);

        var iconWrap = document.createElement('div');
        iconWrap.className = 'dz-cmd-icon' + (on ? ' dz-cmd-icon--on' : '');
        iconWrap.innerHTML = '<i class="' + iconFor(device) + '"></i>';
        el.appendChild(iconWrap);

        var body = document.createElement('div');
        body.className = 'dz-cmd-body';
        var nameEl = document.createElement('div');
        nameEl.className = 'dz-cmd-name';
        nameEl.innerHTML = highlight(device.Name || '', query);
        body.appendChild(nameEl);
        var metaEl = document.createElement('div');
        metaEl.className = 'dz-cmd-meta';
        var parts = [];
        if (device.Type) parts.push(device.Type);
        if (device.SwitchType && device.SwitchType !== device.Type) parts.push(device.SwitchType);
        metaEl.textContent = parts.join(' \u00b7 ');
        body.appendChild(metaEl);
        el.appendChild(body);

        var stateEl = document.createElement('div');
        stateEl.className = 'dz-cmd-state' + (on ? ' dz-cmd-state--on' : '');
        stateEl.textContent = stateLabel(device);
        el.appendChild(stateEl);

        // Navigate button — always present, visible on hover / keyboard focus
        var navBtn = document.createElement('button');
        navBtn.className = 'dz-cmd-nav-btn';
        navBtn.title = 'Go to device page (Shift+\u21b5)';
        navBtn.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
        navBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            navigateToDevice(device);
        });
        el.appendChild(navBtn);

        // Toggle hint — only shown for toggleable devices
        if (tog || dim) {
            var hint = document.createElement('div');
            hint.className = 'dz-cmd-hint';
            hint.innerHTML = '<kbd>\u21b5</kbd>';
            el.appendChild(hint);
        }

        // Store device reference for keyboard Shift+Enter
        el._dzDevice = device;

        var sliderRow = null;
        if (dim) {
            sliderRow = document.createElement('div');
            sliderRow.className = 'dz-cmd-slider-row';
            var level = parseInt(device.Level || 0, 10) || 0;
            sliderRow.innerHTML =
                '<input type="range" class="dz-cmd-slider" min="0" max="100" step="5" value="' + level + '">' +
                '<span class="dz-cmd-slider-val">' + level + '%</span>';
            var slider  = sliderRow.querySelector('.dz-cmd-slider');
            var valSpan = sliderRow.querySelector('.dz-cmd-slider-val');
            slider.addEventListener('input', function () {
                valSpan.textContent = this.value + '%';
            });
            slider.addEventListener('change', function () {
                apiSetLevel(device, this.value, function () {
                    device.Level = parseInt(slider.value, 10);
                    stateEl.textContent = slider.value + '%';
                });
            });
            slider.addEventListener('click', function (e) { e.stopPropagation(); });
            el.appendChild(sliderRow);
        }

        el.addEventListener('mouseenter', function () { setActive(index); });
        el.addEventListener('click', function (e) {
            if (e.target.classList.contains('dz-cmd-slider')) return;
            onActivate(device, el, stateEl, iconWrap, sliderRow);
        });

        return el;
    }

    function navigateToDevice(device) {
        var route = deviceRoute(device);
        closePalette();
        // Always navigate to the device's type page so the user lands in the right section.
        // Use Angular's $location if available (fires $routeChangeSuccess properly);
        // fall back to direct hash assignment.
        setTimeout(function () {
            try {
                var injector = window.angular && angular.element(document.body).injector();
                var $location  = injector && injector.get('$location');
                var $rootScope = injector && injector.get('$rootScope');
                if ($location && $rootScope) {
                    $rootScope.$apply(function () { $location.path(route); });
                    // Scroll to and highlight the device after navigation
                    setTimeout(function() {
                        var card = document.getElementById('itemtable' + device.idx);
                        if (card) {
                            var cardEl = card.closest('div.item.itemBlock, .itemBlock > div.item');
                            if (cardEl) {
                                cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                cardEl.classList.add('dz-flash-on');
                                setTimeout(function() { cardEl.classList.remove('dz-flash-on'); }, 700);
                            }
                        }
                    }, 300);
                    return;
                }
            } catch (e) {}
            window.location.hash = route;
        }, 10); // defer past closePalette's synchronous work
    }

    function onActivate(device, el, stateEl, iconWrap, sliderRow) {
        if (isDimmer(device) && sliderRow) {
            if (!sliderRow.classList.contains('dz-cmd-slider-row--visible')) {
                sliderRow.classList.add('dz-cmd-slider-row--visible');
                var s = sliderRow.querySelector('.dz-cmd-slider');
                if (s) setTimeout(function () { s.focus(); }, 0);
                return;
            }
        }
        if (!isToggleable(device)) return; // Enter only toggles; use nav button or Shift+Enter to navigate
        apiToggle(device, function (d) {
            var nowOn = isOn(d);
            stateEl.textContent = stateLabel(d);
            stateEl.classList.toggle('dz-cmd-state--on', nowOn);
            iconWrap.classList.toggle('dz-cmd-icon--on', nowOn);
            var tbl2 = document.getElementById('itemtable' + d.idx);
            if (tbl2) {
                var card2 = tbl2.closest
                    ? tbl2.closest('div.item.itemBlock, .itemBlock > div.item')
                    : null;
                if (card2) {
                    card2.classList.add(nowOn ? 'dz-flash-on' : 'dz-flash-off');
                    setTimeout(function () {
                        card2.classList.remove('dz-flash-on', 'dz-flash-off');
                    }, 700);
                }
            }
        });
    }

    // ── Active item ────────────────────────────────────────────────

    function setActive(index) {
        if (!_list) return;
        var items = _list.querySelectorAll('.dz-cmd-item');
        if (_activeIdx >= 0 && items[_activeIdx]) {
            items[_activeIdx].classList.remove('dz-cmd-item--active');
        }
        _activeIdx = index;
        if (_activeIdx >= 0 && items[_activeIdx]) {
            items[_activeIdx].classList.add('dz-cmd-item--active');
            items[_activeIdx].scrollIntoView({ block: 'nearest' });
        }
    }

    // ── Open / close ───────────────────────────────────────────────

    function openPalette() {
        if (_overlay) { _input && _input.focus(); return; }

        _overlay = document.createElement('div');
        _overlay.id = 'dz-cmd-overlay';

        var box = document.createElement('div');
        box.id = 'dz-cmd-box';

        var hdr = document.createElement('div');
        hdr.id = 'dz-cmd-header';
        hdr.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';

        _input = document.createElement('input');
        _input.type = 'text';
        _input.id = 'dz-cmd-input';
        _input.placeholder = 'Search devices, toggle switches, adjust dimmers\u2026';
        _input.autocomplete = 'off';
        _input.setAttribute('spellcheck', 'false');
        hdr.appendChild(_input);

        var escBtn = document.createElement('kbd');
        escBtn.className = 'dz-cmd-esc';
        escBtn.textContent = 'Esc';
        escBtn.addEventListener('click', closePalette);
        hdr.appendChild(escBtn);
        box.appendChild(hdr);

        _list = document.createElement('div');
        _list.id = 'dz-cmd-list';
        box.appendChild(_list);

        var footer = document.createElement('div');
        footer.id = 'dz-cmd-footer';
        var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
        var modKey = isMac ? '\u2318' : 'Ctrl';
        footer.innerHTML =
            '<span class="dz-cmd-footer-tip"><kbd>' + modKey + '</kbd><kbd>K</kbd> global search &nbsp;\u00b7&nbsp; <kbd>/</kbd> filter current page</span>' +
            '<span class="dz-cmd-footer-right">' +
            '<span><kbd>\u2191</kbd><kbd>\u2193</kbd> navigate</span>' +
            '<span><kbd>\u21b5</kbd> toggle</span>' +
            '<span><kbd>\u21e7\u21b5</kbd> go\u202fto\u202fpage</span>' +
            '<span><kbd>Esc</kbd> close</span>' +
            '</span>';
        box.appendChild(footer);

        _overlay.appendChild(box);
        document.body.appendChild(_overlay);

        _input.addEventListener('input', function () {
            _activeIdx = -1;
            render(_input.value);
        });

        _input.addEventListener('keydown', function (e) {
            var items = _list.querySelectorAll('.dz-cmd-item');
            var n = items.length;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((_activeIdx + 1) % Math.max(n, 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((_activeIdx - 1 + n) % Math.max(n, 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                var target = _activeIdx >= 0 ? items[_activeIdx] : items[0];
                if (!target) return;
                if (e.shiftKey) {
                    // Shift+Enter → always navigate to device page
                    if (target._dzDevice) navigateToDevice(target._dzDevice);
                } else {
                    target.click(); // Enter → toggle (or expand dimmer)
                }
            } else if (e.key === 'Escape') {
                closePalette();
            }
        });

        _overlay.addEventListener('click', function (e) {
            if (e.target === _overlay) closePalette();
        });

        render('');
        requestAnimationFrame(function () { _input && _input.focus(); });
        if (!_fetched) fetchAll();
    }

    function closePalette() {
        if (!_overlay) return;
        _overlay.classList.add('dz-cmd-closing');
        var snap = _overlay;
        setTimeout(function () {
            if (snap && snap.parentNode) snap.parentNode.removeChild(snap);
            if (_overlay === snap) { _overlay = null; _input = null; _list = null; _activeIdx = -1; }
        }, 160);
    }

    // ── Keyboard shortcut ──────────────────────────────────────────

    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault(); // always prevent browser Ctrl+K (address bar search)
            var active = document.activeElement;
            // Don't open when typing in a text field (unless it's our own input)
            if (active && active !== _input &&
                (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' ||
                 active.isContentEditable)) return;
            _overlay ? closePalette() : openPalette();
        }
    });

    // ── Track recent device changes ────────────────────────────────

    function hookAngular() {
        if (!window.angular) { setTimeout(hookAngular, 600); return; }
        var body = angular.element(document.body);
        if (!body || !body.injector || !body.injector()) { setTimeout(hookAngular, 400); return; }
        try {
            body.injector().get('$rootScope')
                .$on('device_update', function (evt, d) { patchDevice(d); });
        } catch (e) { setTimeout(hookAngular, 600); }
    }

    // ── Intercept Domoticz search bar ──────────────────────────────
    // Add a second button for command palette alongside the page filter button.
    // Left side (#tbSearch): Opens page filter (/) 
    // Right side (new button): Opens command palette (Ctrl+K)

    (function () {
        var buttonAdded = false;

        // Add the command palette trigger button to the search bar
        function addCommandPaletteTrigger() {
            var searchBar = document.getElementById('tbFiltSearch');
            if (!searchBar) {
                setTimeout(addCommandPaletteTrigger, 50);
                return;
            }

            // Check if button already exists
            var existing = searchBar.querySelector('.dz-cmd-palette-trigger');
            if (existing) return;

            var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
            var modKey = isMac ? '⌘' : 'Ctrl';

            var cmdBtn = document.createElement('button');
            cmdBtn.className = 'dz-cmd-palette-trigger';
            cmdBtn.innerHTML = 'Command Palette <kbd class="dz-cmd-palette-trigger-kbd">' + modKey + ' K</kbd>';
            cmdBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                openPalette();
            });

            searchBar.appendChild(cmdBtn);
            buttonAdded = true;
        }

        // Watch for DOM changes and re-add button if navbar is recreated
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    // Check if the search bar was added/modified
                    var searchBar = document.getElementById('tbFiltSearch');
                    if (searchBar && !searchBar.querySelector('.dz-cmd-palette-trigger')) {
                        addCommandPaletteTrigger();
                    }
                }
            });
        });

        // Observe the navbar area for changes
        function startObserving() {
            var navbar = document.getElementById('appnavbar') || document.querySelector('.navbar') || document.body;
            if (navbar) {
                observer.observe(navbar, {
                    childList: true,
                    subtree: true
                });
            }
        }

        function isPageFilterClick(el) {
            // Check if click was on the left button (#tbSearch) for page filter
            while (el) {
                if (el.id === 'tbSearch') return true;
                if (el.id === 'tbFiltSearch') return false;
                el = el.parentElement;
            }
            return false;
        }

        // Intercept clicks on the search bar
        document.addEventListener('mousedown', function (e) {
            var searchBar = document.getElementById('tbFiltSearch');
            if (!searchBar || !searchBar.contains(e.target)) return;

            // If clicking on command palette button, let it handle it
            if (e.target.closest('.dz-cmd-palette-trigger')) return;

            // If clicking on page filter button, let search.js handle it
            if (isPageFilterClick(e.target)) return;

            // Otherwise prevent default
            e.preventDefault();
        }, true);

        document.addEventListener('touchend', function (e) {
            var searchBar = document.getElementById('tbFiltSearch');
            if (!searchBar || !searchBar.contains(e.target)) return;

            if (e.target.closest('.dz-cmd-palette-trigger')) return;
            if (isPageFilterClick(e.target)) return;

            e.preventDefault();
        }, true);

        // Initialize immediately and start observing
        addCommandPaletteTrigger();
        startObserving();

        // Also hook into Angular route changes if available
        function hookAngularRoutes() {
            if (!window.angular) {
                setTimeout(hookAngularRoutes, 300);
                return;
            }
            var body = angular.element(document.body);
            if (!body || !body.injector || !body.injector()) {
                setTimeout(hookAngularRoutes, 300);
                return;
            }
            try {
                body.injector().get('$rootScope').$on('$routeChangeSuccess', function() {
                    // Re-add button after route change
                    setTimeout(addCommandPaletteTrigger, 50);
                });
            } catch (e) {}
        }

        hookAngularRoutes();
    }());

    // ── Init ───────────────────────────────────────────────────────

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(fetchAll, 800);
            hookAngular();
        });
    } else {
        setTimeout(fetchAll, 800);
        hookAngular();
    }
})();
