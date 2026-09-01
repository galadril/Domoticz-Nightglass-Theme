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

    var overlay     = null;
    var inputEl     = null;
    var listEl      = null;
    var activeI     = -1;
    var _textFilter = null;

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
        /* Mobile dashboard: <tr id="..."> rows in table.mobileitem */
        document.querySelectorAll('.dashboardMobile table.mobileitem tbody tr[id]').forEach(function (row) {
            var nameEl = row.querySelector('td#name');
            var name   = nameEl ? (nameEl.textContent || '').trim() : '';
            if (!name) return;
            var icon   = row.querySelector('i.dz-fa-device');
            var iCls   = icon ? ((icon.className.match(/fa-[\w-]+/) || [])[0] || 'fa-circle') : 'fa-circle';
            out.push({ name: name, card: row, icon: iCls });
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

        /* Update the "Filter page" button */
        var filterBtn = document.getElementById('dz-search-filter-btn');
        if (filterBtn) {
            if (q && hits.length > 0) {
                filterBtn.textContent = 'Show ' + hits.length + ' matching device' + (hits.length === 1 ? '' : 's') + ' on this page';
                filterBtn.style.display = '';
            } else {
                filterBtn.style.display = 'none';
            }
        }
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

        // Add prominent highlight animation
        d.card.classList.add('dz-search-highlight');

        // Remove after animation completes
        setTimeout(function () { 
            d.card.classList.remove('dz-search-highlight'); 
        }, 2500);
    }

    function open() {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.id = 'dz-search-overlay';

        var box = document.createElement('div');
        box.id  = 'dz-search-box';

        // Add header with title and touchable close button (mirrors command palette pattern)
        var header = document.createElement('div');
        header.className = 'dz-search-header';
        header.innerHTML = '<i class="fa-solid fa-filter"></i><span class="dz-search-title">Filter Current Page</span>';
        var escBtn = document.createElement('kbd');
        escBtn.className = 'dz-cmd-esc';
        escBtn.textContent = 'Esc';
        escBtn.addEventListener('click', close);
        header.appendChild(escBtn);
        box.appendChild(header);

        inputEl = document.createElement('input');
        inputEl.id          = 'dz-search-input';
        inputEl.type        = 'text';
        inputEl.placeholder = 'Filter devices on current page…';
        inputEl.autocomplete = 'off';

        listEl = document.createElement('div');
        listEl.id = 'dz-search-results';

        var filterBtn = document.createElement('button');
        filterBtn.id        = 'dz-search-filter-btn';
        filterBtn.className = 'dz-search-filter-btn';
        filterBtn.style.display = 'none';
        filterBtn.addEventListener('click', function () {
            var q = inputEl ? inputEl.value.trim() : '';
            if (q) applyTextFilter(q);
        });

        var hint = document.createElement('div');
        hint.className = 'dz-search-hint';
        hint.innerHTML =
            '<span style="opacity: 0.75; margin-right: 4px;"><kbd>/</kbd> filters devices on this page &nbsp;·&nbsp; Use <kbd>Ctrl</kbd><kbd>K</kbd> for global search</span>' +
            '<span style="margin-left: auto; display: flex; gap: 14px;">' +
            '<span><kbd>↑↓</kbd> navigate</span>' +
            '<span><kbd>↵</kbd> go to card</span>' +
            '<span><kbd>⇧↵</kbd> filter page</span>' +
            '<span class="dz-search-hint-esc" style="cursor:pointer"><kbd>Esc</kbd> close</span>' +
            '</span>';
        hint.querySelector('.dz-search-hint-esc').addEventListener('click', close);

        box.appendChild(inputEl);
        box.appendChild(listEl);
        box.appendChild(filterBtn);
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
                if (e.shiftKey) {
                    var q = inputEl.value.trim();
                    if (q) { e.preventDefault(); applyTextFilter(q); }
                } else {
                    if (activeI >= 0 && items[activeI]) items[activeI].click();
                }
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

    /* ── Text filter: hide non-matching cards on the current page ─── */

    function applyTextFilter(q) {
        if (!q) { clearTextFilter(); return; }
        _textFilter = q;
        var qLow = q.toLowerCase();
        var all = getCards();
        var matchCount = 0;
        all.forEach(function (d) {
            var matches = d.name.toLowerCase().indexOf(qLow) !== -1;
            d.card.classList.toggle('dz-tf-hidden', !matches);
            if (matches) matchCount++;
        });

        /* Hide sections that have no visible cards */
        document.querySelectorAll('section.dashCategory').forEach(function (sec) {
            var hasVisible = sec.querySelector(
                '.movable:not(.ng-rf-filtered):not(.dz-tf-hidden), tr[id]:not(.ng-rf-filtered):not(.dz-tf-hidden)'
            );
            sec.classList.toggle('dz-tf-section-hidden', !hasVisible);
        });

        injectTextFilterChip(q, matchCount);
        close();
    }

    function clearTextFilter() {
        _textFilter = null;
        document.querySelectorAll('.dz-tf-hidden').forEach(function (el) {
            el.classList.remove('dz-tf-hidden');
        });
        document.querySelectorAll('.dz-tf-section-hidden').forEach(function (sec) {
            sec.classList.remove('dz-tf-section-hidden');
        });
        var bar = document.getElementById('ng-tf-chip-bar');
        if (bar) bar.remove();
    }

    function injectTextFilterChip(q, count) {
        var existing = document.getElementById('ng-tf-chip-bar');
        if (existing) existing.remove();

        var insertAfter = document.getElementById('ng-rf-chip-bar') ||
                          document.getElementById('ng-rf-toggle');
        var parent = insertAfter
            ? insertAfter.parentNode
            : document.getElementById('tbFiltSearch');
        if (!parent) return;

        var bar = document.createElement('div');
        bar.id        = 'ng-tf-chip-bar';
        bar.className = 'ng-tf-chip-bar';

        var chip = document.createElement('span');
        chip.className = 'ng-rf-chip';

        var lbl = document.createElement('span');
        lbl.className = 'ng-rf-chip-label';
        lbl.innerHTML =
            '<i class="fa-solid fa-magnifying-glass" style="margin-right:4px;font-size:0.85em;opacity:0.7;"></i>' +
            escHtml(q) +
            '<span style="margin-left:6px;opacity:0.6;font-size:0.85em;">(' + count + ')</span>';

        var rm = document.createElement('button');
        rm.className = 'ng-rf-chip-remove';
        rm.setAttribute('aria-label', 'Clear text filter: ' + q);
        rm.textContent = '×';
        rm.addEventListener('click', clearTextFilter);
        rm.addEventListener('touchend', function (e) { e.preventDefault(); clearTextFilter(); });

        chip.appendChild(lbl);
        chip.appendChild(rm);
        bar.appendChild(chip);

        if (insertAfter) {
            insertAfter.parentNode.insertBefore(bar, insertAfter.nextSibling);
        } else {
            parent.appendChild(bar);
        }
    }

    /* Auto-clear text filter when the user navigates to another tab */
    var _routeHookAttempts = 0;
    function hookRouteChange() {
        _routeHookAttempts++;
        if (_routeHookAttempts > 20) return;
        try {
            var $rs = angular.element(document.body).injector().get('$rootScope');
            $rs.$on('$routeChangeSuccess', function () { clearTextFilter(); });
        } catch (e) {
            setTimeout(hookRouteChange, 500);
        }
    }
    hookRouteChange();

    function inInputField(target) {
        var tag = (target.tagName || '').toUpperCase();
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    }

    // Handle clicks on the page filter button (#tbSearch)
    document.addEventListener('click', function(e) {
        var tbSearch = document.getElementById('tbSearch');
        if (tbSearch && (e.target === tbSearch || tbSearch.contains(e.target))) {
            e.preventDefault();
            e.stopPropagation();
            open();
        }
    });

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

        var navItems = nav.querySelectorAll(':scope > li:not(.dropdown) > a');

        /* Authoritative active tab: the <a> inside the <li> that AngularJS has
           marked .current_page_item. This is the single source of truth and,
           because it is only read AFTER the class is committed, can never
           resolve to the previously-active tab. */
        function activeFromDom() {
            var li = nav.querySelector(':scope > li.current_page_item');
            return li ? li.querySelector('a') : null;
        }

        /* Hash-based resolve, used before Angular commits the class (initial
           load) and for keyboard/programmatic navigation. The route keyword
           ("dashboard") is matched against each link's href. */
        function routeKey(h) {
            return (h || '').replace(/^#!?\/?/, '').split(/[\/?#]/)[0].toLowerCase();
        }
        function linkFromHash() {
            var target = routeKey(window.location.hash);
            if (!target) return null;
            for (var i = 0; i < navItems.length; i++) {
                if (routeKey(navItems[i].getAttribute('href')) === target) {
                    return navItems[i];
                }
            }
            return null;
        }

        /* Where the pill rests when the pointer is not on the navbar. It is
           set the instant a tab is clicked (optimistic) so a mouseleave during
           the async route change can never snap the pill back to the old tab
           — the blue underline flash reported in #192 — and reconciled from
           the DOM once AngularJS commits .current_page_item. */
        var activeLink = activeFromDom() || linkFromHash();
        var overNav = false;

        positionTo(activeLink, false);

        for (var i = 0; i < navItems.length; i++) {
            (function (link) {
                link.addEventListener('mouseenter', function () {
                    positionTo(link, true);
                });
                link.addEventListener('click', function () {
                    activeLink = link;
                    positionTo(link, true);
                });
            })(navItems[i]);
        }

        nav.addEventListener('mouseenter', function () { overNav = true; });
        nav.addEventListener('mouseleave', function () {
            overNav = false;
            positionTo(activeLink, true);
        });

        window.addEventListener('resize', function () {
            positionTo(activeLink, false);
        });

        /* Follow the tab AngularJS actually marks active. The observer fires
           the moment .current_page_item is committed on the NEW tab, so the
           resting position is always correct and never stale. While the
           pointer is on the navbar, hover owns the pill, so we only move it
           here when the user is not hovering. */
        if (typeof MutationObserver !== 'undefined') {
            var mo = new MutationObserver(function () {
                var a = activeFromDom();
                if (!a || a === activeLink) return;
                activeLink = a;
                if (!overNav) positionTo(activeLink, true);
            });
            mo.observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
        }

        /* Keyboard/programmatic navigation (e.g. the 1-9 shortcuts) changes
           the hash without a click; reconcile from it as a fallback. */
        window.addEventListener('hashchange', function () {
            var a = linkFromHash();
            if (a) {
                activeLink = a;
                if (!overNav) positionTo(activeLink, true);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initIndicator);
    } else {
        initIndicator();
    }
})();


/* ==================================================================
 *  Dropdown-submenu toggle (mobile accordion + desktop hover/flip)
 *
 *  Desktop: submenus open on CSS :hover (fly left by default).
 *           JS mouseenter flips direction when the left edge clips.
 *           JS click toggle adds .open for keyboard/click use.
 *
 *  Mobile (≤767px): submenus expand accordion-style inline — no
 *           flying panel (there is no room to the left on portrait).
 *           A capture-phase click handler toggles .open before
 *           Bootstrap's bubble-phase clearMenus can fire.
 * ================================================================== */
(function () {
    'use strict';

    function initSubmenus() {

        // --- Click / touch toggle (capture phase) ---
        // Runs before Bootstrap's bubble-phase clearMenus, so the
        // parent dropdown stays open while we toggle the submenu.
        document.addEventListener('click', function (e) {
            // Walk up to find a submenu trigger anchor
            var a = null;
            var el = e.target;
            while (el && el !== document) {
                if (el.tagName === 'A' &&
                    el.parentNode &&
                    (' ' + el.parentNode.className + ' ').indexOf(' dropdown-submenu ') !== -1) {
                    a = el;
                    break;
                }
                el = el.parentNode;
            }
            if (!a) return;

            var $item   = $(a).parent(); // the .dropdown-submenu li
            var wasOpen = $item.hasClass('open');

            // Collapse sibling submenus at the same level, then toggle self
            $item.siblings('.dropdown-submenu').removeClass('open');
            $item.toggleClass('open', !wasOpen);

            // Prevent Bootstrap's clearMenus from closing the parent dropdown
            e.stopPropagation();
            e.preventDefault();
        }, true /* capture phase */);

        // --- Desktop: flip submenu to the right when left edge clips ---
        // CSS default is right:100% (fly left). If the left edge of the
        // rendered menu is off-screen, switch to left:100% (fly right).
        $(document).on('mouseenter.dz-submenu', '.navbar .nav .dropdown-submenu', function () {
            if (window.innerWidth <= 767) return;
            var $menu = $(this).children('.dropdown-menu');
            $menu.css({ left: '', right: '' }); // reset to CSS default
            requestAnimationFrame(function () {
                if (!$menu.length || !$menu[0].getBoundingClientRect) return;
                var rect = $menu[0].getBoundingClientRect();
                if (rect.left < 8) {
                    $menu.css({ right: 'auto', left: '100%' });
                }
            });
        });

        // --- Cleanup: collapse all submenus when the parent dropdown closes ---
        $(document).on('hidden.bs.dropdown', '.dropdown', function () {
            $(this).find('.dropdown-submenu').removeClass('open');
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

    // User-saved color presets are stored in their own Domoticz user variable
    // rather than inside the ThemeSettings blob.  A single preset is ~660 chars
    // (full dark+light color sets + preview + metadata), so a handful would blow
    // past the 2500-char Preferences cap (issue #203).  User variables live in
    // the UserVariables table — no size cap, and still server-side so presets
    // sync across browsers.  Bounded scalar config stays in ThemeSettings;
    // unbounded user data lives here.
    var PRESETS_UVAR = 'ngTheme_presets';
    var PRESETS_KEY  = 'userPresets';    // the _settings key held externally

    // Base path for API calls
    var BASE = (function () {
        return window.location.pathname.replace(/\/[^/]*$/, '/');
    })();

    /* ── Default settings ──────────────────────────────────────── */
    var DEFAULTS = {
        navbarIcons:        true,
        deviceIcons:        true,
        animateDeviceIcons: true,
        /* favStarIcons / trendArrowIcons / actionIcons were dropped once
           Domoticz started rendering those three as Font Awesome itself.
           Stored values from older installs are read and ignored. */
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
        cardStyle:          'classic',
        cardDensity:        'compact',
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

        deviceIconOverrides: '{}',

        /* No iconLibraries key: extra icon fonts are Domoticz's own feature now
           (Setup → Custom Icons). Any value left over from when the theme
           managed them is still read straight out of storage by the one-shot
           migration in icon-studio.js — a key absent from DEFAULTS survives
           both (de)serialize paths untouched. */

        userPresets:        '[]',   /* user-saved color presets — JSON array */

        debugLogs:          false   /* session-only — never persisted */
    };

    var _settings      = null;
    var _uvarIdx       = null;  // Domoticz idx of the ngTheme_settings variable
    var _panelInjected = false;
    var _apiAvailable  = true;  // false if Domoticz API is unreachable
    var _useNewApi     = false; // true when ThemeSettingsAPI is supported (domoticz/domoticz#6950)
    var _saveTimer     = null;  // debounce handle for API writes
    var _dirty         = false; // true when in-memory changes not yet saved to DB
    var _lastupdate    = '';    // concurrency token received from the last server read/write
    var _perUser       = true;  // false when session maps to a shared account (no-auth / trusted net)
    var _presetsUvarIdx  = null; // Domoticz idx of the ngTheme_presets variable (legacy)
    var _presetsSaveTimer = null; // debounce handle for legacy preset writes
    var LS_KEY         = 'ngThemeSettings';

    /* get() answers from DEFAULTS while _settings is still null, so a caller
       cannot tell "nothing stored" from "not read yet" — and one that acts on
       an empty collection would draw the wrong conclusion. whenReady() below
       hands out this latch instead. */
    var _readyDone = false;
    var _readyCbs  = [];
    function _signalReady() {
        if (_readyDone) return;
        _readyDone = true;
        var cbs = _readyCbs;
        _readyCbs = [];
        cbs.forEach(function (fn) { try { fn(); } catch (e) {} });
    }

    /* Collection fields are held in _settings as JSON *strings* (the shape the
       get/set API and every caller expects), but persisted as native
       objects/arrays so their quotes are NOT double-escaped inside the
       ThemeSettings blob.  On the new API (16 KB limit) userPresets are
       included in the blob; on the legacy user-variable path they remain in a
       dedicated variable to stay under the 2500-char cap (issue #203). */
    var COLLECTION_FIELDS = ['deviceIconOverrides', 'userPresets', 'toastBlacklist'];

    /* ── Domoticz API helpers ─────────────────────────────────────── */

    function apiCall(params) {
        var url = BASE + 'json.htm?' + Object.keys(params).map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        }).join('&');
        return fetch(url, {
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).then(function (r) { return r.json(); });
    }

    // POST variant required by the new themesettings_set endpoint (GET returns post_required).
    function apiPost(params) {
        var body = Object.keys(params).map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        }).join('&');
        return fetch(BASE + 'json.htm', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: body
        }).then(function (r) {
            // no_identity / insufficient-rights replies come back as HTTP 403.
            // The body is usually still the command JSON, but a bare 403 page is
            // possible — fall back to a synthetic error object so callers can
            // branch on data.error instead of hitting the network-error catch.
            return r.text().then(function (t) {
                try { return JSON.parse(t); }
                catch (e) {
                    return { status: 'ERR', error: (r.status === 403 ? 'no_identity' : 'http_error'), httpStatus: r.status };
                }
            });
        });
    }

    /* ── New API: per-user ThemeSettings (domoticz/domoticz#6950) ── */

    // Resolves true when the core exposes the ThemeSettingsAPI flag in getversion,
    // or when the build number indicates a build that already merged the feature.
    // Falls back gracefully so older cores keep using user variables.
    function detectThemeSettingsApi() {
        return apiCall({ type: 'command', param: 'getversion' }).then(function (data) {
            if (data && data.ThemeSettingsAPI) return true;
            // Fallback: honour the old build-number threshold while the flag rolls out
            return ((data && (data.Revision || data.build_number)) || 0) >= 17806;
        }).catch(function () { return false; });
    }

    // Reads this theme's settings via the dedicated themesettings_get command.
    // Unlike getsettings (which returns only the *merged* value and no token),
    // this returns the instance and user layers separately, each with its own
    // presence flag and lastupdate concurrency token, plus the PerUser flag.
    //
    // Resolves with { stored, token, perUser }:
    //   • stored  — the effective settings object (user overlay wins over the
    //               instance default), or null when neither layer exists yet.
    //   • token   — the USER-row concurrency token that themesettings_set checks
    //               against on write ('' when the user has no row yet, which the
    //               server treats as a fresh INSERT).
    //   • perUser — false when the session maps to a shared identity (no-auth /
    //               trusted-network), so per-user rows can't actually isolate.
    //
    // Side effects: updates _lastupdate and _perUser.  Rejects only on a
    // network/parse error or a non-OK status.
    function loadFromThemeApi() {
        return apiCall({ type: 'command', param: 'themesettings_get', theme: THEME_NAME }).then(function (data) {
            if (!data || data.status !== 'OK') return Promise.reject('themesettings_get failed');
            _perUser = (data.PerUser !== false);
            var userLayer = data.user || {};
            var instLayer = data.instance || {};
            // The token we must echo back on write is the USER row's — that's the
            // layer themesettings_set writes.  Empty until the first user save.
            _lastupdate = (userLayer.present && userLayer.lastupdate) ? userLayer.lastupdate : '';
            // Effective value: the user overlay replaces the instance sub-object
            // wholesale (themes are atomic), falling back to the instance default.
            var stored = userLayer.present ? userLayer.value
                       : (instLayer.present ? instLayer.value : null);
            return { stored: stored || null, token: _lastupdate, perUser: _perUser };
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
                body:     'Persist your changes across all browsers.' +
                          '<div class="ng-toast-actions">' +
                          '<button type="button" class="ng-toast-action ng-toast-action--save">' +
                          SAVE_BTN_HTML + '</button></div>',
                duration: 0,
                type:     'system'
            });
            // Wire the in-toast Save button to the same save path the settings
            // panel uses, so the latest theme config (incl. device icon
            // overrides) can be stored without opening the panel.
            if (_unsavedToastEl) {
                var _saveBtn = _unsavedToastEl.querySelector('.ng-toast-action--save');
                if (_saveBtn) {
                    _saveBtn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        _postThemeSettings(_saveBtn);
                    });
                }
            }
        } else {
            if (_unsavedToastEl && typeof window.ngRemoveToast === 'function') {
                window.ngRemoveToast(_unsavedToastEl);
            }
            _unsavedToastEl = null;
        }
    }

    // Updates the in-memory dirty flag and surfaces the "unsaved changes" toast
    // so the user knows they need to click "Save to Domoticz".
    function _markDirty() {
        _dirty = true;
        _showUnsavedToast(true);
    }

    // POSTs theme settings to the new per-user themesettings_set endpoint
    // (domoticz/domoticz#6950).  Handles all documented error statuses and
    // uses the lastupdate concurrency token to detect conflicts before
    // blindly overwriting another session's changes.
    var SAVE_BTN_HTML = '<i class="fa-solid fa-floppy-disk"></i> Save to Domoticz';
    // retryCount guards the conflict -> re-read -> overwrite loop: a single
    // automatic retry with the freshly-read token handles the normal case
    // (another session wrote between our read and our write); a second conflict
    // stops prompting and reports, rather than looping forever.
    //
    // Resolves true only when the blob reached the server, so a caller that has
    // already changed something outside the blob can tell whether the two are
    // still in step.  quiet suppresses the conflict confirm(): a save the user
    // did not ask for (the icon-shape migration) must never stop a page load on
    // a modal question — it reports false and leaves the stored copy alone.
    function _postThemeSettings(btn, retryCount, quiet) {
        retryCount = retryCount || 0;
        var json = JSON.stringify(serializeSettings());
        var params = {
            type:  'command',
            param: 'themesettings_set',
            theme: THEME_NAME,
            value: json
        };
        // Always send the token: '' on a first save -> the server INSERTs a fresh
        // row; a real token -> the server compare-and-swaps the existing row.
        params.lastupdate = _lastupdate || '';

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving\u2026';
        }

        function restoreBtn() {
            if (btn) { btn.innerHTML = SAVE_BTN_HTML; btn.disabled = false; }
        }

        function errorToast(color, title, body) {
            restoreBtn();
            if (window.ngShowToast) {
                window.ngShowToast({
                    icon: 'fa-triangle-exclamation', color: color,
                    title: title, body: body, duration: 8000, type: 'system'
                });
            }
        }

        return apiPost(params).then(function (data) {
            if (!data) throw new Error('no response');

            if (data.status === 'OK') {
                // The server hands back the new token so our next save's CAS matches.
                if (data.lastupdate) _lastupdate = data.lastupdate;
                _dirty = false;
                _showUnsavedToast(false);
                if (btn) {
                    btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
                    setTimeout(function () { btn.innerHTML = SAVE_BTN_HTML; btn.disabled = false; }, 2000);
                }
                return true;
            }

            // Every non-OK reply carries the reason in data.error (status is only
            // ever "OK" or "ERR"), so branch on that — never on data.status.
            var err = data.error || 'unknown';

            if (err === 'conflict') {
                if (retryCount > 0) {
                    // We already retried with a fresh token and STILL conflicted —
                    // something keeps writing.  Stop looping; leave changes dirty.
                    errorToast('var(--dz-danger, #e05555)', 'Save conflict',
                        'Another session keeps changing these settings. Reload the ' +
                        'page and try again.');
                    return false;
                }
                if (quiet) {
                    // Nobody asked for this save, so nobody can be asked which
                    // copy wins: the server's stands and the caller is told.
                    restoreBtn();
                    return false;
                }
                // Another session saved after we last read — re-fetch the current
                // server value AND token (loadFromThemeApi updates _lastupdate),
                // then offer the user a choice.
                return loadFromThemeApi().then(function (res) {
                    restoreBtn();
                    var fresh = res ? res.stored : null;
                    if (!confirm(
                        'Your Nightglass settings were changed from another browser or session.\n' +
                        'Overwrite the server copy with your current settings?'
                    )) {
                        // User prefers the server version — apply it locally.
                        if (fresh) {
                            _settings = deserializeSettings(fresh);
                            saveToLocalStorage();
                            applySettings();
                        }
                        _dirty = false;
                        _showUnsavedToast(false);
                        return false;
                    }
                    // User chose to overwrite — retry WITH the fresh token so the
                    // server's compare-and-swap matches and the write lands.
                    return _postThemeSettings(btn, retryCount + 1, quiet);
                }, function () {
                    // Re-read failed — surface the conflict rather than silently drop.
                    errorToast('var(--dz-danger, #e05555)', 'Save conflict',
                        'Settings were changed elsewhere and the current server copy ' +
                        'could not be read. Reload the page and try again.');
                    return false;
                });
            }

            if (err === 'no_identity') {
                // OAuth / token sessions have no user row — fall back to localStorage.
                _apiAvailable = false;
                saveToLocalStorage();
                _dirty = false;
                _showUnsavedToast(false);
                errorToast('var(--dz-warning, #f0a832)', 'Settings not synced',
                    'Your session type does not support per-user settings. ' +
                    'Settings are stored in this browser only.');
                return false;
            }

            if (err === 'too_large') {
                errorToast('var(--dz-danger, #e05555)', 'Settings too large',
                    'The settings blob exceeds the 16 KB server limit. ' +
                    'Try removing device icon styling or user presets.');
                return false;
            }

            if (err === 'too_many_themes') {
                errorToast('var(--dz-danger, #e05555)', 'Too many theme configs',
                    'The server has reached its per-user theme-config limit. ' +
                    'Use the Reset All button to clear stale entries.');
                return false;
            }

            // invalid_theme / invalid_json / missing_value / post_required / db_error
            errorToast('var(--dz-danger, #e05555)', 'Save failed',
                (data.message || 'The server rejected the settings.') + ' (' + err + ')');
            return false;
        }).catch(function (e) {
            console.warn('Nightglass: _postThemeSettings failed', e);
            restoreBtn();
            return false;
        });
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
                if (uv.Name.indexOf(oldPrefix) === 0 && uv.Name !== UVAR_NAME &&
                    uv.Name !== PRESETS_UVAR) {
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

    // Legacy path: store the blob as a JSON user variable (compact form too, so
    // the user-variable value stays small and round-trips identically).
    // Resolves true when the variable was written, for callers that need to know.
    function writeJsonUvar() {
        var json = JSON.stringify(serializeSettings());
        if (_uvarIdx) {
            return apiCall({
                type: 'command', param: 'updateuservariable',
                idx: _uvarIdx, vname: UVAR_NAME, vtype: UVAR_TYPE, vvalue: json
            }).then(function (d) {
                return !!(d && d.status === 'OK');
            }, function () { return false; });
        }
        return apiCall({
            type: 'command', param: 'adduservariable',
            vname: UVAR_NAME, vtype: UVAR_TYPE, vvalue: json
        }).then(function (d) {
            var ok = !!(d && d.status === 'OK');
            // Re-fetch so we have the idx for future update calls
            return apiCall({ type: 'command', param: 'getuservariables' }).then(function (data) {
                if (data && data.result) {
                    data.result.forEach(function (uv) {
                        if (uv.Name === UVAR_NAME) _uvarIdx = uv.idx;
                    });
                }
                return ok;
            }, function () { return ok; });
        }, function () { return false; });
    }

    // Debounced persistence helper called from saveSetting().
    // On the new API, just marks the in-memory state dirty so the user knows
    // to click "Save to Domoticz" — the actual POST happens then.
    // On legacy builds writes to the ngTheme_settings user variable directly.
    function saveJsonUvar() {
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(function () {
            if (_useNewApi) {
                _markDirty();
                return;
            }
            writeJsonUvar();
        }, 400);
    }

    // Persist userPresets to their dedicated ngTheme_presets user variable on
    // legacy builds (debounced so rapid save/delete clicks coalesce into one
    // write).  On the new API userPresets are part of the main blob and are
    // sent with the next "Save to Domoticz" click — no separate call needed.
    function savePresetsUvar() {
        if (_useNewApi) { _markDirty(); return; }
        clearTimeout(_presetsSaveTimer);
        _presetsSaveTimer = setTimeout(function () {
            if (!_apiAvailable) return;
            var json = _settings ? (_settings[PRESETS_KEY] || '[]') : '[]';
            if (_presetsUvarIdx) {
                apiCall({
                    type: 'command', param: 'updateuservariable',
                    idx: _presetsUvarIdx, vname: PRESETS_UVAR, vtype: UVAR_TYPE, vvalue: json
                });
            } else {
                apiCall({
                    type: 'command', param: 'adduservariable',
                    vname: PRESETS_UVAR, vtype: UVAR_TYPE, vvalue: json
                }).then(function () {
                    // Re-fetch so we have the idx for future update calls
                    return apiCall({ type: 'command', param: 'getuservariables' });
                }).then(function (data) {
                    if (!data || !data.result) return;
                    data.result.forEach(function (uv) {
                        if (uv.Name === PRESETS_UVAR) _presetsUvarIdx = uv.idx;
                    });
                }).catch(function () {});
            }
        }, 400);
    }

    /* ── Settings persistence ─────────────────────────────────────── */

    /* Strip empty/default fields from each device-icon override.  A stored
       entry can carry up to 11 fields (icon, iconOn/Off/Open/Close/Stop,
       keepColor, on, off, anim, name) but most are blank — keeping only the
       set ones cuts a typical entry from ~230 to ~90 chars, the single
       biggest contributor to ThemeSettings bloat (issue #203). */
    /* Domoticz's own per-device Icon column, as dzIconPicker serialises it:
       { "t":<prefix>, "on":<class>[, "off":<class>] }. Read here so the icon
       editor opens on the shape actually in effect — a device the user gave an
       icon (a ventilator set to mdi-fan-remove on its device page) reads as
       that icon rather than as the theme's type default. Writing it goes
       through dzDeviceIconStore, which owns the serialisation. */
    function parseNativeDeviceIcon(v) {
        if (!v) return null;
        var p = v;
        if (typeof v === 'string') { try { p = JSON.parse(v); } catch (e) { return null; } }
        if (!p || typeof p !== 'object' || typeof p.on !== 'string') return null;
        var on = p.on.replace(/\s+/g, ' ').trim();
        if (!on) return null;
        return { on: on, off: (typeof p.off === 'string' ? p.off.trim() : '') };
    }

    function pruneOverrides(ov) {
        if (!ov || typeof ov !== 'object') return {};
        /* 'anim' is an id, so an unset animation is '' and drops out here
           along with every other blank field — no animation is the default
           and costs nothing to store. */
        var KEEP = ['icon', 'iconOn', 'iconOff', 'iconOpen', 'iconClose',
                    'iconStop', 'on', 'off', 'anim', 'name'];
        var out = {};
        Object.keys(ov).forEach(function (idx) {
            var s = ov[idx] || {};
            var e = {};
            KEEP.forEach(function (f) { if (s[f]) e[f] = s[f]; });
            if (s.keepColor) e.keepColor = true; // only store when enabled
            if (Object.keys(e).length) out[idx] = e;
        });
        return out;
    }

    /* Build the compact object actually written to storage: only settings that
       differ from DEFAULTS, collection fields as pruned NATIVE objects/arrays
       (omitted entirely when empty), and session-only keys excluded.
       On the new API (16 KB limit) userPresets are included in the blob so the
       separate ngTheme_presets user variable is no longer needed.
       On legacy builds presets are still persisted in their own variable (no
       blob-size cap relief there), so they continue to be excluded here. */
    function serializeSettings() {
        var out = {};
        if (!_settings) return out;
        Object.keys(_settings).forEach(function (key) {
            if (SESSION_ONLY_KEYS.indexOf(key) !== -1) return;
            // On legacy builds userPresets live in their own user variable.
            if (!_useNewApi && key === PRESETS_KEY) return;
            var v = _settings[key];
            if (COLLECTION_FIELDS.indexOf(key) !== -1) {
                var parsed;
                try { parsed = (typeof v === 'string') ? JSON.parse(v || 'null') : v; }
                catch (e) { parsed = null; }
                if (key === 'deviceIconOverrides') { parsed = pruneOverrides(parsed); }
                if (!parsed || typeof parsed !== 'object') { return; }
                if (Array.isArray(parsed) ? !parsed.length : !Object.keys(parsed).length) { return; }
                out[key] = parsed; // native form — no double-escaping in the blob
                return;
            }
            if (!(key in DEFAULTS) || v !== DEFAULTS[key]) { out[key] = v; }
        });
        return out;
    }

    /* Inverse of serializeSettings: layer stored values over DEFAULTS and
       convert collection fields back to the JSON-string form callers expect.
       Accepts both the new compact form (native collections, diff only) and
       the legacy form (collections already strings, every key present), so
       existing installs upgrade transparently. */
    function deserializeSettings(stored) {
        var norm = {};
        if (stored && typeof stored === 'object') {
            Object.keys(stored).forEach(function (key) {
                var v = stored[key];
                if (COLLECTION_FIELDS.indexOf(key) !== -1 && v != null && typeof v !== 'string') {
                    norm[key] = JSON.stringify(v);
                } else {
                    norm[key] = v;
                }
            });
        }
        return Object.assign({}, DEFAULTS, norm);
    }

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
        // Detect ThemeSettingsAPI support first so we know which storage backend to use.
        return detectThemeSettingsApi().then(function (hasNewApi) {
            if (hasNewApi) {
                // New API: read from themesettings_get (captures the concurrency
                // token + PerUser flag), fall back to user vars for migration.
                _useNewApi    = true;
                _apiAvailable = true;
                return loadFromThemeApi().then(function (res) {
                    var stored = res ? res.stored : null;
                    if (stored) {
                        // Settings already persisted via new API — use them.
                        _settings = deserializeSettings(stored);
                    } else {
                        // Nothing in ThemeSettings yet; pull from user variables
                        // as a one-time migration source (read-only — saves will
                        // now go through the new API).
                        return loadJsonUvar().then(function (migrated) {
                            _settings = deserializeSettings(migrated);
                            return _settings;
                        }).catch(function () {
                            _settings = deserializeSettings(null);
                            return _settings;
                        });
                    }
                    return _settings;
                }).catch(function () {
                    // themesettings_get failed — degrade to user variables.
                    return loadJsonUvar().then(function (stored) {
                        _settings = deserializeSettings(stored);
                        return _settings;
                    }).catch(function () {
                        _settings = deserializeSettings(loadFromLocalStorage());
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
                _settings = deserializeSettings(stored);
                saveToLocalStorage();
                return _settings;
            }).catch(function () {
                _apiAvailable = false;
                _settings = deserializeSettings(loadFromLocalStorage());
                return _settings;
            });
        });
    }

    /* Reconcile userPresets with the legacy ngTheme_presets user variable.
       Runs once after loadSettings() has populated _settings.

       New API: presets live inside the ThemeSettings blob, NOT in a user
       variable.  The only thing left to do is a one-time INBOUND migration:
       if the blob has no presets yet but the pre-migration ngTheme_presets
       variable still holds some, fold them into _settings and mark the state
       dirty so they persist into the blob on the next save.  We never WRITE the
       variable on the new API; the old row stays as a read-only source until the
       user saves (Save to Domoticz / Apply Settings), after which the blob wins.

       Legacy builds (unchanged): the variable is authoritative — read it if it
       exists, otherwise create it from any inline blob copy.
       Best-effort — resolves to _settings even if the API is unreachable. */
    function reconcilePresets() {
        if (!_apiAvailable) { return Promise.resolve(_settings); }

        if (_useNewApi) {
            // Already have presets in the blob? Nothing to migrate.
            var current = [];
            try { current = JSON.parse((_settings && _settings[PRESETS_KEY]) || '[]') || []; } catch (e) {}
            if (current.length) { return Promise.resolve(_settings); }

            return apiCall({ type: 'command', param: 'getuservariables' }).then(function (data) {
                var found = null;
                if (data && data.result) {
                    data.result.forEach(function (uv) {
                        if (uv.Name === PRESETS_UVAR) { found = uv; }
                    });
                }
                if (found) {
                    var legacy = [];
                    try { legacy = JSON.parse(found.Value || '[]') || []; } catch (e) {}
                    if (legacy.length) {
                        window.ngLog('[Settings]', 'migrating legacy ' + PRESETS_UVAR +
                            ' presets into the ThemeSettings blob (' + legacy.length + ')');
                        _settings[PRESETS_KEY] = JSON.stringify(legacy);
                        saveToLocalStorage();
                        // Mark dirty so the next Save/Apply writes them into the blob.
                        // The old variable is left untouched as a source of truth
                        // until that save lands (so nothing is lost mid-migration).
                        _markDirty();
                    }
                }
                return _settings;
            }).catch(function () { return _settings; });
        }

        return apiCall({ type: 'command', param: 'getuservariables' }).then(function (data) {
            var found = null;
            if (data && data.result) {
                data.result.forEach(function (uv) {
                    if (uv.Name === PRESETS_UVAR) { found = uv; }
                });
            }
            if (found) {
                _presetsUvarIdx = found.idx;
                _settings[PRESETS_KEY] = found.Value || '[]';
            } else {
                var legacy = (_settings && _settings[PRESETS_KEY]) || '[]';
                var hasLegacy = false;
                try { hasLegacy = (JSON.parse(legacy) || []).length > 0; } catch (e) {}
                if (hasLegacy) {
                    window.ngLog('[Settings]', 'migrating userPresets → ' + PRESETS_UVAR);
                    savePresetsUvar(); // creates the variable from the legacy value
                }
            }
            saveToLocalStorage();
            return _settings;
        }).catch(function () { return _settings; });
    }

    /* Keys listed here are session-only: they live only in _settings for the
       duration of the page session and are never written to localStorage or
       the Domoticz API.  A hard refresh always resets them to DEFAULTS. */
    var SESSION_ONLY_KEYS = ['debugLogs'];

    function saveSetting(key, value) {
        _settings[key] = value;
        window.ngLog('[Settings]', 'set', key, '=', value);
        if (SESSION_ONLY_KEYS.indexOf(key) === -1) {
            if (key === PRESETS_KEY && !_useNewApi) {
                // Legacy: presets have their own user variable, outside the blob.
                if (_apiAvailable) savePresetsUvar();
            } else if (_apiAvailable) {
                saveJsonUvar(); // debounced, batches rapid changes
            }
            saveToLocalStorage();
        }
        applySettings();
    }

    /* Set a value and push the blob to the server right away, instead of the
       usual "mark dirty, wait for Save to Domoticz".  For changes the user did
       not make by hand and so cannot be asked to confirm: the icon-shape
       migration has already written DeviceStatus by the time it trims the blob,
       so leaving that trim to a click that may never come would keep the two
       stores disagreeing.  It writes the whole blob, as every save does — safe
       here only because the migration runs before the settings panel exists and
       therefore before there can be pending hand edits to sweep up with it.
       Resolves true when the value reached durable storage. */
    function persistNow(key, value) {
        if (!_settings) return Promise.resolve(false);
        _settings[key] = value;
        window.ngLog('[Settings]', 'set+persist', key);
        saveToLocalStorage();
        applySettings();
        if (!_apiAvailable) return Promise.resolve(true); // this browser only, but stored
        if (_useNewApi) {
            /* Any debounced save still pending would fire after ours and do
               nothing but raise the unsaved-changes toast for a blob already on
               the server. */
            clearTimeout(_saveTimer);
            return Promise.resolve(_postThemeSettings(null, 0, true)).then(function (ok) {
                return !!ok;
            });
        }
        return writeJsonUvar();
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

        // Animate device icons — master switch over the per-device choices
        var animStyle = document.getElementById('dz-ng-anim-icon-style');
        if (!_settings.animateDeviceIcons || !_settings.deviceIcons) {
            if (!animStyle) {
                animStyle = document.createElement('style');
                animStyle.id = 'dz-ng-anim-icon-style';
                /* Not gated on data-dz-state: a read-only sensor publishes no
                   state and would otherwise keep animating with the switch
                   off.  Device icons carry no other animation to lose. */
                animStyle.textContent =
                    'i.dz-fa-device { animation: none !important; }';
                document.head.appendChild(animStyle);
            }
        } else if (animStyle) {
            animStyle.remove();
        }

        /* Favourite stars, trend arrows and table action icons had their own
           switches here. Each one un-hid a PNG that Domoticz no longer renders:
           stars are <i class="fa-* fa-star"> in the widget templates, trends go
           through dzIconService.chromeIconFor(), and table actions ship as
           <i class="fa-solid fa-trash-can dz-chrome-icon">. With no <img> left
           to restore, the switches only ever hid our own markup, so they are
           gone. Any ngTheme_favStarIcons / ngTheme_trendArrowIcons /
           ngTheme_actionIcons user variable left over from an older install is
           simply ignored. */

        /* Clear the stylesheets an older version of the theme may have left
           behind, so a user who last saved with one of those switches off is
           not stuck with icons hidden by a setting that no longer exists. */
        ['dz-ng-favicon-style', 'dz-ng-trendicon-style', 'dz-ng-actionicon-style']
            .forEach(function (id) {
                var el = document.getElementById(id);
                if (el) el.remove();
            });

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


        // Card style + density
        // The stylesheet ships the "compact" step as its own defaults, so
        // only a non-default density needs writing; clearing the properties
        // hands the choice back to the CSS instead of freezing it here.
        var NGC_DENSITY = {
            comfortable: {
                '--ngc-rail': '44px', '--ngc-rail-btn': '40px',
                '--ngc-pad': '12px',  '--ngc-gap': '11px',
                '--ngc-row-gap': '2px',
                '--ngc-name-size': '0.82rem',
                '--ngc-value-size': '1.05rem',
                '--ngc-meta-size': '0.68rem',
                '--ngc-icon-size': '1.15rem'
            },
            compact: null,   /* the stylesheet's own :root values */
            ultra: {
                '--ngc-rail': '32px', '--ngc-rail-btn': '28px',
                '--ngc-pad': '7px',   '--ngc-gap': '7px',
                '--ngc-row-gap': '0px',
                '--ngc-name-size': '0.74rem',
                '--ngc-value-size': '0.92rem',
                '--ngc-meta-size': '0.64rem',
                '--ngc-icon-size': '0.95rem'
            }
        };

        document.body.classList.toggle('ng-cards-ng',
                                       _settings.cardStyle === 'nightglass');

        var density = NGC_DENSITY[_settings.cardDensity] !== undefined
            ? NGC_DENSITY[_settings.cardDensity]
            : NGC_DENSITY.compact;
        Object.keys(NGC_DENSITY.comfortable).forEach(function (prop) {
            if (density && density[prop]) {
                root.style.setProperty(prop, density[prop]);
            } else {
                root.style.removeProperty(prop);
            }
        });

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

        // Hand libraries the theme used to host over to Domoticz's own icon
        // library registry, which manages them from now on. Runs once, and only
        // when there is something to move.
        if (typeof window.dzMigrateIconLibraries === 'function') {
            window.dzMigrateIconLibraries();
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
            '<button type="button" class="ng-reset-btn" id="ngResetBtn" title="Reset all settings to defaults">' +
            '<i class="fa-solid fa-rotate-left"></i> Reset</button></div>' +

            '<div class="ng-presets-section" id="ngPresetsSection">' +
            '<button class="ng-presets-toggle' + (opts.presetsOpen ? ' ng-presets-toggle--open' : '') + '" id="ngPresetsToggle" type="button">' +
            '<div class="ng-presets-toggle-left"><i class="fa-solid fa-swatchbook"></i> Theme Presets</div>' +
            '<i class="fa-solid fa-chevron-down ng-presets-chevron"></i>' +
            '</button>' +
            '<div class="ng-presets-body" id="ngPresetsBody"' + (opts.presetsOpen ? '' : ' style="display:none;"') + '>' +
            '<div class="ng-presets-grid" id="ngPresetsGrid">' +
            '<div class="ng-preset-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading presets…</div>' +
            '</div>' +
            '<div class="ng-presets-save-row">' +
            '<button class="ng-save-preset-btn" id="ngSavePresetBtn" type="button">' +
            '<i class="fa-solid fa-plus"></i> Save current colors as preset</button>' +
            '</div>' +
            '</div></div>' +

            '<div class="ng-settings-grid">' +

            /* Left column: Icons, Appearance, Effects */

            /* Favourite stars, trend arrows and table action icons used to have
               toggles here. Domoticz now renders all three as Font Awesome
               itself (dzIconService's CHROME_ICONS, and <i class="fa-* fa-star">
               in the widget templates), so there is no PNG left for the theme to
               replace and nothing for a switch to switch. The two that remain
               still decide real behaviour: the navbar is still PNG in
               index.html, and Device Icons governs whether Nightglass decorates
               Domoticz's native glyphs at all. */
            '<div class="ng-settings-section">' +
            '<div class="ng-section-header"><i class="fa-solid fa-icons"></i> Icons</div>' +
            toggle('navbarIcons', 'Navbar Menu Icons', 'Replace PNG menu icons with Font Awesome in the navigation bar') +
            toggle('deviceIcons', 'Device Icons', 'Let Nightglass colour and size device icons; off leaves Domoticz\'s own') +
            toggle('animateDeviceIcons', 'Animate Device Icons', 'Play the animation each device was given in the Icon Studio — spin, glow, flicker and six more') +
            '</div>' +

            '<div class="ng-settings-section">' +
            '<div class="ng-section-header"><i class="fa-solid fa-swatchbook"></i> Appearance</div>' +
            select('themeMode', 'Theme Mode', [
                { value: 'toggle', label: '🔀 Manual toggle' },
                { value: 'auto', label: '🖥️ Auto (follow system)' },
                { value: 'dark', label: '🌙 Always dark' },
                { value: 'light', label: '☀️ Always light' }
            ], 'Manual shows a navbar button to switch; Auto follows your OS preference') +
            slider('fontSize', 'Base Font Size', 80, 125, 5, '%', 'Scale the entire interface') +
            slider('iconSize', 'Device Icon Size', 60, 150, 5, '%', 'Scale device icons on cards') +
            toggle('showLastUpdate', 'Show Last Update', 'Show the formatted timestamp footer on device cards') +
            toggle('uppercaseNames', 'Uppercase Device Names', 'Force device names to UPPERCASE on cards') +
            select('cardStyle', 'Card Style', [
                { value: 'classic',    label: '▤ Classic' },
                { value: 'nightglass', label: '▨ Nightglass' }
            ], 'Nightglass is the compact icon-rail card; Classic keeps the original layout') +
            select('cardDensity', 'Card Density', [
                { value: 'comfortable', label: 'Comfortable' },
                { value: 'compact',     label: 'Compact' },
                { value: 'ultra',       label: 'Ultra' }
            ], 'How tall Nightglass cards are — no effect on the Classic style') +

            '</div>' +

            '<div class="ng-settings-section">' +
            '<div class="ng-section-header"><i class="fa-solid fa-wand-magic-sparkles"></i> Effects &amp; Animations</div>' +
            toggle('cardTilt', '3D Card Tilt', 'Subtle perspective tilt on hover') +
            toggle('sparklines', 'Sparkline Charts', 'Mini 24h trend charts as card watermarks') +
            toggle('stalenessIndicator', 'Staleness Dot', 'Pulsing red dot on devices that haven\'t updated in 24h') +
            toggle('stateFlash', 'State-Change Flash', 'Blue/red ring flash when a device changes state') +
            toggle('tempAccent', 'Sensor Value Accent', 'Color-coded top border reflecting the sensor value — temperature, humidity, CO₂, UV, rain, wind & visibility') +
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
            '  <button type="button" class="ng-action-chip" id="ng-bl-manage-btn">' +
            '    <i class="fa-solid fa-filter-circle-xmark"></i> Manage</button>' +
            '</div>' +
            '</div>' +

            /* No count here. The number of entries in the theme's blob is not
               the number of devices with a custom icon — on a Domoticz that
               owns the icon, the blob holds only colour and animation — so a
               badge would invite exactly the wrong reading. The dialog's own
               footer counts what is actually customised. */
            '<div class="ng-settings-section">' +
            '<div class="ng-section-header"><i class="fa-solid fa-icons"></i> Device Icons</div>' +
            '<div class="ng-setting-row ng-setting-row--action">' +
            '  <div class="ng-setting-info">' +
            '    <span class="ng-setting-label">Per-Device Icons</span>' +
            '    <span class="ng-setting-desc">Pick an icon for a device, then give it on/off colors and an animation</span>' +
            '  </div>' +
            '  <button type="button" class="ng-action-chip" id="ng-override-manage-btn">' +
            '    <i class="fa-solid fa-wand-magic-sparkles"></i> Manage</button>' +
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

            '<div class="ng-settings-section ng-settings-section--full">' +
            '<div class="ng-section-header"><i class="fa-solid fa-bug"></i> Developer</div>' +
            toggle('debugLogs', 'Debug Logging', 'Print verbose trace logs to the browser console for all theme modules (session only — resets on hard refresh)') +
            '</div>' +

            '</div>' + /* grid end */

            '<div class="ng-settings-footer">' +
            '<div class="ng-footer-actions">' +
            '<button type="button" class="ng-export-btn" id="ngExportBtn" title="Export settings as JSON file">' +
            '<i class="fa-solid fa-file-export"></i> Export</button>' +
            '<button type="button" class="ng-import-btn" id="ngImportBtn" title="Import settings from JSON file">' +
            '<i class="fa-solid fa-file-import"></i> Import</button>' +
            '<input type="file" id="ngImportFile" accept=".json" style="display:none">' +
            (_useNewApi
                ? '<button type="button" class="ng-save-btn" id="ngSaveBtn" title="Save settings to the Domoticz database">' +
                  '<i class="fa-solid fa-floppy-disk"></i> Save to Domoticz</button>' +
                  '<button type="button" class="ng-reset-all-btn" id="ngResetAllBtn" ' +
                  'title="Remove all Nightglass settings from the Domoticz database and revert to instance defaults">' +
                  '<i class="fa-solid fa-trash-can"></i> Reset server</button>'
                : '') +
            '</div>' +
            '<span class="ng-footer-note"><i class="fa-solid fa-cloud-arrow-up"></i> ' +
            (!_apiAvailable
                ? 'API unavailable \u2014 settings are stored in this browser\'s local storage.'
                : _useNewApi
                    ? 'Changes apply instantly. Click <strong>Save to Domoticz</strong> (or Domoticz’s <strong>Apply Settings</strong>) to persist across all browsers.' +
                      (!_perUser ? ' <strong>\u26a0\ufe0f Shared:</strong> trusted-network session — all clients share this config (log in for per-user).' : '')
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

    var COLOR_SNAPSHOT_KEYS = [
        'accentColor', 'dangerColor', 'warningColor', 'successColor',
        'accentColorLight', 'dangerColorLight', 'warningColorLight', 'successColorLight',
        'bgColor', 'surfaceColor', 'borderColor', 'textColor',
        'bgColorLight', 'surfaceColorLight', 'borderColorLight', 'textColorLight',
        'pageBgColor', 'pageBgColorLight'
    ];

    function loadUserPresets() {
        if (!_settings) return [];
        try { return JSON.parse(_settings.userPresets || '[]') || []; } catch (e) { return []; }
    }

    function saveUserPresets(arr) {
        saveSetting('userPresets', JSON.stringify(arr));
    }

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

    function presetCardHtml(p, idx, isUser) {
        var pv = p.preview || {};
        var bg = pv.bg || '#1b1d25';
        var sf = pv.surface || '#23252f';
        var ac = pv.accent || '#4e9af1';
        var tx = pv.text || '#e2e4ed';
        var icon = p.icon || 'fa-solid fa-palette';
        var attr = isUser
            ? 'data-ng-user-preset-idx="' + idx + '"'
            : 'data-ng-preset-idx="' + idx + '"';

        return '<button class="ng-preset-card" ' + attr + ' title="' + (p.description || p.name) + '">' +
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

    function renderPresets(grid, presets) {
        var userPresets = loadUserPresets();
        var hasBuiltin = presets && presets.length;

        if (!hasBuiltin && !userPresets.length) {
            grid.innerHTML = '<div class="ng-preset-loading">No presets found</div>';
            return;
        }

        var html = '';

        if (hasBuiltin) {
            for (var i = 0; i < presets.length; i++) {
                html += presetCardHtml(presets[i], i, false);
            }
        }

        if (userPresets.length) {
            html += '<span class="ng-user-presets-label"><i class="fa-solid fa-bookmark"></i> My Presets</span>';
            for (var j = 0; j < userPresets.length; j++) {
                html += '<div class="ng-preset-card-wrap">' +
                    presetCardHtml(userPresets[j], j, true) +
                    '<button class="ng-preset-delete-btn" data-ng-user-idx="' + j + '" title="Delete preset">' +
                    '<i class="fa-solid fa-xmark"></i></button>' +
                    '</div>';
            }
        }

        grid.innerHTML = html;

        grid.querySelectorAll('.ng-preset-card[data-ng-preset-idx]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = parseInt(this.getAttribute('data-ng-preset-idx'), 10);
                applyPreset(presets[idx]);
                grid.querySelectorAll('.ng-preset-card').forEach(function (b) {
                    b.classList.remove('ng-preset-card--active');
                });
                this.classList.add('ng-preset-card--active');
            });
        });

        grid.querySelectorAll('.ng-preset-card[data-ng-user-preset-idx]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = parseInt(this.getAttribute('data-ng-user-preset-idx'), 10);
                applyPreset(userPresets[idx]);
                grid.querySelectorAll('.ng-preset-card').forEach(function (b) {
                    b.classList.remove('ng-preset-card--active');
                });
                this.classList.add('ng-preset-card--active');
            });
        });

        grid.querySelectorAll('.ng-preset-delete-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var idx = parseInt(this.getAttribute('data-ng-user-idx'), 10);
                if (!confirm('Delete preset "' + userPresets[idx].name + '"?')) return;
                var arr = loadUserPresets();
                arr.splice(idx, 1);
                saveUserPresets(arr);
                renderPresets(grid, presets);
            });
        });
    }

    // Keys that represent personal user data.
    // Presets may never overwrite these — they belong to the user, not to a theme.
    var PRESET_PROTECTED_KEYS = {
        deviceIconOverrides: true,
        toastBlacklist:      true,
        userPresets:         true
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
        window.ngLog('[Settings]', 'panel injected into settings page');

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

    /* Mirror the pre-migration unified save: Domoticz's own "Apply Settings"
       button (a.sub-tabs-apply, ng-click="StoreSettings()") now saves only core
       settings, because PR #6950 removed theme settings from the storesettings
       path.  So when the user clicks it with unsaved Nightglass changes, also
       persist those through the new per-user API — either save button then
       stores the theme settings, as it did before the migration.

       Uses a single document-level delegated listener (capture phase) so it
       keeps working across Angular's re-renders of the settings view without
       re-binding, and is installed only once. */
    var _nativeSaveHooked = false;
    function hookNativeSaveButton() {
        if (_nativeSaveHooked) return;
        _nativeSaveHooked = true;
        document.addEventListener('click', function (e) {
            var applyBtn = e.target && e.target.closest && e.target.closest('a.sub-tabs-apply');
            if (!applyBtn) return;
            // Only the new API has a separate write path to keep in sync; the
            // legacy user-variable path already persists on every change.
            if (_useNewApi && _apiAvailable && _dirty) {
                _postThemeSettings(); // no button arg — quiet save alongside StoreSettings()
            }
        }, true);
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

    /* ── Device Icons Dialog ──────────────────────────────────────────
       One row per device, and per device two stores behind it:

         • the SHAPE is Domoticz's, in the DeviceStatus.Icon column, on a
           build that has one — the server renders it, so the choice outlives
           the theme. Written here through dzDeviceIconStore (device-detail.js),
           the same contract the device page's icon field uses. On a build
           without the column the shape falls back to the theme blob, which is
           where it has always lived.
         • COLOUR and ANIMATION are the theme's, in deviceIconOverrides.
           Domoticz validates the Icon column to {"t","on","off"} and has no
           field for either, so they cannot go on the device.

       The storage key is still called deviceIconOverrides: renaming it would
       orphan every existing user's settings. Only the wording moved on. */

    /* Classify a device into an icon/color model for the editor.
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

    function openDeviceIconOverrideDialog(presetIdx) {
        /* Only accept a real device IDX. Guards against a click handler passing
           its Event object as the argument (would prefill "[object …]") — #225. */
        presetIdx = (presetIdx != null && /^\d+$/.test(String(presetIdx)))
            ? String(presetIdx) : null;
        var existing = document.getElementById('ng-ov-overlay');
        if (existing) existing.remove();

        // Parse the theme's stored colour / animation entries
        var currentOv = {};
        try {
            var raw = (window.dzNightglassSettings && window.dzNightglassSettings.get('deviceIconOverrides')) || '{}';
            currentOv = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
        } catch (e) {}

        /* Where a shape gets stored. Resolved before the rows render, because
           it decides both what a row's icon control writes and what the row's
           starting icon is. */
        var iconStore    = window.dzDeviceIconStore || null;
        var nativeShapes = false;

        /* Icon edits staged for Domoticz's own storage, keyed by idx:
           { on, off } for a glyph pair, { image: n } for an uploaded PNG, or
           null to clear. Staged rather than written on the spot so the dialog
           stays one transaction — Save flushes these with the theme blob,
           Cancel drops both. The shape of an entry is dzDeviceIconStore.write's
           `spec`, so Save hands them over untranslated. */
        var pendingNative = {};

        /* Uploaded icons, resolved to the value CustomImage stores. Only needed
           where Domoticz can hold one; null until fetched, [] if unavailable. */
        var customIcons = null;

        function imageInfo(ci) {
            ci = parseInt(ci, 10) || 0;
            if (!ci || !customIcons) return null;
            for (var i = 0; i < customIcons.length; i++) {
                if (customIcons[i].value === ci) return customIcons[i];
            }
            return null;
        }

        // Popular quick-icon suggestions
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


        // Mutable copy of the theme entries — copy every stored field so the
        // row editors reflect the saved state when the dialog reopens.
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
                anim:      s.anim,
                name:      s.name || ''
            };
        });

        var overlay = document.createElement('div');
        overlay.id = 'ng-ov-overlay';
        overlay.className = 'ng-bl-overlay';
        overlay.innerHTML =
            '<div class="ng-bl-dialog ng-ov-dialog" role="dialog" aria-label="Device Icons">' +
            '  <div class="ng-bl-header">' +
            '    <div class="ng-bl-title">' +
            '      <i class="fa-solid fa-icons"></i>' +
            '      <span>Device Icons</span>' +
            '    </div>' +
            '    <button class="ng-bl-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
            '  </div>' +
            '  <div class="ng-ov-body">' +
            '    <div class="ng-ov-main">' +
            '      <div class="ng-ov-store-note" id="ng-ov-store-note"></div>' +
            '      <div class="ng-ov-popular">' +
            '        <div class="ng-ov-popular-label"><i class="fa-solid fa-wand-magic-sparkles"></i> Quick Presets — click one, then click a device</div>' +
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
            '  </div>' +
            '  <div class="ng-bl-footer">' +
            '    <span class="ng-bl-count" id="ng-ov-count"></span>' +
            '    <div class="ng-bl-footer-btns">' +
            '      <button class="ng-bl-btn ng-bl-btn--cancel">Cancel</button>' +
            '      <button class="ng-bl-btn ng-bl-btn--save">Save</button>' +
            '    </div>' +
            '  </div>' +
            '</div>';

        document.body.appendChild(overlay);
        requestAnimationFrame(function () { overlay.classList.add('ng-bl-overlay--open'); });

        var listEl   = overlay.querySelector('#ng-ov-list');
        var searchEl = overlay.querySelector('#ng-ov-search');
        var countEl  = overlay.querySelector('#ng-ov-count');
        var chipsEl  = overlay.querySelector('#ng-ov-chips');
        var noteEl   = overlay.querySelector('#ng-ov-store-note');

        function close() {
            overlay.classList.remove('ng-bl-overlay--open');
            setTimeout(function () { overlay.remove(); }, 260);
        }

        /* getdevices records by idx. Both the marker painter (which needs the
           Icon column) and the shape writer (which needs Protected) read it,
           and it is the same record the rows were built from. */
        var devByIdx = {};

        /* The shape in effect for a device — null when it is still on the icon
           its type gives it. Native first: where Domoticz has the Icon column
           it renders that shape itself, so it is what is actually on screen. A
           shape in the theme blob is the fallback — the only store on a build
           without the column, and still what the theme's PNG replacement draws
           for a device Domoticz has no icon for. Same precedence as the device
           page's icon field. Which of the two it came from is deliberately not
           reported: nothing on the row distinguishes them. */
        function shapeOf(idxStr) {
            if (nativeShapes) {
                var staged = pendingNative.hasOwnProperty(idxStr);
                var s = staged ? pendingNative[idxStr]
                               : parseNativeDeviceIcon((devByIdx[idxStr] || {}).Icon);
                if (s && s.on) return { on: s.on, off: s.off || '' };
                /* An uploaded PNG is the other half of the same native storage,
                   so it counts as a shape here even though it has no class. */
                var ci = staged ? (s && s.image)
                                : (devByIdx[idxStr] || {}).CustomImage;
                ci = parseInt(ci, 10) || 0;
                if (ci >= 100) return { image: ci };
                /* A staged entry is the whole truth for this device: an explicit
                   clear must not fall through to the blob's legacy shape. */
                if (staged) return null;
            }
            var ov  = pending[idxStr];
            var cls = ov && (ov.iconOn || ov.iconOpen || ov.icon);
            if (cls) return { on: cls, off: (ov.iconOff || '') };
            return null;
        }

        /* Whether clearing a device would have anything to erase on the device
           itself — an icon, or an uploaded image the icon would have replaced. */
        function deviceCarriesIcon(idxStr) {
            var rec = devByIdx[idxStr] || {};
            return !!parseNativeDeviceIcon(rec.Icon) ||
                   (parseInt(rec.CustomImage, 10) || 0) > 0;
        }

        /* One list, no shadow list: a device carrying customisation is marked on
           its own row instead of being duplicated into a sidebar, so there is
           one place to look and one place to edit.

           The marks show the theme styling — the two colours and the animation.
           Deliberately nothing about WHICH store holds the icon: on the builds
           this targets the icon is always the device's, so a chip saying so
           would read identically on every row and earn none of its width. The
           line above the list says it once instead. */
        function paintRowMarks(row) {
            var idxStr = String(row.dataset.idx || '');
            var marks  = row.querySelector('.ng-ov-row-marks');
            if (!marks) return;
            var ov    = pending[idxStr] || null;
            var shape = shapeOf(idxStr);
            var html  = '';

            if (ov && (ov.on || ov.off)) {
                var on  = ov.on  || '#4e9af1';
                var off = ov.off || '#555770';
                html += '<span class="ng-ov-mark-dots" title="Nightglass colours — on ' +
                        on + ', off ' + off + '">' +
                        '<span class="ng-ov-mark-dot" style="background:' + on  + '"></span>' +
                        '<span class="ng-ov-mark-dot" style="background:' + off + '"></span>' +
                        '</span>';
            }
            var animName = ov ? animLabel(ov.anim) : '';
            if (animName) {
                html += '<span class="ng-ov-mark ng-ov-mark--anim" title="' + animName +
                        ' animation — Nightglass styling">' +
                        '<i class="fa-solid fa-wand-magic-sparkles"></i>' + animName + '</span>';
            }

            marks.innerHTML = html;
            /* Highlight on anything customised, including an icon with no theme
               styling beside it — the marks can be empty while the row is still
               not on its defaults. */
            row.classList.toggle('ng-ov-row--active', !!(shape || ov));
        }

        /* Counts marked rows, i.e. both stores — the footer is about what the
           user will see on their cards, not about one blob's size. */
        function updateCount() {
            if (!countEl) return;
            var keys = Object.keys(devByIdx);
            var n = 0;
            for (var i = 0; i < keys.length; i++) {
                if (pending[keys[i]] || shapeOf(keys[i])) n++;
            }
            countEl.textContent = n === 0
                ? 'No devices customised'
                : n + ' of ' + keys.length + ' devices customised';
        }

        /* One short line about the split, and only where it is true: on a build
           whose devices hold their own icon, the shape the user picks here is
           not the theme's and will not leave with it. */
        function paintStoreNote() {
            if (!noteEl) return;
            noteEl.innerHTML = nativeShapes
                ? '<i class="fa-solid fa-circle-info"></i> The icon is saved on the ' +
                  'device and stays if you switch themes. Colour and animation are ' +
                  'Nightglass styling and only apply here.'
                : '<i class="fa-solid fa-circle-info"></i> This Domoticz cannot store ' +
                  'an icon per device, so the icon, colour and animation are all ' +
                  'Nightglass styling and only apply here.';
        }

        function filterList(q) {
            q = (q || '').toLowerCase();
            listEl.querySelectorAll('.ng-ov-row').forEach(function (r) {
                r.style.display = (!q || (r.dataset.name || '').toLowerCase().indexOf(q) !== -1) ? '' : 'none';
            });
        }

        /* Icon picker → opens the full Icon Studio overlay (icon-studio.js).
           Shows the current icon + a Change button; calls onSelect(cls) on
           pick. The heavy lifting (all-FA enumeration, custom libraries,
           search, categories, Recent, manual class) lives in the Studio. */
        /* The glyph is the last whitespace token ("ph ph-acorn" → "acorn");
           anything before it is a style or base class. Mirrors labelOf() in
           icon-studio.js, which produces the classes shown here. */
        function pickerLabel(cls) {
            var token = String(cls || '').trim().split(/\s+/).pop() || '';
            return token.replace(/^[a-z0-9]+-/i, '').replace(/-/g, ' ').trim() || 'No icon';
        }

        /* Display name of an animation id, from icons.js's catalogue. */
        function animLabel(id) {
            var list = window.dzIconAnimations || [];
            for (var i = 0; i < list.length; i++) {
                if (list[i].id === id) return list[i].label;
            }
            return '';
        }

        /* `anim` is optional: { get, set }. Passing it hands the Studio the
           animation row as well, so it is given to the picker that edits the
           device's primary (on / open) icon and to no other — an animation
           belongs to the device, not to one of its icon slots.

           `img` is optional too: { get, set }, the device's CustomImage. Passing
           it opens the Studio's Custom source, which is only worth offering
           where an uploaded PNG has somewhere to go — Domoticz's CustomImage
           column. It rides on the same picker as the glyph because to the user
           they are one choice: what this device looks like. */
        function buildIconPicker(initialCls, onSelect, anim, img) {
            var wrap = document.createElement('div');
            wrap.className = 'ng-ov-picker';

            var current = initialCls;

            var row = document.createElement('div');
            row.className = 'ng-ov-picker-current';

            /* Two previews, one shown at a time: a class cannot render a PNG
               and an <img> cannot carry an icon font. */
            var prev = document.createElement('i');
            var prevImg = document.createElement('img');
            prevImg.className = 'ng-ov-picker-img';
            prevImg.alt = '';
            row.appendChild(prev);
            row.appendChild(prevImg);

            var lbl = document.createElement('span');
            lbl.className = 'ng-ov-picker-label';
            row.appendChild(lbl);

            /* Draws whichever of the two the device is actually carrying. */
            function paintCurrent() {
                var info = img ? imageInfo(img.get()) : null;
                if (info) {
                    prev.style.display = 'none';
                    prevImg.style.display = '';
                    prevImg.src = info.src;
                    lbl.textContent = info.name;
                    return;
                }
                prevImg.style.display = 'none';
                prev.style.display = '';
                prev.className = current || 'fa-solid fa-question';
                lbl.textContent = pickerLabel(current);
            }
            paintCurrent();

            /* Says what is set without having to open the Studio; empty
               collapses out of the layout (CSS :empty). */
            var animChip = null;
            if (anim) {
                animChip = document.createElement('span');
                animChip.className = 'ng-ov-picker-anim';
                row.appendChild(animChip);
            }
            function paintAnim() {
                if (!animChip) return;
                var label = animLabel(anim.get());
                animChip.innerHTML = label
                    ? '<i class="fa-solid fa-wand-magic-sparkles"></i>' + label : '';
            }
            /* Lets the row's Remove button clear the chip this drew. */
            if (anim) anim.repaint = paintAnim;
            paintAnim();

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ng-ov-picker-change';
            btn.innerHTML = '<i class="fa-solid fa-icons"></i> ' +
                            (anim ? 'Change icon or animation…' : 'Change icon…');
            btn.addEventListener('click', function () {
                if (typeof window.dzOpenIconStudio !== 'function') return;
                window.dzOpenIconStudio({
                    current: current,
                    title: anim ? 'Choose an icon and animation' : 'Choose an icon',
                    animation: anim ? anim.get() : '',
                    /* Preview the animations on the icon this row is editing,
                       not on the Studio's own placeholder. */
                    animationGlyph: current,
                    allowImages: !!img,
                    currentImage: img ? img.get() : 0,
                    onPick: function (cls) {
                        current = cls;
                        /* A glyph replaces an image, so drop the image first or
                           paintCurrent would keep drawing the old PNG. */
                        if (img) img.set(0);
                        paintCurrent();
                        onSelect(cls);
                    },
                    onPickImage: img ? function (customImage) {
                        /* Already the value CustomImage stores — the Studio put
                           back the 100 that getcustomiconset takes off. */
                        img.set(customImage);
                        paintCurrent();
                    } : undefined,
                    onPickAnimation: anim ? function (id) {
                        anim.set(id);
                        paintAnim();
                    } : undefined
                });
            });
            row.appendChild(btn);

            wrap.appendChild(row);
            return wrap;
        }

        /* Render one device row with its inline editor */
        function renderRow(d) {
            var idxStr = String(d.idx);
            var ov     = pending[idxStr];
            var model  = getDeviceColorModel(d);

            /* ── The device type's own icon, from the replacement module ─────
               Kept intact as `theme*`: it is what "Use default" returns to,
               and folding a chosen shape over it would leave nothing to reset
               back down to. */
            var dzIcon     = typeof window._dzIconForDevice === 'function' ? window._dzIconForDevice : null;
            /* An uploaded image (>= 100) is not a device type — it is artwork —
               so it must not decide what "the type's own icon" resolves to, or
               a device carrying one reports a question mark as its default and
               shows that the moment it is cleared. Image goes with CustomImage:
               the server derives one from the other, so for an upload it holds
               the artwork's name, which is not a DEVICE_MAP key either.
               Built-in images (1..99) do carry type meaning and stay. */
            var defSrc     = ((parseInt(d.CustomImage, 10) || 0) >= 100)
                ? Object.assign({}, d, { CustomImage: 0, Image: '' }) : d;
            var defSpecOn  = dzIcon ? dzIcon(defSrc) : null;
            var themeIconOn  = (defSpecOn && defSpecOn.icon)  || 'fa-solid fa-circle-question';
            var defColorOn   = (defSpecOn && defSpecOn.color) || '#4e9af1';
            var defColorOff  = '#555770';
            var themeIconOpen  = themeIconOn;
            var themeIconClose = themeIconOn;

            if (model === 'blinds-2' || model === 'blinds-3') {
                var sOp = dzIcon ? dzIcon({ TypeImg: (d.TypeImg || '') + 'open', Status: 'On'  }) : null;
                var sCl = dzIcon ? dzIcon({ TypeImg:  d.TypeImg  || 'blinds',   Status: 'Off' }) : null;
                themeIconOpen  = (sOp && sOp.icon)  || 'fa-solid fa-chevron-up';
                themeIconClose = (sCl && sCl.icon)  || 'fa-solid fa-chevron-down';
                defColorOn     = (sOp && sOp.color) || defColorOn;
            }

            /* ── Starting values ────────────────────────────────────────────
               Shape from whichever store owns it (shapeOf), colour, animation
               and the Stop icon always from the theme entry. */
            var shape = shapeOf(idxStr);
            var curIconOn    = shape ? shape.on                : themeIconOn;
            var curIconOff   = shape ? (shape.off || shape.on) : themeIconOn;
            var curIconOpen  = shape ? shape.on                : themeIconOpen;
            var curIconClose = shape ? (shape.off || shape.on) : themeIconClose;
            /* An uploaded PNG carries no class, so the glyph slots stay on the
               type default: open the glyph picker on a device showing an image
               and it starts where the device would fall back to. */
            if (shape && shape.image) {
                curIconOn = themeIconOn;         curIconOff   = themeIconOn;
                curIconOpen = themeIconOpen;     curIconClose = themeIconClose;
            }
            var curIconStop  = (ov && ov.iconStop) || 'fa-solid fa-stop';
            var curOn        = (ov && ov.on)  || defColorOn;
            var curOff       = (ov && ov.off) || defColorOff;
            var keepColor    = ov ? !!(ov.keepColor) : (model === 'sensor');
            /* Read off the entry rather than off a shape: colour and animation
               are stored on their own and need no icon to exist. */
            var curAnim      = (ov && ov.anim) || '';

            /* Marked = the device carries something, from either store. Drives
               the row's highlight, the edit button and the dimmed preview. */
            var hasOv = !!(shape || ov);

            /* ── Row element ──────────────────────────────────────────────── */
            var row = document.createElement('div');
            row.className        = 'ng-ov-row' + (hasOv ? ' ng-ov-row--active' : '');
            row.dataset.idx      = idxStr;
            row.dataset.name     = d.Name || '';

            /* ── Summary line ─────────────────────────────────────────────── */
            var summary = document.createElement('div');
            summary.className = 'ng-ov-row-summary';
            var isBlinds = (model === 'blinds-2' || model === 'blinds-3');

            /* An uploaded PNG replaces the whole icon — there is no per-state
               half of it — so it shows as one image even on a multi-icon row. */
            var imgShape = shape && shape.image ? imageInfo(shape.image) : null;
            var iconHtml =
                (shape && shape.image)
                ? '<span class="ng-ov-row-icon">' +
                  '<img class="ng-ov-row-img" alt="" src="' +
                  ((imgShape && imgShape.src) || '') + '">' +
                  '</span>'
                : isBlinds
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
                /* Filled by paintRowMarks — the theme styling this device carries. */
                '<span class="ng-ov-row-marks"></span>' +
                /* Always "edit", never "add": every device already shows an
                   icon, its type default if nothing else, so there is no state
                   in which the user is creating one rather than changing it. */
                '<button class="ng-ov-edit-btn" type="button" title="Edit this device’s icon">' +
                '  <i class="fa-solid fa-pen-to-square"></i>' +
                '</button>';
            row.appendChild(summary);
            paintRowMarks(row);

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

                /* Recently used colours — the same strip the settings panel,
                   the device colour popup and the bar-range dialog feed. */
                if (window.ngColors) {
                    popover.appendChild(window.ngColors.buildRow({
                        onPick: function (hex) {
                            hsv = hexToHsv(hex);
                            updateFromHsv();
                            window.ngColors.remember(hex);
                        }
                    }));
                }

                pickerWrap.appendChild(swatch);
                pickerWrap.appendChild(hexInput);
                pickerWrap.appendChild(popover);
                wrap.appendChild(pickerWrap);

                var hsv = hexToHsv(initialColor);
                drawSV(svCanvas, hsv.h);
                drawHueBar(hueCanvas);

                function rememberCurrent() {
                    if (window.ngColors) window.ngColors.remember(hexInput.value);
                }

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
                        if (p !== popover) closeAllPopovers(p.parentNode);
                    });
                }

                swatch.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var open = popover.style.display === 'block';
                    closeOtherPopovers();
                    if (open) {
                        closeAllPopovers(pickerWrap);
                    } else {
                        popover.style.display = 'block';
                        var rect = swatch.getBoundingClientRect();
                        var popW = 260;
                        var left = rect.right - popW;
                        var top  = rect.bottom + 8;
                        /* Measured, not assumed: the recent-colour strip only
                           appears once something has been picked. */
                        var popH = popover.offsetHeight || 300;
                        if (left < 8) left = 8;
                        if (top + popH + 8 > window.innerHeight) top = Math.max(8, rect.top - popH - 8);
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
                svCanvas.addEventListener('pointerup',   function ()  {
                    if (svDragging) { svDragging = false; rememberCurrent(); }
                });

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
                hueCanvas.addEventListener('pointerup',   function ()  {
                    if (hueDragging) { hueDragging = false; rememberCurrent(); }
                });

                hexInput.addEventListener('input', function () {
                    var v = this.value.trim();
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) { hsv = hexToHsv(v); updateFromHsv(); }
                });
                hexInput.addEventListener('blur', function () {
                    if (!/^#[0-9a-fA-F]{6}$/.test(this.value)) {
                        this.value = hsvToHex(hsv.h, hsv.s, hsv.v);
                    } else {
                        rememberCurrent();
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
                        rememberCurrent();
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

            /* Labeled wrapper around an icon picker grid. `anim` is passed
               through to buildIconPicker — see there for why only one
               section per row gets it. */
            function makePickerSection(labelText, noteText, initialCls, onSelectFn, anim) {
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
                /* `img` rides along with `anim`: both belong to the device as a
                   whole rather than to one slot, so they go to the same single
                   picker section — the one editing the primary icon. */
                wrap.appendChild(buildIconPicker(initialCls, onSelectFn, anim,
                                                 anim ? imgAccess : null));
                return wrap;
            }

            /* The row's animation accessor, handed to exactly one picker
               section below.  Setting it commits, so the choice sticks the
               moment it is made in the Studio — same as a colour. */
            var animAccess = {
                get: function () { return curAnim; },
                set: function (id) { curAnim = id; commitOverride(); },
                repaint: function () {}      // replaced by buildIconPicker
            };

            /* The device's uploaded PNG, or 0. Only offered where Domoticz can
               store one; the theme blob holds classes, so on a build without
               the CustomImage destination there is nowhere to put an image and
               the Studio's Custom source stays hidden rather than dead. */
            var imgAccess = !nativeShapes ? null : {
                get: function () {
                    var s = shapeOf(idxStr);
                    return (s && s.image) || 0;
                },
                set: function (ci) {
                    ci = parseInt(ci, 10) || 0;
                    if (ci >= 100) pendingNative[idxStr] = { image: ci };
                    else if (pendingNative[idxStr] && pendingNative[idxStr].image) {
                        /* Cleared by a glyph pick, which stages itself next. */
                        delete pendingNative[idxStr];
                    }
                    repaintRowIcon();
                    paintRowMarks(row);
                    updateCount();
                }
            };

            /* Redraw the row's leading icon from whatever the device now carries.
               A glyph and a PNG are different elements, and an image is
               whole-icon even on a two-icon row, so this rebuilds the slot
               rather than patching whatever happens to be in it. Only when the
               kind changed — repainting an unchanged glyph would restart any
               CSS animation on it. */
            function repaintRowIcon() {
                var slot = summary.querySelector('.ng-ov-row-icon');
                if (!slot) return;
                var s     = shapeOf(idxStr);
                var info  = s && s.image ? imageInfo(s.image) : null;
                var hadImg = !!slot.querySelector('img');
                if (info) {
                    if (hadImg && slot.querySelector('img').src.indexOf(info.src) !== -1) return;
                    slot.classList.remove('ng-ov-row-icon--multi');
                    slot.innerHTML = '<img class="ng-ov-row-img" alt="" src="' + info.src + '">';
                    return;
                }
                if (!hadImg) return;
                if (isBlinds) {
                    slot.classList.add('ng-ov-row-icon--multi');
                    slot.innerHTML =
                        '<i class="' + curIconOpen  + ' ng-ov-row-fa ng-ov-row-fa--open"  style="color:' + curOn  + '"></i>' +
                        '<i class="' + curIconClose + ' ng-ov-row-fa ng-ov-row-fa--close" style="color:' + curOff + '"></i>';
                } else {
                    slot.innerHTML = '<i class="' + curIconOn + ' ng-ov-row-fa" style="color:' + curOn + '"></i>';
                }
            }

            /* Sync the summary's single primary icon */
            function updateSummaryPrimary() {
                repaintRowIcon();
                var fa = summary.querySelector('.ng-ov-row-fa');
                if (fa) { fa.className = curIconOn + ' ng-ov-row-fa'; fa.style.color = curOn; fa.style.opacity = ''; }
            }

            /* Sync the summary's blinds open + close icons */
            function updateSummaryBlinds() {
                repaintRowIcon();
                var fo = summary.querySelector('.ng-ov-row-fa--open');
                var fc = summary.querySelector('.ng-ov-row-fa--close');
                if (fo) { fo.className = curIconOpen  + ' ng-ov-row-fa ng-ov-row-fa--open';  fo.style.color = curOn;  fo.style.opacity = ''; }
                if (fc) { fc.className = curIconClose + ' ng-ov-row-fa ng-ov-row-fa--close'; fc.style.color = curOff; fc.style.opacity = ''; }
            }

            /* "Use default" clears BOTH layers, the way the device page's icon
               field does: the shape on the device (staged as an explicit clear
               so Save erases the Icon column and any uploaded image with it)
               and the theme's colour / animation entry. Peeling off one and
               leaving the other is what made the old two-store split confusing.
               `onReset` restores this model's own preview. */
            function buildResetBtn(onReset) {
                var btn = document.createElement('button');
                btn.type      = 'button';
                btn.className = 'ng-ov-remove-btn';
                btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Use default';
                btn.title     = 'Back to the icon Domoticz picks for this device type';
                btn.addEventListener('click', function () {
                    delete pending[idxStr];
                    if (nativeShapes && deviceCarriesIcon(idxStr)) {
                        pendingNative[idxStr] = null;
                    } else {
                        /* Nothing on the device to erase — drop any staged pick
                           rather than queue a write that changes nothing. */
                        delete pendingNative[idxStr];
                    }
                    editor.style.display = 'none';
                    onReset();
                    repaintRowIcon();
                    paintRowMarks(row);
                    updateCount();
                });
                return btn;
            }

            /* A shape edit goes to whichever store owns shapes on this build.
               On native that is Domoticz's Icon column — staged for Save, and
               the theme entry is left untouched, so a device that only got a
               new icon does not gain a theme entry it has no use for. */
            function stageShape() {
                if (!nativeShapes) { commitOverride(); return; }
                /* The Icon column is a single on/off pair, so the models with
                   more slots fold onto it: lock/contact map straight over,
                   blinds' Open/Close become on/off. Everything else has one
                   shape and leaves off unset — native reads `off || on`. */
                var on, off;
                if (model === 'blinds-2' || model === 'blinds-3') {
                    on = curIconOpen; off = curIconClose;
                } else if (model === 'lock' || model === 'contact') {
                    on = curIconOn;   off = curIconOff;
                } else {
                    on = curIconOn;   off = '';
                }
                pendingNative[idxStr] = { on: on, off: (off && off !== on) ? off : '' };
                /* After staging, never before: the row's icon is drawn from
                   shapeOf(), so repainting first would still see the icon this
                   pick replaces — an uploaded PNG most visibly. */
                repaintRowIcon();
                paintRowMarks(row);
                updateCount();
            }

            /* Persist the theme entry: colour, animation, keepColor — and the
               shape only where the theme is still its store. Writing a shape
               into the blob on a native build would record it twice, and the
               blob's copy is the one that never renders. */
            function commitOverride() {
                var obj = { name: d.Name || '', on: curOn, off: curOff };
                if (!nativeShapes) {
                    if (model === 'blinds-2' || model === 'blinds-3') {
                        obj.iconOpen  = curIconOpen;
                        obj.iconClose = curIconClose;
                        obj.iconOn    = curIconOpen;   /* single-icon fallback */
                        if (model === 'blinds-3') obj.iconStop = curIconStop;
                    } else if (model === 'lock' || model === 'contact') {
                        obj.iconOn  = curIconOn;
                        obj.iconOff = curIconOff;
                    } else {
                        obj.iconOn = curIconOn;
                    }
                } else if (model === 'blinds-3' && curIconStop !== 'fa-solid fa-stop') {
                    /* The one shape with nowhere native to go: an on/off pair
                       has no third state, so the Stop icon stays the theme's. */
                    obj.iconStop = curIconStop;
                }
                if (model === 'sensor') obj.keepColor = keepColor;
                if (curAnim) obj.anim = curAnim;
                pending[idxStr] = obj;
                paintRowMarks(row);
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
                        stageShape();
                    }, animAccess));
                if (model === 'blinds-3') {
                    editor.appendChild(makePickerSection('Stop button icon',
                        nativeShapes
                            /* Domoticz's icon is an on/off pair with no third
                               state, so this one cannot go on the device. */
                            ? 'Middle icon — Nightglass only, Domoticz has no third icon'
                            : 'Middle icon — click to stop movement',
                        curIconStop, function (cls) {
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
                        stageShape();
                    }));

                colorRow.appendChild(makeOvColorPicker('Open color', curOn, function (v) {
                    curOn = v; updateSlotIcon(slotOpen, curIconOpen, curOn); updateSummaryBlinds(); commitOverride();
                }));
                colorRow.appendChild(makeOvColorPicker('Close color', curOff, function (v) {
                    curOff = v; updateSlotIcon(slotClose, curIconClose, curOff); updateSummaryBlinds(); commitOverride();
                }));
                colorRow.appendChild(buildResetBtn(function () {
                    curIconOpen = themeIconOpen; curIconClose = themeIconClose;
                    curIconStop = 'fa-solid fa-stop';
                    curOn = defColorOn; curOff = defColorOff;
                    curAnim = ''; animAccess.repaint();
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
                        stageShape();
                    }, animAccess));

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
                colorRow.appendChild(buildResetBtn(function () {
                    curIconOn = themeIconOn; curOn = defColorOn; keepColor = true;
                    curAnim = ''; animAccess.repaint();
                    var fa = summary.querySelector('.ng-ov-row-fa');
                    if (fa) { fa.className = themeIconOn + ' ng-ov-row-fa'; fa.style.color = defColorOn; fa.style.opacity = '.55'; }
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
                    stageShape();
                }, animAccess));
                editor.appendChild(makePickerSection(inactiveLabel + ' icon', null, curIconOff, function (cls) {
                    curIconOff = cls;
                    updateSlotIcon(slotInactive, curIconOff, curOff);
                    stageShape();
                }));

                colorRow.appendChild(makeOvColorPicker(activeLabel + ' color', curOn, function (v) {
                    curOn = v; updateSlotIcon(slotActive, curIconOn, curOn); updateSummaryPrimary(); commitOverride();
                }));
                colorRow.appendChild(makeOvColorPicker(inactiveLabel + ' color', curOff, function (v) {
                    curOff = v; updateSlotIcon(slotInactive, curIconOff, curOff); commitOverride();
                }));
                colorRow.appendChild(buildResetBtn(function () {
                    curIconOn = themeIconOn; curIconOff = themeIconOn; curOn = defColorOn; curOff = defColorOff;
                    curAnim = ''; animAccess.repaint();
                    var fa = summary.querySelector('.ng-ov-row-fa');
                    if (fa) { fa.className = themeIconOn + ' ng-ov-row-fa'; fa.style.color = defColorOn; fa.style.opacity = '.55'; }
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
                    stageShape();
                }, animAccess));

                colorRow.appendChild(makeOvColorPicker(labelOn, curOn, function (v) {
                    curOn = v; updateSlotIcon(slotMain, curIconOn, v); updateSummaryPrimary(); commitOverride();
                }));
                colorRow.appendChild(makeOvColorPicker(labelOff, curOff, function (v) {
                    curOff = v; commitOverride();
                }));
                colorRow.appendChild(buildResetBtn(function () {
                    curIconOn = themeIconOn; curOn = defColorOn; curOff = defColorOff;
                    curAnim = ''; animAccess.repaint();
                    var fa = summary.querySelector('.ng-ov-row-fa');
                    if (fa) { fa.className = themeIconOn + ' ng-ov-row-fa'; fa.style.color = defColorOn; fa.style.opacity = '.55'; }
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
            devices.forEach(function (d) { devByIdx[String(d.idx)] = d; });

            // Sort: already-customised devices first, from either store
            var sorted = devices.slice().sort(function (a, b) {
                var aHas = !!(pending[String(a.idx)] || shapeOf(String(a.idx)));
                var bHas = !!(pending[String(b.idx)] || shapeOf(String(b.idx)));
                if (aHas && !bHas) return -1;
                if (!aHas && bHas) return 1;
                return (a.Name || '').localeCompare(b.Name || '');
            });

            sorted.forEach(function (d) { listEl.appendChild(renderRow(d)); });
            updateCount();

            /* Opened preset to a specific device (e.g. from the device-detail
               page): scroll it into view, flash a highlight, and open its
               inline editor so the user lands straight on it. */
            if (presetIdx) {
                var target = listEl.querySelector('.ng-ov-row[data-idx="' + presetIdx + '"]');
                if (target) {
                    target.classList.add('ng-ov-row--preset-focus');
                    try { target.scrollIntoView({ block: 'center' }); } catch (e) { target.scrollIntoView(); }
                    var eb = target.querySelector('.ng-ov-edit-btn');
                    if (eb) eb.click();
                    setTimeout(function () { target.classList.remove('ng-ov-row--preset-focus'); }, 2600);
                } else if (searchEl) {
                    /* Device not in the used-device list — at least surface it. */
                    searchEl.value = presetIdx;
                    filterList(presetIdx);
                }
            }
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

        /* Apply the pending preset to a device row.

           A preset is a shape plus a colour pair, so it splits cleanly down the
           same seam as everything else: the icon to whichever store owns shapes
           here, the two colours always to the theme. Nothing about a preset is
           lost in the split — there is no preset field without a home. */
        function applyPresetToRow(idxStr) {
            var pp = _pendingPreset;
            var was = pending[idxStr];
            var ent = { on: pp.on, off: pp.off, name: (was && was.name) || pp.label };
            /* Keep an animation the device already had: a preset says nothing
               about motion, so it has no business clearing one. */
            if (was && was.anim) ent.anim = was.anim;
            if (nativeShapes) {
                pendingNative[idxStr] = { on: pp.icon, off: '' };
            } else {
                ent.iconOn = pp.icon;
            }
            pending[idxStr] = ent;

            var row = listEl.querySelector('[data-idx="' + idxStr + '"]');
            if (row) {
                /* Update all FA icons in the summary — blinds rows have open + close icons,
                   so querySelectorAll is needed instead of just querySelector for the first. */
                row.querySelectorAll('.ng-ov-row-fa').forEach(function (fa) {
                    var keepCls = fa.classList.contains('ng-ov-row-fa--open')  ? ' ng-ov-row-fa--open'  :
                                  fa.classList.contains('ng-ov-row-fa--close') ? ' ng-ov-row-fa--close' : '';
                    fa.className   = pp.icon + ' ng-ov-row-fa' + keepCls;
                    fa.style.color   = fa.classList.contains('ng-ov-row-fa--close') ? pp.off : pp.on;
                    fa.style.opacity = '';
                });
                paintRowMarks(row);
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
                closeAllPopovers(overlay);
            }
        });
        overlay.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { if (_pendingPreset) { exitSelectMode(); e.stopPropagation(); } else { close(); } }
        });
        if (searchEl) searchEl.addEventListener('input', function () { filterList(this.value); });

        /* Save writes both stores. The staged shapes go to Domoticz first: they
           are the half that can fail (a rejected class, a permission), and a
           failure there must not be hidden behind an already-saved theme blob.
           The blob is written either way — colour and animation are ours and
           have nothing to do with whether setused went through. */
        overlay.querySelector('.ng-bl-btn--save').addEventListener('click', function () {
            var staged = Object.keys(pendingNative);
            var failed = 0;
            var left   = staged.length;

            function finish() {
                if (window.dzNightglassSettings) {
                    window.dzNightglassSettings.set('deviceIconOverrides', JSON.stringify(pending));
                }
                if (failed && typeof window.ngShowToast === 'function') {
                    window.ngShowToast({
                        type: 'error', icon: 'fa-triangle-exclamation', color: 'var(--dz-danger)',
                        title: 'Icon not saved',
                        body: 'Domoticz refused the icon for ' + failed + ' device' +
                              (failed === 1 ? '' : 's') + '. Colour and animation were saved.'
                    });
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
            }

            if (!left || !iconStore || typeof iconStore.write !== 'function') { finish(); return; }
            staged.forEach(function (idxStr) {
                /* A staged entry already IS the store's spec — { on, off } for a
                   glyph, { image } for an upload, null to clear. */
                iconStore.write(devByIdx[idxStr] || { idx: idxStr },
                                pendingNative[idxStr], function (ok) {
                    if (!ok) failed++;
                    if (--left === 0) finish();
                });
            });
        });

        /* Fetch devices — window.__ngDemoDevices can be set by demo pages as a fallback */
        function loadDevices() {
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

        /* Settle the store question before anything renders — it decides what
           each row's icon control writes and what its starting icon is. */
        if (iconStore && typeof iconStore.probeNative === 'function') {
            iconStore.probeNative(function (ok) {
                nativeShapes = ok;
                paintStoreNote();
                /* Uploaded icons only matter where Domoticz can store one, and
                   the rows need them to draw a device that already has one — so
                   this waits for the list rather than rendering "#101" first.
                   dzCustomIcons owns the +100, so no offset arrives here. */
                if (ok && typeof window.dzCustomIcons === 'function') {
                    window.dzCustomIcons(function (list) {
                        customIcons = list;
                        loadDevices();
                    });
                    return;
                }
                loadDevices();
            });
        } else {
            /* The device-icon module is a separate file: without it there is no
               way to reach the Icon column from here, so the blob is the store. */
            paintStoreNote();
            loadDevices();
        }
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
            /* Rendered from an HTML string with value= already set, which
               raises no input event — prime the track fill once here. */
            if (window.ngFillRange) window.ngFillRange(sl);
            sl.addEventListener('input', function () {
                var val = this.value;
                this.closest('.ng-slider-wrap').querySelector('.ng-slider-value').textContent = val + '%';
                saveSetting(this.getAttribute('data-ng-key'), val);
            });
        });

        // Reset button
        var resetBtn = container.querySelector('#ngResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function (e) {
                e.preventDefault();
                if (!confirm('Reset all Nightglass theme settings to defaults?')) return;
                Object.keys(DEFAULTS).forEach(function (key) {
                    saveSetting(key, DEFAULTS[key]);
                });
                // Also clear the server-side entry so the user is no longer
                // anchored to their own layer and falls back to instance defaults.
                if (_useNewApi && _apiAvailable) {
                    apiPost({
                        type: 'command', param: 'themesettings_set',
                        theme: THEME_NAME, reset: 'true'
                    }).then(function (data) {
                        if (data && data.status === 'OK') {
                            _lastupdate = data.lastupdate || '';
                            _dirty = false;
                            _showUnsavedToast(false);
                        }
                    }).catch(function () {});
                }
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

        // Device Icons dialog button
        var ovBtn = container.querySelector('#ng-override-manage-btn');
        if (ovBtn) {
            /* Wrap so the click Event isn't passed as presetIdx (issue #225). */
            ovBtn.addEventListener('click', function () { openDeviceIconOverrideDialog(); });
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
            saveBtn.addEventListener('click', function (e) {
                // Panel lives inside Domoticz's Angular settings <form>; stop any
                // implicit submit so the page doesn't reload and revert changes.
                e.preventDefault();
                _postThemeSettings(this);
            });
        }

        // Reset All server button (new API only) — clears only the Nightglass
        // entry so the user reverts to the instance-level defaults.
        var resetAllBtn = container.querySelector('#ngResetAllBtn');
        if (resetAllBtn) {
            resetAllBtn.addEventListener('click', function (e) {
                e.preventDefault();
                if (!confirm(
                    'Remove your Nightglass settings from the Domoticz database?\n\n' +
                    'Your settings will revert to the instance defaults.\n' +
                    'Local storage will also be cleared.'
                )) return;
                // Clear in-memory state immediately so the live page reflects
                // defaults even while the API call is in flight.
                _settings = deserializeSettings(null);
                _lastupdate = '';
                saveToLocalStorage();
                applySettings();
                // POST the server reset, then re-render the panel only after
                // confirming the server acknowledged the deletion.
                apiPost({
                    type: 'command', param: 'themesettings_set',
                    theme: THEME_NAME, reset: 'true'
                }).then(function (data) {
                    if (data && data.status === 'OK') {
                        _lastupdate = data.lastupdate || '';
                        _dirty = false;
                        _showUnsavedToast(false);
                        // Re-render panel to reflect the cleared state.
                        var wrap = document.getElementById('ng-theme-settings-wrap');
                        if (wrap) {
                            wrap.innerHTML = buildPanel();
                            bindEvents(wrap);
                            loadPresets(wrap);
                        }
                        if (window.ngShowToast) {
                            window.ngShowToast({
                                icon:     'fa-rotate-left',
                                color:    'var(--dz-accent)',
                                title:    'Server settings cleared',
                                body:     'Nightglass is now using the instance defaults.',
                                type:     'success',
                                duration: 4000
                            });
                        }
                    }
                }).catch(function () {});
            });
        }

        // Save current colors as user preset
        var savePresetBtn = container.querySelector('#ngSavePresetBtn');
        if (savePresetBtn) {
            savePresetBtn.addEventListener('click', function () {
                var name = prompt('Enter a name for this preset:', '');
                if (name === null || !name.trim()) return;
                name = name.trim();
                var colors = {};
                COLOR_SNAPSHOT_KEYS.forEach(function (key) {
                    if (_settings[key] !== undefined) colors[key] = _settings[key];
                });
                var preset = {
                    name:        name,
                    description: 'Custom preset',
                    icon:        'fa-solid fa-palette',
                    preview: {
                        bg:      _settings.bgColor      || '#1b1d25',
                        surface: _settings.surfaceColor  || '#23252f',
                        accent:  _settings.accentColor   || '#4e9af1',
                        text:    _settings.textColor     || '#e2e4ed'
                    },
                    colors:      colors,
                    userDefined: true
                };
                var arr = loadUserPresets();
                arr.push(preset);
                saveUserPresets(arr);
                var grid = container.querySelector('#ngPresetsGrid');
                if (grid) {
                    if (_presetsCache !== null) {
                        renderPresets(grid, _presetsCache);
                    } else {
                        loadPresets(container);
                    }
                }
                if (window.ngShowToast) {
                    window.ngShowToast({
                        icon:     'fa-bookmark',
                        color:    'var(--dz-accent)',
                        title:    name,
                        body:     'Preset saved',
                        type:     'success',
                        duration: 3000
                    });
                }
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

            /* Recently used colours, shared with every other picker in the
               theme. Recorded on commit points only — a drag would otherwise
               fill the whole strip with one gradient. */
            if (window.ngColors) {
                popover.appendChild(window.ngColors.buildRow({
                    onPick: function (hex) {
                        hsv = hexToHsv(hex);
                        updateFromHsv(true);
                        window.ngColors.remember(hex);
                    }
                }));
            }

            function rememberCurrent() {
                if (window.ngColors) window.ngColors.remember(hexInput.value);
            }

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
                    // Keep within viewport — measure rather than assume a
                    // height, the recent-colour strip makes it vary
                    var popH = popover.offsetHeight || 300;
                    if (left < 8) left = 8;
                    if (top + popH + 8 > window.innerHeight) top = Math.max(8, rect.top - popH - 8);
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
            svCanvas.addEventListener('pointerup', function () {
                if (svDragging) { svDragging = false; rememberCurrent(); }
            });

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
            hueCanvas.addEventListener('pointerup', function () {
                if (hueDragging) { hueDragging = false; rememberCurrent(); }
            });

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
                } else {
                    rememberCurrent();
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
                    rememberCurrent();
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
            /* Whatever a picker was left showing is what the user settled on,
               so that is the colour worth remembering. */
            if (p.style.display === 'block' && window.ngColors) {
                var hexEl = p.parentNode && p.parentNode.querySelector('.ng-cp-hex');
                if (hexEl) window.ngColors.remember(hexEl.value);
            }
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
        loadSettings().then(reconcilePresets).then(function () {
            window.ngLog('[Settings]', 'loaded:', JSON.stringify(_settings));
            applySettings();
            /* Before the panel work below, which is retried on a timer and can
               take seconds: a whenReady() caller only needs the values. */
            _signalReady();
            injectPanel();
            hookOtherTabs();
            hookNativeSaveButton();
            if (!_panelInjected) {
                retryInjectPanel(10);
            }
            // Warn when the "per-user" layer is actually shared.  The server sets
            // PerUser=false only when the session is auto-authenticated over a
            // trusted network with no login session (WebLocalNetworks / -nowwwpwd):
            // every such client resolves to the same admin identity, so per-user
            // rows can't isolate them.  This is NOT "no authentication" — an admin
            // reached the page — so word it accurately, and show it once per
            // browser session instead of on every page load.
            if (_useNewApi && !_perUser) {
                window.ngLog('[Settings]', 'PerUser=false — trusted-network session shares one identity; settings are not per-user');
                var warnKey = 'ngSharedWarnShown';
                var alreadyWarned = false;
                try { alreadyWarned = sessionStorage.getItem(warnKey) === '1'; } catch (e) {}
                if (!alreadyWarned && window.ngShowToast) {
                    try { sessionStorage.setItem(warnKey, '1'); } catch (e) {}
                    window.ngShowToast({
                        icon:     'fa-users',
                        color:    'var(--dz-warning, #f0a832)',
                        title:    'Theme settings are shared, not per-user',
                        body:     'This session was auto-authenticated over a trusted local network, ' +
                                  'so Domoticz can’t tell clients apart. All clients on that network ' +
                                  'share one Nightglass configuration. Log in with a username and password ' +
                                  '(or disable trusted-network access) for per-user settings.',
                        duration: 10000,
                        type:     'system'
                    });
                }
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
    /* Parse the stored per-device styling map (best-effort). Still keyed
       'deviceIconOverrides' in storage — see the Device Icons dialog. */
    function readOverrideMap() {
        try {
            var raw = (window.dzNightglassSettings && window.dzNightglassSettings.get('deviceIconOverrides')) || '{}';
            var m = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
            return (m && typeof m === 'object') ? m : {};
        } catch (e) { return {}; }
    }

    window.dzNightglassSettings = {
        get: function (key) { return _settings ? _settings[key] : DEFAULTS[key]; },
        set: saveSetting,
        /* Run cb once the stored values are in — immediately if they already
           are.  Anything that reasons about an *absence* (an empty collection,
           a missing entry) has to wait for this; get() alone would hand it
           DEFAULTS and it would act on the wrong picture. */
        whenReady: function (cb) {
            if (typeof cb !== 'function') return;
            if (_readyDone) cb();
            else _readyCbs.push(cb);
        },
        /* set(), but written through to the server now rather than left for the
           user to save. Returns a promise resolving true on success. */
        setAndPersist: persistNow,
        reset: function () {
            Object.keys(DEFAULTS).forEach(function (key) {
                saveSetting(key, DEFAULTS[key]);
            });
        },
        /* Open the Device Icons dialog, optionally focused on one device
           (used by the device-detail page). */
        openIconOverride: function (idx) { openDeviceIconOverrideDialog(idx); },
        /* Return the stored styling entry for a device IDX, or null. */
        getDeviceOverride: function (idx) {
            var m = readOverrideMap();
            return m[String(idx)] || null;
        },
        /* Drop a device's styling entry and re-apply icons immediately. */
        removeDeviceOverride: function (idx) {
            var m = readOverrideMap();
            if (!m[String(idx)]) return false;
            delete m[String(idx)];
            saveSetting('deviceIconOverrides', JSON.stringify(m));
            if (typeof window._dzSetDeviceIconOverrides === 'function') {
                window._dzSetDeviceIconOverrides(m);
            }
            return true;
        },
        /* Set the on (and optionally off) icon in the theme's own entry,
           preserving any existing colours and animation. The fallback store
           for a shape: used by the device-detail / utility box on a Domoticz
           without the Icon column. An empty off clears the stored off,
           falling back to the on shape — the single-icon default. */
        setDeviceOverrideIcons: function (idx, onCls, offCls, deviceName) {
            if (!idx || !onCls) return false;
            var m  = readOverrideMap();
            var ex = m[String(idx)] || {};
            ex.iconOn    = onCls;
            ex.iconOff   = String(offCls || '').trim() || undefined;
            ex.on        = ex.on  || '#4e9af1';
            ex.off       = ex.off || '#555770';
            ex.name      = ex.name || deviceName || ('IDX ' + idx);
            m[String(idx)] = ex;
            saveSetting('deviceIconOverrides', JSON.stringify(m));
            if (typeof window._dzSetDeviceIconOverrides === 'function') {
                window._dzSetDeviceIconOverrides(m);
            }
            return true;
        },
        /* Set (or clear) just the animation.  Separate from the icon because
           the two no longer share a home: on a Domoticz with the Icon column
           the shape is the device's and only the animation is ours, so the
           device icon field has to be able to write one without the other.
           An entry that ends up holding nothing but a name is dropped rather
           than left behind as a stored no-op. */
        setDeviceOverrideAnim: function (idx, animId, deviceName) {
            if (!idx) return false;
            var key = String(idx);
            var m   = readOverrideMap();
            var ex  = m[key] || {};
            var id  = String(animId || '');
            /* Whitelisted against the catalogue icons.js publishes, so a typo
               or a stale id cannot be persisted. */
            var known = (window.dzIconAnimations || []).some(function (a) {
                return a.id === id;
            });
            if (id && !known) return false;

            if (id) {
                ex.anim = id;
                ex.name = ex.name || deviceName || ('IDX ' + key);
                m[key]  = ex;
            } else {
                delete ex.anim;
                var meaningful = ['icon', 'iconOn', 'iconOff', 'iconOpen',
                                  'iconClose', 'iconStop', 'on', 'off',
                                  'keepColor'].some(function (f) { return ex[f]; });
                if (meaningful) m[key] = ex;
                else delete m[key];
            }
            saveSetting('deviceIconOverrides', JSON.stringify(m));
            if (typeof window._dzSetDeviceIconOverrides === 'function') {
                window._dzSetDeviceIconOverrides(m);
            }
            return true;
        }
    };
})();
