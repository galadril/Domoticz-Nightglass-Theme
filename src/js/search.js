(function () {
    'use strict';

    // Press 1–9 while not in a text field to jump to these routes.
    // Keys must match the Domoticz Angular route names exactly (app.routes.js).
    var NAV = {
        '1': 'Dashboard',
        '2': 'LightSwitches',
        '3': 'Scenes',
        '4': 'Temperature',
        '5': 'Weather',
        '6': 'Utility',
        '7': 'Cam',
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
 *  Dropdown-submenu toggle (mobile accordion + desktop overflow flip)
 *
 *  Bootstrap 2/3 reveals nested submenus via CSS :hover only.
 *  On touch devices :hover never fires, so we need a click handler.
 *
 *  The fundamental problem: Bootstrap's clearMenus is a bubble-phase
 *  handler on `document`.  Any jQuery handler we add on body or
 *  document also runs in the bubble phase, and Bootstrap's fires first
 *  (registered earlier), closing the parent dropdown before our .open
 *  toggle takes effect.
 *
 *  Solution: register a native capture-phase listener on document.
 *  Capture fires top-down BEFORE any bubble-phase handlers, so our
 *  code runs first.  Calling stopPropagation() in capture prevents the
 *  event from ever reaching Bootstrap's bubble handler.
 * ================================================================== */
(function () {
    'use strict';

    function initSubmenus() {
        // --- Mobile: position level-2 panel to the left of the parent menu ---
        // Measures the parent .dropdown-menu BoundingRect so it never overlaps.
        function positionMobileLevel2($item) {
            var menu = $item.children('.dropdown-menu')[0];
            if (!menu) return;
            // Parent menu (e.g. Setup dropdown) is one level up
            var parentMenu = $item.closest('.navbar .nav .dropdown').children('.dropdown-menu')[0];
            if (!parentMenu) return;
            var r = parentMenu.getBoundingClientRect();
            // Available space to the left of the parent menu
            var availW = Math.max(130, r.left - 8);
            var leftPos = Math.max(4, r.left - availW - 4);
            var topPos  = r.top;
            var maxH    = window.innerHeight - topPos - 8;
            menu.style.setProperty('position',   'fixed',             'important');
            menu.style.setProperty('top',         topPos  + 'px',     'important');
            menu.style.setProperty('left',        leftPos + 'px',     'important');
            menu.style.setProperty('right',       'auto',             'important');
            menu.style.setProperty('width',       availW  + 'px',     'important');
            menu.style.setProperty('min-width',   '130px',            'important');
            menu.style.setProperty('max-height',  maxH    + 'px',     'important');
            menu.style.setProperty('z-index',     '100000',           'important');
        }

        function clearMobileLevel2($dropdown) {
            $dropdown.find('.dropdown-submenu').children('.dropdown-menu').each(function () {
                // Only clear if this is a level-2 (direct child of top-level dropdown)
                if (!$(this).closest('.dropdown-submenu .dropdown-submenu').length) {
                    this.style.removeProperty('position');
                    this.style.removeProperty('top');
                    this.style.removeProperty('left');
                    this.style.removeProperty('right');
                    this.style.removeProperty('width');
                    this.style.removeProperty('min-width');
                    this.style.removeProperty('max-height');
                    this.style.removeProperty('z-index');
                }
            });
        }

        // --- Touch / click toggle (capture phase) ---
        // Fires before Bootstrap's bubble-phase clearMenus, so the
        // parent dropdown stays open while we expand the submenu.
        document.addEventListener('click', function (e) {
            var a = e.target && e.target.closest
                ? e.target.closest('.dropdown-submenu > a')
                : (function (el) {
                    // IE/old-Android fallback for closest()
                    while (el && el !== document) {
                        if (el.tagName === 'A' &&
                            el.parentNode &&
                            (' ' + el.parentNode.className + ' ').indexOf(' dropdown-submenu ') !== -1) {
                            return el;
                        }
                        el = el.parentNode;
                    }
                    return null;
                }(e.target));

            if (!a) return;

            var $item = $(a).closest('.dropdown-submenu');
            var wasOpen = $item.hasClass('open');
            // Collapse any open sibling submenus at the same level
            $item.siblings('.dropdown-submenu').removeClass('open');
            $item.toggleClass('open', !wasOpen);

            // Mobile: position level-2 panel via JS so it never collides
            if (window.innerWidth <= 767 && !wasOpen) {
                var isLevel2 = !$item.closest('.dropdown-submenu .dropdown-submenu').length;
                if (isLevel2) {
                    positionMobileLevel2($item);
                }
            }

            // Stop propagation AND prevent default so Bootstrap's
            // clearMenus (bubble phase, document) never fires and the
            // link does not navigate.
            e.stopPropagation();
            e.preventDefault();
        }, true /* capture */);

        // --- Desktop hover: CSS defaults to right:100% (fly left).
        // Only flip to right when there is not enough room on the left.
        $(document).on('mouseenter.dz-submenu-pos', '.navbar .nav .dropdown-submenu', function () {
            if (window.innerWidth <= 767) return; // mobile layout handled by JS
            var $menu = $(this).children('.dropdown-menu');
            // Reset any previous flip so we start from the CSS default (right:100%)
            $menu.css({ left: '', right: '' });
            requestAnimationFrame(function () {
                if (!$menu.is(':visible')) return;
                var rect = $menu[0].getBoundingClientRect();
                if (rect.left < 8) {
                    // Clipped by left edge — flip to fly right instead
                    $menu.css({ right: 'auto', left: '100%' });
                }
            });
        });

        // Clean up: collapse all submenus when the parent dropdown closes
        $(document).on('hidden.bs.dropdown', '.dropdown', function () {
            $(this).find('.dropdown-submenu').removeClass('open');
            if (window.innerWidth <= 767) {
                clearMobileLevel2($(this));
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSubmenus);
    } else {
        initSubmenus();
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
        toastBlacklist:     '[]',

        deviceIconOverrides: '{}'
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

        // Push device icon overrides to the icon replacement module
        if (typeof window._dzSetDeviceIconOverrides === 'function') {
            try {
                var raw = _settings.deviceIconOverrides || '{}';
                var overrides = typeof raw === 'string' ? JSON.parse(raw) : raw;
                window._dzSetDeviceIconOverrides(overrides);
            } catch (e) {
                window._dzSetDeviceIconOverrides({});
            }
        }
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

            (function () {
                var ovRaw = (s.deviceIconOverrides || '{}');
                var ovCount = 0;
                try { ovCount = Object.keys(typeof ovRaw === 'string' ? JSON.parse(ovRaw) : ovRaw).length; } catch (e) {}
                var badge = ovCount > 0
                    ? ' <span class="ng-override-badge">' + ovCount + '</span>'
                    : '';
                return '<div class="ng-settings-section">' +
                    '<div class="ng-section-header"><i class="fa-solid fa-icons"></i> Device Icon Overrides</div>' +
                    '<div class="ng-setting-row ng-setting-row--action">' +
                    '  <div class="ng-setting-info">' +
                    '    <span class="ng-setting-label">Per-Device Icons' + badge + '</span>' +
                    '    <span class="ng-setting-desc">Assign any Font Awesome icon &amp; custom on/off colors to individual devices</span>' +
                    '  </div>' +
                    '  <button class="ng-action-chip" id="ng-override-manage-btn">' +
                    '    <i class="fa-solid fa-wand-magic-sparkles"></i> Manage</button>' +
                    '</div>' +
                    '</div>';
            })() +

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

    // Keys that represent personal device/notification data.
    // Presets may never overwrite these — they belong to the user, not to a theme.
    var PRESET_PROTECTED_KEYS = {
        deviceIconOverrides: true,
        toastBlacklist:      true
    };

    function applyPreset(preset) {
        if (!preset || !preset.colors) return;
        var colors = preset.colors;
        var keys = Object.keys(colors);

        // Apply color keys — skip any that hold personal user data
        keys.forEach(function (key) {
            if (!PRESET_PROTECTED_KEYS[key]) {
                _settings[key] = colors[key];
            }
        });
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

    /* ── Device Icon Override Dialog ──────────────────────────────── */

    /* Classify a device into an icon/color model for the override editor.
       Returns one of:
         'binary'    standard switch — 1 icon, on/off colors
         'selector'  selector switch — 1 icon, active/inactive colors
         'lock'      door lock — 2 icons (unlocked + locked) + 2 colors
         'contact'   contact/door sensor — 2 icons (open + closed) + 2 colors
         'blinds-2'  directional blinds, no stop — Open + Close icons
         'blinds-3'  directional blinds with stop — Open + Stop + Close icons
         'sensor'    value-driven sensors (temp/humidity/etc.) — 1 icon + keepColor toggle */
    function getDeviceColorModel(d) {
        var sw      = d.SwitchType || '';
        var type    = d.Type       || '';
        var typeImg = (d.TypeImg   || '').toLowerCase();
        var subType = d.SubType    || '';

        /* Blinds — directional multi-icon cards */
        if (sw.indexOf('Blinds') >= 0 || sw === 'Venetian Blinds US' || sw === 'Venetian Blinds EU') {
            var hasStop = (
                subType === 'RAEX'               || subType === 'Harrison'              ||
                subType.indexOf('A-OK')       === 0 || subType.indexOf('Hasta')       >= 0 ||
                subType.indexOf('Media Mount')=== 0 || subType.indexOf('Forest')      === 0 ||
                subType.indexOf('Chamberlain')=== 0 || subType.indexOf('Sunpery')     === 0 ||
                subType.indexOf('Dolat')      === 0 || subType.indexOf('ASP')         === 0 ||
                subType.indexOf('RFY')        === 0 || subType.indexOf('ASA')         === 0 ||
                subType.indexOf('DC106')      === 0 || subType.indexOf('Confexx')     === 0 ||
                sw.indexOf('Venetian Blinds') === 0 || sw.indexOf('Stop')             >= 0
            );
            return hasStop ? 'blinds-3' : 'blinds-2';
        }

        /* Sensors — value-driven, dynamic color, no binary on/off */
        var sensorTypes = ['Temp', 'Temp+Hum', 'Temp+Hum+Baro', 'Humidity', 'Rain', 'UV',
                           'Wind', 'Lux', 'Air Quality', 'Soil Moisture', 'Leaf Wetness',
                           'Visibility', 'Barometric Pressure', 'Current', 'Current/Energy', 'Weight'];
        if (sensorTypes.indexOf(type) >= 0 || /^temp|^humid|^rain|^uv|^wind|^alert/i.test(typeImg)) {
            return 'sensor';
        }
        if (type === 'General') {
            var sensorSubs = ['Voltage', 'Current', 'Pressure', 'Sound Level', 'Solar Radiation',
                              'Visibility', 'Distance', 'Soil Moisture', 'Leaf Wetness',
                              'Waterflow', 'Lux', 'Percentage', 'Managed Counter', 'Counter Incremental'];
            if (sensorSubs.indexOf(subType) >= 0) return 'sensor';
        }

        /* Door locks — benefit from different icons per state */
        if (sw === 'Door Lock' || sw === 'Door Lock Inverted') return 'lock';

        /* Contact sensors */
        if (sw === 'Contact' || sw === 'Door Contact') return 'contact';

        /* Selector switches */
        if (sw === 'Selector') return 'selector';

        return 'binary';
    }

    /* Returns a human-readable group label for a device (shown as a tag in the dialog).
       Groups mirror the Domoticz dashboard tabs. */
    function getDeviceGroup(d) {
        var type = d.Type || '';
        var sw   = d.SwitchType || '';
        if (['Temp','Temp+Hum','Temp+Hum+Baro','Humidity',
             'Soil Temperature'].indexOf(type) >= 0) return 'Temperature';
        if (['Rain','Wind','UV','Visibility','Barometric Pressure',
             'Solar Radiation'].indexOf(type) >= 0) return 'Weather';
        if (type === 'Security') return 'Security';
        if (type === 'Scene') return 'Scene';
        if (type === 'Group' || sw === 'Group') return 'Group';
        if (['General','P1 Smart Meter','RFXMeter','YouLess Meter',
             'Lux','Air Quality','Current','Current/Energy',
             'Weight','Counter Incremental'].indexOf(type) >= 0) return 'Utility';
        if (['Light/Switch','Lighting 1','Lighting 2','Lighting 3',
             'Lighting 4','Lighting 5','Lighting 6','Fan','Chime',
             'Color Switch'].indexOf(type) >= 0) return 'Light & Switch';
        return null;
    }

    function openDeviceIconOverrideDialog() {
        var existing = document.getElementById('ng-ov-overlay');
        if (existing) existing.remove();

        // Parse current overrides
        var currentOv = {};
        try {
            var raw = (window.dzNightglassSettings && window.dzNightglassSettings.get('deviceIconOverrides')) || '{}';
            currentOv = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
        } catch (e) {}

        // Popular quick-override suggestions
        var POPULAR_OVERRIDES = [
            { label: 'WiFi Router',     icon: 'fa-solid fa-wifi',              on: '#4caf7d', off: '#555770' },
            { label: 'Network Switch',  icon: 'fa-solid fa-network-wired',     on: '#4e9af1', off: '#555770' },
            { label: 'Car',             icon: 'fa-solid fa-car',               on: '#4e9af1', off: '#555770' },
            { label: 'EV Charger',      icon: 'fa-solid fa-charging-station',  on: '#4caf7d', off: '#555770' },
            { label: 'Baby Monitor',    icon: 'fa-solid fa-baby',              on: '#c8a0ff', off: '#555770' },
            { label: 'Camera',          icon: 'fa-solid fa-camera',            on: '#4e9af1', off: '#555770' },
            { label: 'Doorbell',        icon: 'fa-solid fa-bell-concierge',    on: '#f0a832', off: '#555770' },
            { label: 'Freezer',         icon: 'fa-solid fa-temperature-low',   on: '#29b6f6', off: '#555770' },
            { label: 'Washing Machine', icon: 'fa-solid fa-shirt',             on: '#4e9af1', off: '#555770' },
            { label: 'Dishwasher',      icon: 'fa-solid fa-sink',              on: '#4e9af1', off: '#555770' },
            { label: 'Solar Panel',     icon: 'fa-solid fa-solar-panel',       on: '#f0a832', off: '#555770' },
            { label: 'Battery/UPS',     icon: 'fa-solid fa-car-battery',       on: '#4caf7d', off: '#555770' },
            { label: 'Server',          icon: 'fa-solid fa-server',            on: '#4e9af1', off: '#555770' },
            { label: 'Smart Plug',      icon: 'fa-solid fa-plug',              on: '#4caf7d', off: '#555770' },
            { label: 'Boiler',          icon: 'fa-solid fa-fire-flame-curved', on: '#ff7043', off: '#555770' },
            { label: 'Ventilation',     icon: 'fa-solid fa-fan',               on: '#29b6f6', off: '#555770' },
            { label: 'Garage Door',     icon: 'fa-solid fa-warehouse',         on: '#f0a832', off: '#4caf7d' },
            { label: 'Pet Feeder',      icon: 'fa-solid fa-paw',               on: '#f0a832', off: '#555770' },
            { label: 'NAS / Disk',      icon: 'fa-solid fa-hard-drive',        on: '#4e9af1', off: '#555770' },
            { label: 'Vacuum Robot',    icon: 'fa-solid fa-robot',             on: '#4e9af1', off: '#555770' }
        ];

        // FA 7 Free icon picker sets.
        // FA_ICONS_PRESET — shown by default (curated home-automation icons).
        // FA_ICONS_ALL    — searched when the user types in the picker search box.
        var FA_ICONS_PRESET = [
            // Networking
            'fa-solid fa-wifi',              'fa-solid fa-network-wired',     'fa-solid fa-ethernet',
            'fa-solid fa-satellite-dish',    'fa-solid fa-tower-broadcast',   'fa-solid fa-signal',
            // House & Rooms
            'fa-solid fa-house',             'fa-solid fa-house-chimney',     'fa-solid fa-house-signal',
            'fa-solid fa-door-closed',       'fa-solid fa-door-open',         'fa-solid fa-window-maximize',
            'fa-solid fa-warehouse',         'fa-solid fa-building',          'fa-solid fa-couch',
            'fa-solid fa-bed',               'fa-solid fa-bath',              'fa-solid fa-sink',
            'fa-solid fa-toilet',            'fa-solid fa-stairs',            'fa-solid fa-table',
            'fa-solid fa-chair',             'fa-solid fa-shower',
            // Lighting
            'fa-solid fa-lightbulb',         'fa-solid fa-circle-half-stroke','fa-solid fa-sun',
            'fa-solid fa-moon',              'fa-solid fa-star',              'fa-solid fa-wand-magic-sparkles',
            // Tech & AV
            'fa-solid fa-tv',                'fa-solid fa-display',           'fa-solid fa-computer',
            'fa-solid fa-server',            'fa-solid fa-hard-drive',        'fa-solid fa-print',
            'fa-solid fa-phone',             'fa-solid fa-mobile-screen',     'fa-solid fa-tablet-screen-button',
            'fa-solid fa-headphones',        'fa-solid fa-volume-high',       'fa-solid fa-music',
            'fa-solid fa-gamepad',           'fa-solid fa-camera',            'fa-solid fa-video',
            // Appliances
            'fa-solid fa-blender',           'fa-solid fa-mug-hot',           'fa-solid fa-utensils',
            'fa-solid fa-shirt',             'fa-solid fa-broom',             'fa-solid fa-baby',
            'fa-solid fa-carriage-baby',     'fa-solid fa-robot',
            // Energy & Power
            'fa-solid fa-bolt',              'fa-solid fa-plug',              'fa-solid fa-charging-station',
            'fa-solid fa-solar-panel',       'fa-solid fa-car-battery',       'fa-solid fa-battery-full',
            'fa-solid fa-power-off',         'fa-solid fa-toggle-on',
            // Climate & Sensors
            'fa-solid fa-fire',              'fa-solid fa-fire-flame-curved', 'fa-solid fa-gauge',
            'fa-solid fa-temperature-half',  'fa-solid fa-temperature-full',  'fa-solid fa-snowflake',
            'fa-solid fa-fan',               'fa-solid fa-wind',              'fa-solid fa-cloud',
            'fa-solid fa-cloud-rain',        'fa-solid fa-umbrella',          'fa-solid fa-droplet',
            'fa-solid fa-temperature-low',   'fa-solid fa-temperature-high',  'fa-solid fa-smog',
            // Garden & Nature
            'fa-solid fa-seedling',          'fa-solid fa-leaf',              'fa-solid fa-tree',
            'fa-solid fa-trowel',            'fa-solid fa-water-ladder',
            // Security
            'fa-solid fa-lock',              'fa-solid fa-lock-open',         'fa-solid fa-shield-halved',
            'fa-solid fa-bell',              'fa-solid fa-bell-concierge',    'fa-solid fa-triangle-exclamation',
            'fa-solid fa-circle-exclamation','fa-solid fa-eye',               'fa-solid fa-person-running',
            // Pets & Animals
            'fa-solid fa-dog',               'fa-solid fa-paw',               'fa-solid fa-cat',
            // Transport
            'fa-solid fa-car',               'fa-solid fa-car-side',          'fa-solid fa-truck',
            'fa-solid fa-motorcycle',        'fa-solid fa-bicycle',           'fa-solid fa-plane',
            'fa-solid fa-tractor',           'fa-solid fa-bus',
            // Water & Plumbing
            'fa-solid fa-hand-holding-droplet','fa-solid fa-faucet',          'fa-solid fa-pump-soap',
            'fa-solid fa-spray-can',
            // Health
            'fa-solid fa-heart-pulse',       'fa-solid fa-weight-scale',      'fa-solid fa-lungs',
            'fa-solid fa-syringe',           'fa-solid fa-pills',             'fa-solid fa-hospital',
            // Tools
            'fa-solid fa-gear',              'fa-solid fa-wrench',            'fa-solid fa-screwdriver',
            'fa-solid fa-toolbox',
            // Controls & Misc
            'fa-solid fa-box',               'fa-solid fa-bookmark',          'fa-solid fa-flag',
            'fa-solid fa-circle-dot',        'fa-solid fa-sliders',           'fa-solid fa-clock',
            'fa-solid fa-calendar',          'fa-solid fa-location-dot',      'fa-solid fa-map-location-dot',
            'fa-solid fa-microchip',         'fa-solid fa-database',          'fa-solid fa-bars-progress'
        ];

        // All searchable icons — FA 7 Free Solid, verified against the Domoticz bundle.
        // Shown only when the user types a search query in the icon picker.
        var FA_ICONS_ALL = [
            // Networking
            'fa-solid fa-wifi',              'fa-solid fa-network-wired',     'fa-solid fa-ethernet',
            'fa-solid fa-satellite-dish',    'fa-solid fa-satellite',         'fa-solid fa-tower-broadcast',
            'fa-solid fa-tower-cell',        'fa-solid fa-signal',            'fa-solid fa-globe',
            'fa-solid fa-server',            'fa-solid fa-database',          'fa-solid fa-microchip',
            'fa-solid fa-hard-drive',        'fa-solid fa-radio',             'fa-solid fa-walkie-talkie',
            // House & Rooms
            'fa-solid fa-house',             'fa-solid fa-house-chimney',     'fa-solid fa-house-signal',
            'fa-solid fa-house-lock',        'fa-solid fa-house-fire',        'fa-solid fa-house-flood-water',
            'fa-solid fa-house-laptop',      'fa-solid fa-house-user',        'fa-solid fa-house-chimney-window',
            'fa-solid fa-house-medical',     'fa-solid fa-house-chimney-crack','fa-solid fa-building',
            'fa-solid fa-building-columns',  'fa-solid fa-building-lock',     'fa-solid fa-warehouse',
            'fa-solid fa-igloo',             'fa-solid fa-door-closed',       'fa-solid fa-door-open',
            'fa-solid fa-window-maximize',   'fa-solid fa-window-restore',    'fa-solid fa-window-minimize',
            'fa-solid fa-couch',             'fa-solid fa-bed',               'fa-solid fa-chair',
            'fa-solid fa-table',             'fa-solid fa-bath',              'fa-solid fa-sink',
            'fa-solid fa-toilet',            'fa-solid fa-toilet-paper',      'fa-solid fa-shower',
            'fa-solid fa-stairs',            'fa-solid fa-archway',
            // Lighting
            'fa-solid fa-lightbulb',         'fa-solid fa-circle-half-stroke','fa-solid fa-sun',
            'fa-solid fa-moon',              'fa-solid fa-star',              'fa-solid fa-wand-magic-sparkles',
            'fa-solid fa-wand-magic',        'fa-solid fa-wand-sparkles',
            // Tech & AV
            'fa-solid fa-tv',                'fa-solid fa-display',           'fa-solid fa-computer',
            'fa-solid fa-computer-mouse',    'fa-solid fa-keyboard',          'fa-solid fa-print',
            'fa-solid fa-phone',             'fa-solid fa-mobile-screen',     'fa-solid fa-mobile-screen-button',
            'fa-solid fa-tablet-screen-button','fa-solid fa-headphones',      'fa-solid fa-volume-high',
            'fa-solid fa-volume-low',        'fa-solid fa-volume-off',        'fa-solid fa-volume-xmark',
            'fa-solid fa-microphone',        'fa-solid fa-camera',            'fa-solid fa-video',
            'fa-solid fa-music',             'fa-solid fa-gamepad',           'fa-solid fa-record-vinyl',
            'fa-solid fa-fax',
            // Appliances & Home
            'fa-solid fa-blender',           'fa-solid fa-mug-hot',           'fa-solid fa-mug-saucer',
            'fa-solid fa-utensils',          'fa-solid fa-pizza-slice',       'fa-solid fa-broom',
            'fa-solid fa-shirt',             'fa-solid fa-soap',              'fa-solid fa-spray-can',
            'fa-solid fa-spray-can-sparkles','fa-solid fa-baby',              'fa-solid fa-carriage-baby',
            'fa-solid fa-robot',
            // Energy & Power
            'fa-solid fa-bolt',              'fa-solid fa-bolt-lightning',    'fa-solid fa-plug',
            'fa-solid fa-plug-circle-bolt',  'fa-solid fa-plug-circle-check', 'fa-solid fa-plug-circle-exclamation',
            'fa-solid fa-charging-station',  'fa-solid fa-solar-panel',       'fa-solid fa-car-battery',
            'fa-solid fa-battery-full',      'fa-solid fa-battery-three-quarters','fa-solid fa-battery-half',
            'fa-solid fa-battery-quarter',   'fa-solid fa-battery-empty',     'fa-solid fa-power-off',
            'fa-solid fa-toggle-on',         'fa-solid fa-toggle-off',
            // Climate & Weather sensors
            'fa-solid fa-temperature-half',  'fa-solid fa-temperature-full',  'fa-solid fa-temperature-empty',
            'fa-solid fa-temperature-quarter','fa-solid fa-temperature-three-quarters','fa-solid fa-temperature-high',
            'fa-solid fa-temperature-low',   'fa-solid fa-temperature-up',    'fa-solid fa-temperature-down',
            'fa-solid fa-thermometer',       'fa-solid fa-thermometer-half',  'fa-solid fa-thermometer-full',
            'fa-solid fa-snowflake',         'fa-solid fa-fan',               'fa-solid fa-wind',
            'fa-solid fa-cloud',             'fa-solid fa-cloud-sun',         'fa-solid fa-cloud-rain',
            'fa-solid fa-cloud-bolt',        'fa-solid fa-cloud-showers-heavy','fa-solid fa-cloud-showers-water',
            'fa-solid fa-umbrella',          'fa-solid fa-droplet',           'fa-solid fa-smog',
            'fa-solid fa-gauge',             'fa-solid fa-gauge-high',        'fa-solid fa-tornado',
            'fa-solid fa-hurricane',         'fa-solid fa-sun-plant-wilt',    'fa-solid fa-rainbow',
            // Fire & Safety
            'fa-solid fa-fire',              'fa-solid fa-fire-flame-curved', 'fa-solid fa-fire-flame-simple',
            'fa-solid fa-fire-extinguisher', 'fa-solid fa-bell',              'fa-solid fa-bell-slash',
            'fa-solid fa-bell-concierge',    'fa-solid fa-radiation',
            // Security
            'fa-solid fa-lock',              'fa-solid fa-lock-open',         'fa-solid fa-unlock',
            'fa-solid fa-unlock-keyhole',    'fa-solid fa-shield',            'fa-solid fa-shield-halved',
            'fa-solid fa-shield-heart',      'fa-solid fa-eye',               'fa-solid fa-eye-slash',
            'fa-solid fa-person-running',    'fa-solid fa-triangle-exclamation','fa-solid fa-circle-exclamation',
            // Garden & Nature
            'fa-solid fa-seedling',          'fa-solid fa-leaf',              'fa-solid fa-tree',
            'fa-solid fa-tree-city',         'fa-solid fa-spa',               'fa-solid fa-water',
            'fa-solid fa-water-ladder',      'fa-solid fa-hand-holding-droplet','fa-solid fa-hand-holding-water',
            'fa-solid fa-faucet',            'fa-solid fa-faucet-drip',       'fa-solid fa-tractor',
            'fa-solid fa-trowel',            'fa-solid fa-trowel-bricks',     'fa-solid fa-recycle',
            // Transport
            'fa-solid fa-car',               'fa-solid fa-car-side',          'fa-solid fa-car-battery',
            'fa-solid fa-truck',             'fa-solid fa-truck-fast',        'fa-solid fa-van-shuttle',
            'fa-solid fa-bus',               'fa-solid fa-motorcycle',        'fa-solid fa-bicycle',
            'fa-solid fa-plane',             'fa-solid fa-train',             'fa-solid fa-train-subway',
            'fa-solid fa-helicopter',        'fa-solid fa-route',             'fa-solid fa-traffic-light',
            // Health & Wellness
            'fa-solid fa-heart-pulse',       'fa-solid fa-weight-scale',      'fa-solid fa-lungs',
            'fa-solid fa-syringe',           'fa-solid fa-pills',             'fa-solid fa-hospital',
            'fa-solid fa-stethoscope',       'fa-solid fa-wheelchair',        'fa-solid fa-dumbbell',
            'fa-solid fa-tooth',             'fa-solid fa-pump-medical',
            // Water & Plumbing
            'fa-solid fa-pump-soap',         'fa-solid fa-spray-can',         'fa-solid fa-glass-water',
            // Tools & Work
            'fa-solid fa-gear',              'fa-solid fa-gears',             'fa-solid fa-wrench',
            'fa-solid fa-screwdriver',       'fa-solid fa-screwdriver-wrench','fa-solid fa-toolbox',
            'fa-solid fa-ruler',             'fa-solid fa-ruler-combined',    'fa-solid fa-paintbrush',
            'fa-solid fa-hammer',
            // Animals & Pets
            'fa-solid fa-dog',               'fa-solid fa-paw',               'fa-solid fa-cat',
            'fa-solid fa-fish',              'fa-solid fa-kiwi-bird',         'fa-solid fa-hippo',
            'fa-solid fa-frog',
            // People
            'fa-solid fa-baby',              'fa-solid fa-carriage-baby',     'fa-solid fa-person',
            'fa-solid fa-user',              'fa-solid fa-users',             'fa-solid fa-person-walking',
            'fa-solid fa-person-running',    'fa-solid fa-person-hiking',     'fa-solid fa-person-biking',
            'fa-solid fa-person-swimming',   'fa-solid fa-person-pregnant',   'fa-solid fa-child',
            'fa-solid fa-wheelchair',
            // Controls & Status
            'fa-solid fa-sliders',           'fa-solid fa-power-off',         'fa-solid fa-toggle-on',
            'fa-solid fa-toggle-off',        'fa-solid fa-circle-dot',        'fa-solid fa-layer-group',
            'fa-solid fa-palette',           'fa-solid fa-arrows-rotate',     'fa-solid fa-rotate',
            'fa-solid fa-expand',            'fa-solid fa-compress',          'fa-solid fa-check',
            'fa-solid fa-check-double',      'fa-solid fa-list-check',        'fa-solid fa-bars-progress',
            // Time & Location
            'fa-solid fa-clock',             'fa-solid fa-calendar',          'fa-solid fa-stopwatch',
            'fa-solid fa-hourglass-half',    'fa-solid fa-location-dot',      'fa-solid fa-map-location-dot',
            'fa-solid fa-map',               'fa-solid fa-map-pin',           'fa-solid fa-compass',
            // Misc Utility
            'fa-solid fa-box',               'fa-solid fa-bookmark',          'fa-solid fa-flag',
            'fa-solid fa-tag',               'fa-solid fa-tags',              'fa-solid fa-barcode',
            'fa-solid fa-qrcode',            'fa-solid fa-clipboard',         'fa-solid fa-microchip',
            'fa-solid fa-database',          'fa-solid fa-server',            'fa-solid fa-graduation-cap',
            'fa-solid fa-trophy',            'fa-solid fa-medal',             'fa-solid fa-crown',
            'fa-solid fa-piggy-bank',        'fa-solid fa-coins',             'fa-solid fa-gift',
            'fa-solid fa-cart-shopping',     'fa-solid fa-scissors',          'fa-solid fa-anchor',
            'fa-solid fa-dice',              'fa-solid fa-handshake',         'fa-solid fa-heart',
            'fa-solid fa-infinity',          'fa-solid fa-rocket',            'fa-solid fa-spinner',
            'fa-solid fa-hourglass'
        ];

        // Mutable copy of current overrides — copy every stored field so the
        // sidebar and row editors reflect the saved state when the dialog reopens.
        var pending = {};
        Object.keys(currentOv).forEach(function (k) {
            var s = currentOv[k];
            pending[k] = {
                icon:      s.icon,
                iconOn:    s.iconOn,
                iconOff:   s.iconOff,
                iconOpen:  s.iconOpen,
                iconClose: s.iconClose,
                iconStop:  s.iconStop,
                keepColor: s.keepColor,
                on:        s.on,
                off:       s.off,
                name:      s.name || ''
            };
        });

        var overlay = document.createElement('div');
        overlay.id = 'ng-ov-overlay';
        overlay.className = 'ng-bl-overlay';
        overlay.innerHTML =
            '<div class="ng-bl-dialog ng-ov-dialog" role="dialog" aria-label="Device Icon Overrides">' +
            '  <div class="ng-bl-header">' +
            '    <div class="ng-bl-title">' +
            '      <i class="fa-solid fa-icons"></i>' +
            '      <span>Device Icon Overrides</span>' +
            '    </div>' +
            '    <button class="ng-bl-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
            '  </div>' +
            '  <div class="ng-ov-body">' +
            '    <div class="ng-ov-main">' +
            '      <div class="ng-ov-popular">' +
            '        <div class="ng-ov-popular-label"><i class="fa-solid fa-wand-magic-sparkles"></i> Quick Presets — click to assign to a device</div>' +
            '        <div class="ng-ov-chips" id="ng-ov-chips"></div>' +
            '      </div>' +
            '      <div class="ng-bl-search-wrap">' +
            '        <i class="fa-solid fa-magnifying-glass ng-bl-search-icon"></i>' +
            '        <input class="ng-bl-search" id="ng-ov-search" placeholder="Search devices…" autocomplete="off">' +
            '      </div>' +
            '      <div class="ng-bl-list ng-ov-list" id="ng-ov-list">' +
            '        <div class="ng-bl-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading devices…</div>' +
            '      </div>' +
            '    </div>' +
            '    <div class="ng-ov-sidebar" id="ng-ov-sidebar">' +
            '      <div class="ng-ov-sidebar-header">' +
            '        <i class="fa-solid fa-list-check"></i> Active' +
            '        <span class="ng-ov-sidebar-count" id="ng-ov-sidebar-count">0</span>' +
            '      </div>' +
            '      <div class="ng-ov-sidebar-list" id="ng-ov-sidebar-list">' +
            '        <div class="ng-ov-sidebar-empty">No overrides yet</div>' +
            '      </div>' +
            '    </div>' +
            '  </div>' +
            '  <div class="ng-bl-footer">' +
            '    <span class="ng-bl-count" id="ng-ov-count"></span>' +
            '    <div class="ng-bl-footer-btns">' +
            '      <button class="ng-bl-btn ng-bl-btn--cancel">Cancel</button>' +
            '      <button class="ng-bl-btn ng-bl-btn--save">Save Overrides</button>' +
            '    </div>' +
            '  </div>' +
            '</div>';

        document.body.appendChild(overlay);
        requestAnimationFrame(function () { overlay.classList.add('ng-bl-overlay--open'); });

        var listEl         = overlay.querySelector('#ng-ov-list');
        var searchEl       = overlay.querySelector('#ng-ov-search');
        var countEl        = overlay.querySelector('#ng-ov-count');
        var chipsEl        = overlay.querySelector('#ng-ov-chips');
        var sidebarListEl  = overlay.querySelector('#ng-ov-sidebar-list');
        var sidebarCountEl = overlay.querySelector('#ng-ov-sidebar-count');

        function close() {
            overlay.classList.remove('ng-bl-overlay--open');
            setTimeout(function () { overlay.remove(); }, 260);
        }

        function renderSidebar() {
            var keys = Object.keys(pending);
            if (sidebarCountEl) sidebarCountEl.textContent = keys.length;
            if (!sidebarListEl) return;
            if (!keys.length) {
                sidebarListEl.innerHTML = '<div class="ng-ov-sidebar-empty">No overrides yet</div>';
                return;
            }
            sidebarListEl.innerHTML = '';
            keys.forEach(function (idxStr) {
                var ov   = pending[idxStr];
                var name = ov.name || ('IDX ' + idxStr);
                var on   = ov.on  || '#4e9af1';
                var off  = ov.off || '#555770';

                var item = document.createElement('div');
                item.className = 'ng-ov-si';
                item.dataset.idx = idxStr;
                item.title = 'Jump to ' + name;

                var icon = document.createElement('i');
                icon.className = (ov.iconOn || ov.iconOpen || ov.icon || 'fa-solid fa-circle-question') + ' ng-ov-si-icon';
                icon.style.color = on;

                var info = document.createElement('div');
                info.className = 'ng-ov-si-info';

                var nameEl = document.createElement('span');
                nameEl.className = 'ng-ov-si-name';
                nameEl.textContent = name;

                var dots = document.createElement('span');
                dots.className = 'ng-ov-si-dots';
                dots.innerHTML =
                    '<span class="ng-ov-si-dot" style="background:' + on  + '" title="On: ' + on + '"></span>' +
                    '<span class="ng-ov-si-dot" style="background:' + off + '" title="Off: ' + off + '"></span>';

                info.appendChild(nameEl);
                info.appendChild(dots);

                var removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'ng-ov-si-remove';
                removeBtn.title = 'Remove override';
                removeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
                removeBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    delete pending[idxStr];
                    /* Reset the corresponding device row if visible */
                    var row = listEl.querySelector('[data-idx="' + idxStr + '"]');
                    if (row) {
                        row.classList.remove('ng-ov-row--active');
                        var rowFa   = row.querySelector('.ng-ov-row-fa');
                        var editBtn = row.querySelector('.ng-ov-edit-btn');
                        var editor  = row.querySelector('.ng-ov-editor');
                        if (rowFa)   { rowFa.className = (row.dataset.defIcon || 'fa-solid fa-circle-question') + ' ng-ov-row-fa'; rowFa.style.color = row.dataset.defColor || '#555770'; rowFa.style.opacity = '.55'; }
                        if (editBtn) { editBtn.innerHTML = '<i class="fa-solid fa-plus"></i>'; }
                        if (editor)  { editor.style.display = 'none'; }
                    }
                    updateCount();
                });

                item.appendChild(icon);
                item.appendChild(info);
                item.appendChild(removeBtn);

                /* Click to jump to + briefly highlight the device row */
                item.addEventListener('click', function () {
                    var target = listEl.querySelector('[data-idx="' + idxStr + '"]');
                    if (!target) return;
                    /* Clear search so the row is visible */
                    if (searchEl && searchEl.value) { searchEl.value = ''; filterList(''); }
                    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    target.classList.add('ng-ov-row--flash');
                    setTimeout(function () { target.classList.remove('ng-ov-row--flash'); }, 900);
                });

                sidebarListEl.appendChild(item);
            });
        }

        function updateCount() {
            if (countEl) {
                var n = Object.keys(pending).length;
                countEl.textContent = n === 0 ? 'No overrides set' : n + ' override' + (n === 1 ? '' : 's');
            }
            renderSidebar();
        }

        /* Populate sidebar immediately for any pre-existing overrides */
        renderSidebar();

        function filterList(q) {
            q = (q || '').toLowerCase();
            listEl.querySelectorAll('.ng-ov-row').forEach(function (r) {
                r.style.display = (!q || (r.dataset.name || '').toLowerCase().indexOf(q) !== -1) ? '' : 'none';
            });
        }

        /* Build an inline FA icon picker, calls onSelect(cls) on pick */
        function buildIconPicker(initialCls, onSelect) {
            var wrap = document.createElement('div');
            wrap.className = 'ng-ov-picker';

            var si = document.createElement('input');
            si.type = 'text';
            si.className = 'ng-ov-picker-search';
            si.placeholder = 'Search icons… (wifi, fan, bolt, car…)';
            si.autocomplete = 'off';
            wrap.appendChild(si);

            var grid = document.createElement('div');
            grid.className = 'ng-ov-icon-grid';
            wrap.appendChild(grid);

            var activeCls = initialCls;

            function renderGrid(q) {
                q = (q || '').toLowerCase().replace(/^fa-solid\s+fa-/, '').trim();
                var hits = q
                    ? FA_ICONS_ALL.filter(function (c) { return c.replace('fa-solid fa-', '').replace(/-/g, ' ').indexOf(q) !== -1; })
                    : FA_ICONS_PRESET;
                grid.innerHTML = '';
                hits.forEach(function (cls) {
                    var btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'ng-ov-icon-btn' + (cls === activeCls ? ' ng-ov-icon-btn--active' : '');
                    btn.title = cls.replace('fa-solid fa-', '').replace(/-/g, ' ');
                    btn.setAttribute('data-icon', cls);
                    var ic = document.createElement('i');
                    ic.className = cls;
                    btn.appendChild(ic);
                    grid.appendChild(btn);
                });
            }

            renderGrid('');

            si.addEventListener('input', function () { renderGrid(this.value); });

            grid.addEventListener('click', function (e) {
                var btn = e.target.closest('.ng-ov-icon-btn');
                if (!btn) return;
                activeCls = btn.getAttribute('data-icon');
                grid.querySelectorAll('.ng-ov-icon-btn').forEach(function (b) {
                    b.classList.toggle('ng-ov-icon-btn--active', b === btn);
                });
                onSelect(activeCls);
            });

            return wrap;
        }

        /* Render one device row with its inline editor */
        function renderRow(d) {
            var idxStr = String(d.idx);
            var ov     = pending[idxStr];
            var model  = getDeviceColorModel(d);
            var hasOv  = !!(ov && (ov.iconOn || ov.iconOpen || ov.icon));

            /* ── Resolve defaults via the icon replacement module ─────────── */
            var dzIcon     = typeof window._dzIconForDevice === 'function' ? window._dzIconForDevice : null;
            var defSpecOn  = dzIcon ? dzIcon(d) : null;
            var defIconOn  = (defSpecOn && defSpecOn.icon)  || 'fa-solid fa-circle-question';
            var defColorOn = (defSpecOn && defSpecOn.color) || '#4e9af1';
            var defColorOff = '#555770';
            var defIconOpen  = defIconOn;
            var defIconClose = defIconOn;

            if (model === 'blinds-2' || model === 'blinds-3') {
                var sOp = dzIcon ? dzIcon({ TypeImg: (d.TypeImg || '') + 'open', Status: 'On'  }) : null;
                var sCl = dzIcon ? dzIcon({ TypeImg:  d.TypeImg  || 'blinds',   Status: 'Off' }) : null;
                defIconOpen  = (sOp && sOp.icon)  || 'fa-solid fa-chevron-up';
                defIconClose = (sCl && sCl.icon)  || 'fa-solid fa-chevron-down';
                defColorOn   = (sOp && sOp.color) || defColorOn;
            }

            /* ── Current values: override or defaults ─────────────────────── */
            var curIconOn    = hasOv ? (ov.iconOn    || ov.icon || defIconOn)                 : defIconOn;
            var curIconOff   = hasOv ? (ov.iconOff   || ov.iconOn || ov.icon || defIconOn)    : defIconOn;
            var curIconOpen  = hasOv ? (ov.iconOpen  || ov.iconOn || ov.icon || defIconOpen)  : defIconOpen;
            var curIconClose = hasOv ? (ov.iconClose || ov.iconOn || ov.icon || defIconClose) : defIconClose;
            var curIconStop  = hasOv ? (ov.iconStop  || 'fa-solid fa-stop')                   : 'fa-solid fa-stop';
            var curOn        = hasOv ? (ov.on  || defColorOn)  : defColorOn;
            var curOff       = hasOv ? (ov.off || defColorOff) : defColorOff;
            var keepColor    = ov ? !!(ov.keepColor) : (model === 'sensor');

            /* ── Row element ──────────────────────────────────────────────── */
            var row = document.createElement('div');
            row.className        = 'ng-ov-row' + (hasOv ? ' ng-ov-row--active' : '');
            row.dataset.idx      = idxStr;
            row.dataset.name     = d.Name || '';
            row.dataset.defIcon  = defIconOn;
            row.dataset.defColor = defColorOn;

            /* ── Summary line ─────────────────────────────────────────────── */
            var summary = document.createElement('div');
            summary.className = 'ng-ov-row-summary';
            var isBlinds = (model === 'blinds-2' || model === 'blinds-3');

            var iconHtml = isBlinds
                ? '<span class="ng-ov-row-icon ng-ov-row-icon--multi">' +
                  '<i class="' + curIconOpen  + ' ng-ov-row-fa ng-ov-row-fa--open"  style="color:' + curOn  + ';' + (hasOv ? '' : 'opacity:.55') + '"></i>' +
                  '<i class="' + curIconClose + ' ng-ov-row-fa ng-ov-row-fa--close" style="color:' + curOff + ';' + (hasOv ? '' : 'opacity:.55') + '"></i>' +
                  '</span>'
                : '<span class="ng-ov-row-icon">' +
                  '<i class="' + curIconOn + ' ng-ov-row-fa" style="color:' + curOn + ';' + (hasOv ? '' : 'opacity:.55') + '"></i>' +
                  '</span>';

            var modelBadge = model === 'blinds-2' ? ' <span class="ng-ov-model-badge">2-icon</span>'
                           : model === 'blinds-3' ? ' <span class="ng-ov-model-badge">3-icon</span>'
                           : model === 'sensor'   ? ' <span class="ng-ov-model-badge ng-ov-model-badge--sensor">sensor</span>'
                           : '';
            var groupLabel = getDeviceGroup(d);
            var groupTagCls = !groupLabel ? '' :
                groupLabel === 'Temperature' ? ' ng-ov-group-tag--temp' :
                groupLabel === 'Weather'     ? ' ng-ov-group-tag--weather' :
                groupLabel === 'Security'    ? ' ng-ov-group-tag--security' :
                groupLabel === 'Utility'     ? ' ng-ov-group-tag--utility' :
                (groupLabel === 'Scene' || groupLabel === 'Group') ? ' ng-ov-group-tag--scene' : '';
            var groupTag = groupLabel ? ' <span class="ng-ov-group-tag' + groupTagCls + '">' + groupLabel + '</span>' : '';
            var swLabel = (d.SwitchType && d.SwitchType !== d.Type) ? ' &middot; ' + d.SwitchType : '';
            summary.innerHTML =
                iconHtml +
                '<span class="ng-bl-row-info">' +
                '  <span class="ng-bl-row-name">' + (d.Name || 'Device ' + d.idx) + '</span>' +
                '  <span class="ng-bl-row-type">IDX&nbsp;' + d.idx +
                    (d.Type ? ' &middot; ' + d.Type : '') + swLabel + modelBadge + groupTag +
                '  </span>' +
                '</span>' +
                '<button class="ng-ov-edit-btn" type="button" title="' + (hasOv ? 'Edit override' : 'Add override') + '">' +
                '  <i class="fa-solid ' + (hasOv ? 'fa-pen-to-square' : 'fa-plus') + '"></i>' +
                '</button>';
            row.appendChild(summary);

            /* ── Inline editor ────────────────────────────────────────────── */
            var editor = document.createElement('div');
            editor.className   = 'ng-ov-editor';
            editor.style.display = 'none';

            /* colorRow is shared across all models; built and populated per-model below */
            var colorRow = document.createElement('div');
            colorRow.className = 'ng-ov-color-row';

            var OV_COLOR_PRESETS = [
                '#4e9af1','#29b6f6','#4caf7d','#66bb6a',
                '#f0a832','#ffa726','#ff7043','#e05555',
                '#c8a0ff','#ab47bc','#78909c','#555770'
            ];

            /* HSV color picker (unchanged) */
            function makeOvColorPicker(labelText, initialColor, onChange) {
                var wrap = document.createElement('div');
                wrap.className = 'ng-ov-color-label';

                var span = document.createElement('span');
                span.textContent = labelText;
                wrap.appendChild(span);

                var pickerWrap = document.createElement('div');
                pickerWrap.className = 'ng-color-wrap';

                var swatch = document.createElement('button');
                swatch.type = 'button';
                swatch.className = 'ng-cp-swatch';
                swatch.style.background = initialColor;

                var hexInput = document.createElement('input');
                hexInput.type = 'text';
                hexInput.className = 'ng-cp-hex';
                hexInput.value = initialColor;
                hexInput.maxLength = 7;
                hexInput.spellcheck = false;

                var popover = document.createElement('div');
                popover.className = 'ng-cp-popover';
                popover.style.display = 'none';

                var svCanvas = document.createElement('canvas');
                svCanvas.className = 'ng-cp-sv';
                svCanvas.width = 232;
                svCanvas.height = 148;

                var hueCanvas = document.createElement('canvas');
                hueCanvas.className = 'ng-cp-hue';
                hueCanvas.width = 232;
                hueCanvas.height = 14;

                var presetsEl = document.createElement('div');
                presetsEl.className = 'ng-cp-presets';
                OV_COLOR_PRESETS.forEach(function (c) {
                    var btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'ng-cp-preset' + (c.toLowerCase() === initialColor.toLowerCase() ? ' ng-cp-preset--active' : '');
                    btn.setAttribute('data-color', c);
                    btn.style.background = c;
                    btn.title = c;
                    presetsEl.appendChild(btn);
                });

                popover.appendChild(svCanvas);
                popover.appendChild(hueCanvas);
                popover.appendChild(presetsEl);
                pickerWrap.appendChild(swatch);
                pickerWrap.appendChild(hexInput);
                pickerWrap.appendChild(popover);
                wrap.appendChild(pickerWrap);

                var hsv = hexToHsv(initialColor);
                drawSV(svCanvas, hsv.h);
                drawHueBar(hueCanvas);

                function updateFromHsv() {
                    var hex = hsvToHex(hsv.h, hsv.s, hsv.v);
                    swatch.style.background = hex;
                    hexInput.value = hex;
                    drawSV(svCanvas, hsv.h);
                    presetsEl.querySelectorAll('.ng-cp-preset').forEach(function (b) {
                        b.classList.toggle('ng-cp-preset--active',
                            b.getAttribute('data-color').toLowerCase() === hex.toLowerCase());
                    });
                    onChange(hex);
                }

                function closeOtherPopovers() {
                    var dialog = wrap.closest('.ng-ov-dialog') || document.body;
                    dialog.querySelectorAll('.ng-color-wrap .ng-cp-popover').forEach(function (p) {
                        if (p !== popover) p.style.display = 'none';
                    });
                }

                swatch.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var open = popover.style.display === 'block';
                    closeOtherPopovers();
                    if (!open) {
                        popover.style.display = 'block';
                        var rect = swatch.getBoundingClientRect();
                        var popW = 260;
                        var left = rect.right - popW;
                        var top  = rect.bottom + 8;
                        if (left < 8) left = 8;
                        if (top + 300 > window.innerHeight) top = rect.top - 308;
                        popover.style.left = left + 'px';
                        popover.style.top  = top  + 'px';
                        drawSV(svCanvas, hsv.h);
                        drawHueBar(hueCanvas);
                    }
                });

                function handleSV(e) {
                    var rect = svCanvas.getBoundingClientRect();
                    hsv.s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    hsv.v = 1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                    updateFromHsv();
                }
                var svDragging = false;
                svCanvas.addEventListener('pointerdown', function (e) {
                    svDragging = true; svCanvas.setPointerCapture(e.pointerId); handleSV(e);
                });
                svCanvas.addEventListener('pointermove', function (e) { if (svDragging) handleSV(e); });
                svCanvas.addEventListener('pointerup',   function ()  { svDragging = false; });

                function handleHue(e) {
                    var rect = hueCanvas.getBoundingClientRect();
                    hsv.h = Math.max(0, Math.min(0.9999, (e.clientX - rect.left) / rect.width));
                    updateFromHsv();
                }
                var hueDragging = false;
                hueCanvas.addEventListener('pointerdown', function (e) {
                    hueDragging = true; hueCanvas.setPointerCapture(e.pointerId); handleHue(e);
                });
                hueCanvas.addEventListener('pointermove', function (e) { if (hueDragging) handleHue(e); });
                hueCanvas.addEventListener('pointerup',   function ()  { hueDragging = false; });

                hexInput.addEventListener('input', function () {
                    var v = this.value.trim();
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) { hsv = hexToHsv(v); updateFromHsv(); }
                });
                hexInput.addEventListener('blur', function () {
                    if (!/^#[0-9a-fA-F]{6}$/.test(this.value)) {
                        this.value = hsvToHex(hsv.h, hsv.s, hsv.v);
                    }
                });
                hexInput.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') this.blur();
                });

                presetsEl.querySelectorAll('.ng-cp-preset').forEach(function (btn) {
                    btn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        hsv = hexToHsv(this.getAttribute('data-color'));
                        updateFromHsv();
                    });
                });

                return wrap;
            }

            /* ── Editor helpers ───────────────────────────────────────────── */

            /* One preview slot: icon + optional label underneath */
            function makePreviewSlot(iconCls, color, labelText) {
                var slot = document.createElement('div');
                slot.className = 'ng-ov-preview-slot';
                var ic = document.createElement('i');
                ic.className   = iconCls + ' ng-ov-preview-icon';
                ic.style.color = color;
                slot.appendChild(ic);
                if (labelText) {
                    var lbl = document.createElement('span');
                    lbl.className   = 'ng-ov-preview-label';
                    lbl.textContent = labelText;
                    slot.appendChild(lbl);
                }
                return slot;
            }

            function updateSlotIcon(slot, iconCls, color) {
                var ic = slot && slot.querySelector('.ng-ov-preview-icon');
                if (ic) { ic.className = iconCls + ' ng-ov-preview-icon'; ic.style.color = color; }
            }

            /* Labeled wrapper around an icon picker grid */
            function makePickerSection(labelText, noteText, initialCls, onSelectFn) {
                var wrap = document.createElement('div');
                wrap.className = 'ng-ov-picker-section';
                if (labelText) {
                    var lbl = document.createElement('div');
                    lbl.className   = 'ng-ov-picker-label';
                    lbl.textContent = labelText;
                    wrap.appendChild(lbl);
                }
                if (noteText) {
                    var note = document.createElement('div');
                    note.className   = 'ng-ov-picker-note';
                    note.textContent = noteText;
                    wrap.appendChild(note);
                }
                wrap.appendChild(buildIconPicker(initialCls, onSelectFn));
                return wrap;
            }

            /* Sync the summary's single primary icon */
            function updateSummaryPrimary() {
                var fa = summary.querySelector('.ng-ov-row-fa');
                if (fa) { fa.className = curIconOn + ' ng-ov-row-fa'; fa.style.color = curOn; fa.style.opacity = ''; }
            }

            /* Sync the summary's blinds open + close icons */
            function updateSummaryBlinds() {
                var fo = summary.querySelector('.ng-ov-row-fa--open');
                var fc = summary.querySelector('.ng-ov-row-fa--close');
                if (fo) { fo.className = curIconOpen  + ' ng-ov-row-fa ng-ov-row-fa--open';  fo.style.color = curOn;  fo.style.opacity = ''; }
                if (fc) { fc.className = curIconClose + ' ng-ov-row-fa ng-ov-row-fa--close'; fc.style.color = curOff; fc.style.opacity = ''; }
            }

            /* Remove button with model-aware reset callback */
            function buildRemoveBtn(onRemove) {
                var btn = document.createElement('button');
                btn.type      = 'button';
                btn.className = 'ng-ov-remove-btn';
                btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Remove';
                btn.addEventListener('click', function () {
                    delete pending[idxStr];
                    row.classList.remove('ng-ov-row--active');
                    var eb = summary.querySelector('.ng-ov-edit-btn');
                    if (eb) eb.innerHTML = '<i class="fa-solid fa-plus"></i>';
                    editor.style.display = 'none';
                    onRemove();
                    updateCount();
                });
                return btn;
            }

            /* Persist pending entry + mark row active */
            function commitOverride() {
                var obj = { name: d.Name || '', on: curOn, off: curOff };
                if (model === 'blinds-2' || model === 'blinds-3') {
                    obj.iconOpen  = curIconOpen;
                    obj.iconClose = curIconClose;
                    obj.iconOn    = curIconOpen;   /* sidebar display fallback */
                    if (model === 'blinds-3') obj.iconStop = curIconStop;
                } else if (model === 'lock' || model === 'contact') {
                    obj.iconOn  = curIconOn;
                    obj.iconOff = curIconOff;
                } else if (model === 'sensor') {
                    obj.iconOn    = curIconOn;
                    obj.keepColor = keepColor;
                } else {
                    obj.iconOn = curIconOn;
                }
                pending[idxStr] = obj;
                row.classList.add('ng-ov-row--active');
                var eb = summary.querySelector('.ng-ov-edit-btn');
                if (eb) eb.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
                updateCount();
            }

            /* ── Build editor body per model ──────────────────────────────── */

            if (model === 'blinds-2' || model === 'blinds-3') {
                var preview   = document.createElement('div');
                preview.className = 'ng-ov-preview ng-ov-preview--multi';
                var slotOpen  = makePreviewSlot(curIconOpen,  curOn,     'Open');
                var slotStop  = model === 'blinds-3' ? makePreviewSlot(curIconStop, '#b0b3c6', 'Stop') : null;
                var slotClose = makePreviewSlot(curIconClose, curOff,    'Close');
                preview.appendChild(slotOpen);
                if (slotStop) preview.appendChild(slotStop);
                preview.appendChild(slotClose);
                editor.appendChild(preview);

                editor.appendChild(makePickerSection('Open button icon',
                    'First icon — highlights when blind is open', curIconOpen, function (cls) {
                        curIconOpen = cls;
                        updateSlotIcon(slotOpen, curIconOpen, curOn);
                        updateSummaryBlinds();
                        commitOverride();
                    }));
                if (model === 'blinds-3') {
                    editor.appendChild(makePickerSection('Stop button icon',
                        'Middle icon — click to stop movement', curIconStop, function (cls) {
                            curIconStop = cls;
                            updateSlotIcon(slotStop, curIconStop, '#b0b3c6');
                            commitOverride();
                        }));
                }
                editor.appendChild(makePickerSection('Close button icon',
                    'Last icon — highlights when blind is closed', curIconClose, function (cls) {
                        curIconClose = cls;
                        updateSlotIcon(slotClose, curIconClose, curOff);
                        updateSummaryBlinds();
                        commitOverride();
                    }));

                colorRow.appendChild(makeOvColorPicker('Open color', curOn, function (v) {
                    curOn = v; updateSlotIcon(slotOpen, curIconOpen, curOn); updateSummaryBlinds(); commitOverride();
                }));
                colorRow.appendChild(makeOvColorPicker('Close color', curOff, function (v) {
                    curOff = v; updateSlotIcon(slotClose, curIconClose, curOff); updateSummaryBlinds(); commitOverride();
                }));
                colorRow.appendChild(buildRemoveBtn(function () {
                    curIconOpen = defIconOpen; curIconClose = defIconClose; curIconStop = 'fa-solid fa-stop';
                    curOn = defColorOn; curOff = defColorOff;
                    updateSummaryBlinds();
                    var fo = summary.querySelector('.ng-ov-row-fa--open');
                    var fc = summary.querySelector('.ng-ov-row-fa--close');
                    if (fo) fo.style.opacity = '.55';
                    if (fc) fc.style.opacity = '.55';
                }));
                editor.appendChild(colorRow);

            } else if (model === 'sensor') {
                var preview    = document.createElement('div');
                preview.className = 'ng-ov-preview';
                var slotSensor = makePreviewSlot(curIconOn, keepColor ? defColorOn : curOn, null);
                var nameSpan   = document.createElement('span');
                nameSpan.className   = 'ng-ov-preview-name';
                nameSpan.textContent = d.Name || 'Device';
                preview.appendChild(slotSensor);
                preview.appendChild(nameSpan);
                editor.appendChild(preview);

                editor.appendChild(makePickerSection('Icon',
                    'Replaces the dynamic sensor range icon (temperature, humidity, etc.)', curIconOn, function (cls) {
                        curIconOn = cls;
                        updateSlotIcon(slotSensor, curIconOn, keepColor ? defColorOn : curOn);
                        updateSummaryPrimary();
                        commitOverride();
                    }));

                var keepWrap = document.createElement('div');
                keepWrap.className = 'ng-ov-keepcolor-wrap';
                var keepCb  = document.createElement('input');
                keepCb.type    = 'checkbox';
                keepCb.id      = 'ng-ov-kc-' + idxStr;
                keepCb.checked = keepColor;
                var keepLbl = document.createElement('label');
                keepLbl.setAttribute('for', 'ng-ov-kc-' + idxStr);
                keepLbl.textContent = 'Keep dynamic color (temperature range, alert levels, etc.)';
                keepWrap.appendChild(keepCb);
                keepWrap.appendChild(keepLbl);
                keepCb.addEventListener('change', function () {
                    keepColor = this.checked;
                    updateSlotIcon(slotSensor, curIconOn, keepColor ? defColorOn : curOn);
                    commitOverride();
                });
                editor.appendChild(keepWrap);

                colorRow.appendChild(makeOvColorPicker('Accent color', curOn, function (v) {
                    curOn = v;
                    if (!keepColor) updateSlotIcon(slotSensor, curIconOn, v);
                    commitOverride();
                }));
                colorRow.appendChild(buildRemoveBtn(function () {
                    curIconOn = defIconOn; curOn = defColorOn; keepColor = true;
                    var fa = summary.querySelector('.ng-ov-row-fa');
                    if (fa) { fa.className = defIconOn + ' ng-ov-row-fa'; fa.style.color = defColorOn; fa.style.opacity = '.55'; }
                }));
                editor.appendChild(colorRow);

            } else if (model === 'lock' || model === 'contact') {
                var activeLabel   = model === 'lock' ? 'Unlocked' : 'Open';
                var inactiveLabel = model === 'lock' ? 'Locked'   : 'Closed';
                var preview      = document.createElement('div');
                preview.className = 'ng-ov-preview ng-ov-preview--multi';
                var slotActive   = makePreviewSlot(curIconOn,  curOn,  activeLabel);
                var slotInactive = makePreviewSlot(curIconOff, curOff, inactiveLabel);
                preview.appendChild(slotActive);
                preview.appendChild(slotInactive);
                editor.appendChild(preview);

                editor.appendChild(makePickerSection(activeLabel + ' icon', null, curIconOn, function (cls) {
                    curIconOn = cls;
                    updateSlotIcon(slotActive, curIconOn, curOn);
                    updateSummaryPrimary();
                    commitOverride();
                }));
                editor.appendChild(makePickerSection(inactiveLabel + ' icon', null, curIconOff, function (cls) {
                    curIconOff = cls;
                    updateSlotIcon(slotInactive, curIconOff, curOff);
                    commitOverride();
                }));

                colorRow.appendChild(makeOvColorPicker(activeLabel + ' color', curOn, function (v) {
                    curOn = v; updateSlotIcon(slotActive, curIconOn, curOn); updateSummaryPrimary(); commitOverride();
                }));
                colorRow.appendChild(makeOvColorPicker(inactiveLabel + ' color', curOff, function (v) {
                    curOff = v; updateSlotIcon(slotInactive, curIconOff, curOff); commitOverride();
                }));
                colorRow.appendChild(buildRemoveBtn(function () {
                    curIconOn = defIconOn; curIconOff = defIconOn; curOn = defColorOn; curOff = defColorOff;
                    var fa = summary.querySelector('.ng-ov-row-fa');
                    if (fa) { fa.className = defIconOn + ' ng-ov-row-fa'; fa.style.color = defColorOn; fa.style.opacity = '.55'; }
                }));
                editor.appendChild(colorRow);

            } else {
                /* binary / selector / media: single icon, 2 colors */
                var labelOn  = model === 'selector' ? 'Active color'   : 'On color';
                var labelOff = model === 'selector' ? 'Inactive color' : 'Off color';
                var preview  = document.createElement('div');
                preview.className = 'ng-ov-preview';
                var slotMain = makePreviewSlot(curIconOn, curOn, null);
                var nameSpan = document.createElement('span');
                nameSpan.className   = 'ng-ov-preview-name';
                nameSpan.textContent = d.Name || 'Device';
                preview.appendChild(slotMain);
                preview.appendChild(nameSpan);
                editor.appendChild(preview);

                editor.appendChild(makePickerSection(null, null, curIconOn, function (cls) {
                    curIconOn = cls;
                    updateSlotIcon(slotMain, curIconOn, curOn);
                    updateSummaryPrimary();
                    commitOverride();
                }));

                colorRow.appendChild(makeOvColorPicker(labelOn, curOn, function (v) {
                    curOn = v; updateSlotIcon(slotMain, curIconOn, v); updateSummaryPrimary(); commitOverride();
                }));
                colorRow.appendChild(makeOvColorPicker(labelOff, curOff, function (v) {
                    curOff = v; commitOverride();
                }));
                colorRow.appendChild(buildRemoveBtn(function () {
                    curIconOn = defIconOn; curOn = defColorOn; curOff = defColorOff;
                    var fa = summary.querySelector('.ng-ov-row-fa');
                    if (fa) { fa.className = defIconOn + ' ng-ov-row-fa'; fa.style.color = defColorOn; fa.style.opacity = '.55'; }
                }));
                editor.appendChild(colorRow);
            }

            /* ── Click to toggle editor ───────────────────────────────────── */
            summary.addEventListener('click', function (e) {
                if (_pendingPreset) {
                    /* In select mode: show per-row confirm instead of applying immediately */
                    var existing = row.querySelector('.ng-ov-confirm-bar');
                    if (existing) { existing.remove(); return; }
                    listEl.querySelectorAll('.ng-ov-confirm-bar').forEach(function (b) { b.remove(); });
                    var pp  = _pendingPreset;
                    var bar = document.createElement('div');
                    bar.className = 'ng-ov-confirm-bar';
                    bar.innerHTML =
                        '<span class="ng-ov-confirm-text">Apply <i class="' + pp.icon + '" style="color:' + pp.on + ';margin:0 3px"></i><strong>' + pp.label + '</strong>?</span>' +
                        '<button class="ng-ov-confirm-apply" type="button">Apply</button>' +
                        '<button class="ng-ov-confirm-skip" type="button"><i class="fa-solid fa-xmark"></i> Skip</button>';
                    bar.querySelector('.ng-ov-confirm-apply').addEventListener('click', function (ev) {
                        ev.stopPropagation(); applyPresetToRow(idxStr);
                    });
                    bar.querySelector('.ng-ov-confirm-skip').addEventListener('click', function (ev) {
                        ev.stopPropagation(); bar.remove();
                    });
                    row.appendChild(bar);
                    return;
                }
                if (!e.target.closest('.ng-ov-edit-btn')) return;
                var open = editor.style.display !== 'none';
                listEl.querySelectorAll('.ng-ov-editor').forEach(function (ed) { ed.style.display = 'none'; });
                editor.style.display = open ? 'none' : '';
            });

            row.appendChild(editor);
            return row;
        }

        function renderDevices(devices) {
            if (!devices || !devices.length) {
                listEl.innerHTML = '<div class="ng-bl-empty">No devices found.</div>';
                return;
            }
            listEl.innerHTML = '';

            // Sort: devices with existing overrides first
            var sorted = devices.slice().sort(function (a, b) {
                var aHas = !!(pending[String(a.idx)]);
                var bHas = !!(pending[String(b.idx)]);
                if (aHas && !bHas) return -1;
                if (!aHas && bHas) return 1;
                return (a.Name || '').localeCompare(b.Name || '');
            });

            sorted.forEach(function (d) { listEl.appendChild(renderRow(d)); });
            updateCount();
        }

        /* Selection mode — used when a preset chip is active */
        var _pendingPreset = null;
        var _pendingChip   = null;

        /* Banner shown above the list when a preset is pending */
        var banner = document.createElement('div');
        banner.className = 'ng-ov-select-banner';
        banner.style.display = 'none';
        listEl.parentNode.insertBefore(banner, listEl);

        function enterSelectMode(preset, chip) {
            _pendingPreset = preset;
            if (_pendingChip) _pendingChip.classList.remove('ng-ov-chip--active');
            _pendingChip = chip;
            chip.classList.add('ng-ov-chip--active');

            banner.innerHTML =
                '<span class="ng-ov-banner-icon"><i class="' + preset.icon + '" style="color:' + preset.on + '"></i></span>' +
                '<span class="ng-ov-banner-text">Click any device to apply <strong>' + preset.label + '</strong></span>' +
                '<button class="ng-ov-banner-cancel" type="button"><i class="fa-solid fa-xmark"></i> Cancel</button>';
            banner.style.display = '';
            listEl.classList.add('ng-ov-list--select-mode');

            banner.querySelector('.ng-ov-banner-cancel').addEventListener('click', exitSelectMode);
        }

        function exitSelectMode() {
            _pendingPreset = null;
            if (_pendingChip) _pendingChip.classList.remove('ng-ov-chip--active');
            _pendingChip = null;
            banner.style.display = 'none';
            listEl.classList.remove('ng-ov-list--select-mode');
            listEl.querySelectorAll('.ng-ov-confirm-bar').forEach(function (b) { b.remove(); });
        }

        /* Apply the pending preset to a device row */
        function applyPresetToRow(idxStr) {
            var pp = _pendingPreset;
            pending[idxStr] = { iconOn: pp.icon, on: pp.on, off: pp.off, name: pending[idxStr] && pending[idxStr].name || pp.label };
            var row = listEl.querySelector('[data-idx="' + idxStr + '"]');
            if (row) {
                row.classList.add('ng-ov-row--active');
                /* Update all FA icons in the summary — blinds rows have open + close icons,
                   so querySelectorAll is needed instead of just querySelector for the first. */
                row.querySelectorAll('.ng-ov-row-fa').forEach(function (fa) {
                    var keepCls = fa.classList.contains('ng-ov-row-fa--open')  ? ' ng-ov-row-fa--open'  :
                                  fa.classList.contains('ng-ov-row-fa--close') ? ' ng-ov-row-fa--close' : '';
                    fa.className   = pp.icon + ' ng-ov-row-fa' + keepCls;
                    fa.style.color   = fa.classList.contains('ng-ov-row-fa--close') ? pp.off : pp.on;
                    fa.style.opacity = '';
                });
                var editBtn = row.querySelector('.ng-ov-edit-btn');
                if (editBtn) editBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
            }
            updateCount();
            exitSelectMode();
        }

        /* Popular preset chips */
        POPULAR_OVERRIDES.forEach(function (p) {
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'ng-ov-chip';
            chip.title = p.icon.replace('fa-solid fa-', '').replace(/-/g, ' ');
            chip.innerHTML = '<i class="' + p.icon + '"></i> ' + p.label;

            chip.addEventListener('click', function () {
                /* Toggle: clicking the already-active chip exits select mode */
                if (_pendingPreset === p) { exitSelectMode(); return; }
                exitSelectMode();
                enterSelectMode(p, chip);
            });
            chipsEl.appendChild(chip);
        });

        /* Close + Search + Save */
        overlay.querySelector('.ng-bl-close').addEventListener('click', close);
        overlay.querySelector('.ng-bl-btn--cancel').addEventListener('click', close);
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) { close(); return; }
            /* Close any open HSV color-picker popovers when clicking outside them */
            if (!e.target.closest('.ng-color-wrap')) {
                overlay.querySelectorAll('.ng-cp-popover').forEach(function (p) { p.style.display = 'none'; });
            }
        });
        overlay.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { if (_pendingPreset) { exitSelectMode(); e.stopPropagation(); } else { close(); } }
        });
        if (searchEl) searchEl.addEventListener('input', function () { filterList(this.value); });

        overlay.querySelector('.ng-bl-btn--save').addEventListener('click', function () {
            if (window.dzNightglassSettings) {
                window.dzNightglassSettings.set('deviceIconOverrides', JSON.stringify(pending));
            }
            close();
            // Refresh settings panel badge
            var wrap = document.getElementById('ng-theme-settings-wrap');
            if (wrap) {
                var presetsBody = wrap.querySelector('#ngPresetsBody');
                var presetsOpen = presetsBody && presetsBody.style.display !== 'none';
                wrap.innerHTML = buildPanel({ presetsOpen: presetsOpen });
                bindEvents(wrap);
                loadPresets(wrap);
            }
        });

        /* Fetch devices — window.__ngDemoDevices can be set by demo pages as a fallback */
        fetch('/json.htm?type=command&param=getdevices&filter=all&used=true&order=Name', { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (data) { renderDevices(data.result || []); })
            .catch(function () {
                if (Array.isArray(window.__ngDemoDevices)) {
                    renderDevices(window.__ngDemoDevices);
                    listEl.insertAdjacentHTML('afterbegin',
                        '<div class="ng-ov-demo-notice">' +
                        '<i class="fa-solid fa-circle-info"></i> ' +
                        'Demo mode \u2014 showing example devices.' +
                        '</div>');
                    return;
                }
                listEl.innerHTML =
                    '<div class="ng-bl-empty">' +
                    '  <i class="fa-solid fa-triangle-exclamation"></i>' +
                    '  Could not load devices. Use Quick Presets above and enter a device IDX.' +
                    '</div>';
                updateCount();
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

        // Device icon override manage button
        var ovBtn = container.querySelector('#ng-override-manage-btn');
        if (ovBtn) {
            ovBtn.addEventListener('click', openDeviceIconOverrideDialog);
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
