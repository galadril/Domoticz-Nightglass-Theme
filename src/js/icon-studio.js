/* ══════════════════════════════════════════════════════════════════
   ICON STUDIO — Nightglass icon picker overlay
   ──────────────────────────────────────────────────────────────────
   A large, reusable icon chooser used by the Device Icon Overrides
   editor (and anywhere that needs an icon class). It:
     • enumerates EVERY icon-font glyph the browser has loaded (all of
       Font Awesome 7 + every icon library installed on this Domoticz),
       grouped by library with counts;
     • offers search, a Recent row, Font Awesome category chips, per-
       library collapsible browsing, and a manual "enter any class"
       field with live preview.

   Icon libraries themselves are Domoticz's business: they are added and
   removed on Setup → Custom Icons, live in the WebAssets table, and are
   served from assets/ under a <link> Domoticz injects. This module only
   reads that registry — it never installs, hosts or caches a library.
   Because the stylesheets are therefore same-origin, their glyphs come
   straight out of document.styleSheets and need no fetching at all.

   Public API:
     window.dzOpenIconStudio({ current, onPick, title })
     window.dzMigrateIconLibraries()      // called by the settings module
     window.dzEnumerateIcons()            // cached flat class list
   ══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var RECENT_KEY = 'dz-icon-recent';
    var RECENT_MAX = 24;
    var RESULT_CAP = 300;
    var SEARCH_DELAY = 200;          // ms; matches the native Domoticz picker

    /* FA style/utility classes that are not glyphs. */
    var FA_STYLE = /^fa-(solid|regular|brands|light|thin|duotone|sharp|classic|2xs|xs|sm|lg|xl|2xl|[0-9]+x|fw|ul|li|border|pull-left|pull-right|spin|spin-pulse|spin-reverse|pulse|beat|fade|beat-fade|bounce|flip|flip-horizontal|flip-vertical|flip-both|rotate-90|rotate-180|rotate-270|rotate-by|stack|stack-1x|stack-2x|inverse|sr-only|sr-only-focusable|swap-opacity)$/;

    /* Icon classes are only ever letters, digits, spaces, dashes and
       underscores. Anything else is a typo or an attempt to smuggle markup
       into the class attribute we build, so it never gets applied or stored. */
    var SAFE_CLASS_RE = /^[A-Za-z0-9 _-]+$/;
    function cleanClass(cls) {
        var v = String(cls == null ? '' : cls).replace(/\s+/g, ' ').trim();
        return SAFE_CLASS_RE.test(v) ? v : '';
    }

    /* Rightmost `prefix-name` class token in one selector.
       Weight-variant sheets declare the glyph on a compound selector whose
       LEADING token is the variant (`.ph-fill.ph-acorn::before`), so taking
       the first match would collapse a whole library to a single bogus
       "ph-fill" entry. */
    var GLYPH_CLASS_RE = /\.([a-z][a-z0-9]*-[a-z0-9-]+)/gi;
    function glyphClassOf(selector) {
        var m, name = null;
        GLYPH_CLASS_RE.lastIndex = 0;
        while ((m = GLYPH_CLASS_RE.exec(selector)) !== null) name = m[1];
        return name;
    }

    /* ── Enumeration (cached) ─────────────────────────────────────── */
    var _cache = null;
    function collectGlyphs(rules, set) {
        for (var j = 0; j < rules.length; j++) {
            var r = rules[j];
            if (!r) continue;
            /* @media / @supports / @layer wrap their contents in a grouping
               rule that has no selectorText of its own; descend or the glyphs
               inside are never seen. */
            if (r.cssRules && r.cssRules.length) { collectGlyphs(r.cssRules, set); continue; }
            if (!r.selectorText || !r.style) continue;
            var faVar = r.style.getPropertyValue('--fa');
            var content = r.style.content;
            /* Not every set is a font. Iconoir and friends ship no @font-face and
               draw each icon as an SVG mask, so they declare mask-image and never
               a codepoint; requiring content would enumerate nothing for them.
               Utility classes declare neither, which is what this really excludes. */
            var mask = r.style.getPropertyValue('mask-image') ||
                       r.style.getPropertyValue('-webkit-mask-image');
            var isGlyph = (faVar && faVar !== 'none') ||
                          (mask && mask !== 'none') ||
                          (/::?before/.test(r.selectorText) && content &&
                           content !== 'none' && content !== 'normal' && content !== '""');
            if (!isGlyph) continue;
            var sels = r.selectorText.split(',');
            for (var k = 0; k < sels.length; k++) {
                var name = glyphClassOf(sels[k]);
                if (!name) continue;
                if (name.indexOf('fa-') === 0) {
                    if (FA_STYLE.test(name)) continue;
                    set['fa-solid ' + name] = true;
                } else {
                    /* Emit the base class alongside the glyph class. Phosphor,
                       Tabler and Weather Icons hang `font-family` on the base
                       (`.ph`), so `class="ph-acorn"` alone renders as a
                       zero-width Times New Roman blank. Libraries that key off
                       an attribute selector instead (Bootstrap, Remix) don't
                       need it but are unharmed by it. */
                    set[name.slice(0, name.indexOf('-')) + ' ' + name] = true;
                }
            }
        }
    }
    function enumerate() {
        if (_cache) return _cache;
        var set = {};
        var sheets = document.styleSheets || [];
        for (var i = 0; i < sheets.length; i++) {
            var rules;
            try { rules = sheets[i].cssRules || sheets[i].rules; }
            catch (e) { continue; }               // cross-origin — unreadable
            if (rules) collectGlyphs(rules, set);
        }
        _cache = Object.keys(set).sort();
        return _cache;
    }
    window.dzEnumerateIcons = enumerate;

    /* ── Libraries ────────────────────────────────────────────────── */
    /* Returns [{ id, name, prefix }] — the implicit Font Awesome library plus
       every library installed on this Domoticz. Those are the only two sources:
       adding a library is done on Domoticz's Custom Icons page, never here. */
    function configuredLibraries() {
        return [{ id: 'fa', name: 'Font Awesome', prefix: 'fa' }]
            .concat(nativeLibraries());
    }

    /* ── Domoticz's icon-library registry ──────────────────────────────
       Libraries live in the WebAssets table, are added/removed on Setup →
       Custom Icons, and are listed by the `getwebassets` command.

       Every read is guarded: a Domoticz without the command must leave the
       Studio showing Font Awesome and nothing else, rather than treating a
       missing endpoint as "every library was deleted". _nativeLibs therefore
       stays null until one read actually succeeds, which is also its permanent
       value on a build without the endpoint. */
    var _nativeLibs = null;
    var _nativeFetch = null;
    var _nativeAssetNames = {};  // every registry file name, lowercased
    var _onNativeChange = null;  // set while the Studio is open

    function nativeLibraries() { return _nativeLibs || []; }

    /* Older Nightglass hosted libraries itself and uploaded them as
       `iconfont-<prefix>.css`. Anything left over from that is already covered
       by the real `<prefix>.css` row, and its stem would derive the bogus
       prefix "iconfontmdi", so it is not a library as far as this is
       concerned. */
    function isOwnAssetName(name) {
        return /^iconfont-/i.test(String(name || ''));
    }

    function deriveNativeLib(asset) {
        var name = String((asset && asset.name) || '');
        if (!/\.css$/i.test(name) || isOwnAssetName(name)) return null;
        /* Same derivation as Domoticz's own Custom Icons page: the file stem IS
           the class prefix, because that page builds the name from the prefix
           the user typed (`<prefix>.css`). */
        var prefix = name.replace(/\.css$/i, '').replace(/[^a-z0-9]/gi, '');
        if (!prefix) return null;
        var title = String(asset.Title || '').trim();
        return { id: prefix, name: title || prefix, prefix: prefix };
    }

    function fetchNativeLibraries(force) {
        if (_nativeFetch && !force) return _nativeFetch;
        var job = fetch('json.htm?type=command&param=getwebassets',
                        { credentials: 'same-origin' })
            .then(function (r) { if (!r.ok) throw 0; return r.json(); })
            .then(function (d) {
                /* A Domoticz without the command 404s (thrown above) or answers
                   with an error payload. Either way there is no registry, and
                   "no registry" must never be read as "everything was deleted". */
                if (!d || d.status !== 'OK' || !Array.isArray(d.result)) throw 0;
                var libs = [], seen = {}, names = {};
                d.result.forEach(function (a) {
                    if (a && a.name) names[String(a.name).toLowerCase()] = true;
                    var lib = deriveNativeLib(a);
                    if (!lib || seen[lib.prefix]) return;
                    seen[lib.prefix] = true;
                    libs.push(lib);
                });
                _nativeLibs = libs;
                _nativeAssetNames = names;
                return libs;
            })
            .catch(function () {
                /* Retry on the next open rather than caching the failure, and
                   hand back whatever was last known good. */
                if (_nativeFetch === job) _nativeFetch = null;
                return nativeLibraries();
            });
        _nativeFetch = job;
        return job;
    }

    /* Domoticz's Custom Icons page broadcasts after every successful add,
       refresh and delete. Angular, the injector and the event are all optional
       — on older builds none of the three exists, and the per-open refetch below
       is what keeps the Studio correct there. */
    function subscribeToNativeChanges() {
        try {
            var injector = window.angular &&
                           window.angular.element(document.body).injector();
            if (!injector) return false;
            injector.get('$rootScope').$on('dz-webassets-changed', function () {
                _nativeFetch = null;
                _cache = null;
                fetchNativeLibraries(true).then(function () {
                    if (typeof _onNativeChange === 'function') _onNativeChange();
                });
            });
            return true;
        } catch (e) { return false; }
    }

    /* Domoticz injects a <link> per asset when the app boots and has no reason
       to look again mid-session, so nudge its loader — otherwise a library that
       just migrated renders nothing until the next page load. */
    function reloadNativeStylesheets() {
        try {
            var injector = window.angular &&
                           window.angular.element(document.body).injector();
            if (injector) injector.get('iconLibraries').load();
        } catch (e) {}
    }

    /* ── One-shot migration onto Domoticz's registry ───────────────────
       Nightglass used to install icon libraries itself and remembered them in
       the `iconLibraries` setting. Domoticz owns that job now, and every stored
       entry already holds what a native install needs — source URL, prefix and
       display name — so hand them over once and stop remembering them.

       An entry is only dropped once it is definitely safe to forget: that
       source URL is the sole record of where the library came from, so anything
       that fails (a session without admin rights, or a URL the server refuses)
       stays exactly as it is and gets another chance on a later page load. */
    var LEGACY_KEY = 'iconLibraries';
    var _migrationDone = false;

    function legacyLibraries() {
        try {
            var raw = window.dzNightglassSettings &&
                      window.dzNightglassSettings.get(LEGACY_KEY);
            var arr = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []);
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }

    /* `<prefix>.css` is the name Domoticz's own Custom Icons page derives from
       a prefix, so a migrated library is indistinguishable from a hand-added
       one — including having its prefix read back off the file stem. */
    function nativeAssetName(prefix) {
        return String(prefix || '') + '.css';
    }

    function normalizePrefix(prefix) {
        return String(prefix || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    }

    /* Resolves true only on a recorded install. Every failure — 403 for a
       non-admin session, a refused URL, an unreachable server — is one value:
       "not migrated", which is what keeps the stored entry alive. */
    function installFromUrl(name, url, title) {
        return fetch('json.htm?type=command&param=uploadwebasset' +
                     '&name=' + encodeURIComponent(name) +
                     '&url=' + encodeURIComponent(url) +
                     '&title=' + encodeURIComponent(title || ''),
                     { credentials: 'same-origin' })
            /* A non-admin session is answered with 403 and no JSON body. */
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (d) { return !!(d && d.status === 'OK'); })
            .catch(function () { return false; });
    }

    /* The theme's own upload for a library it has just handed over. Left in
       place it would keep the <link> Domoticz injects for it, so the same font
       would be fetched and declared twice for the rest of the install's life.
       Derived from the prefix rather than the entry's recorded assetPath: that
       field was only ever written locally, so plenty of installs know the file
       exists without having a path for it. Only reached once that library's
       migration succeeded. */
    function dropOwnUpload(prefix) {
        var name = 'iconfont-' + prefix + '.css';
        if (!_nativeAssetNames[name]) return;
        fetch('json.htm?type=command&param=deletewebasset&name=' + encodeURIComponent(name),
              { credentials: 'same-origin' }).catch(function () {});
    }

    function migrateLegacyLibraries() {
        if (_migrationDone) return;
        var stored = legacyLibraries();
        /* Nothing to migrate — but settings load asynchronously, so this may
           simply be too early to tell. Stay un-done and let the next call
           decide. */
        if (!stored.length) return;
        _migrationDone = true;

        fetchNativeLibraries(true).then(function () {
            /* No registry on this build: there is nowhere to migrate TO, and
               the entries have to be left for a Domoticz that has one. */
            if (!_nativeLibs) return;
            var registered = {};
            _nativeLibs.forEach(function (n) { registered[normalizePrefix(n.prefix)] = true; });

            return Promise.all(stored.map(function (l) {
                var prefix = normalizePrefix(l && l.prefix);
                /* Already Domoticz's, whether this run put it there or an
                   earlier one did — which is what makes this idempotent. */
                if (prefix && registered[prefix]) { dropOwnUpload(prefix); return true; }
                /* The server installs from a public http(s) URL only; a
                   relative path or a LAN address is refused. Don't ask, and
                   above all don't discard the only copy of that URL. */
                if (!prefix || !/^https?:\/\//i.test(String((l && l.cssUrl) || ''))) return false;
                return installFromUrl(nativeAssetName(prefix), l.cssUrl, l.name || prefix)
                    .then(function (ok) {
                        if (ok) dropOwnUpload(prefix);
                        return ok;
                    });
            })).then(function (moved) {
                var keep = stored.filter(function (l, i) { return !moved[i]; });
                if (keep.length === stored.length) return null;
                if (window.dzNightglassSettings) {
                    window.dzNightglassSettings.set(LEGACY_KEY, JSON.stringify(keep));
                }
                _nativeFetch = null;
                _cache = null;
                return fetchNativeLibraries(true).then(function () {
                    reloadNativeStylesheets();
                    if (typeof _onNativeChange === 'function') _onNativeChange();
                });
            });
        });
    }
    window.dzMigrateIconLibraries = migrateLegacyLibraries;

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

    /* The glyph is always the last whitespace token; the ones before it are
       style/base classes. "ph ph-acorn" → "ph-acorn". */
    function glyphTokenOf(cls) {
        return String(cls || '').trim().split(/\s+/).pop() || '';
    }

    /* "ph ph-acorn" → "acorn" */
    function labelOf(cls) {
        return glyphTokenOf(cls).replace(/^[a-z0-9]+-/i, '').replace(/-/g, ' ').trim();
    }

    /* An override stored before base classes were emitted is a bare token
       ("bi-alarm"); still mark its tile ("bi bi-alarm") as the current pick.
       Only a bare token may match loosely, so "fa-solid fa-house" and
       "fa-brands fa-house" stay distinct. */
    function sameIcon(a, b) {
        if (!a || !b) return false;
        return a === b || a === glyphTokenOf(b) || b === glyphTokenOf(a);
    }

    /* ── Recent (localStorage) ────────────────────────────────────── */
    /* Guarded on read as well as write: the list is user-editable storage that
       gets interpolated into a class attribute. */
    function getRecent() {
        try {
            var list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') || [];
            return list.map(cleanClass).filter(Boolean);
        }
        catch (e) { return []; }
    }
    function pushRecent(cls) {
        cls = cleanClass(cls);
        if (!cls) return;
        try {
            var list = getRecent().filter(function (c) { return c !== cls; });
            list.unshift(cls);
            localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
        } catch (e) {}
    }

    /* Is this icon class still backed by an available library? Font Awesome is
       always present; other classes need their library (by prefix) installed. */
    function isKnownIcon(cls, libs) {
        var token = (cls || '').split(/\s+/)[0];
        if (!token) return false;
        if (token === 'fa' || token.indexOf('fa-') === 0) return true;
        for (var i = 0; i < libs.length; i++) {
            if (libs[i].prefix && (token === libs[i].prefix || token.indexOf(libs[i].prefix) === 0)) return true;
        }
        return false;
    }

    /* Drop recent icons whose library has been removed, so they don't linger as
       blank/invalid glyphs. */
    function pruneRecent(libs) {
        try {
            var kept = getRecent().filter(function (c) { return isKnownIcon(c, libs); });
            localStorage.setItem(RECENT_KEY, JSON.stringify(kept));
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
    var _relaxedDialogs = [];
    var _escHandler = null;

    /* jQuery UI modal dialogs (Domoticz's Utility "edit device" dialogs use
       modal: true) install a document-wide focusin trap. jQuery UI 1.12's
       _allowInteraction() only permits focus inside .ui-dialog / .ui-datepicker
       and drags it back otherwise — so our overlay, which lives on <body>,
       could not focus its own search box. Pressing Escape closed the dialog,
       removing the trap, which is why the field then became usable (#230).

       Teach any OPEN dialog to treat our overlay as legitimate, per instance so
       nothing global is monkey-patched, and undo it when we close. Doing this
       on the live instances (rather than the widget prototype) also works when
       the dialog was created before this module loaded. */
    function relaxOpenModalDialogs() {
        var $ = window.jQuery;
        if (!$ || !$.fn || !$.fn.jquery) return;
        try {
            $('.ui-dialog-content').each(function () {
                var inst = $(this).data('uiDialog') || $(this).data('dialog');
                if (!inst || typeof inst._allowInteraction !== 'function') return;
                if (inst._ngIsRelaxed) return;
                var orig = inst._allowInteraction;
                inst._allowInteraction = function (event) {
                    if ($(event.target).closest('.ng-is-overlay').length) return true;
                    return orig.call(this, event);
                };
                inst._ngIsRelaxed = true;
                _relaxedDialogs.push({ inst: inst, orig: orig });
            });
        } catch (e) {}
    }

    function restoreRelaxedDialogs() {
        _relaxedDialogs.forEach(function (r) {
            try { r.inst._allowInteraction = r.orig; delete r.inst._ngIsRelaxed; } catch (e) {}
        });
        _relaxedDialogs = [];
    }

    function close() {
        if (!_overlay) return;
        if (_escHandler) {
            document.removeEventListener('keydown', _escHandler, true);
            _escHandler = null;
        }
        restoreRelaxedDialogs();
        _onNativeChange = null;
        _overlay.classList.remove('ng-is--open');
        var el = _overlay;
        _overlay = null;
        setTimeout(function () { if (el.parentNode) el.remove(); }, 220);
    }

    function openIconStudio(opts) {
        opts = opts || {};
        if (_overlay) {
            /* Drop the outgoing overlay now rather than letting it fade: a new
               dialog is replacing it on screen anyway, and leaving it in the
               document would duplicate #ng-is-overlay. */
            var prev = _overlay;
            close();
            if (prev.parentNode) prev.remove();
        }

        var libs, all, groups;
        /* Sanitised: it is interpolated into the preview's class attribute. */
        var chosen    = cleanClass(opts.current);
        var scope     = 'all';           // 'all' | 'recent' | libId
        var query     = '';

        function buildData() {
            libs = configuredLibraries();
            all = enumerate();
            groups = groupByLibrary(all, libs);
        }
        /* A library may have been installed or removed since the last open, and
           its stylesheet is loaded by then either way, so never open on a stale
           enumeration. */
        _cache = null;
        buildData();
        /* pruneRecent() is deliberately NOT called here — it runs once the
           registry has been consulted (see the bottom of this function),
           because until then a recent icon from an installed library has no
           library to be recognised by and would be thrown away. */

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
            '    <div class="ng-is-rail"></div>' +
            '    <div class="ng-is-main"></div>' +
            '  </div>' +
            '  <div class="ng-is-foot">' +
            '    <div class="ng-is-manual">' +
            '      <span class="ng-is-manual-preview"><i class="' + (chosen || 'fa-solid fa-question') + '"></i></span>' +
            '      <input class="ng-is-manual-input" type="text" placeholder="Or paste any icon class (e.g. mdi mdi-home, fa-brands fa-github)" autocomplete="off">' +
            '      <button class="ng-is-manual-use" type="button">Use</button>' +
            '    </div>' +
            '    <div class="ng-is-manual-msg" role="alert"></div>' +
            '  </div>' +
            '</div>';

        document.body.appendChild(overlay);
        _overlay = overlay;
        requestAnimationFrame(function () { overlay.classList.add('ng-is--open'); });

        /* Class, not id: these lived under ids nothing else referenced, and a
           document-level id lookup can land on a still-fading overlay. */
        var railEl   = overlay.querySelector('.ng-is-rail');
        var mainEl   = overlay.querySelector('.ng-is-main');
        var searchEl = overlay.querySelector('.ng-is-search');
        var mInput   = overlay.querySelector('.ng-is-manual-input');
        var mPrev    = overlay.querySelector('.ng-is-manual-preview i');
        var mMsg     = overlay.querySelector('.ng-is-manual-msg');

        function apply(cls) {
            cls = cleanClass(cls);
            if (!cls) return false;
            pushRecent(cls);
            if (typeof opts.onPick === 'function') opts.onPick(cls);
            close();
            return true;
        }

        /* Icon tile */
        function tile(cls) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'ng-is-tile' + (sameIcon(cls, chosen) ? ' ng-is-tile--active' : '');
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

        /* ── Keyboard navigation over the rendered tiles ──────────────
           Index into whatever the main pane currently shows; -1 = nothing
           highlighted. renderMain() resets it because the tiles it points
           at are replaced wholesale. */
        var hi = -1;
        function tiles() { return mainEl.querySelectorAll('.ng-is-tile'); }

        /* Up/Down step by a full row, so they need the live column count.
           .ng-is-grid in settings-panel.css is `repeat(auto-fill, minmax(…))`,
           i.e. it varies with the dialog width — read the resolved track list
           back instead of hardcoding a number that would silently drift. */
        function columnsOf(tileEl) {
            var grid = tileEl && tileEl.parentNode;
            if (!grid) return 1;
            var tracks = (window.getComputedStyle(grid).gridTemplateColumns || '').trim();
            var n = tracks ? tracks.split(/\s+/).length : 0;
            return n > 0 ? n : 1;
        }

        function setHighlight(i, list) {
            if (hi >= 0 && list[hi]) list[hi].classList.remove('ng-is-tile--hi');
            hi = i;
            var el = list[hi];
            if (!el) return;
            el.classList.add('ng-is-tile--hi');
            if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
        }

        function onGridKeydown(e) {
            /* The manual-class field owns its own Enter/arrow behaviour. */
            if (e.target && e.target.closest && e.target.closest('.ng-is-manual')) return;

            var list = tiles();
            if (e.key === 'Enter') {
                if (hi >= 0 && list[hi]) { e.preventDefault(); list[hi].click(); }
                return;
            }
            var step;
            if (e.key === 'ArrowLeft')       step = -1;
            else if (e.key === 'ArrowRight') step = 1;
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') step = 0;
            else return;
            /* Left/Right belong to the caret while the user is typing. */
            if (step !== 0 && e.target === searchEl) return;
            if (!list.length) return;
            e.preventDefault();
            if (hi < 0) { setHighlight(0, list); return; }
            if (step === 0) step = (e.key === 'ArrowUp' ? -1 : 1) * columnsOf(list[hi]);
            setHighlight(Math.max(0, Math.min(list.length - 1, hi + step)), list);
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
        }

        /* ── Main pane ── */
        function renderMain() {
            mainEl.innerHTML = '';
            hi = -1;               // the tiles it indexed no longer exist

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
                    hi = -1;              // swapping the grid drops the tiles
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
                /* One installed library */
                var g = groups[scope];
                if (!g || !g.icons.length) {
                    mainEl.innerHTML = '<div class="ng-is-note"><i class="fa-solid fa-circle-info"></i> ' +
                        'No icons found in this library’s stylesheet. Paste the exact class below instead.' +
                        '</div>';
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
        /* Every keystroke would otherwise re-filter and re-tile a pool of
           thousands. Only the re-render is deferred, so the field itself stays
           responsive. */
        var searchTimer = null;
        searchEl.addEventListener('input', function () {
            var value = this.value.trim();
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function () {
                if (!_overlay) return;            // closed while waiting
                query = value;
                renderMain();
            }, SEARCH_DELAY);
        });

        function manualFeedback(msg) {
            mMsg.textContent = msg || '';
            mInput.classList.toggle('ng-is-invalid', !!msg);
        }
        function useManual() {
            var raw = mInput.value.trim();
            if (!raw) { manualFeedback('Enter an icon class first, e.g. mdi mdi-home.'); return; }
            var cls = cleanClass(raw);
            if (!cls) {
                manualFeedback('An icon class can only contain letters, numbers, spaces, - and _.');
                return;
            }
            manualFeedback('');
            apply(cls);
        }
        mInput.addEventListener('input', function () {
            var raw = this.value.trim();
            var cls = cleanClass(raw);
            mPrev.className = cls || 'fa-solid fa-question';
            manualFeedback(raw && !cls
                ? 'An icon class can only contain letters, numbers, spaces, - and _.' : '');
        });
        mInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); useManual(); }
        });
        overlay.querySelector('.ng-is-manual-use').addEventListener('click', useManual);
        overlay.querySelector('.ng-is-close').addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        overlay.addEventListener('keydown', onGridKeydown);

        /* Escape goes on the document in the CAPTURE phase: bound to the
           overlay it was missed as soon as focus left the dialog, and an open
           jQuery UI modal underneath would see the key first and close itself
           instead of us. Cancel only the picker, and drop the listener on
           close() so it never outlives this instance. */
        _escHandler = function (e) {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            close();
        };
        document.addEventListener('keydown', _escHandler, true);

        renderRail();
        renderMain();

        /* Reconcile with the registry on every open, so the Studio also
           self-heals on builds that never broadcast dz-webassets-changed. The
           same handler serves the broadcast while this overlay is on screen.
           fetchNativeLibraries() always resolves: on a Domoticz without the
           command it yields the empty list, leaving Font Awesome as the only
           library — which is exactly right there. */
        _onNativeChange = function () {
            if (_overlay !== overlay) return;      // a newer overlay owns the UI
            _cache = null;        // a library may have just come or gone
            buildData();
            pruneRecent(libs);    // self-heal: drop recents from removed libraries
            renderRail();
            renderMain();
        };
        fetchNativeLibraries(true).then(_onNativeChange);

        /* Must happen before we take focus: an open jQuery UI modal would
           otherwise steal it straight back (#230). */
        relaxOpenModalDialogs();
        setTimeout(function () { try { searchEl.focus(); } catch (e) {} }, 60);
    }

    window.dzOpenIconStudio = openIconStudio;

    /* Angular bootstraps after this file runs, so the injector is usually not
       there yet; retry briefly and then give up for good — on a Domoticz without
       the feature it will never appear, and the per-open refetch covers it. */
    if (!subscribeToNativeChanges()) {
        var tries = 0;
        var timer = setInterval(function () {
            if (subscribeToNativeChanges() || ++tries >= 20) clearInterval(timer);
        }, 500);
    }
})();
