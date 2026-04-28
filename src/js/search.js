(function () {
    'use strict';

    // Press 1–9 while not in a text field to jump to these routes
    var NAV = {
        '1': 'Dashboard',
        '2': 'Switches',
        '3': 'Scenes',
        '4': 'Temp',
        '5': 'Weather',
        '6': 'Utility',
        '7': 'Cameras',
        '8': 'Log',
        '9': 'Setup'
    };

    var overlay = null;
    var inputEl = null;
    var listEl  = null;
    var activeI = -1;

    function escHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function getCards() {
        var out = [];
        document.querySelectorAll('div.item.itemBlock, .itemBlock > div.item').forEach(function (card) {
            if (!card.querySelector('table[id^="itemtable"]')) return;
            var nameEl = card.querySelector('td#name');
            var name   = nameEl ? (nameEl.textContent || '').trim() : '';
            if (!name) return;
            var icon   = card.querySelector('i.dz-fa-device');
            var iCls   = icon ? ((icon.className.match(/fa-[\w-]+/) || [])[0] || 'fa-circle') : 'fa-circle';
            out.push({ name: name, card: card, icon: iCls });
        });
        return out;
    }

    function render(query) {
        var q = query.trim().toLowerCase();
        var all = getCards();
        var hits = q ? all.filter(function (d) { return d.name.toLowerCase().indexOf(q) !== -1; })
                      : all.slice(0, 9);
        listEl.innerHTML = '';
        activeI = -1;
        hits.slice(0, 10).forEach(function (d, i) {
            var el = document.createElement('div');
            el.className = 'dz-search-item';
            el.innerHTML = '<i class="fa-solid ' + d.icon + '"></i>' + escHtml(d.name);
            el.addEventListener('mouseenter', function () { highlight(i); });
            el.addEventListener('click', function () { pick(d); });
            listEl.appendChild(el);
        });
    }

    function highlight(i) {
        var items = listEl.querySelectorAll('.dz-search-item');
        if (activeI >= 0 && items[activeI]) items[activeI].classList.remove('dz-search-active');
        activeI = i;
        if (items[activeI]) items[activeI].classList.add('dz-search-active');
    }

    function pick(d) {
        close();
        d.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        d.card.classList.add('dz-flash-on');
        setTimeout(function () { d.card.classList.remove('dz-flash-on'); }, 700);
    }

    function open() {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.id = 'dz-search-overlay';

        var box = document.createElement('div');
        box.id  = 'dz-search-box';

        inputEl = document.createElement('input');
        inputEl.id          = 'dz-search-input';
        inputEl.type        = 'text';
        inputEl.placeholder = 'Search devices…';
        inputEl.autocomplete = 'off';

        listEl = document.createElement('div');
        listEl.id = 'dz-search-results';

        var hint = document.createElement('div');
        hint.className = 'dz-search-hint';
        hint.innerHTML =
            '<span><kbd>↑↓</kbd> navigate</span>' +
            '<span><kbd>↵</kbd> go to</span>' +
            '<span><kbd>Esc</kbd> close</span>' +
            '<span><kbd>1–9</kbd> jump to section</span>';

        box.appendChild(inputEl);
        box.appendChild(listEl);
        box.appendChild(hint);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        inputEl.addEventListener('input', function () { render(this.value); });
        inputEl.addEventListener('keydown', function (e) {
            var items = listEl.querySelectorAll('.dz-search-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault(); highlight(Math.min(activeI + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault(); highlight(Math.max(activeI - 1, 0));
            } else if (e.key === 'Enter') {
                if (activeI >= 0 && items[activeI]) items[activeI].click();
            } else if (e.key === 'Escape') {
                close();
            }
        });

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });

        render('');
        setTimeout(function () { if (inputEl) inputEl.focus(); }, 25);
    }

    function close() {
        if (overlay) { overlay.remove(); overlay = null; inputEl = null; listEl = null; }
    }

    function inInputField(target) {
        var tag = (target.tagName || '').toUpperCase();
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    }

    document.addEventListener('keydown', function (e) {
        if (inInputField(e.target) && !overlay) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        if (e.key === '/' && !overlay && !inInputField(e.target)) {
            e.preventDefault();
            open();
            return;
        }

        if (!overlay && !inInputField(e.target) && NAV[e.key]) {
            e.preventDefault();
            window.location.hash = '/' + NAV[e.key];
        }
    });
})();


/* ==================================================================
 *  Navbar sliding indicator + hover tracking
 *  Positions a glowing pill under the active nav item and smoothly
 *  slides it to hovered items, returning to active on mouse-leave.
 * ================================================================== */

(function () {
    'use strict';

    function initIndicator() {
        var nav = document.getElementById('appnavbar');
        if (!nav) return;

        var ind = nav.querySelector('.dz-nav-indicator');
        if (!ind) {
            ind = document.createElement('div');
            ind.className = 'dz-nav-indicator';
            ind.id = 'dzNavIndicator';
            nav.insertBefore(ind, nav.firstChild);
        }

        function positionTo(el, animate) {
            if (!el) return;
            var navRect = nav.getBoundingClientRect();
            var elRect = el.getBoundingClientRect();
            if (animate) ind.classList.add('dz-nav-indicator--animated');
            else ind.classList.remove('dz-nav-indicator--animated');
            ind.style.width = elRect.width + 'px';
            ind.style.left = (elRect.left - navRect.left) + 'px';
            ind.style.opacity = '1';
        }

        var activeLink = nav.querySelector('.current_page_item > a');
        positionTo(activeLink, false);

        var navItems = nav.querySelectorAll(':scope > li:not(.dropdown) > a');
        for (var i = 0; i < navItems.length; i++) {
            (function (link) {
                link.addEventListener('mouseenter', function () {
                    positionTo(link, true);
                });
            })(navItems[i]);
        }

        nav.addEventListener('mouseleave', function () {
            positionTo(activeLink, true);
        });

        window.addEventListener('resize', function () {
            positionTo(activeLink, false);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initIndicator);
    } else {
        initIndicator();
    }
})();


/* ==================================================================
 *  Nightglass Theme Settings Panel
 *  Injects a themed config panel into the Domoticz Settings page.
 *  On Domoticz build ≥ 17806 settings are persisted via the ThemeSettings
 *  API (preferences DB).  On older builds the legacy ngTheme_settings user
 *  variable is used as a fallback.  localStorage is always kept in sync as
 *  a local cache so settings apply instantly on every page load.
 * ================================================================== */

(function () {
    'use strict';

    // Domoticz build ≥ 17806 supports ThemeSettings in the preferences DB.
    // Older builds use a user variable (ngTheme_settings) as fallback.
    var THEME_NAME = 'Nightglass';
    var UVAR_NAME  = 'ngTheme_settings'; // legacy user-variable name
    var UVAR_TYPE  = 2;                  // Domoticz "string" type

    // Base path for API calls
    var BASE = (function () {
        return window.location.pathname.replace(/\/[^/]*$/, '/');
    })();

    /* ── Default settings ──────────────────────────────────────── */
    var DEFAULTS = {
        navbarIcons:        true,
        deviceIcons:        true,
        animateDeviceIcons: true,
        favStarIcons:       true,
        trendArrowIcons:    true,
        actionIcons:        true,
        showThemeToggle:    true,
        defaultMode:        'dark',
        themeMode:          'toggle',
        accentColor:        '#4e9af1',
        dangerColor:        '#e05555',
        warningColor:       '#f0a832',
        successColor:       '#4caf7d',
        accentColorLight:   '#2a7de1',
        dangerColorLight:   '#d63b3b',
        warningColorLight:  '#c07818',
        successColorLight:  '#2e8c58',
        bgColor:            '#23252f',
        surfaceColor:       '#2a2b35',
        borderColor:        '#33354a',
        textColor:          '#e2e4ed',
        bgColorLight:       '#ffffff',
        surfaceColorLight:  '#f5f6fa',
        borderColorLight:   '#d0d3dc',
        textColorLight:     '#1a1c24',
        pageBgColor:        '#1b1d25',
        pageBgColorLight:   '#f0f2f5',
        cardTilt:           true,
        sparklines:         true,
        stalenessIndicator: true,
        stateFlash:         true,
        tempAccent:         true,
        cardAnimations:     true,
        navAnimations:      true,
        smoothScrolling:    true,
        showLastUpdate:     false,
        uppercaseNames:     true,
        iconSize:           '100',
        enableIcons:        true,
        enableAppearance:   true,
        enableEffects:      true,
        enableColors:       true,
        fontSize:           '100',

        liveToasts:         true,
        liveToastFilter:    'meaningful',
        liveToastDuration:  '4',
        liveToastPosition:  'bottom-right',
        toastBlacklist:     '[]'
    };

    var _settings      = null;
    var _uvarIdx       = null;  // Domoticz idx of the ngTheme_settings variable
    var _panelInjected = false;
    var _apiAvailable  = true;  // false if Domoticz API is unreachable
    var _useNewApi     = false; // true when build ≥ 17806 (ThemeSettings in getsettings)
    var _saveTimer     = null;  // debounce handle for API writes
    var _dirty         = false; // true when in-memory changes not yet saved to DB
    var LS_KEY         = 'ngThemeSettings';

    /* ── Domoticz API helper ──────────────────────────────────────── */

    function apiCall(params) {
        var url = BASE + 'json.htm?' + Object.keys(params).map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        }).join('&');
        return fetch(url, {
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).then(function (r) { return r.json(); });
    }

    /* ── New API: ThemeSettings in Domoticz preferences DB (build ≥ 17806) ── */

    // Resolves with the Domoticz build number, or 0 on failure.
    function getBuildNumber() {
        return apiCall({ type: 'command', param: 'getversion' }).then(function (data) {
            return (data && (data.Revision || data.build_number)) || 0;
        }).catch(function () { return 0; });
    }

    // Reads ThemeSettings from getsettings.  Always resolves — returns the
    // stored object if present, or null when no settings have been saved yet
    // (first use with the new API).  Rejects only on a network/parse error.
    function loadFromGetsettings() {
        return apiCall({ type: 'command', param: 'getsettings' }).then(function (data) {
            if (!data || data.status !== 'OK') return Promise.reject('getsettings failed');
            var stored = data.ThemeSettings && data.ThemeSettings[THEME_NAME];
            return stored || null;
        });
    }

    var _unsavedToastEl = null;

    // Shows or dismisses the persistent "unsaved changes" toast notification.
    function _showUnsavedToast(show) {
        if (!_useNewApi) return;
        if (show) {
            if (_unsavedToastEl && _unsavedToastEl.parentNode) return; // already visible
            if (typeof window.ngShowToast !== 'function') return;
            _unsavedToastEl = window.ngShowToast({
                icon:     'fa-floppy-disk',
                color:    'var(--dz-warning, #f0a832)',
                title:    'Unsaved theme changes',
                body:     'Click <strong>Save to Domoticz</strong> to persist across all browsers.',
                duration: 0,
                type:     'system'
            });
        } else {
            if (_unsavedToastEl && typeof window.ngRemoveToast === 'function') {
                window.ngRemoveToast(_unsavedToastEl);
            }
            _unsavedToastEl = null;
        }
    }

    // Updates Angular scope's ThemeSettings in-memory so the value is
    // included when scope.StoreSettings() is called later from the Save button.
    // No direct storesettings API call — avoids any risk of clobbering other
    // Domoticz settings with a partial POST.
    function _updateAngularScope() {
        try {
            var el = document.getElementById('maindiv') || document.body;
            var scope = window.angular && angular.element(el).scope();
            if (!scope) return;
            scope.$apply(function () {
                scope.ThemeSettings = scope.ThemeSettings || {};
                scope.ThemeSettings[THEME_NAME] = _settings;
            });
        } catch (e) {}
        _dirty = true;
        _showUnsavedToast(true);
    }

    // Persists settings to the Domoticz database by calling Angular's
    // StoreSettings() — the same full-form save the settings page uses, so
    // all other Domoticz settings are preserved.  Only callable from the
    // Settings page (which is where the Nightglass panel lives).
    function _saveToDomoticz(btn) {
        try {
            var el = document.getElementById('maindiv') || document.body;
            var scope = window.angular && angular.element(el).scope();
            if (!scope || !scope.StoreSettings) {
                console.warn('Nightglass: StoreSettings not available on this page');
                return;
            }
            scope.$apply(function () {
                scope.ThemeSettings = scope.ThemeSettings || {};
                scope.ThemeSettings[THEME_NAME] = _settings;
            });
            scope.StoreSettings();
            _dirty = false;
            _showUnsavedToast(false);
            if (btn) {
                var orig = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
                btn.disabled = true;
                setTimeout(function () { btn.innerHTML = orig; btn.disabled = false; }, 2000);
            }
        } catch (e) {
            console.warn('Nightglass: _saveToDomoticz failed', e);
        }
    }

    /* ── Legacy: single-variable JSON storage (user variables) ───────── */
    // Loads all user variables, finds ngTheme_settings and parses its JSON.
    // If that variable doesn't exist but old per-key ngTheme_* variables do,
    // migrates them transparently (no data loss on first upgrade).
    function loadJsonUvar() {
        return apiCall({ type: 'command', param: 'getuservariables' }).then(function (data) {
            if (!data || !data.result) return null;

            // Look for the new consolidated variable first
            for (var i = 0; i < data.result.length; i++) {
                var uv = data.result[i];
                if (uv.Name === UVAR_NAME) {
                    _uvarIdx = uv.idx;
                    try { return JSON.parse(uv.Value); } catch (e) { return null; }
                }
            }

            // Migration path: absorb old per-key ngTheme_<key> variables
            var migrated = {};
            var oldPrefix = 'ngTheme_';
            data.result.forEach(function (uv) {
                if (uv.Name.indexOf(oldPrefix) === 0 && uv.Name !== UVAR_NAME) {
                    var key = uv.Name.slice(oldPrefix.length);
                    if (key in DEFAULTS) {
                        var raw = uv.Value;
                        // Old variables stored booleans as the strings "true"/"false"
                        migrated[key] = typeof DEFAULTS[key] === 'boolean' ? raw === 'true' : raw;
                    }
                }
            });
            return Object.keys(migrated).length ? migrated : null;
        });
    }

    // Keeps Angular scope in sync on every setting change (debounced 400 ms).
    // On build ≥ 17806 only updates the Angular scope in-memory — the actual
    // database write happens when the user clicks "Save to Domoticz" in the
    // panel footer, which calls scope.StoreSettings() so ALL Domoticz settings
    // are written together (no partial-POST risk).
    // On older builds falls back to the safe user-variable API.
    function saveJsonUvar() {
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(function () {
            if (_useNewApi) {
                _updateAngularScope();
                return;
            }
            // Legacy path: store as a JSON user variable
            var json = JSON.stringify(_settings);
            if (_uvarIdx) {
                apiCall({
                    type: 'command', param: 'updateuservariable',
                    idx: _uvarIdx, vname: UVAR_NAME, vtype: UVAR_TYPE, vvalue: json
                });
            } else {
                apiCall({
                    type: 'command', param: 'adduservariable',
                    vname: UVAR_NAME, vtype: UVAR_TYPE, vvalue: json
                }).then(function () {
                    // Re-fetch so we have the idx for future update calls
                    return apiCall({ type: 'command', param: 'getuservariables' });
                }).then(function (data) {
                    if (!data || !data.result) return;
                    data.result.forEach(function (uv) {
                        if (uv.Name === UVAR_NAME) _uvarIdx = uv.idx;
                    });
                });
            }
        }, 400);
    }

    /* ── Settings persistence ─────────────────────────────────────── */

    function loadFromLocalStorage() {
        try {
            var stored = localStorage.getItem(LS_KEY);
            if (stored) return JSON.parse(stored);
        } catch (e) {}
        return null;
    }

    function saveToLocalStorage() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(_settings)); } catch (e) {}
    }

    function loadSettings() {
        // Check build number first so we know which storage backend to use.
        return getBuildNumber().then(function (build) {
            if (build >= 17806) {
                // New API: read from getsettings, fall back to user vars for migration.
                _useNewApi    = true;
                _apiAvailable = true;
                return loadFromGetsettings().then(function (stored) {
                    if (stored) {
                        // Settings already persisted via new API — use them.
                        _settings = Object.assign({}, DEFAULTS, stored);
                    } else {
                        // Nothing in ThemeSettings yet; pull from user variables
                        // as a one-time migration source (read-only — saves will
                        // now go through the new API).
                        return loadJsonUvar().then(function (migrated) {
                            _settings = Object.assign({}, DEFAULTS, migrated || {});
                            return _settings;
                        }).catch(function () {
                            _settings = Object.assign({}, DEFAULTS);
                            return _settings;
                        });
                    }
                    return _settings;
                }).catch(function () {
                    // getsettings failed — degrade to user variables.
                    return loadJsonUvar().then(function (stored) {
                        _settings = Object.assign({}, DEFAULTS, stored || {});
                        return _settings;
                    }).catch(function () {
                        _settings = Object.assign({}, DEFAULTS, loadFromLocalStorage() || {});
                        return _settings;
                    });
                }).then(function (s) {
                    saveToLocalStorage();
                    return s;
                });
            }

            // Older build — use user variables.
            _useNewApi    = false;
            return loadJsonUvar().then(function (stored) {
                _apiAvailable = true;
                _settings = Object.assign({}, DEFAULTS, stored || {});
                saveToLocalStorage();
                return _settings;
            }).catch(function () {
                _apiAvailable = false;
                _settings = Object.assign({}, DEFAULTS, loadFromLocalStorage() || {});
                return _settings;
            });
        });
    }

    function saveSetting(key, value) {
        _settings[key] = value;
        if (_apiAvailable) saveJsonUvar(); // debounced, batches rapid changes
        saveToLocalStorage();
        applySettings();
    }

    /* ── Apply settings to the page ────────────────────────────── */

    function applySettings() {
        if (!_settings) return;
        var root = document.documentElement;

        // --- Icon visibility (granular per-category) ---

        // Navbar icons (menu items in the top bar)
        var navIconStyle = document.getElementById('dz-ng-navicon-style');
        if (!_settings.navbarIcons) {
            if (!navIconStyle) {
                navIconStyle = document.createElement('style');
                navIconStyle.id = 'dz-ng-navicon-style';
                navIconStyle.textContent =
                    '.navbar .nav li a > i.dz-fa-icon { display: none !important; }' +
                    '.navbar .nav .dropdown-menu li a > i.dz-fa-icon { display: none !important; }' +
                    '.navbar img.dz-icon-replaced { display: inline !important; opacity: 1 !important; pointer-events: auto !important; }' +
                    '.navbar img[src^="images/"] { opacity: 1 !important; pointer-events: auto !important; }';
                document.head.appendChild(navIconStyle);
            }
        } else if (navIconStyle) {
            navIconStyle.remove();
        }

        // Device / card icons (48px device state icons)
        var devIconStyle = document.getElementById('dz-ng-devicon-style');
        if (!_settings.deviceIcons) {
            if (!devIconStyle) {
                devIconStyle = document.createElement('style');
                devIconStyle.id = 'dz-ng-devicon-style';
                devIconStyle.textContent =
                    'i.dz-fa-device, i.dz-wind { display: none !important; }' +
                    'body table[id^="itemtable"] img.dz-icon-replaced:not([data-dz-src*="favorite"]) { display: inline !important; opacity: 1 !important; pointer-events: auto !important; }' +
                    'body table[id^="itemtable"] img[src*="48"]:not([src*="favorite"]) { opacity: 1 !important; pointer-events: auto !important; }';
                document.head.appendChild(devIconStyle);
            }
        } else if (devIconStyle) {
            devIconStyle.remove();
        }

        // Animate device icons (spinning fans, flickering flames, etc.)
        var animStyle = document.getElementById('dz-ng-anim-icon-style');
        if (!_settings.animateDeviceIcons || !_settings.deviceIcons) {
            if (!animStyle) {
                animStyle = document.createElement('style');
                animStyle.id = 'dz-ng-anim-icon-style';
                animStyle.textContent =
                    'i.dz-fa-device[data-dz-state="on"] { animation: none !important; }';
                document.head.appendChild(animStyle);
            }
        } else if (animStyle) {
            animStyle.remove();
        }

        // Favorite star icons
        var favIconStyle = document.getElementById('dz-ng-favicon-style');
        if (!_settings.favStarIcons) {
            if (!favIconStyle) {
                favIconStyle = document.createElement('style');
                favIconStyle.id = 'dz-ng-favicon-style';
                favIconStyle.textContent =
                    'i.dz-fa-fav { display: none !important; }' +
                    'img[src*="favorite"].dz-icon-replaced { display: inline !important; opacity: 1 !important; pointer-events: auto !important; }' +
                    'img[src*="favorite"] { opacity: 1 !important; pointer-events: auto !important; }';
                document.head.appendChild(favIconStyle);
            }
        } else if (favIconStyle) {
            favIconStyle.remove();
        }

        // Trend arrow icons
        var trendIconStyle = document.getElementById('dz-ng-trendicon-style');
        if (!_settings.trendArrowIcons) {
            if (!trendIconStyle) {
                trendIconStyle = document.createElement('style');
                trendIconStyle.id = 'dz-ng-trendicon-style';
                trendIconStyle.textContent =
                    'i.dz-fa-trend { display: none !important; }' +
                    'img[src*="arrow_"].dz-icon-replaced { display: inline !important; opacity: 1 !important; pointer-events: auto !important; }' +
                    'img[src*="arrow_"] { opacity: 1 !important; pointer-events: auto !important; }';
                document.head.appendChild(trendIconStyle);
            }
        } else if (trendIconStyle) {
            trendIconStyle.remove();
        }

        // Action icons (delete, rename, add, etc. in tables)
        var actionIconStyle = document.getElementById('dz-ng-actionicon-style');
        if (!_settings.actionIcons) {
            if (!actionIconStyle) {
                actionIconStyle = document.createElement('style');
                actionIconStyle.id = 'dz-ng-actionicon-style';
                actionIconStyle.textContent =
                    'i.dz-fa-action, i.dz-fa-nav { display: none !important; }' +
                    'img.dz-icon-replaced[data-dz-src*="delete"], img.dz-icon-replaced[data-dz-src*="rename"],' +
                    'img.dz-icon-replaced[data-dz-src*="add."], img.dz-icon-replaced[data-dz-src*="remove."],' +
                    'img.dz-icon-replaced[data-dz-src*="up."], img.dz-icon-replaced[data-dz-src*="down."],' +
                    'img.dz-icon-replaced[data-dz-src*="next."]' +
                    '{ display: inline !important; opacity: 1 !important; pointer-events: auto !important; }';
                document.head.appendChild(actionIconStyle);
            }
        } else if (actionIconStyle) {
            actionIconStyle.remove();
        }

        // Theme mode: toggle (manual navbar button), auto, dark, light
        var themeMode = _settings.themeMode || 'toggle';
        // Backward compat: if themeMode not set, derive from old keys
        if (!_settings.themeMode && _settings.showThemeToggle === false) {
            themeMode = _settings.defaultMode || 'dark';
        }
        var toggleNav = document.getElementById('dz-theme-style-nav');
        if (themeMode === 'toggle') {
            if (toggleNav) toggleNav.style.display = '';
        } else {
            if (toggleNav) toggleNav.style.display = 'none';
            var wantLight;
            if (themeMode === 'auto') {
                wantLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
            } else {
                wantLight = themeMode === 'light';
            }
            var isLight = document.body.classList.contains('dz-light');
            if (isLight !== wantLight) {
                if (wantLight) document.body.classList.add('dz-light');
                else document.body.classList.remove('dz-light');
            }
            localStorage.setItem('dz-theme-style', themeMode);
            if (typeof applyHighchartsTheme === 'function') applyHighchartsTheme(!wantLight);
        }

        // Accent colors — apply via a dynamic <style> so both :root and body.dz-light are covered
        var hexToRgb = function (hex) {
            var r = parseInt(hex.slice(1, 3), 16);
            var g = parseInt(hex.slice(3, 5), 16);
            var b = parseInt(hex.slice(5, 7), 16);
            return r + ', ' + g + ', ' + b;
        };
        var darkenHex = function (hex, amt) {
            var r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amt);
            var g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amt);
            var b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amt);
            var toH = function (n) { var h = n.toString(16); return h.length < 2 ? '0' + h : h; };
            return '#' + toH(r) + toH(g) + toH(b);
        };
        var lightenHex = function (hex, amt) {
            var r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amt);
            var g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amt);
            var b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amt);
            var toH = function (n) { var h = n.toString(16); return h.length < 2 ? '0' + h : h; };
            return '#' + toH(r) + toH(g) + toH(b);
        };

        var ac = _settings.accentColor;
        var dc = _settings.dangerColor;
        var wc = _settings.warningColor;
        var sc = _settings.successColor;
        var acL = _settings.accentColorLight  || darkenHex(ac, 15);
        var dcL = _settings.dangerColorLight  || darkenHex(dc, 15);
        var wcL = _settings.warningColorLight || darkenHex(wc, 25);
        var scL = _settings.successColorLight || darkenHex(sc, 20);
        var bg  = _settings.bgColor      || '#23252f';
        var sf  = _settings.surfaceColor  || '#2a2b35';
        var bd  = _settings.borderColor   || '#33354a';
        var tx  = _settings.textColor     || '#e2e4ed';
        var bgL = _settings.bgColorLight     || '#ffffff';
        var sfL = _settings.surfaceColorLight || '#f5f6fa';
        var bdL = _settings.borderColorLight  || '#d0d3dc';
        var txL = _settings.textColorLight    || '#1a1c24';
        var pbg  = _settings.pageBgColor       || '#1b1d25';
        var pbgL = _settings.pageBgColorLight  || '#f0f2f5';

        var colorCSS =
            ':root {\n' +
            '  --dz-accent: ' + ac + ';\n' +
            '  --dz-accent-color: ' + ac + ';\n' +
            '  --dz-widget-accent: ' + ac + ';\n' +
            '  --dz-btn-primary-bg: ' + ac + ';\n' +
            '  --dz-btn-info-bg: ' + ac + ';\n' +
            '  --dz-accent-rgb: ' + hexToRgb(ac) + ';\n' +
            '  --dz-accent-light: ' + lightenHex(ac, 30) + ';\n' +
            '  --dz-accent-hover: ' + darkenHex(ac, 20) + ';\n' +
            '  --dz-danger: ' + dc + ';\n' +
            '  --dz-accent-red: ' + dc + ';\n' +
            '  --dz-danger-hover: ' + darkenHex(dc, 20) + ';\n' +
            '  --dz-warning: ' + wc + ';\n' +
            '  --dz-warning-hover: ' + darkenHex(wc, 20) + ';\n' +
            '  --dz-success: ' + sc + ';\n' +
            '  --dz-success-hover: ' + darkenHex(sc, 20) + ';\n' +
            '  --dz-surface: ' + bg + ';\n' +
            '  --dz-surface-2: ' + sf + ';\n' +
            '  --dz-surface-3: ' + lightenHex(sf, 10) + ';\n' +
            '  --dz-border: ' + bd + ';\n' +
            '  --dz-border-b: ' + lightenHex(bd, 10) + ';\n' +
            '  --dz-text: ' + tx + ';\n' +
            '  --dz-text-soft: ' + darkenHex(tx, 30) + ';\n' +
            '  --dz-text-muted: ' + darkenHex(tx, 60) + ';\n' +
            '  --dz-text-faint: ' + darkenHex(tx, 90) + ';\n' +
            '  --dz-bg: ' + pbg + ';\n' +
            '  --dz-bg-alt: ' + lightenHex(pbg, 5) + ';\n' +
            '  --dz-nav-bg: ' + bg + ';\n' +
            '  --dz-table-odd-bg: ' + bg + ';\n' +
            '  --dz-table-even-bg: ' + darkenHex(bg, 8) + ';\n' +
            '  --dz-table-odd-text: ' + tx + ';\n' +
            '  --dz-table-even-text: ' + tx + ';\n' +
            '  --dz-panel-bg: ' + bg + ';\n' +
            '  --dz-panel-text: ' + tx + ';\n' +
            '  --dz-modal-bg: ' + bg + ';\n' +
            '  --dz-modal-text: ' + tx + ';\n' +
            '  --dz-modal-header-bg: ' + sf + ';\n' +
            '  --dz-input-bg: ' + sf + ';\n' +
            '  --dz-input-text: ' + tx + ';\n' +
            '  --dz-input-border: ' + bd + ';\n' +
            '  --dz-btn-bg: ' + sf + ';\n' +
            '  --dz-btn-text: ' + tx + ';\n' +
            '  --dz-btn-border: ' + lightenHex(bd, 10) + ';\n' +
            '  --dz-btn-hover-bg: ' + lightenHex(sf, 10) + ';\n' +
            '  --dz-btn-primary-text: #fff;\n' +
            '  --dz-btn-warning-bg: ' + wc + ';\n' +
            '  --dz-btn-danger-bg: ' + dc + ';\n' +
            '  --dz-btn-success-bg: ' + sc + ';\n' +
            '  --dz-overlay-rgb: 255, 255, 255;\n' +
            '  --dz-surface-rgb: ' + hexToRgb(bg) + ';\n' +
            '  --dz-border-rgb: ' + hexToRgb(bd) + ';\n' +
            '  --dz-border-color: ' + bd + ';\n' +
            '  --dz-body-bg: ' + pbg + ';\n' +
            '  --dz-body-text: ' + tx + ';\n' +
            '  --dz-widget-bg: ' + bg + ';\n' +
            '  --dz-widget-text: ' + tx + ';\n' +
            '}\n' +
            'body.dz-light {\n' +
            '  --dz-accent: ' + acL + ';\n' +
            '  --dz-accent-color: ' + acL + ';\n' +
            '  --dz-widget-accent: ' + acL + ';\n' +
            '  --dz-btn-primary-bg: ' + acL + ';\n' +
            '  --dz-btn-info-bg: ' + acL + ';\n' +
            '  --dz-accent-rgb: ' + hexToRgb(acL) + ';\n' +
            '  --dz-accent-light: ' + lightenHex(acL, 30) + ';\n' +
            '  --dz-accent-hover: ' + darkenHex(acL, 20) + ';\n' +
            '  --dz-danger: ' + dcL + ';\n' +
            '  --dz-accent-red: ' + dcL + ';\n' +
            '  --dz-danger-hover: ' + darkenHex(dcL, 20) + ';\n' +
            '  --dz-warning: ' + wcL + ';\n' +
            '  --dz-warning-hover: ' + darkenHex(wcL, 20) + ';\n' +
            '  --dz-success: ' + scL + ';\n' +
            '  --dz-success-hover: ' + darkenHex(scL, 20) + ';\n' +
            '  --dz-surface: ' + bgL + ';\n' +
            '  --dz-surface-2: ' + sfL + ';\n' +
            '  --dz-surface-3: ' + darkenHex(sfL, 10) + ';\n' +
            '  --dz-border: ' + bdL + ';\n' +
            '  --dz-border-b: ' + darkenHex(bdL, 10) + ';\n' +
            '  --dz-text: ' + txL + ';\n' +
            '  --dz-text-soft: ' + lightenHex(txL, 30) + ';\n' +
            '  --dz-text-muted: ' + lightenHex(txL, 60) + ';\n' +
            '  --dz-text-faint: ' + lightenHex(txL, 90) + ';\n' +
            '  --dz-bg: ' + pbgL + ';\n' +
            '  --dz-bg-alt: ' + darkenHex(pbgL, 10) + ';\n' +
            '  --dz-nav-bg: ' + bgL + ';\n' +
            '  --dz-table-odd-bg: ' + bgL + ';\n' +
            '  --dz-table-even-bg: ' + sfL + ';\n' +
            '  --dz-table-odd-text: ' + txL + ';\n' +
            '  --dz-table-even-text: ' + txL + ';\n' +
            '  --dz-panel-bg: ' + bgL + ';\n' +
            '  --dz-panel-text: ' + txL + ';\n' +
            '  --dz-modal-bg: ' + bgL + ';\n' +
            '  --dz-modal-text: ' + txL + ';\n' +
            '  --dz-modal-header-bg: ' + sfL + ';\n' +
            '  --dz-input-bg: ' + sfL + ';\n' +
            '  --dz-input-text: ' + txL + ';\n' +
            '  --dz-input-border: ' + bdL + ';\n' +
            '  --dz-btn-bg: ' + sfL + ';\n' +
            '  --dz-btn-text: ' + txL + ';\n' +
            '  --dz-btn-border: ' + darkenHex(bdL, 10) + ';\n' +
            '  --dz-btn-hover-bg: ' + darkenHex(sfL, 10) + ';\n' +
            '  --dz-btn-primary-text: #fff;\n' +
            '  --dz-btn-warning-bg: ' + wcL + ';\n' +
            '  --dz-btn-danger-bg: ' + dcL + ';\n' +
            '  --dz-btn-success-bg: ' + scL + ';\n' +
            '  --dz-overlay-rgb: 0, 0, 0;\n' +
            '  --dz-surface-rgb: ' + hexToRgb(bgL) + ';\n' +
            '  --dz-border-rgb: ' + hexToRgb(bdL) + ';\n' +
            '  --dz-border-color: ' + bdL + ';\n' +
            '  --dz-body-bg: ' + pbgL + ';\n' +
            '  --dz-body-text: ' + txL + ';\n' +
            '  --dz-widget-bg: ' + bgL + ';\n' +
            '  --dz-widget-text: ' + txL + ';\n' +
            '}\n';

        var colorStyle = document.getElementById('dz-ng-color-style');
        if (!colorStyle) {
            colorStyle = document.createElement('style');
            colorStyle.id = 'dz-ng-color-style';
            document.head.appendChild(colorStyle);
        }
        colorStyle.textContent = colorCSS;

        // Card tilt
        var tiltStyle = document.getElementById('dz-ng-tilt-style');
        if (!_settings.cardTilt) {
            if (!tiltStyle) {
                tiltStyle = document.createElement('style');
                tiltStyle.id = 'dz-ng-tilt-style';
                tiltStyle.textContent = '.dz-tilt-enabled { transform: none !important; }';
                document.head.appendChild(tiltStyle);
            }
        } else if (tiltStyle) {
            tiltStyle.remove();
        }

        // Sparklines
        var sparkStyle = document.getElementById('dz-ng-spark-style');
        if (!_settings.sparklines) {
            if (!sparkStyle) {
                sparkStyle = document.createElement('style');
                sparkStyle.id = 'dz-ng-spark-style';
                sparkStyle.textContent = '.dz-sparkline-wrap { display: none !important; }';
                document.head.appendChild(sparkStyle);
            }
        } else if (sparkStyle) {
            sparkStyle.remove();
        }

        // Staleness indicator
        var staleStyle = document.getElementById('dz-ng-stale-style');
        if (!_settings.stalenessIndicator) {
            if (!staleStyle) {
                staleStyle = document.createElement('style');
                staleStyle.id = 'dz-ng-stale-style';
                staleStyle.textContent = '.dz-stale::before { display: none !important; }';
                document.head.appendChild(staleStyle);
            }
        } else if (staleStyle) {
            staleStyle.remove();
        }

        // State flash
        var flashStyle = document.getElementById('dz-ng-flash-style');
        if (!_settings.stateFlash) {
            if (!flashStyle) {
                flashStyle = document.createElement('style');
                flashStyle.id = 'dz-ng-flash-style';
                flashStyle.textContent = '.dz-flash-on, .dz-flash-off { animation: none !important; }';
                document.head.appendChild(flashStyle);
            }
        } else if (flashStyle) {
            flashStyle.remove();
        }

        // Temperature accent
        var tempStyle = document.getElementById('dz-ng-temp-style');
        if (!_settings.tempAccent) {
            if (!tempStyle) {
                tempStyle = document.createElement('style');
                tempStyle.id = 'dz-ng-temp-style';
                tempStyle.textContent = '.dz-temp-accent { border-top: none !important; }';
                document.head.appendChild(tempStyle);
            }
        } else if (tempStyle) {
            tempStyle.remove();
        }

        // Card animations
        var cardAnimStyle = document.getElementById('dz-ng-cardanim-style');
        if (!_settings.cardAnimations) {
            if (!cardAnimStyle) {
                cardAnimStyle = document.createElement('style');
                cardAnimStyle.id = 'dz-ng-cardanim-style';
                cardAnimStyle.textContent =
                    'body table[id^="itemtable"] tbody tr { animation: none !important; }' +
                    'div.item.itemBlock, .itemBlock > div.item { transition: none !important; }';
                document.head.appendChild(cardAnimStyle);
            }
        } else if (cardAnimStyle) {
            cardAnimStyle.remove();
        }

        // Nav animations
        var navAnimStyle = document.getElementById('dz-ng-navanim-style');
        if (!_settings.navAnimations) {
            if (!navAnimStyle) {
                navAnimStyle = document.createElement('style');
                navAnimStyle.id = 'dz-ng-navanim-style';
                navAnimStyle.textContent =
                    '.navbar .nav > li { animation-duration: 0s !important; animation-delay: 0s !important; }' +
                    '.navbar .nav .dropdown-menu > li { animation-duration: 0s !important; animation-delay: 0s !important; }' +
                    '.navbar .nav .dropdown-menu { animation-duration: 0s !important; animation-delay: 0s !important; }' +
                    '.dz-nav-indicator { display: none !important; }';
                document.head.appendChild(navAnimStyle);
            }
        } else if (navAnimStyle) {
            navAnimStyle.remove();
        }

        // Smooth scrolling
        root.style.scrollBehavior = _settings.smoothScrolling ? 'smooth' : 'auto';

        // Show last update
        var luStyle = document.getElementById('dz-ng-lu-style');
        if (!_settings.showLastUpdate) {
            if (!luStyle) {
                luStyle = document.createElement('style');
                luStyle.id = 'dz-ng-lu-style';
                luStyle.textContent = '.dz-card-footer { display: none !important; }';
                document.head.appendChild(luStyle);
            }
        } else if (luStyle) {
            luStyle.remove();
        }

        // Uppercase device names
        var ucStyle = document.getElementById('dz-ng-uc-style');
        if (!_settings.uppercaseNames) {
            if (!ucStyle) {
                ucStyle = document.createElement('style');
                ucStyle.id = 'dz-ng-uc-style';
                ucStyle.textContent = 'body table[id^="itemtable"] tr td:first-child { text-transform: none !important; }';
                document.head.appendChild(ucStyle);
            }
        } else if (ucStyle) {
            ucStyle.remove();
        }


        // Font size
        var pct = parseInt(_settings.fontSize, 10) || 100;
        root.style.fontSize = pct === 100 ? '' : (pct + '%');

        // Icon size
        var iconPct = parseInt(_settings.iconSize, 10) || 100;
        root.style.setProperty('--ng-icon-scale', iconPct === 100 ? '1' : (iconPct / 100));

        // Section-level master toggles
        // When Icons section is disabled, revert all icon replacements
        var iconsDisabledStyle = document.getElementById('dz-ng-icons-disabled');
        if (!_settings.enableIcons) {
            if (!iconsDisabledStyle) {
                iconsDisabledStyle = document.createElement('style');
                iconsDisabledStyle.id = 'dz-ng-icons-disabled';
                iconsDisabledStyle.textContent =
                    'i.dz-fa-device, i.dz-fa-icon, i.dz-fa-fav, i.dz-fa-trend, i.dz-fa-action, i.dz-fa-nav, i.dz-wind { display: none !important; }' +
                    'img.dz-icon-replaced { display: inline !important; opacity: 1 !important; pointer-events: auto !important; }' +
                    'img.dz-icon-replaced[data-dz-src*="favorite"] ~ img.dz-icon-replaced[data-dz-src*="favorite"] { display: none !important; }';
                document.head.appendChild(iconsDisabledStyle);
            }
        } else if (iconsDisabledStyle) { iconsDisabledStyle.remove(); }

        // When Effects section is disabled, kill all effects
        var effectsDisabledStyle = document.getElementById('dz-ng-effects-disabled');
        if (!_settings.enableEffects) {
            if (!effectsDisabledStyle) {
                effectsDisabledStyle = document.createElement('style');
                effectsDisabledStyle.id = 'dz-ng-effects-disabled';
                effectsDisabledStyle.textContent =
                    '.dz-tilt-enabled { transform: none !important; }' +
                    '.dz-sparkline-wrap { display: none !important; }' +
                    '.dz-stale::before { display: none !important; }' +
                    '.dz-flash-on, .dz-flash-off { animation: none !important; }' +
                    '.dz-temp-accent { border-top: none !important; }' +
                    'div.item.itemBlock, .itemBlock > div.item { transition: none !important; }' +
                    'body table[id^="itemtable"] tbody tr { animation: none !important; }' +
                    '.navbar .nav > li, .navbar .nav .dropdown-menu > li, .navbar .nav .dropdown-menu { animation-duration: 0s !important; animation-delay: 0s !important; }' +
                    '.dz-nav-indicator { display: none !important; }';
                document.head.appendChild(effectsDisabledStyle);
            }
        } else if (effectsDisabledStyle) { effectsDisabledStyle.remove(); }

        // When Colors section is disabled, remove the custom color overrides
        if (!_settings.enableColors) {
            var cs = document.getElementById('dz-ng-color-style');
            if (cs) cs.textContent = '';
        }

        // Update toast stack position if the system is already running
        if (window.ngUpdateToastPosition) window.ngUpdateToastPosition();
    }

    /* ── Build the settings panel HTML ─────────────────────────── */

    function buildPanel(opts) {
        opts = opts || {};
        var s = _settings || DEFAULTS;

        function toggle(key, label, desc) {
            var checked = s[key] ? ' checked' : '';
            return '<div class="ng-setting-row">' +
                '<div class="ng-setting-info"><span class="ng-setting-label">' + label + '</span>' +
                (desc ? '<span class="ng-setting-desc">' + desc + '</span>' : '') + '</div>' +
                '<label class="ng-toggle"><input type="checkbox" data-ng-key="' + key + '"' + checked + '>' +
                '<span class="ng-toggle-slider"></span></label></div>';
        }

        var COLOR_PRESETS = [
            '#4e9af1','#2a7de1','#29b6f6','#4dd0e1','#4caf7d','#66bb6a',
            '#f0a832','#ffa726','#ff7043','#e05555','#c8a0ff','#ab47bc',
            '#78909c','#b0b3c6','#555770','#ffffff'
        ];

        function colorPicker(key, label) {
            var val = s[key] || '#4e9af1';
            var presetHtml = COLOR_PRESETS.map(function (c) {
                var sel = (c.toLowerCase() === val.toLowerCase()) ? ' ng-cp-preset--active' : '';
                return '<button class="ng-cp-preset' + sel + '" data-color="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
            }).join('');
            return '<div class="ng-color-wrap" data-ng-color-key="' + key + '">' +
                '<button class="ng-cp-swatch" style="background:' + val + ';"></button>' +
                '<input type="text" class="ng-cp-hex" value="' + val + '" maxlength="7" spellcheck="false">' +
                '<div class="ng-cp-popover">' +
                '<canvas class="ng-cp-sv" width="232" height="148"></canvas>' +
                '<canvas class="ng-cp-hue" width="232" height="14"></canvas>' +
                '<div class="ng-cp-presets">' + presetHtml + '</div>' +
                '</div></div>';
        }

        function dualColorPicker(darkKey, lightKey, label) {
            return '<div class="ng-setting-row ng-setting-row--dual">' +
                '<div class="ng-setting-info"><span class="ng-setting-label">' + label + '</span></div>' +
                '<div class="ng-dual-colors">' +
                '<div class="ng-dual-col">' +
                colorPicker(darkKey, '') + '</div>' +
                '<div class="ng-dual-col">' +
                colorPicker(lightKey, '') + '</div>' +
                '</div></div>';
        }

        function select(key, label, options, desc) {
            var opts = options.map(function (o) {
                var sel = s[key] === o.value ? ' selected' : '';
                return '<option value="' + o.value + '"' + sel + '>' + o.label + '</option>';
            }).join('');
            return '<div class="ng-setting-row">' +
                '<div class="ng-setting-info"><span class="ng-setting-label">' + label + '</span>' +
                (desc ? '<span class="ng-setting-desc">' + desc + '</span>' : '') + '</div>' +
                '<select data-ng-key="' + key + '" class="ng-select">' + opts + '</select></div>';
        }

        function slider(key, label, min, max, step, unit, desc) {
            var val = s[key] || DEFAULTS[key];
            return '<div class="ng-setting-row">' +
                '<div class="ng-setting-info"><span class="ng-setting-label">' + label + '</span>' +
                (desc ? '<span class="ng-setting-desc">' + desc + '</span>' : '') + '</div>' +
                '<div class="ng-slider-wrap"><input type="range" data-ng-key="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">' +
                '<span class="ng-slider-value">' + val + (unit || '') + '</span></div></div>';
        }

        function sectionToggle(key) {
            var checked = s[key] ? ' checked' : '';
            return '<label class="ng-section-toggle" title="Enable / disable this section">' +
                '<input type="checkbox" data-ng-section-key="' + key + '"' + checked + '>' +
                '<span class="ng-section-toggle-slider"></span></label>';
        }
        return '<div id="ng-theme-settings" class="ng-settings-panel">' +

            '<div class="ng-settings-header">' +
            '<div class="ng-settings-header-left">' +
            '<i class="fa-solid fa-palette ng-header-icon"></i>' +
            '<div><h3 class="ng-settings-title">Nightglass Theme</h3>' +
            '<span class="ng-settings-subtitle">Customize your dashboard experience</span></div></div>' +
            '<button class="ng-reset-btn" id="ngResetBtn" title="Reset all settings to defaults">' +
            '<i class="fa-solid fa-rotate-left"></i> Reset</button></div>' +

            '<div class="ng-presets-section" id="ngPresetsSection">' +
            '<button class="ng-presets-toggle' + (opts.presetsOpen ? ' ng-presets-toggle--open' : '') + '" id="ngPresetsToggle" type="button">' +
            '<div class="ng-presets-toggle-left"><i class="fa-solid fa-swatchbook"></i> Theme Presets</div>' +
            '<i class="fa-solid fa-chevron-down ng-presets-chevron"></i>' +
            '</button>' +
            '<div class="ng-presets-body" id="ngPresetsBody"' + (opts.presetsOpen ? '' : ' style="display:none;"') + '>' +
            '<div class="ng-presets-grid" id="ngPresetsGrid">' +
            '<div class="ng-preset-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading presets…</div>' +
            '</div></div></div>' +

            '<div class="ng-settings-grid">' +

            /* Left column: Icons, Appearance, Effects */
            '<div class="ng-settings-section">' +
            '<div class="ng-section-header"><i class="fa-solid fa-bars"></i> Navbar Icons</div>' +
            toggle('navbarIcons', 'Navbar Menu Icons', 'Replace PNG menu icons with Font Awesome in the navigation bar') +
            '</div>' +

            '<div class="ng-settings-section">' +
            '<div class="ng-section-header"><i class="fa-solid fa-cube"></i> Device &amp; Card Icons</div>' +
            toggle('deviceIcons', 'Device Icons', 'Replace 48px PNG device icons with Font Awesome on cards') +
            toggle('animateDeviceIcons', 'Animate Device Icons', 'Spin fans, flicker flames, pulse presence sensors when active') +
            toggle('favStarIcons', 'Favorite Star Icons', 'Replace PNG stars with Font Awesome star icons') +
            toggle('trendArrowIcons', 'Trend Arrow Icons', 'Replace PNG trend arrows with Font Awesome arrows') +
            toggle('actionIcons', 'Action Icons', 'Replace PNG action icons (delete, rename, add) in data tables') +
            '</div>' +

            '<div class="ng-settings-section">' +
            '<div class="ng-section-header"><i class="fa-solid fa-swatchbook"></i> Appearance</div>' +
            select('themeMode', 'Theme Mode', [
                { value: 'toggle', label: '🔀 Manual toggle' },
                { value: 'auto', label: '🖥️ Auto (follow system)' },
                { value: 'dark', label: '🌙 Always dark' },
                { value: 'light', label: '☀️ Always light' }
            ], 'Manual shows a navbar button to switch; Auto follows your OS preference') +
            slider('fontSize', 'Base Font Size', 80, 130, 5, '%', 'Scale the entire interface') +
            slider('iconSize', 'Device Icon Size', 60, 150, 5, '%', 'Scale device icons on cards') +
            toggle('showLastUpdate', 'Show Last Update', 'Show the formatted timestamp footer on device cards') +
            toggle('uppercaseNames', 'Uppercase Device Names', 'Force device names to UPPERCASE on cards') +

            '</div>' +

            '<div class="ng-settings-section">' +
            '<div class="ng-section-header"><i class="fa-solid fa-wand-magic-sparkles"></i> Effects &amp; Animations</div>' +
            toggle('cardTilt', '3D Card Tilt', 'Subtle perspective tilt on hover') +
            toggle('sparklines', 'Sparkline Charts', 'Mini 24h trend charts as card watermarks') +
            toggle('stalenessIndicator', 'Staleness Dot', 'Pulsing red dot on devices that haven\'t updated in 24h') +
            toggle('stateFlash', 'State-Change Flash', 'Blue/red ring flash when a device changes state') +
            toggle('tempAccent', 'Temperature Accent', 'Color-coded top border based on temperature value') +
            toggle('cardAnimations', 'Card Animations', 'Entrance animations and hover transitions on cards') +
            toggle('navAnimations', 'Navbar Animations', 'Staggered entrances, sliding indicator, dropdown effects') +
            toggle('smoothScrolling', 'Smooth Scrolling', 'Enable smooth scroll behavior page-wide') +
            '</div>' +

            '<div class="ng-settings-section">' +
            '<div class="ng-section-header"><i class="fa-solid fa-bell"></i> Live Notifications</div>' +
            toggle('liveToasts', 'Device State Toasts', 'Show a toast when any device changes state via the live WebSocket feed') +
            select('liveToastFilter', 'Event Filter', [
                { value: 'meaningful', label: 'Meaningful (switches & event sensors)' },
                { value: 'all',        label: 'All device changes' }
            ], 'Meaningful skips continuous sensors like temperature and power meters') +
            select('liveToastDuration', 'Visible Duration', [
                { value: '2',  label: '2 seconds' },
                { value: '4',  label: '4 seconds' },
                { value: '6',  label: '6 seconds' },
                { value: '10', label: '10 seconds' }
            ], 'How long each toast stays on screen before fading') +
            select('liveToastPosition', 'Position', [
                { value: 'bottom-right',  label: 'Bottom right' },
                { value: 'bottom-center', label: 'Bottom center' },
                { value: 'top-right',     label: 'Top right' }
            ], 'Where toasts appear on screen') +
            '<div class="ng-setting-row ng-setting-row--action">' +
            '  <div class="ng-setting-info">' +
            '    <span class="ng-setting-label">Suppressed Devices</span>' +
            '    <span class="ng-setting-desc">Block specific devices from triggering notifications</span>' +
            '  </div>' +
            '  <button class="ng-action-chip" id="ng-bl-manage-btn">' +
            '    <i class="fa-solid fa-filter-circle-xmark"></i> Manage</button>' +
            '</div>' +
            '</div>' +

            /* Right column: Color panels (together) */
            '<div class="ng-settings-section ng-settings-section--colors">' +
            '<div class="ng-section-header"><i class="fa-solid fa-droplet"></i> Colors</div>' +
            '<div class="ng-dual-col-headers"><span class="ng-dual-label"><i class="fa-solid fa-moon"></i> Dark</span><span class="ng-dual-label"><i class="fa-solid fa-sun"></i> Light</span></div>' +
            dualColorPicker('accentColor', 'accentColorLight', 'Accent Color') +
            dualColorPicker('dangerColor', 'dangerColorLight', 'Danger Color') +
            dualColorPicker('warningColor', 'warningColorLight', 'Warning Color') +
            dualColorPicker('successColor', 'successColorLight', 'Success Color') +
            '</div>' +

            '<div class="ng-settings-section ng-settings-section--colors">' +
            '<div class="ng-section-header"><i class="fa-solid fa-fill-drip"></i> Background &amp; Surface</div>' +
            '<div class="ng-dual-col-headers"><span class="ng-dual-label"><i class="fa-solid fa-moon"></i> Dark</span><span class="ng-dual-label"><i class="fa-solid fa-sun"></i> Light</span></div>' +
            dualColorPicker('pageBgColor', 'pageBgColorLight', 'Page Background') +
            dualColorPicker('bgColor', 'bgColorLight', 'Navbar &amp; Cards') +
            dualColorPicker('surfaceColor', 'surfaceColorLight', 'Card Surface') +
            dualColorPicker('borderColor', 'borderColorLight', 'Borders') +
            dualColorPicker('textColor', 'textColorLight', 'Text') +
            '</div>' +

            '</div>' + /* grid end */

            '<div class="ng-settings-footer">' +
            '<div class="ng-footer-actions">' +
            '<button class="ng-export-btn" id="ngExportBtn" title="Export settings as JSON file">' +
            '<i class="fa-solid fa-file-export"></i> Export</button>' +
            '<button class="ng-import-btn" id="ngImportBtn" title="Import settings from JSON file">' +
            '<i class="fa-solid fa-file-import"></i> Import</button>' +
            '<input type="file" id="ngImportFile" accept=".json" style="display:none">' +
            (_useNewApi
                ? '<button class="ng-save-btn" id="ngSaveBtn" title="Save settings to the Domoticz database">' +
                  '<i class="fa-solid fa-floppy-disk"></i> Save to Domoticz</button>'
                : '') +
            '</div>' +
            '<span class="ng-footer-note"><i class="fa-solid fa-cloud-arrow-up"></i> ' +
            (!_apiAvailable
                ? 'API unavailable — settings are stored in this browser\'s local storage.'
                : _useNewApi
                    ? 'Changes apply instantly. Click <strong>Save to Domoticz</strong> to persist across all browsers.'
                    : 'Settings are stored as Domoticz user variables and sync across all your browsers.') +
            '</span></div>' +

            '</div>';
    }

    /* ── Theme Preset Loader ───────────────────────────────────── */

    var PRESET_FILES = [
        'nightglass', 'emerald-forest', 'solar-flare', 'arctic-ice',
        'violet-nebula', 'rose-gold', 'monochrome', 'crimson-ember',
        'matrix', 'cyberpunk', 'dracula', 'solarized',
        'synthwave', 'nord', 'hacker', 'ocean-depth'
    ];

    var _presetsCache = null;

    function loadPresets(container) {
        var grid = container.querySelector('#ngPresetsGrid');
        if (!grid) return;

        if (_presetsCache) {
            renderPresets(grid, _presetsCache);
            return;
        }

        var themePath = (function () {
            var scripts = document.querySelectorAll('script[src*="custom.js"]');
            for (var i = 0; i < scripts.length; i++) {
                var src = scripts[i].getAttribute('src') || '';
                var idx = src.indexOf('custom.js');
                if (idx !== -1) return src.substring(0, idx) + 'themes/';
            }
            var links = document.querySelectorAll('link[href*="custom.css"]');
            for (var j = 0; j < links.length; j++) {
                var href = links[j].getAttribute('href') || '';
                var idx2 = href.indexOf('custom.css');
                if (idx2 !== -1) return href.substring(0, idx2) + 'themes/';
            }
            return 'themes/';
        })();

        var promises = PRESET_FILES.map(function (name) {
            return fetch(themePath + name + '.json', { credentials: 'same-origin' })
                .then(function (r) { return r.json(); })
                .catch(function () { return null; });
        });

        Promise.all(promises).then(function (results) {
            _presetsCache = results.filter(function (r) { return r !== null; });
            renderPresets(grid, _presetsCache);
        });
    }

    function renderPresets(grid, presets) {
        if (!presets || !presets.length) {
            grid.innerHTML = '<div class="ng-preset-loading">No presets found</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < presets.length; i++) {
            var p = presets[i];
            var pv = p.preview || {};
            var bg = pv.bg || '#1b1d25';
            var sf = pv.surface || '#23252f';
            var ac = pv.accent || '#4e9af1';
            var tx = pv.text || '#e2e4ed';
            var icon = p.icon || 'fa-solid fa-palette';

            html += '<button class="ng-preset-card" data-ng-preset-idx="' + i + '" title="' + (p.description || p.name) + '">' +
                '<div class="ng-preset-preview" style="background:' + bg + ';">' +
                '<div class="ng-preset-preview-bar" style="background:' + sf + ';border-bottom:2px solid ' + ac + ';"></div>' +
                '<div class="ng-preset-preview-body">' +
                '<div class="ng-preset-preview-card" style="background:' + sf + ';border:1px solid ' + ac + '30;">' +
                '<i class="' + icon + '" style="color:' + ac + ';font-size:14px;"></i>' +
                '<div class="ng-preset-preview-lines">' +
                '<div style="background:' + tx + ';width:70%;height:3px;border-radius:2px;opacity:0.7;"></div>' +
                '<div style="background:' + ac + ';width:45%;height:3px;border-radius:2px;opacity:0.6;"></div>' +
                '</div></div>' +
                '<div class="ng-preset-preview-card" style="background:' + sf + ';border:1px solid ' + ac + '30;">' +
                '<div class="ng-preset-preview-lines">' +
                '<div style="background:' + tx + ';width:55%;height:3px;border-radius:2px;opacity:0.5;"></div>' +
                '<div style="background:' + ac + ';width:35%;height:3px;border-radius:2px;opacity:0.4;"></div>' +
                '</div></div>' +
                '</div></div>' +
                '<div class="ng-preset-info">' +
                '<span class="ng-preset-name">' + p.name + '</span>' +
                '<span class="ng-preset-desc">' + (p.description || '') + '</span>' +
                '</div></button>';
        }
        grid.innerHTML = html;

        grid.querySelectorAll('.ng-preset-card').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = parseInt(this.getAttribute('data-ng-preset-idx'), 10);
                applyPreset(presets[idx]);
                grid.querySelectorAll('.ng-preset-card').forEach(function (b) {
                    b.classList.remove('ng-preset-card--active');
                });
                this.classList.add('ng-preset-card--active');
            });
        });
    }

    function applyPreset(preset) {
        if (!preset || !preset.colors) return;
        var colors = preset.colors;
        var keys = Object.keys(colors);

        // Apply all color keys locally (synchronous), then one API call
        keys.forEach(function (key) { _settings[key] = colors[key]; });
        saveToLocalStorage();
        if (_apiAvailable) saveJsonUvar();

        applySettings();

        // Re-render the settings panel to reflect new colors
        var wrap = document.getElementById('ng-theme-settings-wrap');
        if (wrap) {
            var presetsBody = wrap.querySelector('#ngPresetsBody');
            var presetsWereOpen = presetsBody && presetsBody.style.display !== 'none';
            wrap.innerHTML = buildPanel({ presetsOpen: presetsWereOpen });
            bindEvents(wrap);
            loadPresets(wrap);
        }

        // Show a simple confirmation toast
        if (window.ngShowToast) {
            window.ngShowToast({
                icon:     'fa-palette',
                color:    'var(--dz-accent)',
                title:    preset.name || 'Theme preset',
                body:     'Theme applied',
                type:     'success',
                duration: 3000
            });
        }
    }

    /* ── Inject panel into settings page ───────────────────────── */

    function injectPanel() {
        if (_panelInjected) return;
        var settingsContent = document.getElementById('settingscontent');
        if (!settingsContent) return;
        if (document.getElementById('ng-theme-settings')) return;

        var subTabs = settingsContent.querySelector('.sub-tabs');
        if (!subTabs) return;

        _panelInjected = true;

        // Pre-create the wrap (hidden) so it's ready when tab is clicked
        var wrap = document.createElement('div');
        wrap.id = 'ng-theme-settings-wrap';
        wrap.style.display = 'none';
        wrap.innerHTML = buildPanel();
        settingsContent.appendChild(wrap);
        bindEvents(wrap);
        loadPresets(wrap);

        var li = document.createElement('li');
        li.id = 'ng-settings-tab';
        var a = document.createElement('a');
        a.href = 'javascript:void(0)';
        a.textContent = 'Nightglass';
        a.addEventListener('click', function () {
            showNightglassTab(settingsContent, subTabs);
        });
        li.appendChild(a);

        // Keep the Nightglass tab directly after the localized Backup/Restore tab
        // when that tab exists, and otherwise fall back to placing it before the
        // apply button.
        var applyBtn = subTabs.querySelector('a.sub-tabs-apply');
        var applyLi  = applyBtn ? applyBtn.closest('li') : null;
        var backupLi = Array.from(subTabs.querySelectorAll('li')).find(function (tab) {
            var link = tab.querySelector('a');
            var label = link ? link.textContent.replace(/\s+/g, '').toLowerCase() : '';
            return label === 'backup/herstel' || label === 'backup/restore';
        });
        if (applyLi) {
            applyLi.classList.add('ng-apply-li');
        }
        if (backupLi) {
            if (backupLi.nextElementSibling) {
                subTabs.insertBefore(li, backupLi.nextElementSibling);
            } else if (applyLi) {
                subTabs.insertBefore(li, applyLi);
            } else {
                subTabs.appendChild(li);
            }
        } else if (applyLi) {
            subTabs.insertBefore(li, applyLi);
        } else {
            subTabs.appendChild(li);
        }
    }

    function showNightglassTab(settingsContent, subTabs) {
        var tabs = subTabs.querySelectorAll('li');
        tabs.forEach(function (t) { t.classList.remove('active'); });
        document.getElementById('ng-settings-tab').classList.add('active');
        settingsContent.classList.add('ng-showing');
        var wrap = document.getElementById('ng-theme-settings-wrap');
        if (wrap) wrap.style.display = '';
        settingsContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (!document.getElementById('dz-ng-settings-hide')) {
            var style = document.createElement('style');
            style.id = 'dz-ng-settings-hide';
            style.textContent =
                '#settingscontent.ng-showing #my-tab-content { display: none !important; }' +
                '#settingscontent.ng-showing #ng-theme-settings-wrap { display: block !important; }';
            document.head.appendChild(style);
        }
    }
    /* Restore other panes when clicking a non-Nightglass tab */
    function hookOtherTabs() {
        var settingsContent = document.getElementById('settingscontent');
        if (!settingsContent) return;
        var subTabs = settingsContent.querySelector('.sub-tabs');
        if (!subTabs) return;

        subTabs.addEventListener('click', function (e) {
            var li = e.target.closest('li');
            if (!li || li.id === 'ng-settings-tab') return;
            // Remove the CSS-based hiding class
            settingsContent.classList.remove('ng-showing');
            var wrap = document.getElementById('ng-theme-settings-wrap');
            if (wrap) wrap.style.display = 'none';
            var ngTab = document.getElementById('ng-settings-tab');
            if (ngTab) ngTab.classList.remove('active');
        });
    }

    /* ── Bind interactive events ───────────────────────────────── */

    function applySectionStates(container) {
        container.querySelectorAll('input[data-ng-section-key]').forEach(function (cb) {
            var section = cb.closest('.ng-settings-section');
            if (!section) return;
            if (cb.checked) {
                section.classList.remove('ng-section-disabled');
            } else {
                section.classList.add('ng-section-disabled');
            }
        });
    }

    /* ── Notification Blacklist Dialog ─────────────────────────── */

    function openBlacklistDialog() {
        // Remove any existing dialog
        var existing = document.getElementById('ng-bl-overlay');
        if (existing) existing.remove();

        // Load current blacklist
        var currentBl = [];
        try {
            currentBl = JSON.parse(
                (window.dzNightglassSettings && window.dzNightglassSettings.get('toastBlacklist')) || '[]'
            );
        } catch (e) {}

        // Build dialog shell
        var overlay = document.createElement('div');
        overlay.id = 'ng-bl-overlay';
        overlay.className = 'ng-bl-overlay';
        overlay.innerHTML =
            '<div class="ng-bl-dialog" role="dialog" aria-label="Notification Blacklist">' +
            '  <div class="ng-bl-header">' +
            '    <div class="ng-bl-title">' +
            '      <i class="fa-solid fa-filter-circle-xmark"></i>' +
            '      <span>Suppressed Devices</span>' +
            '    </div>' +
            '    <button class="ng-bl-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
            '  </div>' +
            '  <div class="ng-bl-search-wrap">' +
            '    <i class="fa-solid fa-magnifying-glass ng-bl-search-icon"></i>' +
            '    <input class="ng-bl-search" id="ng-bl-search" placeholder="Search devices…" autocomplete="off">' +
            '  </div>' +
            '  <div class="ng-bl-list" id="ng-bl-list">' +
            '    <div class="ng-bl-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading devices…</div>' +
            '  </div>' +
            '  <div class="ng-bl-footer">' +
            '    <span class="ng-bl-count" id="ng-bl-count"></span>' +
            '    <div class="ng-bl-footer-btns">' +
            '      <button class="ng-bl-btn ng-bl-btn--cancel">Cancel</button>' +
            '      <button class="ng-bl-btn ng-bl-btn--save">Save</button>' +
            '    </div>' +
            '  </div>' +
            '</div>';
        document.body.appendChild(overlay);

        // Animate in
        requestAnimationFrame(function () { overlay.classList.add('ng-bl-overlay--open'); });

        var dialog    = overlay.querySelector('.ng-bl-dialog');
        var listEl    = overlay.querySelector('#ng-bl-list');
        var searchEl  = overlay.querySelector('#ng-bl-search');
        var countEl   = overlay.querySelector('#ng-bl-count');
        var pending   = currentBl.slice(); // copy to mutate

        function close() {
            overlay.classList.remove('ng-bl-overlay--open');
            setTimeout(function () { overlay.remove(); }, 260);
        }

        function updateCount() {
            if (countEl) {
                var n = pending.length;
                countEl.textContent = n === 0 ? 'None suppressed' : n + ' suppressed';
            }
        }

        function filterList(q) {
            var rows = listEl.querySelectorAll('.ng-bl-row');
            q = (q || '').toLowerCase();
            for (var i = 0; i < rows.length; i++) {
                var name = (rows[i].dataset.name || '').toLowerCase();
                rows[i].style.display = (!q || name.indexOf(q) !== -1) ? '' : 'none';
            }
        }

        function renderDevices(devices) {
            if (!devices || !devices.length) {
                listEl.innerHTML = '<div class="ng-bl-empty">No devices found.</div>';
                return;
            }
            var html = '';
            for (var i = 0; i < devices.length; i++) {
                var d = devices[i];
                var isBlocked = pending.indexOf(String(d.idx)) !== -1;
                html +=
                    '<label class="ng-bl-row' + (isBlocked ? ' ng-bl-row--active' : '') + '" ' +
                    '  data-idx="' + d.idx + '" data-name="' + (d.Name || '').replace(/"/g,'&quot;') + '">' +
                    '  <span class="ng-bl-row-info">' +
                    '    <span class="ng-bl-row-name">' + (d.Name || 'Device ' + d.idx) + '</span>' +
                    '    <span class="ng-bl-row-type">' + (d.HardwareName || '') + (d.Type ? ' · ' + d.Type : '') + '</span>' +
                    '  </span>' +
                    '  <input type="checkbox" class="ng-bl-cb" ' + (isBlocked ? 'checked' : '') + ' aria-label="Suppress">' +
                    '  <span class="ng-bl-toggle-track"><span class="ng-bl-toggle-thumb"></span></span>' +
                    '</label>';
            }
            listEl.innerHTML = html;

            // Wire up checkbox changes
            listEl.addEventListener('change', function (e) {
                var cb = e.target;
                if (!cb.classList.contains('ng-bl-cb')) return;
                var row = cb.closest('.ng-bl-row');
                if (!row) return;
                var idxStr = String(row.dataset.idx);
                var pos = pending.indexOf(idxStr);
                if (cb.checked) {
                    row.classList.add('ng-bl-row--active');
                    if (pos === -1) pending.push(idxStr);
                } else {
                    row.classList.remove('ng-bl-row--active');
                    if (pos !== -1) pending.splice(pos, 1);
                }
                updateCount();
            });

            updateCount();
        }

        // Close handlers
        overlay.querySelector('.ng-bl-close').addEventListener('click', close);
        overlay.querySelector('.ng-bl-btn--cancel').addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

        // Search
        if (searchEl) {
            searchEl.addEventListener('input', function () { filterList(this.value); });
        }

        // Save
        overlay.querySelector('.ng-bl-btn--save').addEventListener('click', function () {
            if (window.dzNightglassSettings) {
                window.dzNightglassSettings.set('toastBlacklist', JSON.stringify(pending));
            }
            close();
        });

        // Fetch devices from Domoticz
        fetch('/json.htm?type=command&param=getdevices&filter=all&used=true&order=Name', { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (data) { renderDevices(data.result || []); })
            .catch(function () {
                listEl.innerHTML =
                    '<div class="ng-bl-empty">' +
                    '  <i class="fa-solid fa-triangle-exclamation"></i>' +
                    '  Could not load device list.' +
                    '</div>';
            });
    }

    function bindEvents(container) {
        // Presets panel collapse/expand
        var presetsToggle = container.querySelector('#ngPresetsToggle');
        var presetsBody = container.querySelector('#ngPresetsBody');
        if (presetsToggle && presetsBody) {
            presetsToggle.addEventListener('click', function () {
                var open = presetsBody.style.display !== 'none';
                presetsBody.style.display = open ? 'none' : '';
                presetsToggle.classList.toggle('ng-presets-toggle--open', !open);
            });
        }

        // Toggles
        container.querySelectorAll('input[type="checkbox"][data-ng-key]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                saveSetting(this.getAttribute('data-ng-key'), this.checked);
                // Sub-setting visibility
                updateSubSettings(container);
            });
        });

        // Section toggles (enable/disable entire section)
        container.querySelectorAll('input[data-ng-section-key]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var key = this.getAttribute('data-ng-section-key');
                saveSetting(key, this.checked);
                applySectionStates(container);
            });
        });
        applySectionStates(container);

        // Color pickers (custom HSV canvas)
        initColorPickers(container);

        // Selects
        container.querySelectorAll('select[data-ng-key]').forEach(function (sel) {
            sel.addEventListener('change', function () {
                saveSetting(this.getAttribute('data-ng-key'), this.value);
            });
        });

        // Sliders
        container.querySelectorAll('input[type="range"][data-ng-key]').forEach(function (sl) {
            sl.addEventListener('input', function () {
                var val = this.value;
                this.closest('.ng-slider-wrap').querySelector('.ng-slider-value').textContent = val + '%';
                saveSetting(this.getAttribute('data-ng-key'), val);
            });
        });

        // Reset button
        var resetBtn = container.querySelector('#ngResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
                if (!confirm('Reset all Nightglass theme settings to defaults?')) return;
                Object.keys(DEFAULTS).forEach(function (key) {
                    saveSetting(key, DEFAULTS[key]);
                });
                // Re-render
                var wrap = document.getElementById('ng-theme-settings-wrap');
                if (wrap) {
                    wrap.innerHTML = buildPanel();
                    bindEvents(wrap);
                    loadPresets(wrap);
                }
            });
        }

        // Notification blacklist manage button
        var blBtn = container.querySelector('#ng-bl-manage-btn');
        if (blBtn) {
            blBtn.addEventListener('click', openBlacklistDialog);
        }

        // Export button
        var exportBtn = container.querySelector('#ngExportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', function () {
                var data = JSON.stringify(_settings, null, 2);
                var blob = new Blob([data], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'nightglass-settings.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }

        // Import button
        var importBtn = container.querySelector('#ngImportBtn');
        var importFile = container.querySelector('#ngImportFile');
        if (importBtn && importFile) {
            importBtn.addEventListener('click', function () {
                importFile.click();
            });
            importFile.addEventListener('change', function () {
                var file = this.files && this.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function (e) {
                    try {
                        var imported = JSON.parse(e.target.result);
                        var count = 0;
                        Object.keys(DEFAULTS).forEach(function (key) {
                            if (imported[key] !== undefined) {
                                saveSetting(key, imported[key]);
                                count++;
                            }
                        });
                        // Re-render panel with new values
                        var wrap = document.getElementById('ng-theme-settings-wrap');
                        if (wrap) {
                            wrap.innerHTML = buildPanel();
                            bindEvents(wrap);
                            loadPresets(wrap);
                        }
                        alert('Imported ' + count + ' settings successfully.');
                    } catch (err) {
                        alert('Failed to import settings: invalid JSON file.');
                    }
                };
                reader.readAsText(file);
                this.value = ''; // allow re-importing the same file
            });
        }

        // Save to Domoticz button (new API only)
        var saveBtn = container.querySelector('#ngSaveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                _saveToDomoticz(this);
            });
        }

        updateSubSettings(container);
    }

    /* ── Custom HSV Color Picker logic ─────────────────────────── */

    function hexToHsv(hex) {
        var r = parseInt(hex.slice(1,3),16)/255;
        var g = parseInt(hex.slice(3,5),16)/255;
        var b = parseInt(hex.slice(5,7),16)/255;
        var mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx - mn;
        var h = 0, s = mx === 0 ? 0 : d / mx, v = mx;
        if (d !== 0) {
            if (mx === r)      h = ((g - b) / d + 6) % 6;
            else if (mx === g) h = (b - r) / d + 2;
            else               h = (r - g) / d + 4;
            h /= 6;
        }
        return { h: h, s: s, v: v };
    }

    function hsvToHex(h, s, v) {
        var i = Math.floor(h * 6), f = h * 6 - i;
        var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
        var r, g, b;
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        var toHex = function (n) { var h = Math.round(n * 255).toString(16); return h.length < 2 ? '0' + h : h; };
        return '#' + toHex(r) + toHex(g) + toHex(b);
    }

    function drawSV(canvas, hue) {
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;
        // Fill with hue
        ctx.fillStyle = hsvToHex(hue, 1, 1);
        ctx.fillRect(0, 0, w, h);
        // White gradient left to right
        var gW = ctx.createLinearGradient(0, 0, w, 0);
        gW.addColorStop(0, 'rgba(255,255,255,1)');
        gW.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gW;
        ctx.fillRect(0, 0, w, h);
        // Black gradient top to bottom
        var gB = ctx.createLinearGradient(0, 0, 0, h);
        gB.addColorStop(0, 'rgba(0,0,0,0)');
        gB.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = gB;
        ctx.fillRect(0, 0, w, h);
    }

    function drawHueBar(canvas) {
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;
        var grad = ctx.createLinearGradient(0, 0, w, 0);
        for (var i = 0; i <= 6; i++) {
            grad.addColorStop(i / 6, hsvToHex(i / 6, 1, 1));
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    function initColorPickers(container) {
        container.querySelectorAll('.ng-color-wrap[data-ng-color-key]').forEach(function (wrap) {
            var key = wrap.getAttribute('data-ng-color-key');
            var swatch = wrap.querySelector('.ng-cp-swatch');
            var hexInput = wrap.querySelector('.ng-cp-hex');
            var popover = wrap.querySelector('.ng-cp-popover');
            var svCanvas = wrap.querySelector('.ng-cp-sv');
            var hueCanvas = wrap.querySelector('.ng-cp-hue');
            var presetBtns = wrap.querySelectorAll('.ng-cp-preset');

            var hsv = hexToHsv(hexInput.value || '#4e9af1');

            function updateFromHsv(commit) {
                var hex = hsvToHex(hsv.h, hsv.s, hsv.v);
                swatch.style.background = hex;
                hexInput.value = hex;
                drawSV(svCanvas, hsv.h);
                // Highlight active preset
                presetBtns.forEach(function (b) {
                    b.classList.toggle('ng-cp-preset--active',
                        b.getAttribute('data-color').toLowerCase() === hex.toLowerCase());
                });
                if (commit) saveSetting(key, hex);
            }

            // Init canvases
            drawSV(svCanvas, hsv.h);
            drawHueBar(hueCanvas);

            // Toggle popover (fixed positioning to escape overflow)
            swatch.addEventListener('click', function (e) {
                e.stopPropagation();
                var open = popover.style.display === 'block';
                closeAllPopovers(container);
                if (!open) {
                    popover.style.display = 'block';
                    // Position fixed relative to the swatch button
                    var rect = swatch.getBoundingClientRect();
                    var popW = 260; // matches CSS width
                    var left = rect.right - popW;
                    var top = rect.bottom + 8;
                    // Keep within viewport
                    if (left < 8) left = 8;
                    if (top + 300 > window.innerHeight) top = rect.top - 308;
                    popover.style.left = left + 'px';
                    popover.style.top = top + 'px';
                    drawSV(svCanvas, hsv.h);
                    drawHueBar(hueCanvas);
                }
            });

            // SV canvas interaction
            function handleSV(e) {
                var rect = svCanvas.getBoundingClientRect();
                var x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                var y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                hsv.s = x;
                hsv.v = 1 - y;
                updateFromHsv(true);
            }
            var svDragging = false;
            svCanvas.addEventListener('pointerdown', function (e) {
                svDragging = true;
                svCanvas.setPointerCapture(e.pointerId);
                handleSV(e);
            });
            svCanvas.addEventListener('pointermove', function (e) {
                if (svDragging) handleSV(e);
            });
            svCanvas.addEventListener('pointerup', function () { svDragging = false; });

            // Hue bar interaction
            function handleHue(e) {
                var rect = hueCanvas.getBoundingClientRect();
                hsv.h = Math.max(0, Math.min(0.9999, (e.clientX - rect.left) / rect.width));
                updateFromHsv(true);
            }
            var hueDragging = false;
            hueCanvas.addEventListener('pointerdown', function (e) {
                hueDragging = true;
                hueCanvas.setPointerCapture(e.pointerId);
                handleHue(e);
            });
            hueCanvas.addEventListener('pointermove', function (e) {
                if (hueDragging) handleHue(e);
            });
            hueCanvas.addEventListener('pointerup', function () { hueDragging = false; });

            // Hex input
            hexInput.addEventListener('input', function () {
                var v = this.value.trim();
                if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                    hsv = hexToHsv(v);
                    updateFromHsv(true);
                }
            });
            hexInput.addEventListener('blur', function () {
                var v = this.value.trim();
                if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
                    this.value = hsvToHex(hsv.h, hsv.s, hsv.v);
                }
            });
            hexInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { this.blur(); }
            });

            // Presets
            presetBtns.forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var c = this.getAttribute('data-color');
                    hsv = hexToHsv(c);
                    updateFromHsv(true);
                });
            });
        });

        // Close popover when clicking outside
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.ng-color-wrap')) {
                closeAllPopovers(container);
            }
        });
    }

    function closeAllPopovers(container) {
        container.querySelectorAll('.ng-cp-popover').forEach(function (p) {
            p.style.display = 'none';
        });
    }

    function updateSubSettings(container) {
        // animateDeviceIcons only relevant if deviceIcons is on
        var animRow = container.querySelector('[data-ng-key="animateDeviceIcons"]');
        if (animRow) {
            var row = animRow.closest('.ng-setting-row');
            if (row) row.style.opacity = _settings.deviceIcons ? '1' : '0.4';
        }
    }

    /* ── Initialize ────────────────────────────────────────────── */

    function retryInjectPanel(attempts) {
        if (_panelInjected || attempts <= 0) return;
        injectPanel();
        if (!_panelInjected) {
            setTimeout(function () { retryInjectPanel(attempts - 1); }, 500);
        } else {
            hookOtherTabs();
        }
    }

    function init() {
        loadSettings().then(function () {
            applySettings();
            injectPanel();
            hookOtherTabs();
            if (!_panelInjected) {
                retryInjectPanel(10);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-inject on SPA navigation (settings page may load later)
    window.addEventListener('hashchange', function () {
        _panelInjected = false;
        setTimeout(function () {
            if (_settings) {
                injectPanel();
                hookOtherTabs();
            }
        }, 500);
    });

    // Also watch for Angular route changes
    var _retryCount = 0;
    function hookAngularForSettings() {
        var $body = document.querySelector('[ng-app]') || document.body;
        var injector = window.angular && window.angular.element($body).injector();
        if (!injector) {
            if (++_retryCount < 20) setTimeout(hookAngularForSettings, 500);
            return;
        }
        var $rootScope = injector.get('$rootScope');
        $rootScope.$on('$viewContentLoaded', function () {
            _panelInjected = false;
            setTimeout(function () {
                if (_settings) {
                    injectPanel();
                    hookOtherTabs();
                }
            }, 500);
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(hookAngularForSettings, 500);
        });
    } else {
        setTimeout(hookAngularForSettings, 500);
    }

    // Expose for external use
    window.dzNightglassSettings = {
        get: function (key) { return _settings ? _settings[key] : DEFAULTS[key]; },
        set: saveSetting,
        reset: function () {
            Object.keys(DEFAULTS).forEach(function (key) {
                saveSetting(key, DEFAULTS[key]);
            });
        }
    };
})();
