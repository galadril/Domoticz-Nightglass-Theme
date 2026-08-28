/* ══════════════════════════════════════════════════════════════════
   ICON STUDIO — Nightglass icon picker overlay
   ──────────────────────────────────────────────────────────────────
   A large, reusable icon chooser used by the Device Icons editor (and
   anywhere that needs an icon class). It:
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

   Callers that can store an image (the device / Utility icon field) may
   also opt into a Custom source listing the user's ZIP-uploaded custom
   icons. Those are PNGs, not glyphs, so they carry a CustomImage number
   rather than a class and come back through onPickImage.

   Callers that are editing ONE device may likewise opt into the animation
   row, which is the same opt-in shape: it needs somewhere to store the
   choice, so it appears only for a caller that passes onPickAnimation.
   Animation is a second axis rather than part of the pick, so clicking a
   tile reports it and leaves the dialog open.

   Public API:
     window.dzOpenIconStudio({
         current,        // class string of the current pick, if any
         currentImage,   // CustomImage number of the current pick, if any
         allowImages,    // offer the Custom (uploaded image) source
         animation,      // animation id currently set, '' for none
         animationGlyph, // glyph to preview the animations on (default: current)
         onPick,         // fn(classString)
         onPickImage,    // fn(customImage, item)
         onPickAnimation,// fn(animationId) — offers the animation row
         title
     })
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

    /* ── Domoticz's uploaded custom icons ──────────────────────────────
       The ZIP uploads on Setup → More Options → Custom Icons. They are PNGs,
       so they are the one thing an icon class cannot express, and the only
       reason this module talks about images at all.

       Only the uploads are offered — not Domoticz's 38 built-in switch icons.
       Every one of those now carries an FaClass (verified against
       custom_light_icons on 2026.3), which is what Domoticz renders for
       CustomImage 1..99 and what Nightglass substitutes for their PNGs on
       older builds. So a "Domoticz" source would be a second, worse-labelled
       route to glyphs the Font Awesome source already lists: picking "Alarm"
       and picking fa-solid fa-bell produce the identical result. Native
       offers both because its glyph source is a separate opt-in; here glyphs
       are the default, so the built-ins are pure duplication. */
    var _imgSet = null;      // null = never read; [] = read, none uploaded
    var _imgFetch = null;

    function customImages() { return _imgSet || []; }

    function fetchCustomImages(force) {
        if (_imgFetch && !force) return _imgFetch;
        var job = fetch('json.htm?type=command&param=getcustomiconset',
                        { credentials: 'same-origin' })
            .then(function (r) { if (!r.ok) throw 0; return r.json(); })
            .then(function (d) {
                if (!d || d.status !== 'OK' || !Array.isArray(d.result)) throw 0;
                var list = [];
                d.result.forEach(function (it) {
                    var id = parseInt(it && it.idx, 10);
                    if (isNaN(id)) return;
                    var src = String(it.IconFile48On || it.IconFile16 || '');
                    if (!src) return;
                    list.push({
                        kind: 'img',
                        /* Cmd_GetCustomIconSet (main/WebServerCmds.cpp) emits
                           only icons whose internal idx is >= 100 — the
                           CustomImages table, i.e. the uploads — and reports
                           `icon.idx - 100`. DeviceStatus.CustomImage stores the
                           internal value, so the 100 that
                           ReloadCustomSwitchIcons() added has to go back on.
                           Get this wrong and a pick silently lands on a
                           different icon, so it is stored resolved, once,
                           here rather than re-derived at each use site. */
                        value: id + 100,
                        src: src,
                        name: String(it.Title || '').trim() || ('#' + id),
                        desc: String(it.Description || '').trim()
                    });
                });
                _imgSet = list;
                return list;
            })
            .catch(function () {
                /* A Domoticz that refuses the command (or a session without
                   rights) leaves the source absent rather than empty, and gets
                   another chance on the next open. */
                if (_imgFetch === job) _imgFetch = null;
                return customImages();
            });
        _imgFetch = job;
        return job;
    }

    function findCustomImage(value) {
        var list = customImages();
        for (var i = 0; i < list.length; i++) {
            if (list[i].value === value) return list[i];
        }
        return null;
    }

    /* The uploaded-icon list with the +100 already applied, i.e. keyed by the
       value DeviceStatus.CustomImage stores. Published because a caller that
       renders a CustomImage it did not just pick (the settings editor's device
       rows) needs the same resolution the picker uses — re-deriving the offset
       at a second site is exactly how a pick lands on the wrong icon. */
    window.dzCustomIcons = function (cb) {
        fetchCustomImages().then(function (list) { cb(list || []); },
                                 function ()     { cb([]); });
    };

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

    /* ── Animations ───────────────────────────────────────────────────
       The catalogue is icons.js's (window.dzIconAnimations); this module
       only renders it. Both reads are guarded so the row degrades to
       nothing at all rather than half a row if that module is absent. */
    function animCatalogue() {
        return (window.dzIconAnimations || []);
    }
    function animClassOf(id) {
        return (typeof window.dzIconAnimClass === 'function')
            ? window.dzIconAnimClass(id) : '';
    }
    /* '' for anything not in the catalogue — including a stale id from an
       override written by a later version of the theme. */
    function animIdOf(value) {
        var v = String(value == null ? '' : value);
        var list = animCatalogue();
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === v) return v;
        }
        return '';
    }

    /* An override stored before base classes were emitted is a bare token
       ("bi-alarm"); still mark its tile ("bi bi-alarm") as the current pick.
       Only a bare token may match loosely, so "fa-solid fa-house" and
       "fa-brands fa-house" stay distinct. */
    function sameIcon(a, b) {
        if (!a || !b) return false;
        return a === b || a === glyphTokenOf(b) || b === glyphTokenOf(a);
    }

    /* ── Recent (localStorage) ──────────────────────────────────────
       An entry is either a class string (a glyph) or { kind:'img', value:N }
       (an uploaded image, N = CustomImage). On disk images are stored as
       { ci: N }: an older Nightglass runs cleanClass() over every entry, which
       turns an object into "[object Object]", fails SAFE_CLASS_RE and drops it
       — so a mixed list degrades to the glyphs it can use instead of rendering
       a broken tile.

       Guarded on read as well as write: the list is user-editable storage that
       gets interpolated into a class attribute. */
    function isImgEntry(e) { return !!(e && typeof e === 'object' && e.kind === 'img'); }
    function entryKey(e)   { return isImgEntry(e) ? 'ci:' + e.value : String(e); }

    function getRecent() {
        try {
            var list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') || [];
            var out = [];
            list.forEach(function (e) {
                if (e && typeof e === 'object') {
                    var ci = parseInt(e.ci, 10);
                    if (ci > 0) out.push({ kind: 'img', value: ci });
                    return;
                }
                var cls = cleanClass(e);
                if (cls) out.push(cls);
            });
            return out;
        }
        catch (e) { return []; }
    }
    function storeRecent(list) {
        try {
            localStorage.setItem(RECENT_KEY, JSON.stringify(
                list.slice(0, RECENT_MAX).map(function (e) {
                    return isImgEntry(e) ? { ci: e.value } : e;
                })));
        } catch (e) {}
    }
    function pushRecent(entry) {
        if (isImgEntry(entry)) {
            if (!(parseInt(entry.value, 10) > 0)) return;
            entry = { kind: 'img', value: parseInt(entry.value, 10) };
        } else {
            entry = cleanClass(entry);
            if (!entry) return;
        }
        var key = entryKey(entry);
        var list = getRecent().filter(function (e) { return entryKey(e) !== key; });
        list.unshift(entry);
        storeRecent(list);
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

    /* Drop recent icons whose library has been removed, or whose uploaded image
       has been deleted, so they don't linger as blank tiles. An image is only
       judged once the set has actually been read: before that, "not in the
       list" means "list not loaded", not "deleted". */
    function pruneRecent(libs) {
        var kept = getRecent().filter(function (e) {
            if (isImgEntry(e)) return _imgSet === null || !!findCustomImage(e.value);
            return isKnownIcon(e, libs);
        });
        storeRecent(kept);
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

        var libs, all, groups, imgs;
        /* Sanitised: it is interpolated into the preview's class attribute. */
        var chosen    = cleanClass(opts.current);
        var chosenImg = parseInt(opts.currentImage, 10) || 0;
        /* Images need somewhere to go, so the source is only offered to a
           caller that can store one. */
        var allowImg  = !!opts.allowImages && typeof opts.onPickImage === 'function';
        /* Same rule for the animation row: no store, no row. That also keeps
           it out of callers with no device to attach it to. */
        var allowAnim = typeof opts.onPickAnimation === 'function' &&
                        animCatalogue().length > 0;
        var animPick  = animIdOf(opts.animation);

        /* On/off (and beyond) target slots.  Domoticz's own native picker
           gained a distinct off-state icon, and this mirrors it: each slot is
           { key, label, cls }, the grid assigns to whichever is active, and
           onPickSlot(key, cls) reports it.  A caller that passes no slots gets
           the classic single-target picker unchanged. */
        var slots = (Array.isArray(opts.slots) &&
                     typeof opts.onPickSlot === 'function')
            ? opts.slots.map(function (s) {
                  return { key: s.key, label: s.label, cls: cleanClass(s.cls) };
              })
            : null;
        var activeSlot = 0;
        if (slots && slots.length) chosen = slots[0].cls || chosen;
        /* Icon and CustomImage are alternatives in the store, and Domoticz
           resolves the glyph first, so a slotted caller handing over both is
           really saying "glyph". Only that caller can be read this way: the
           slot-less picker passes the device type's own fallback glyph
           alongside a real image pick on purpose. */
        if (slots && slots.length && slots[0].cls) chosenImg = 0;

        /* With a second axis to set — an off icon, an animation, or both — an
           icon click refines the choice rather than finishing it, so the dialog
           stays open and the user closes it with Done / Esc.  Without one it is
           still pick-and-go. */
        var keepOpen  = !!(slots && slots.length) || allowAnim;
        var scope     = 'all';           // 'all' | 'recent' | 'custom' | libId
        var query     = '';

        function buildData() {
            libs = configuredLibraries();
            all = enumerate();
            groups = groupByLibrary(all, libs);
            imgs = allowImg ? customImages() : [];
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
            (slots ? '  <div class="ng-is-slotbar"></div>' : '') +
            '  <div class="ng-is-body">' +
            '    <div class="ng-is-rail"></div>' +
            '    <div class="ng-is-main"></div>' +
            '  </div>' +
            '  <div class="ng-is-foot">' +
            (allowAnim ? '    <div class="ng-is-anim"></div>' : '') +
            '    <div class="ng-is-manual">' +
            '      <span class="ng-is-manual-preview"><i class="' + (chosen || 'fa-solid fa-question') + '"></i></span>' +
            '      <input class="ng-is-manual-input" type="text" placeholder="Or paste any icon class (e.g. mdi mdi-home, fa-brands fa-github)" autocomplete="off">' +
            '      <button class="ng-is-manual-use" type="button">Use</button>' +
            (keepOpen ? '      <button class="ng-is-done" type="button">Done</button>' : '') +
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
        var slotbarEl = overlay.querySelector('.ng-is-slotbar');

        /* The record behind the current image pick, or null when the selection
           is a glyph. Held as a number rather than as the record so it survives
           the uploaded set being re-read, and resolved here on every render:
           on open the set is usually still in flight, and a caller can hand us
           a CustomImage before there is anything to look it up in. */
        function chosenImage() {
            if (!chosenImg) return null;
            return findCustomImage(chosenImg) ||
                   { kind: 'img', value: chosenImg, src: '', name: '#' + chosenImg, desc: '' };
        }

        function apply(cls) {
            cls = cleanClass(cls);
            if (!cls) return false;
            pushRecent(cls);
            /* A glyph and an uploaded image are one choice, not two layers —
               both stores drop the image when a glyph is written — so picking
               one has to unset the other here as well. */
            chosenImg = 0;
            if (slots) {
                /* Assign to the active slot and stay put: the user is likely to
                   set the other slot next. */
                slots[activeSlot].cls = cls;
                chosen = cls;
                opts.onPickSlot(slots[activeSlot].key, cls);
                renderSlots();
                renderMain();          // move the grid's "current" marker
                if (allowAnim) renderAnimRow();   // preview on the new on-icon
                if (mPrev) mPrev.className = cls;
                return true;
            }
            if (typeof opts.onPick === 'function') opts.onPick(cls);
            if (keepOpen) {
                /* Caller that stays open (the Device Icons editor): report the
                   icon but leave the dialog up so the animation row is still
                   there. Re-render that row too — the tiles animate the
                   selected glyph, so leaving them on the previous one made a
                   pick look like it had not registered. `chosen` is assigned
                   first because renderAnimRow() reads it. */
                chosen = cls;
                renderMain();
                if (allowAnim) renderAnimRow();
                if (mPrev) mPrev.className = cls;
                return true;
            }
            close();
            return true;
        }

        function applyImage(item) {
            if (!allowImg || !item || !(item.value > 0)) return false;
            pushRecent(item);
            /* The image becomes THE selection and the glyph one steps aside —
               same exclusivity apply() enforces the other way round. The slots
               keep their classes rather than being cleared: they mirror the
               caller's own copy of the on/off pair, which is what a later glyph
               pick writes back, so emptying them here would only put the two
               out of step. chosenImg is what every render reads to decide which
               kind is set. */
            chosenImg = item.value;
            /* Whichever slot was being edited, the next glyph pick is the
               on-icon: that is the only slot the bar offers while an image is
               set, and it is where the pair starts again. */
            activeSlot = 0;
            opts.onPickImage(item.value, item);
            /* An uploaded image is a whole-icon choice — there is no separate
               off PNG — so it finishes the icon axis.  Keep the dialog open
               only if there is still an animation to set. */
            if (keepOpen) {
                if (slots) renderSlots();
                renderMain();          // move the grid's "current" marker
                if (allowAnim) renderAnimRow();
                /* The footer swatch previews an icon class, which an image has
                   none of; back to the placeholder rather than leaving the
                   previous glyph standing as if it were still the pick. */
                if (mPrev) mPrev.className = 'fa-solid fa-question';
                return true;
            }
            close();
            return true;
        }

        /* What a slot holds, drawn: an uploaded PNG is an <img>, a glyph an
           <i>, and a slot with neither gets the empty-square placeholder —
           which is also what an image whose record has not arrived yet shows,
           rather than a broken <img>. */
        function slotIcon(cls, img) {
            if (img && img.src) {
                var im = document.createElement('img');
                im.src = img.src;
                im.alt = '';
                return im;
            }
            var ic = document.createElement('i');
            ic.className = cls || 'fa-regular fa-square';
            return ic;
        }

        function slotText(el, label, sub) {
            var lab = document.createElement('span');
            lab.className = 'ng-is-slot-label';
            lab.textContent = label;
            var s = document.createElement('em');
            s.className = 'ng-is-slot-cls';
            /* Server-supplied for an image (its Title), so text, not markup. */
            s.textContent = sub;
            el.appendChild(lab);
            el.appendChild(s);
        }

        /* On/off target bar (only when the caller passes slots). */
        function renderSlots() {
            if (!slotbarEl) return;
            slotbarEl.innerHTML = '';
            var lead = document.createElement('span');
            lead.className = 'ng-is-slotbar-lead';
            lead.textContent = 'Editing';
            slotbarEl.appendChild(lead);

            /* An uploaded image is the whole icon: it ships one PNG, so there
               is no off state to express and nowhere to store one if there
               were. While one is picked the bar therefore states the single
               icon that is set instead of offering an off slot that could not
               be saved — picking any glyph hands the on/off pair straight
               back. */
            var img = chosenImage();
            if (img) {
                var one = document.createElement('span');
                one.className = 'ng-is-slot ng-is-slot--active ng-is-slot--img';
                one.appendChild(slotIcon('', img));
                slotText(one, 'Icon', img.name);
                slotbarEl.appendChild(one);
                return;
            }

            slots.forEach(function (s, i) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'ng-is-slot' + (i === activeSlot ? ' ng-is-slot--active' : '');
                b.appendChild(slotIcon(s.cls, null));
                slotText(b, s.label, s.cls ? labelOf(s.cls) : 'not set');
                b.addEventListener('click', function () {
                    activeSlot = i;
                    chosen = s.cls;
                    renderSlots();
                    renderMain();
                    if (mPrev) mPrev.className = s.cls || 'fa-solid fa-question';
                });
                slotbarEl.appendChild(b);
            });
        }

        /* One tile for both kinds. An entry is a class string (glyph) or an
           uploaded-image record; everything above this point keeps them in the
           same arrays so search, the cap and the keyboard cursor need no idea
           which is which. */
        function tile(entry) {
            var b = document.createElement('button');
            b.type = 'button';
            var isImg = isImgEntry(entry);
            /* One selection, so at most one marker: a glyph tile only counts as
               current while no image is picked, or the fallback glyph a caller
               opens on would sit lit up next to the image actually in use. */
            var active = isImg ? (entry.value === chosenImg)
                               : (!chosenImg && sameIcon(entry, chosen));
            b.className = 'ng-is-tile' + (active ? ' ng-is-tile--active' : '');

            if (isImg) {
                b.classList.add('ng-is-tile--img');
                b.title = entry.desc ? entry.name + ' — ' + entry.desc : entry.name;
                var im = document.createElement('img');
                im.src = entry.src;
                im.alt = '';
                var label = document.createElement('span');
                /* Title and Description come from the server; set as text so a
                   name with markup in it stays a name. */
                label.textContent = entry.name;
                b.appendChild(im);
                b.appendChild(label);
                b.addEventListener('click', function () { applyImage(entry); });
                return b;
            }

            b.title = labelOf(entry);
            b.innerHTML = '<i class="' + entry + '"></i><span>' + labelOf(entry) + '</span>';
            b.addEventListener('click', function () { apply(entry); });
            return b;
        }

        function gridOf(entries, capped) {
            var grid = document.createElement('div');
            grid.className = 'ng-is-grid';
            var list = capped ? entries.slice(0, RESULT_CAP) : entries;
            list.forEach(function (e) { grid.appendChild(tile(e)); });
            if (capped && entries.length > RESULT_CAP) {
                var more = document.createElement('div');
                more.className = 'ng-is-note';
                more.textContent = 'Showing ' + RESULT_CAP + ' of ' + entries.length +
                                   ' — search to narrow down.';
                grid.appendChild(more);
            }
            return grid;
        }

        /* A recent image is stored as just its number; the name and PNG live in
           the uploaded set, which may not be read yet. Entries the current
           caller cannot pick are dropped rather than shown as dead tiles. */
        function recentEntries() {
            return getRecent().filter(function (e) {
                return allowImg || !isImgEntry(e);
            }).map(function (e) {
                if (!isImgEntry(e)) return e;
                return findCustomImage(e.value) ||
                       { kind: 'img', value: e.value, src: '', name: '#' + e.value, desc: '' };
            });
        }

        function imageHits(q) {
            return imgs.filter(function (it) {
                return !q || (it.name + ' ' + it.desc).toLowerCase().indexOf(q) !== -1;
            });
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
            /* The footer owns its own Enter/arrow behaviour: the manual-class
               field types, and an animation tile is a plain focusable button
               whose native Enter must not be stolen by the grid cursor. */
            if (e.target && e.target.closest &&
                e.target.closest('.ng-is-manual, .ng-is-anim')) return;

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
            var items = [{ id: 'all', name: 'All icons', icon: 'fa-layer-group',
                           count: all.length + imgs.length },
                         { id: 'recent', name: 'Recent', icon: 'fa-clock-rotate-left',
                           count: recentEntries().length }];
            /* Only when there is something in it: an empty source in the rail
               is a dead end, and the note in the main pane cannot be seen
               without clicking it. */
            if (imgs.length) {
                items.push({ id: 'custom', name: 'Custom images', icon: 'fa-upload',
                             count: imgs.length });
            }
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
                /* Images lead. There are a handful of them against thousands of
                   glyphs, so appending would push them past RESULT_CAP and the
                   one source the user cannot reach any other way would be the
                   one that got truncated away. */
                if (allowImg) hits = imageHits(q).concat(hits);
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
                var recent = recentEntries();
                if (!recent.length) {
                    mainEl.innerHTML = '<div class="ng-is-note">No recent icons yet — the ones you pick will appear here.</div>';
                    return;
                }
                mainEl.appendChild(gridOf(recent, false));
                return;
            }

            if (scope === 'custom') {
                if (!imgs.length) {
                    mainEl.innerHTML = '<div class="ng-is-note"><i class="fa-solid fa-cloud-arrow-up"></i> ' +
                        'No custom icons uploaded yet. Add them on Setup ▸ More Options ▸ Custom Icons.' +
                        '</div>';
                    return;
                }
                mainEl.appendChild(gridOf(imgs, false));
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

            /* All: collapsible section per source */
            function section(name, entries) {
                var sec = document.createElement('div');
                sec.className = 'ng-is-section';
                var head = document.createElement('button');
                head.type = 'button';
                head.className = 'ng-is-section-head';
                head.innerHTML = '<i class="fa-solid fa-chevron-down"></i> ' + name +
                                 ' <em>' + entries.length + '</em>';
                var body = document.createElement('div');
                body.className = 'ng-is-section-body';
                body.appendChild(gridOf(entries, true));
                head.addEventListener('click', function () {
                    var open = sec.classList.toggle('ng-is-section--collapsed');
                    head.querySelector('i').className = open ? 'fa-solid fa-chevron-right'
                                                             : 'fa-solid fa-chevron-down';
                });
                sec.appendChild(head);
                sec.appendChild(body);
                mainEl.appendChild(sec);
            }

            /* Uploaded images first: it is the shortest list and the only one
               whose contents are the user's own. */
            if (imgs.length) section('Custom images', imgs);

            libs.forEach(function (l) {
                var g = groups[l.id];
                section(l.name, g ? g.icons : []);
            });
        }

        /* ── Animation row ────────────────────────────────────────────
           A row of tiles, each rendering the icon that is actually selected
           with one catalogue animation applied — the same .dz-anim-* class
           the card icon gets, so what the tile does is what the device will
           do. The choice is made by watching rather than by reading a name,
           which is why there is no dropdown here. */
        function renderAnimRow() {
            var wrap = overlay.querySelector('.ng-is-anim');
            if (!wrap) return;
            /* Preview on the icon under discussion — the on/active icon, which
               is what animates on the card.  apply() re-renders this row on
               every pick, so the order here decides which icon the tiles show:
               `chosen` is the live selection and has to win, because
               opts.animationGlyph is only the caller's opening hint and goes
               stale the moment the user picks something else. With slots, slot
               0 IS the on-icon and outranks both. */
            var glyph = (slots && slots[0].cls) || chosen ||
                        cleanClass(opts.animationGlyph) || 'fa-solid fa-lightbulb';
            /* …unless the selection is an uploaded PNG, which outranks every
               glyph above: those are only ever the fallback the caller opened
               on, and the tiles have to show what the device will actually
               animate. */
            var img = chosenImage();

            wrap.innerHTML =
                '<div class="ng-is-anim-head">Animation ' +
                '<em>plays while the device is on</em></div>' +
                '<div class="ng-is-anim-strip"></div>';
            var strip = wrap.querySelector('.ng-is-anim-strip');

            /* "No animation" is the default, so it leads the row. */
            var entries = [{ id: '', label: 'No animation', hint: 'Holds still' }]
                .concat(animCatalogue());

            entries.forEach(function (a) {
                var b = document.createElement('button');
                b.type = 'button';
                b.className = 'ng-is-anim-tile' +
                    (a.id ? '' : ' ng-is-anim-tile--off') +
                    (a.id === animPick ? ' ng-is-anim-tile--active' : '');
                b.title = a.hint ? a.label + ' — ' + a.hint : a.label;

                /* Every animation in the catalogue drives transform and opacity
                   only (section 25 of animations.css), and the classes carry no
                   element requirement, so an <img> moves under them exactly as
                   a glyph does. */
                var ic;
                if (img && img.src) {
                    ic = document.createElement('img');
                    ic.src = img.src;
                    ic.alt = '';
                    if (a.id) ic.className = animClassOf(a.id);
                } else {
                    ic = document.createElement('i');
                    ic.className = glyph + (a.id ? ' ' + animClassOf(a.id) : '');
                }
                var lbl = document.createElement('span');
                lbl.textContent = a.label;
                b.appendChild(ic);
                b.appendChild(lbl);

                b.addEventListener('click', function () {
                    animPick = a.id;
                    strip.querySelectorAll('.ng-is-anim-tile').forEach(function (t) {
                        t.classList.remove('ng-is-anim-tile--active');
                    });
                    b.classList.add('ng-is-anim-tile--active');
                    /* Reported straight away and the dialog stays open: this is
                       a second axis, not the pick, and the user may well want to
                       change the icon in the same visit. */
                    opts.onPickAnimation(a.id);
                });
                strip.appendChild(b);
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
        var doneBtn = overlay.querySelector('.ng-is-done');
        if (doneBtn) doneBtn.addEventListener('click', close);
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
        if (slots)     renderSlots();
        if (allowAnim) renderAnimRow();

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
            /* The image pick is held as a number, so its name and PNG only
               exist once the uploaded set has been read — repaint the previews
               that draw it when that lands. Only then: rebuilding the animation
               tiles restarts every keyframe list from frame zero, which is a
               visible stutter to spend on nothing when a glyph is selected. */
            if (chosenImg) {
                if (slots) renderSlots();
                if (allowAnim) renderAnimRow();
            }
        };
        fetchNativeLibraries(true).then(_onNativeChange);

        /* Same deal for the uploaded icons: they are added and deleted on
           Domoticz's Custom Icons page, so re-read them on every open rather
           than trusting a set fetched at some earlier point in the session.
           Only for a caller that can store one — nothing else has any use for
           the request. */
        if (allowImg) fetchCustomImages(true).then(_onNativeChange);

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
