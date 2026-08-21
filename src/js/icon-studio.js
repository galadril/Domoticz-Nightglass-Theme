/* ══════════════════════════════════════════════════════════════════
   ICON STUDIO — Nightglass icon picker overlay
   ──────────────────────────────────────────────────────────────────
   A large, reusable icon chooser used by the Device Icon Overrides
   editor (and anywhere that needs an icon class). It:
     • enumerates EVERY icon-font glyph the browser has loaded (all of
       Font Awesome 7 + any extra library the user added), grouped by
       library with counts;
     • supports user-added icon libraries (Material Design Icons, etc.)
       via a settings-managed stylesheet URL + prefix (issue #129);
     • offers search, a Recent row, Font Awesome category chips, per-
       library collapsible browsing, and a manual "enter any class"
       field with live preview (covers cross-origin / CDN libraries the
       browser won't let us enumerate).

   Public API:
     window.dzOpenIconStudio({ current, onPick, title })
     window.dzInjectIconLibraries(list)   // called by the settings module
     window.dzEnumerateIcons()            // cached flat class list
   ══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var RECENT_KEY = 'dz-icon-recent';
    var RECENT_MAX = 24;
    var RESULT_CAP = 300;

    /* Popular icon-font libraries offered as one-click suggestions in the
       manager (prefilled, NOT auto-enabled). CDN URLs render fine; because
       they're cross-origin the picker can't auto-list them, so those are
       chosen via the manual class field (or host the CSS on Domoticz to get
       auto-listing). */
    var SUGGESTED_LIBS = [
        { name: 'Material Design Icons', prefix: 'mdi', cssUrl: 'https://cdn.jsdelivr.net/npm/@mdi/font@7/css/materialdesignicons.min.css' },
        { name: 'Bootstrap Icons',       prefix: 'bi',  cssUrl: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1/font/bootstrap-icons.min.css' },
        { name: 'Phosphor Icons',        prefix: 'ph',  cssUrl: 'https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2/src/regular/style.css' },
        { name: 'Remix Icon',            prefix: 'ri',  cssUrl: 'https://cdn.jsdelivr.net/npm/remixicon@4/fonts/remixicon.css' },
        { name: 'Tabler Icons',          prefix: 'ti',  cssUrl: 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2/tabler-icons.min.css' },
        { name: 'Weather Icons',         prefix: 'wi',  cssUrl: 'https://cdn.jsdelivr.net/npm/weathericons@2.0.10/css/weather-icons.min.css' }
    ];

    /* FA style/utility classes that are not glyphs. */
    var FA_STYLE = /^fa-(solid|regular|brands|light|thin|duotone|sharp|classic|2xs|xs|sm|lg|xl|2xl|[0-9]+x|fw|ul|li|border|pull-left|pull-right|spin|spin-pulse|spin-reverse|pulse|beat|fade|beat-fade|bounce|flip|flip-horizontal|flip-vertical|flip-both|rotate-90|rotate-180|rotate-270|rotate-by|stack|stack-1x|stack-2x|inverse|sr-only|sr-only-focusable|swap-opacity)$/;

    /* ── Enumeration (cached) ─────────────────────────────────────── */
    var _cache = null;
    function enumerate() {
        if (_cache) return _cache;
        var set = {};
        var sheets = document.styleSheets || [];
        for (var i = 0; i < sheets.length; i++) {
            var rules;
            try { rules = sheets[i].cssRules || sheets[i].rules; }
            catch (e) { continue; }               // cross-origin — unreadable
            if (!rules) continue;
            for (var j = 0; j < rules.length; j++) {
                var r = rules[j];
                if (!r || !r.selectorText || !r.style) continue;
                var faVar = r.style.getPropertyValue('--fa');
                var content = r.style.content;
                var isGlyph = (faVar && faVar !== 'none') ||
                              (/::?before/.test(r.selectorText) && content &&
                               content !== 'none' && content !== 'normal' && content !== '""');
                if (!isGlyph) continue;
                var sels = r.selectorText.split(',');
                for (var k = 0; k < sels.length; k++) {
                    var m = sels[k].match(/\.([a-z][a-z0-9]*-[a-z0-9-]+)/i);
                    if (!m) continue;
                    var name = m[1];
                    if (name.indexOf('fa-') === 0) {
                        if (FA_STYLE.test(name)) continue;
                        set['fa-solid ' + name] = true;
                    } else if (name.indexOf('mdi-') === 0) {
                        set['mdi ' + name] = true;
                    } else {
                        set[name] = true;         // other libs: class == prefix-name
                    }
                }
            }
        }
        _cache = Object.keys(set).sort();
        return _cache;
    }
    window.dzEnumerateIcons = enumerate;

    /* ── Libraries ────────────────────────────────────────────────── */
    /* Returns [{ id, name, prefix }] — the implicit Font Awesome library
       plus any user-configured ones. */
    function configuredLibraries() {
        var libs = [{ id: 'fa', name: 'Font Awesome', prefix: 'fa' }];
        try {
            var raw = (window.dzNightglassSettings &&
                       window.dzNightglassSettings.get('iconLibraries')) || '[]';
            var arr = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
            (arr || []).forEach(function (l) {
                if (l && l.prefix) libs.push({
                    id: l.id || l.prefix, name: l.name || l.prefix, prefix: l.prefix
                });
            });
        } catch (e) {}
        return libs;
    }

    /* Inject <link> for each library stylesheet so glyphs render and (if
       same-origin) become enumerable. Called by the settings module. */
    window.dzInjectIconLibraries = function (list) {
        try {
            var arr = typeof list === 'string' ? JSON.parse(list) : (list || []);
            (arr || []).forEach(function (l) {
                if (!l || !l.cssUrl) return;
                var id = 'ng-iconlib-' + (l.id || l.prefix || l.cssUrl).replace(/[^\w-]/g, '');
                if (document.getElementById(id)) return;
                var link = document.createElement('link');
                link.id = id;
                link.rel = 'stylesheet';
                link.href = l.cssUrl;
                document.head.appendChild(link);
            });
            _cache = null;   // new glyphs may have loaded — re-enumerate lazily
        } catch (e) {}
    };

    /* Raw user library list (excludes the implicit Font Awesome entry). */
    function readLibsRaw() {
        try {
            var raw = (window.dzNightglassSettings &&
                       window.dzNightglassSettings.get('iconLibraries')) || '[]';
            var a = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
            return Array.isArray(a) ? a : [];
        } catch (e) { return []; }
    }
    function saveLibsRaw(arr) {
        var json = JSON.stringify(arr || []);
        if (window.dzNightglassSettings) window.dzNightglassSettings.set('iconLibraries', json);
        if (window.dzInjectIconLibraries) window.dzInjectIconLibraries(json);
        _cache = null;   // force re-enumeration next time
    }

    /* ── Cross-origin library enumeration via fetch + parse ───────────
       Reading a cross-origin <link>'s .cssRules throws (SecurityError), so
       CDN libraries can't be listed that way. But fetching the same URL is a
       normal CORS request, and the big icon CDNs (jsDelivr, cdnjs, unpkg…)
       send Access-Control-Allow-Origin: *, so we can fetch the CSS text and
       parse the glyph classes out of it ourselves — same-origin URLs work too.
       Values: undefined = not loaded, 'loading', 'error', or class[]. */
    var _libIcons = {};

    /* Parse an icon-font stylesheet for `<prefix>-<name>` glyph classes.
       Splits into rule blocks and keeps selectors whose body actually declares
       a glyph (content: or an --fa/-style icon var), so utility classes
       (sizes, rotations…) are ignored. Handles grouped selectors. */
    function parseCssForIcons(cssText, prefix) {
        var out = {};
        var pfx = prefix.replace(/[^a-z0-9]/gi, '');
        var selRe = new RegExp('\\.(' + pfx + '-[a-z0-9-]+)', 'gi');
        var chunks = cssText.split('}');
        for (var i = 0; i < chunks.length; i++) {
            var brace = chunks[i].indexOf('{');
            if (brace < 0) continue;
            var sel  = chunks[i].slice(0, brace);
            var body = chunks[i].slice(brace + 1);
            if (!/content\s*:/i.test(body) && !/--fa\b/i.test(body)) continue;
            var mm; selRe.lastIndex = 0;
            while ((mm = selRe.exec(sel)) !== null) {
                out[prefix + ' ' + mm[1]] = true;   // e.g. "mdi mdi-home"
            }
        }
        return Object.keys(out).sort();
    }

    /* Load (and cache) a library's icon list. cb() fires when state changes. */
    function loadLibraryIcons(lib, cb) {
        var st = _libIcons[lib.id];
        if (st === 'loading' || (st && st !== 'error')) { cb(); return; }
        if (!lib.cssUrl) { _libIcons[lib.id] = []; cb(); return; }
        _libIcons[lib.id] = 'loading';
        cb();
        fetch(lib.cssUrl, { credentials: 'omit' })
            .then(function (r) { if (!r.ok) throw 0; return r.text(); })
            .then(function (t) { _libIcons[lib.id] = parseCssForIcons(t, lib.prefix); cb(); })
            .catch(function () { _libIcons[lib.id] = 'error'; cb(); });
    }

    /* Which library a class belongs to (by prefix). */
    function libIdOf(cls, libs) {
        var token = cls.split(/\s+/)[0];              // e.g. "fa-solid" | "mdi" | "bi"
        if (token.indexOf('fa-') === 0 || token === 'fa') return 'fa';
        for (var i = 0; i < libs.length; i++) {
            if (libs[i].prefix && token.indexOf(libs[i].prefix) === 0) return libs[i].id;
        }
        return token;                                  // fallback: prefix as id
    }

    /* Group enumerated classes by library, in library order. */
    function groupByLibrary(classes, libs) {
        var groups = {};
        libs.forEach(function (l) { groups[l.id] = { lib: l, icons: [] }; });
        classes.forEach(function (c) {
            var id = libIdOf(c, libs);
            if (!groups[id]) groups[id] = { lib: { id: id, name: id }, icons: [] };
            groups[id].icons.push(c);
        });
        return groups;
    }

    function labelOf(cls) {
        return cls.replace(/^fa-solid\s+fa-/, '').replace(/^fa-\w+\s+fa-/, '')
                  .replace(/^mdi\s+mdi-/, '').replace(/^[a-z0-9]+[\s-]/, '')
                  .replace(/-/g, ' ').trim();
    }

    /* ── Recent (localStorage) ────────────────────────────────────── */
    function getRecent() {
        try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') || []; }
        catch (e) { return []; }
    }
    function pushRecent(cls) {
        try {
            var list = getRecent().filter(function (c) { return c !== cls; });
            list.unshift(cls);
            localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
        } catch (e) {}
    }

    /* ── Font Awesome category chips (curated) ────────────────────── */
    var FA_CATEGORIES = {
        'Home':        ['house','house-chimney','door-open','door-closed','couch','bed','bath','shower','toilet','kitchen-set','stairs','warehouse','key','lock','bell','fingerprint'],
        'Climate':     ['temperature-half','temperature-high','temperature-low','fire','fire-flame-curved','snowflake','fan','wind','droplet','sun','gauge','smog'],
        'Weather':     ['cloud','cloud-rain','cloud-showers-heavy','cloud-sun','bolt','umbrella','rainbow','moon','sun','wind','snowflake','temperature-half'],
        'Energy':      ['plug','bolt','battery-full','battery-half','solar-panel','charging-station','gauge-high','lightbulb','fire-flame-simple','oil-can'],
        'Lighting':    ['lightbulb','circle-half-stroke','sun','moon','star','wand-magic-sparkles','tv'],
        'Tech / AV':   ['tv','desktop','laptop','server','hard-drive','print','mobile-screen','tablet-screen-button','headphones','volume-high','music','gamepad','camera','video','wifi','network-wired','satellite-dish','robot'],
        'Appliances':  ['blender','mug-hot','utensils','kitchen-set','fire-burner','temperature-arrow-up','soap','jug-detergent','shirt','sink'],
        'Security':    ['shield-halved','lock','lock-open','key','bell','video','camera','fingerprint','user-shield','triangle-exclamation','person-through-window'],
        'Outdoor':     ['car','car-battery','charging-station','tree','seedling','faucet','faucet-drip','water-ladder','trash-can','dumpster','trailer'],
        'People':      ['user','users','baby','person-walking','child','paw','dog','cat'],
        'Status':      ['circle-check','circle-xmark','triangle-exclamation','circle-info','circle-question','power-off','play','pause','stop','arrow-rotate-right']
    };

    /* ── Overlay ──────────────────────────────────────────────────── */
    var _overlay = null;

    function close() {
        if (!_overlay) return;
        _overlay.classList.remove('ng-is--open');
        var el = _overlay;
        _overlay = null;
        setTimeout(function () { if (el.parentNode) el.remove(); }, 220);
    }

    function openIconStudio(opts) {
        opts = opts || {};
        if (_overlay) close();

        var libs, all, groups;
        var chosen    = opts.current || '';
        var scope     = 'all';           // 'all' | 'recent' | libId
        var query     = '';

        /* Merge same-origin/loaded glyphs (enumerate) with the fetched CDN
           library icons (_libIcons) into the flat pool + per-library groups. */
        function buildData() {
            libs = configuredLibraries();
            var valid = {};
            libs.forEach(function (l) { valid[l.id] = true; });
            var merged = {}, out = [];
            enumerate().forEach(function (c) { merged[c] = true; });
            Object.keys(_libIcons).forEach(function (id) {
                if (!valid[id]) return;   // library was removed — don't leak its icons
                if (Array.isArray(_libIcons[id])) _libIcons[id].forEach(function (c) { merged[c] = true; });
            });
            Object.keys(merged).sort().forEach(function (c) { out.push(c); });
            all = out;
            groups = groupByLibrary(all, libs);
        }
        buildData();

        var overlay = document.createElement('div');
        overlay.id = 'ng-is-overlay';
        overlay.className = 'ng-is-overlay';
        overlay.innerHTML =
            '<div class="ng-is-dialog" role="dialog" aria-label="Icon Studio">' +
            '  <div class="ng-is-head">' +
            '    <div class="ng-is-title"><i class="fa-solid fa-icons"></i> ' +
                   (opts.title || 'Choose an icon') + '</div>' +
            '    <div class="ng-is-search-wrap">' +
            '      <i class="fa-solid fa-magnifying-glass"></i>' +
            '      <input class="ng-is-search" type="text" placeholder="Search all icons…" autocomplete="off">' +
            '    </div>' +
            '    <button class="ng-is-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
            '  </div>' +
            '  <div class="ng-is-body">' +
            '    <div class="ng-is-rail" id="ng-is-rail"></div>' +
            '    <div class="ng-is-main" id="ng-is-main"></div>' +
            '  </div>' +
            '  <div class="ng-is-foot">' +
            '    <div class="ng-is-manual">' +
            '      <span class="ng-is-manual-preview"><i class="' + (chosen || 'fa-solid fa-question') + '"></i></span>' +
            '      <input class="ng-is-manual-input" type="text" placeholder="Or paste any icon class (e.g. mdi mdi-home, fa-brands fa-github)" autocomplete="off">' +
            '      <button class="ng-is-manual-use" type="button">Use</button>' +
            '    </div>' +
            '  </div>' +
            '</div>';

        document.body.appendChild(overlay);
        _overlay = overlay;
        requestAnimationFrame(function () { overlay.classList.add('ng-is--open'); });

        var railEl   = overlay.querySelector('#ng-is-rail');
        var mainEl   = overlay.querySelector('#ng-is-main');
        var searchEl = overlay.querySelector('.ng-is-search');
        var mInput   = overlay.querySelector('.ng-is-manual-input');
        var mPrev    = overlay.querySelector('.ng-is-manual-preview i');

        function apply(cls) {
            if (!cls) return;
            pushRecent(cls);
            if (typeof opts.onPick === 'function') opts.onPick(cls);
            close();
        }

        /* Icon tile */
        function tile(cls) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'ng-is-tile' + (cls === chosen ? ' ng-is-tile--active' : '');
            b.title = labelOf(cls);
            b.innerHTML = '<i class="' + cls + '"></i><span>' + labelOf(cls) + '</span>';
            b.addEventListener('click', function () { apply(cls); });
            return b;
        }

        function gridOf(classes, capped) {
            var grid = document.createElement('div');
            grid.className = 'ng-is-grid';
            var list = capped ? classes.slice(0, RESULT_CAP) : classes;
            list.forEach(function (c) { grid.appendChild(tile(c)); });
            if (capped && classes.length > RESULT_CAP) {
                var more = document.createElement('div');
                more.className = 'ng-is-note';
                more.textContent = 'Showing ' + RESULT_CAP + ' of ' + classes.length +
                                   ' — search to narrow down.';
                grid.appendChild(more);
            }
            return grid;
        }

        /* ── Left rail ── */
        function renderRail() {
            railEl.innerHTML = '';
            var items = [{ id: 'all', name: 'All icons', icon: 'fa-layer-group', count: all.length },
                         { id: 'recent', name: 'Recent', icon: 'fa-clock-rotate-left', count: getRecent().length }];
            libs.forEach(function (l) {
                items.push({ id: l.id, name: l.name, icon: 'fa-icons',
                             count: (groups[l.id] ? groups[l.id].icons.length : 0) });
            });
            items.forEach(function (it) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'ng-is-rail-item' + (it.id === scope ? ' ng-is-rail-item--active' : '');
                b.innerHTML = '<i class="fa-solid ' + it.icon + '"></i><span>' + it.name + '</span>' +
                              '<em class="ng-is-rail-count">' + it.count + '</em>';
                b.addEventListener('click', function () { scope = it.id; renderRail(); renderMain(); });
                railEl.appendChild(b);
            });

            /* Manage libraries (add MDI / your own icon fonts) */
            var mng = document.createElement('button');
            mng.type = 'button';
            mng.className = 'ng-is-rail-manage' + (scope === 'manage' ? ' ng-is-rail-item--active' : '');
            mng.innerHTML = '<i class="fa-solid fa-plus"></i><span>Add / manage libraries</span>';
            mng.addEventListener('click', function () { scope = 'manage'; renderRail(); renderMain(); });
            railEl.appendChild(mng);
        }

        function refreshData() { buildData(); }

        /* Fetch+parse any not-yet-loaded library, re-rendering as each lands. */
        function loadLibraries() {
            configuredLibraries().forEach(function (l) {
                if (l.id === 'fa') return;
                loadLibraryIcons(l, function () {
                    buildData();
                    renderRail();
                    renderMain();
                });
            });
        }

        /* ── Library manager ── */
        function renderManage() {
            mainEl.innerHTML = '';
            var head = document.createElement('div');
            head.className = 'ng-is-section-title';
            head.textContent = 'Icon libraries';
            mainEl.appendChild(head);

            var desc = document.createElement('div');
            desc.className = 'ng-is-note';
            desc.innerHTML = 'Add an icon font such as ' +
                '<a href="https://pictogrammers.com/library/mdi/" target="_blank" rel="noopener">Material Design Icons</a>. ' +
                'Give its stylesheet URL and class prefix (e.g. <code>mdi</code>). Libraries hosted on ' +
                'this Domoticz server are listed automatically; libraries loaded from another domain still ' +
                'render but must be picked via the “paste any class” field below.';
            mainEl.appendChild(desc);

            var listWrap = document.createElement('div');
            listWrap.className = 'ng-is-lib-list';
            var raw = readLibsRaw();
            if (!raw.length) {
                listWrap.innerHTML = '<div class="ng-is-note">No custom libraries yet.</div>';
            } else {
                raw.forEach(function (l, i) {
                    var rowEl = document.createElement('div');
                    rowEl.className = 'ng-is-lib-row';
                    rowEl.innerHTML =
                        '<div class="ng-is-lib-meta"><strong>' + (l.name || l.prefix || '?') + '</strong>' +
                        '<span>' + (l.prefix ? l.prefix + '-*' : '') + ' · ' + (l.cssUrl || '') + '</span></div>';
                    var rm = document.createElement('button');
                    rm.type = 'button';
                    rm.className = 'ng-is-lib-remove';
                    rm.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                    rm.addEventListener('click', function () {
                        var arr = readLibsRaw();
                        arr.splice(i, 1);
                        saveLibsRaw(arr);
                        refreshData();
                        renderRail();
                        renderManage();
                    });
                    rowEl.appendChild(rm);
                    listWrap.appendChild(rowEl);
                });
            }
            mainEl.appendChild(listWrap);

            /* One-click suggestions for popular libraries (prefill only). */
            var addedPrefixes = {};
            raw.forEach(function (l) { if (l && l.prefix) addedPrefixes[l.prefix] = true; });
            var suggestable = SUGGESTED_LIBS.filter(function (s) { return !addedPrefixes[s.prefix]; });
            if (suggestable.length) {
                var sug = document.createElement('div');
                sug.className = 'ng-is-lib-suggest';
                var sLbl = document.createElement('div');
                sLbl.className = 'ng-is-lib-suggest-label';
                sLbl.textContent = 'Popular libraries — click to prefill, then review & Add:';
                sug.appendChild(sLbl);
                var chips = document.createElement('div');
                chips.className = 'ng-is-lib-suggest-chips';
                suggestable.forEach(function (s) {
                    var chip = document.createElement('button');
                    chip.type = 'button';
                    chip.className = 'ng-is-lib-suggest-chip';
                    chip.textContent = s.name;
                    chip.addEventListener('click', function () {
                        form.querySelector('.ng-is-lib-name').value   = s.name;
                        form.querySelector('.ng-is-lib-url').value     = s.cssUrl;
                        form.querySelector('.ng-is-lib-prefix').value  = s.prefix;
                        form.querySelector('.ng-is-lib-url').classList.remove('ng-is-invalid');
                        form.querySelector('.ng-is-lib-prefix').classList.remove('ng-is-invalid');
                    });
                    chips.appendChild(chip);
                });
                sug.appendChild(chips);
                mainEl.appendChild(sug);
            }

            var form = document.createElement('div');
            form.className = 'ng-is-lib-form';
            form.innerHTML =
                '<input class="ng-is-lib-name"   type="text" placeholder="Name (e.g. Material Design Icons)">' +
                '<input class="ng-is-lib-url"    type="text" placeholder="Stylesheet URL (e.g. templates/materialdesignicons.min.css)">' +
                '<input class="ng-is-lib-prefix" type="text" placeholder="Class prefix (e.g. mdi)">' +
                '<button type="button" class="ng-is-lib-add"><i class="fa-solid fa-plus"></i> Add library</button>';
            mainEl.appendChild(form);

            form.querySelector('.ng-is-lib-add').addEventListener('click', function () {
                var name   = form.querySelector('.ng-is-lib-name').value.trim();
                var url    = form.querySelector('.ng-is-lib-url').value.trim();
                var prefix = form.querySelector('.ng-is-lib-prefix').value.trim().replace(/-.*$/, '').replace(/[^a-z0-9]/gi, '');
                if (!url || !prefix) {
                    form.querySelector('.ng-is-lib-url').classList.toggle('ng-is-invalid', !url);
                    form.querySelector('.ng-is-lib-prefix').classList.toggle('ng-is-invalid', !prefix);
                    return;
                }
                var arr = readLibsRaw();
                arr.push({ id: prefix, name: name || prefix, cssUrl: url, prefix: prefix });
                saveLibsRaw(arr);
                delete _libIcons[prefix];     // ensure a fresh fetch
                refreshData();
                scope = prefix;               // jump to the new library (shows loading)
                renderRail();
                renderMain();
                /* Fetch+parse it (and inject its <link> for rendering), then
                   re-render when the icon list lands. */
                loadLibraryIcons({ id: prefix, name: name || prefix, cssUrl: url, prefix: prefix }, function () {
                    buildData(); renderRail(); if (scope === prefix) renderMain();
                });
            });
        }

        /* ── Main pane ── */
        function renderMain() {
            mainEl.innerHTML = '';

            if (scope === 'manage') { renderManage(); return; }

            if (query) {
                var q = query.toLowerCase();
                var hits = all.filter(function (c) { return labelOf(c).indexOf(q) !== -1; });
                var h = document.createElement('div');
                h.className = 'ng-is-section-title';
                h.textContent = hits.length + ' result' + (hits.length === 1 ? '' : 's') + ' for “' + query + '”';
                mainEl.appendChild(h);
                if (!hits.length) {
                    var none = document.createElement('div');
                    none.className = 'ng-is-note';
                    none.textContent = 'No icons match. Try another term, or paste a class below.';
                    mainEl.appendChild(none);
                } else {
                    mainEl.appendChild(gridOf(hits, true));
                }
                return;
            }

            if (scope === 'recent') {
                var recent = getRecent();
                if (!recent.length) {
                    mainEl.innerHTML = '<div class="ng-is-note">No recent icons yet — the ones you pick will appear here.</div>';
                    return;
                }
                mainEl.appendChild(gridOf(recent, false));
                return;
            }

            if (scope === 'fa') {
                /* Font Awesome — category chips + full list */
                var chipBar = document.createElement('div');
                chipBar.className = 'ng-is-chips';
                var activeCat = null;
                var catGrid = document.createElement('div');

                function showCat(cat) {
                    activeCat = cat;
                    chipBar.querySelectorAll('.ng-is-chip').forEach(function (c) {
                        c.classList.toggle('ng-is-chip--active', c.getAttribute('data-cat') === (cat || ''));
                    });
                    catGrid.replaceWith(catGrid = (function () {
                        if (!cat) return gridOf(groups.fa ? groups.fa.icons : [], true);
                        var names = FA_CATEGORIES[cat] || [];
                        return gridOf(names.map(function (n) { return 'fa-solid fa-' + n; }), false);
                    })());
                }

                var allChip = document.createElement('button');
                allChip.type = 'button'; allChip.className = 'ng-is-chip ng-is-chip--active';
                allChip.setAttribute('data-cat', '');
                allChip.textContent = 'All';
                allChip.addEventListener('click', function () { showCat(null); });
                chipBar.appendChild(allChip);

                Object.keys(FA_CATEGORIES).forEach(function (cat) {
                    var c = document.createElement('button');
                    c.type = 'button'; c.className = 'ng-is-chip';
                    c.setAttribute('data-cat', cat);
                    c.textContent = cat;
                    c.addEventListener('click', function () { showCat(cat); });
                    chipBar.appendChild(c);
                });

                mainEl.appendChild(chipBar);
                catGrid = gridOf(groups.fa ? groups.fa.icons : [], true);
                mainEl.appendChild(catGrid);
                return;
            }

            if (scope !== 'all') {
                /* A specific configured library */
                if (_libIcons[scope] === 'loading') {
                    mainEl.innerHTML = '<div class="ng-is-note"><i class="fa-solid fa-spinner fa-spin"></i> ' +
                        'Loading icons…</div>';
                    return;
                }
                var g = groups[scope];
                if (!g || !g.icons.length) {
                    var reason = _libIcons[scope] === 'error'
                        ? 'Couldn’t load this library’s icon list (the CDN blocked the request, or it’s offline). ' +
                          'It will still render — paste the exact class below, or host the CSS on Domoticz for a full list.'
                        : 'No icons found in this library’s stylesheet. Paste the exact class below instead.';
                    mainEl.innerHTML = '<div class="ng-is-note"><i class="fa-solid fa-circle-info"></i> ' + reason + '</div>';
                    return;
                }
                mainEl.appendChild(gridOf(g.icons, true));
                return;
            }

            /* All: collapsible section per library */
            libs.forEach(function (l) {
                var g = groups[l.id];
                var icons = g ? g.icons : [];
                var sec = document.createElement('div');
                sec.className = 'ng-is-section';
                var head = document.createElement('button');
                head.type = 'button';
                head.className = 'ng-is-section-head';
                head.innerHTML = '<i class="fa-solid fa-chevron-down"></i> ' + l.name +
                                 ' <em>' + icons.length + '</em>';
                var body = document.createElement('div');
                body.className = 'ng-is-section-body';
                body.appendChild(gridOf(icons, true));
                head.addEventListener('click', function () {
                    var open = sec.classList.toggle('ng-is-section--collapsed');
                    head.querySelector('i').className = open ? 'fa-solid fa-chevron-right'
                                                             : 'fa-solid fa-chevron-down';
                });
                sec.appendChild(head);
                sec.appendChild(body);
                mainEl.appendChild(sec);
            });
        }

        /* ── Wire ── */
        searchEl.addEventListener('input', function () { query = this.value.trim(); renderMain(); });
        mInput.addEventListener('input', function () {
            mPrev.className = this.value.trim() || 'fa-solid fa-question';
        });
        mInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); if (this.value.trim()) apply(this.value.trim()); }
        });
        overlay.querySelector('.ng-is-manual-use').addEventListener('click', function () {
            if (mInput.value.trim()) apply(mInput.value.trim());
        });
        overlay.querySelector('.ng-is-close').addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

        renderRail();
        renderMain();
        loadLibraries();          // fetch+parse CDN/custom libraries in the background
        setTimeout(function () { try { searchEl.focus(); } catch (e) {} }, 60);
    }

    window.dzOpenIconStudio = openIconStudio;
})();
