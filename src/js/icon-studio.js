/* ══════════════════════════════════════════════════════════════════
   ICON STUDIO — Nightglass icon picker overlay
   ──────────────────────────────────────────────────────────────────
   A large, reusable icon chooser used by the Device Icon Overrides
   editor (and anywhere that needs an icon class). It:
     • enumerates EVERY icon-font glyph the browser has loaded (all of
       Font Awesome 7 + any extra library the user added), grouped by
       library with counts;
     • supports user-added icon libraries (Material Design Icons, etc.)
       via a settings-managed stylesheet URL + prefix (issue #129). Each
       library is downloaded once, its fonts inlined, and then stored ON THE
       DOMOTICZ SERVER (www/assets/ via the `uploadwebasset` API) so every
       browser loads it locally. Where that isn't possible (non-admin session,
       or a Domoticz without the endpoint) it falls back to a per-browser
       IndexedDB copy, and finally to the source URL;
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
    var SEARCH_DELAY = 200;          // ms; matches the native Domoticz picker

    /* Popular icon-font libraries offered as one-click suggestions in the
       manager (prefilled, NOT auto-enabled). Nightglass downloads + caches
       them locally in the browser, so the user still only needs a source URL
       and prefix. */
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
    /* Returns [{ id, name, prefix }] — the implicit Font Awesome library, any
       user-configured ones, and any library Domoticz itself manages. */
    function configuredLibraries() {
        var libs = [{ id: 'fa', name: 'Font Awesome', prefix: 'fa' }];
        var byPrefix = {};
        try {
            var raw = (window.dzNightglassSettings &&
                       window.dzNightglassSettings.get('iconLibraries')) || '[]';
            var arr = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
            (arr || []).forEach(function (l) {
                if (!l || !l.prefix) return;
                var entry = {
                    id: l.id || l.prefix, name: l.name || l.prefix,
                    prefix: l.prefix, cssUrl: l.cssUrl,
                    /* assetPath = stored on this Domoticz server; must be
                       carried through so loads/reopens use the local copy
                       instead of going back out to the source URL. */
                    assetPath: l.assetPath,
                    unavailable: !!_nativeGone[l.id || l.prefix]
                };
                byPrefix[entry.prefix] = entry;
                libs.push(entry);
            });
        } catch (e) {}

        /* Domoticz's own registry is APPENDED, never substituted. On a prefix
           collision the Nightglass entry wins because it carries the cssUrl and
           assetPath a registry row has no equivalent of — but the registry's
           Title is a real display name, so adopt it when ours is nothing better
           than the bare prefix. */
        nativeLibraries().forEach(function (n) {
            var mine = byPrefix[n.prefix];
            if (mine) {
                if (n.title && mine.name === mine.prefix) mine.name = n.title;
                return;
            }
            /* `managed` records provenance for the code, not for the UI: it is
               what tells the loader this library is Domoticz's to fetch. */
            libs.push({
                id: n.id, name: n.name, prefix: n.prefix,
                cssUrl: n.cssUrl, assetPath: n.assetPath,
                managed: 'domoticz'
            });
        });
        return libs;
    }

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

    /* ── Domoticz's own icon-library registry ──────────────────────────
       Newer Domoticz manages icon libraries itself: they live in the WebAssets
       table, are added/removed on Setup → Custom Icons, and are listed by the
       `getwebassets` command. Without this, adding or removing a library there
       was invisible to the Studio — new ones never showed up and removed ones
       lingered as broken entries.

       It is strictly an ADDITIONAL source. Stable Domoticz has none of it, so
       every read is guarded and a missing or failing endpoint must leave
       behaviour byte-for-byte as it was: nothing is cleared, no <link> is
       dropped and no recent is pruned off the back of a failed fetch.

       _nativeLibs stays null until one read actually succeeds, which is also
       its permanent value on a Domoticz without the endpoint. */
    var _nativeLibs = null;
    var _nativeFetch = null;
    var _nativeGone = {};        // our libs whose uploaded asset has vanished
    var _onNativeChange = null;  // set while the Studio is open

    function nativeLibraries() { return _nativeLibs || []; }

    /* Nightglass uploads its own packaged copies as `iconfont-<prefix>.css`
       (see assetFileName below) and Domoticz lists those rows too. They are
       already represented by the iconLibraries entry that owns them, and their
       stem would derive the bogus prefix "iconfont-mdi", so they are not
       libraries as far as this merge is concerned. */
    function isOwnAssetName(name) {
        return /^iconfont-/i.test(String(name || ''));
    }

    /* `assets/iconfont-mdi.css?v=1756…` → `iconfont-mdi.css`. The cache-busting
       query is ours alone and registry rows never carry one, so removal
       detection has to compare on the bare file name. */
    function assetNameOf(path) {
        var clean = String(path || '').split('?')[0].split('#')[0];
        return clean.slice(clean.lastIndexOf('/') + 1).toLowerCase();
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
        var path = asset.path || ('assets/' + name);
        /* cssUrl here is a cache key and a same-origin read path, not a download
           source — Domoticz owns fetching this library. Folding LastUpdate in
           makes a refresh on the native page miss the stored class list instead
           of serving the previous copy's glyphs. */
        var stamp = String(asset.LastUpdate || '').replace(/[^0-9]/g, '');
        return {
            id: prefix,
            name: title || prefix,
            prefix: prefix,
            title: title,
            assetPath: path,
            cssUrl: path + (stamp ? '?ts=' + stamp : '')
        };
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
                var libs = [], seen = {};
                d.result.forEach(function (a) {
                    var lib = deriveNativeLib(a);
                    if (!lib || seen[lib.prefix]) return;
                    seen[lib.prefix] = true;
                    libs.push(lib);
                });
                _nativeLibs = libs;
                reconcileOwnAssets(d.result);
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

    /* One of our own libraries whose uploaded copy is gone from the registry was
       removed on the native Custom Icons page. Treat it as gone — but keep the
       user's iconLibraries entry, since a settings entry still holds the source
       URL needed to reinstall it. Only ever reached from a SUCCESSFUL read. */
    function reconcileOwnAssets(rows) {
        var present = {};
        rows.forEach(function (a) {
            if (a && a.name) present[String(a.name).toLowerCase()] = true;
        });
        var changed = false;
        readLibsRaw().forEach(function (l) {
            if (!l || !l.assetPath) return;
            var id = l.id || l.prefix;
            if (present[assetNameOf(l.assetPath)]) {
                if (_nativeGone[id]) { delete _nativeGone[id]; changed = true; }
                return;
            }
            if (_nativeGone[id]) return;
            _nativeGone[id] = true;
            changed = true;
            forgetVanishedLibrary(l);
        });
        if (!changed) return;
        _cache = null;
        /* Re-run injection so a library that came BACK gets its <link> again;
           the ones still flagged are skipped there and swept away. */
        if (window.dzInjectIconLibraries) window.dzInjectIconLibraries(readLibsRaw());
    }

    function forgetVanishedLibrary(l) {
        var id = l.id || l.prefix;
        var domId = libraryDomId(l);
        var link = document.getElementById(domId);
        if (link && link.parentNode) {
            revokeLibraryBlobUrl(domId);
            link.parentNode.removeChild(link);
        }
        delete _libIcons[id];
        delete _libPackageLoads[libraryKey(l)];
        setLibStatus(id, 'missing');
        /* Both keys: the class list may have been stored under the source URL or
           under the server path, depending on which route loaded it. */
        dropLibCache(l.cssUrl);
        dropLibCache(l.assetPath);
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

    /* `<prefix>.css` is the name Domoticz's own Custom Icons page derives from
       a prefix, so a migrated library is indistinguishable from a hand-added
       one — including having the prefix read back off the file stem. */
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
       place it would keep its Domoticz-injected <link>, so the same font would
       be fetched and declared twice for the rest of the install's life. Scoped
       to our own `iconfont-` naming and only ever reached after that library's
       migration succeeded. */
    function dropOwnUpload(assetPath) {
        var name = assetNameOf(assetPath);
        if (!/^iconfont-[a-z0-9_-]+\.css$/.test(name)) return;
        fetch('json.htm?type=command&param=deletewebasset&name=' + encodeURIComponent(name),
              { credentials: 'same-origin' }).catch(function () {});
    }

    function migrateLegacyLibraries() {
        if (_migrationDone) return;
        var stored = readLibsRaw();
        /* Nothing to migrate — but settings load asynchronously, so this may
           simply be too early to tell. Stay un-done and let the next call
           decide. */
        if (!stored.length) return;
        _migrationDone = true;

        fetchNativeLibraries(true).then(function () {
            /* No registry on this build: there is nowhere to migrate TO, and
               the entries have to keep working the way they always did. */
            if (!_nativeLibs) return;
            var registered = {};
            _nativeLibs.forEach(function (n) { registered[normalizePrefix(n.prefix)] = true; });

            return Promise.all(stored.map(function (l) {
                var prefix = normalizePrefix(l && l.prefix);
                /* Already Domoticz's, whether this run put it there or an
                   earlier one did — which is what makes this idempotent. */
                if (prefix && registered[prefix]) return true;
                /* The server installs from a public http(s) URL only; a
                   relative path or a LAN address is refused. Don't ask, and
                   above all don't discard the only copy of that URL. */
                if (!prefix || !/^https?:\/\//i.test(String((l && l.cssUrl) || ''))) return false;
                return installFromUrl(nativeAssetName(prefix), l.cssUrl, l.name || prefix)
                    .then(function (ok) {
                        if (ok && l.assetPath) dropOwnUpload(l.assetPath);
                        return ok;
                    });
            })).then(function (moved) {
                var keep = stored.filter(function (l, i) { return !moved[i]; });
                if (keep.length === stored.length) return null;
                /* saveLibsRaw() re-runs the injector, which sweeps the <link>s
                   of the entries that just left. */
                saveLibsRaw(keep);
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

    /* ── Cross-origin library download + local caching ────────────────
       Nightglass keeps the user-facing config simple (name + URL + prefix)
       but downloads the stylesheet and its assets itself, rewrites those
       asset URLs into embedded data: URLs, stores the result in IndexedDB,
       and injects a local blob stylesheet on later loads. This avoids making
       users manually host libraries on the Domoticz server while still
       allowing a manual refresh/redownload on demand.

       Values in _libIcons: undefined = not loaded, 'loading', 'error', or
       class[]. */
    var _libIcons = {};
    var _libStatus = {};
    var _libBlobUrls = {};
    var _libPackageLoads = {};

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
            /* Rightmost token per selector, as in enumerate(): a weight-variant
               sheet reads `.ph-fill.ph-acorn:before`, where only the last token
               is the glyph and the first is the variant. */
            sel.split(',').forEach(function (one) {
                var mm, name = null;
                selRe.lastIndex = 0;
                while ((mm = selRe.exec(one)) !== null) name = mm[1];
                if (name) out[prefix + ' ' + name] = true;   // e.g. "mdi mdi-home"
            });
        }
        return Object.keys(out).sort();
    }

    /* Two local stores, both keyed by stylesheet URL so a changed/versioned
       URL misses cleanly:
         • localStorage (LIB_CACHE_KEY) — the parsed icon-class list, so the
           Studio grid opens instantly;
         • IndexedDB (LIB_DB_*) — the downloaded stylesheet with its fonts
           inlined as data: URLs, so rendering needs no network at all.
       Neither ever expires on its own: refreshing is an explicit user action,
       so a stored library never quietly calls out to the source again. */
    var LIB_CACHE_KEY = 'dz-iconlib-cache';
    var LIB_DB_NAME = 'dz-nightglass-iconlib-packages';
    var LIB_DB_STORE = 'packages';

    function readLibCache() {
        try { return JSON.parse(localStorage.getItem(LIB_CACHE_KEY) || '{}') || {}; }
        catch (e) { return {}; }
    }
    function writeLibCache(url, icons) {
        if (!url) return;                 // no key = nothing worth storing
        try {
            var c = readLibCache();
            c[url] = { icons: icons, ts: Date.now() };
            localStorage.setItem(LIB_CACHE_KEY, JSON.stringify(c));
        } catch (e) { /* quota / disabled — best effort, falls back to refetch */ }
    }
    function dropLibCache(url) {
        if (!url) return;
        try {
            var c = readLibCache();
            if (!Object.prototype.hasOwnProperty.call(c, url)) return;
            delete c[url];
            localStorage.setItem(LIB_CACHE_KEY, JSON.stringify(c));
        } catch (e) {}
    }

    function setLibStatus(id, state, extra) {
        var next = { state: state };
        var prev = _libStatus[id] || {};
        var k;
        for (k in prev) {
            if (Object.prototype.hasOwnProperty.call(prev, k)) next[k] = prev[k];
        }
        extra = extra || {};
        for (k in extra) {
            if (Object.prototype.hasOwnProperty.call(extra, k)) next[k] = extra[k];
        }
        _libStatus[id] = next;
    }

    function libraryKey(lib) {
        return String((lib && (lib.id || lib.prefix)) || '') + '|' + String((lib && lib.cssUrl) || '');
    }

    /* The id of the <link> this library owns. Shared by the injector and the
       removal path so both address the same element. */
    function libraryDomId(lib) {
        var libId = (lib && (lib.id || lib.prefix)) || (lib && lib.cssUrl) || '';
        return 'ng-iconlib-' + String(libId).replace(/[^\w-]/g, '');
    }

    function libraryStillConfigured(lib) {
        var key = libraryKey(lib);
        var arr = readLibsRaw();
        for (var i = 0; i < arr.length; i++) {
            if (libraryKey(arr[i]) === key) return true;
        }
        return false;
    }

    function replaceMarker(text, marker, value) {
        var at = text.indexOf(marker);
        if (at < 0) return text;
        return text.slice(0, at) + value + text.slice(at + marker.length);
    }

    function blobToDataUrl(blob) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onloadend = function () { resolve(reader.result); };
            reader.onerror = function () { reject(reader.error || 0); };
            reader.readAsDataURL(blob);
        });
    }

    function absolutizeUrl(url, baseUrl) {
        try { return new URL(url, baseUrl).href; }
        catch (e) { return url; }
    }

    function sanitizeCssUrl(url) {
        return String(url || '').trim().replace(/^['"]|['"]$/g, '');
    }

    function openLibDb() {
        return new Promise(function (resolve, reject) {
            if (!window.indexedDB) { reject(0); return; }
            var req = window.indexedDB.open(LIB_DB_NAME, 1);
            req.onupgradeneeded = function () {
                var db = req.result;
                if (!db.objectStoreNames.contains(LIB_DB_STORE)) {
                    db.createObjectStore(LIB_DB_STORE, { keyPath: 'key' });
                }
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error || 0); };
        });
    }

    function readLibPackage(key) {
        return openLibDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(LIB_DB_STORE, 'readonly');
                var store = tx.objectStore(LIB_DB_STORE);
                var req = store.get(key);
                tx.oncomplete = function () { try { db.close(); } catch (e) {} };
                tx.onabort = function () { reject(tx.error || 0); };
                req.onsuccess = function () { resolve(req.result || null); };
                req.onerror = function () { reject(req.error || 0); };
            });
        });
    }

    function writeLibPackage(entry) {
        return openLibDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(LIB_DB_STORE, 'readwrite');
                var store = tx.objectStore(LIB_DB_STORE);
                tx.oncomplete = function () { try { db.close(); } catch (e) {} resolve(entry); };
                tx.onabort = function () { reject(tx.error || 0); };
                var req = store.put(entry);
                req.onerror = function () { reject(req.error || 0); };
            });
        });
    }

    function deleteLibPackage(key) {
        return openLibDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(LIB_DB_STORE, 'readwrite');
                var store = tx.objectStore(LIB_DB_STORE);
                tx.oncomplete = function () { try { db.close(); } catch (e) {} resolve(); };
                tx.onabort = function () { reject(tx.error || 0); };
                var req = store.delete(key);
                req.onerror = function () { reject(req.error || 0); };
            });
        });
    }

    function fetchCssText(url) {
        return fetch(url, { credentials: 'omit' })
            .then(function (r) { if (!r.ok) throw 0; return r.text(); });
    }

    function localizeCssAssets(cssText, baseUrl, assetCache) {
        var URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
        var tasks = [];
        var out = cssText.replace(URL_RE, function (full, quote, raw) {
            var ref = sanitizeCssUrl(raw);
            if (!ref || /^data:/i.test(ref) || /^blob:/i.test(ref) || ref.charAt(0) === '#') return full;
            var abs = absolutizeUrl(ref, baseUrl);
            if (!assetCache[abs]) {
                assetCache[abs] = fetch(abs, { credentials: 'omit' })
                    .then(function (r) { if (!r.ok) throw 0; return r.blob(); })
                    .then(blobToDataUrl);
            }
            var marker = '__NG_ICONLIB_URL_' + tasks.length + '__';
            tasks.push(assetCache[abs].then(function (dataUrl) {
                return 'url("' + dataUrl + '")';
            }).catch(function () { return full; }));
            return marker;
        });
        if (!tasks.length) return Promise.resolve(out);
        return Promise.all(tasks).then(function (repl) {
            repl.forEach(function (val, i) {
                out = replaceMarker(out, '__NG_ICONLIB_URL_' + i + '__', val);
            });
            return out;
        });
    }

    function fetchAndRewriteCss(url, seen, assetCache) {
        seen = seen || {};
        assetCache = assetCache || {};
        if (seen[url]) return Promise.resolve('');
        seen[url] = true;

        return fetchCssText(url).then(function (cssText) {
            var importRe = /@import\s+(?:url\(\s*)?(?:(['"])([^'"]+)\1|([^'"\)\s;]+))\s*\)?[^;]*;/gi;
            var imports = [];
            var out = cssText.replace(importRe, function (full, quote, qUrl, bareUrl) {
                var ref = sanitizeCssUrl(qUrl || bareUrl);
                if (!ref) return '';
                var abs = absolutizeUrl(ref, url);
                var marker = '__NG_ICONLIB_IMPORT_' + imports.length + '__';
                imports.push(fetchAndRewriteCss(abs, seen, assetCache).catch(function () { return full; }));
                return marker;
            });
            return Promise.all(imports).then(function (chunks) {
                chunks.forEach(function (chunk, i) {
                    out = replaceMarker(out, '__NG_ICONLIB_IMPORT_' + i + '__', chunk);
                });
                return localizeCssAssets(out, url, assetCache);
            });
        });
    }

    /* ── Server-side hosting (Domoticz `uploadwebasset`) ───────────────
       Best case: we store the downloaded, self-contained stylesheet in the
       Domoticz web root (www/assets/<name>) so EVERY browser and device loads
       it from this server — no CDN, no per-browser download, and because it's
       same-origin its glyphs also enumerate straight from document.styleSheets
       (no fetch needed for the picker).

       The store is Domoticz-wide rather than theme-scoped, so the same webfont
       is shared instead of each theme keeping its own copy, and it survives
       both theme reinstalls and Domoticz updates.

       Requires an admin session and a Domoticz build that has the endpoint;
       when either is missing we silently keep the per-browser IndexedDB copy,
       so nothing breaks on older servers. */

    function utf8ToBase64(str) {
        var bytes = new TextEncoder().encode(str);
        var bin = '';
        var CHUNK = 0x8000;                       // avoid apply() arg limits
        for (var i = 0; i < bytes.length; i += CHUNK) {
            bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
        }
        return btoa(bin);
    }

    /* `title` is display-only and ignored by Domoticz builds that predate it;
       sending it means our uploads are labelled with their library name on the
       native Custom Icons page instead of the bare `iconfont-<prefix>` stem. */
    function uploadWebAsset(name, content, title) {
        var body = 'name=' + encodeURIComponent(name) +
                   '&title=' + encodeURIComponent(title || '') +
                   '&data=' + encodeURIComponent(utf8ToBase64(content));
        return fetch('json.htm?type=command&param=uploadwebasset', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        }).then(function (r) { return r.json(); }).then(function (d) {
            if (!d || d.status !== 'OK' || !d.path) throw (d && d.error) || 0;
            return d.path;
        });
    }

    /* The asset store is shared Domoticz-wide, so namespace the filename to
       make its provenance obvious and avoid clashing with other uploads. */
    function assetFileName(lib) {
        return 'iconfont-' + String(lib.prefix || lib.id || 'lib').replace(/[^a-z0-9_-]/gi, '') + '.css';
    }

    /* Persist the server path onto the library's settings entry so later page
       loads can point the <link> straight at it. */
    function setLibraryAssetPath(lib, path) {
        var arr = readLibsRaw();
        var changed = false;
        for (var i = 0; i < arr.length; i++) {
            if (libraryKey(arr[i]) === libraryKey(lib)) {
                if (arr[i].assetPath !== path) { arr[i].assetPath = path; changed = true; }
                break;
            }
        }
        if (changed) saveLibsRaw(arr);
    }

    /* Best-effort publish; resolves to the path or null (never rejects). */
    function publishLibraryToServer(lib, cssText) {
        if (!cssText) return Promise.resolve(null);
        return uploadWebAsset(assetFileName(lib), cssText, lib.name || lib.prefix)
            .then(function (path) {
                if (!libraryStillConfigured(lib)) return null;
                /* Refreshing overwrites the same filename, so version the URL —
                   otherwise the browser keeps serving the previous copy. */
                var versioned = path + '?v=' + Date.now();
                setLibraryAssetPath(lib, versioned);
                setLibStatus(lib.id || lib.prefix, 'server', { path: versioned, ts: Date.now() });
                return versioned;
            })
            .catch(function () { return null; });   // no admin / older Domoticz
    }

    function downloadLibraryPackage(lib) {
        var id = lib.id || lib.prefix;
        setLibStatus(id, 'downloading');
        return fetchAndRewriteCss(lib.cssUrl, {}, {}).then(function (cssText) {
            var entry = {
                key: libraryKey(lib),
                id: id,
                prefix: lib.prefix,
                url: lib.cssUrl,
                cssText: cssText,
                icons: parseCssForIcons(cssText, lib.prefix),
                ts: Date.now()
            };
            if (!libraryStillConfigured(lib)) throw { removed: true };
            _libIcons[id] = entry.icons;
            writeLibCache(lib.cssUrl, entry.icons);
            setLibStatus(id, 'cached', { ts: entry.ts });
            return writeLibPackage(entry)
                .catch(function () { return entry; })
                .then(function () {
                    /* Try to hand it to the server too; keeps the local copy
                       either way so this can never make things worse. */
                    return publishLibraryToServer(lib, entry.cssText).then(function () { return entry; });
                });
        }).catch(function (err) {
            if (err && err.removed) throw err;
            setLibStatus(id, 'error');
            throw err;
        });
    }

    function ensureLibraryPackage(lib, opts) {
        opts = opts || {};
        if (!lib || !lib.cssUrl) return Promise.reject(0);

        var id = lib.id || lib.prefix;
        var key = libraryKey(lib);
        if (_libPackageLoads[key] && !opts.force) return _libPackageLoads[key];

        var job = (opts.force ? deleteLibPackage(key).catch(function () {}) : readLibPackage(key).catch(function () { return null; }))
            .then(function (entry) {
                if (entry && !opts.force) {
                    _libIcons[id] = Array.isArray(entry.icons) ? entry.icons : [];
                    writeLibCache(lib.cssUrl, _libIcons[id]);
                    setLibStatus(id, 'cached', { ts: entry.ts || 0 });
                    /* Deliberately no age-based auto re-download: a locally
                       stored library must never quietly hit the network again.
                       Updating is an explicit action (the Refresh button). */
                    return entry;
                }
                return downloadLibraryPackage(lib);
            });

        _libPackageLoads[key] = job.then(function (entry) {
            delete _libPackageLoads[key];
            return entry;
        }, function (err) {
            delete _libPackageLoads[key];
            throw err;
        });
        return _libPackageLoads[key];
    }

    function revokeLibraryBlobUrl(domId) {
        if (_libBlobUrls[domId]) {
            try { URL.revokeObjectURL(_libBlobUrls[domId]); } catch (e) {}
            delete _libBlobUrls[domId];
        }
    }

    function setLibraryLinkHref(link, domId, href, originalUrl, isLocal) {
        link.href = href;
        link.setAttribute('data-url', originalUrl || '');
        link.setAttribute('data-local', isLocal ? '1' : '0');
    }

    /* Claim the <link> for a library WITHOUT giving it an href yet.
       This is what stops a remote request on every page load: previously the
       link was pointed at the CDN synchronously and only swapped to the local
       copy afterwards, so each load still pulled the remote CSS (and the fonts
       it references). Now applyLibraryStylesheet() points it at the locally
       cached blob — and only falls back to the source URL if no local copy can
       be produced. href is removed rather than blanked, because an empty href
       resolves to the page itself and would fire a pointless request. */
    function markLibraryLink(link, url) {
        link.removeAttribute('href');
        link.setAttribute('data-url', url || '');
        link.setAttribute('data-local', '0');
    }

    function applyLibraryStylesheet(link, domId, lib) {
        ensureLibraryPackage(lib).then(function (entry) {
            var current = document.getElementById(domId);
            if (!current || current.getAttribute('data-url') !== lib.cssUrl) return;
            var blobUrl = URL.createObjectURL(new Blob([entry.cssText || ''], { type: 'text/css' }));
            revokeLibraryBlobUrl(domId);
            _libBlobUrls[domId] = blobUrl;
            setLibraryLinkHref(current, domId, blobUrl, lib.cssUrl, true);
            _cache = null;
        }).catch(function () {
            var current = document.getElementById(domId);
            if (!current || current.getAttribute('data-url') !== lib.cssUrl) return;
            if (!libraryStillConfigured(lib)) return;
            revokeLibraryBlobUrl(domId);
            setLibStatus(lib.id || lib.prefix, 'remote');
            setLibraryLinkHref(current, domId, lib.cssUrl, lib.cssUrl, false);
        });
    }

    /* Inject/update/remove <link>s for the configured libraries so glyphs
       render from the local cache when possible, with a source-URL fallback
       if local download is blocked. */
    window.dzInjectIconLibraries = function (list) {
        try {
            var arr = typeof list === 'string' ? JSON.parse(list) : (list || []);
            var want = {};
            (arr || []).forEach(function (l) {
                if (!l || !l.cssUrl) return;
                var libId = l.id || l.prefix;
                /* Its asset was deleted on Domoticz's Custom Icons page, so
                   re-creating the <link> would only request a 404 and re-flash
                   the icons. Left out of `want` on purpose: the sweep below then
                   removes any link still hanging around. Refresh clears this. */
                if (_nativeGone[libId]) return;
                var domId = libraryDomId(l);
                want[domId] = true;
                var link = document.getElementById(domId);
                if (link) {
                    var prevUrl = link.getAttribute('data-url');
                    /* Already serving the local copy for this exact URL — leave
                       it alone so re-running (e.g. on settings save) doesn't
                       drop a working stylesheet and re-flash the icons. */
                    if (prevUrl === l.cssUrl &&
                        link.getAttribute('data-local') === '1' &&
                        link.getAttribute('href')) return;
                    if (prevUrl && prevUrl !== l.cssUrl) {
                        revokeLibraryBlobUrl(domId);
                        if (libId) delete _libIcons[libId];
                    }
                } else {
                    link = document.createElement('link');
                    link.id = domId;
                    link.rel = 'stylesheet';
                    document.head.appendChild(link);
                }
                var lib = {
                    id: libId,
                    name: l.name || l.prefix,
                    cssUrl: l.cssUrl,
                    prefix: l.prefix,
                    assetPath: l.assetPath
                };

                /* Best case: the library is hosted on this Domoticz server —
                   point straight at it. Same-origin, so it costs one ordinary
                   (browser-cached) request and its glyphs enumerate directly
                   from document.styleSheets. */
                if (l.assetPath) {
                    markLibraryLink(link, l.cssUrl);
                    link.setAttribute('data-local', '1');
                    link.onerror = function () {
                        /* Asset vanished (theme reinstalled/upgraded): forget the
                           path and fall back to the local/remote flow. */
                        link.onerror = null;
                        setLibraryAssetPath(lib, '');
                        setLibStatus(libId, 'error');
                        markLibraryLink(link, l.cssUrl);
                        applyLibraryStylesheet(link, domId, lib);
                    };
                    link.href = l.assetPath;
                    setLibStatus(libId, 'server', { path: l.assetPath });
                    return;
                }

                /* Claim the link but leave href unset; the local copy (or a
                   remote fallback) is applied asynchronously below. */
                markLibraryLink(link, l.cssUrl);
                applyLibraryStylesheet(link, domId, lib);
            });
            /* Drop links (and cached icons) for removed libraries. */
            var stale = document.querySelectorAll('link[id^="ng-iconlib-"]');
            for (var i = 0; i < stale.length; i++) {
                if (!want[stale[i].id]) {
                    revokeLibraryBlobUrl(stale[i].id);
                    stale[i].parentNode.removeChild(stale[i]);
                }
            }
            _cache = null;
        } catch (e) {}
    }

    /* Load a library's icon list. cb() fires when state changes.
       Order: in-memory → localStorage (instant) → IndexedDB/local download. */
    function loadLibraryIcons(lib, cb, force) {
        var st = _libIcons[lib.id];
        if (!force && (st === 'loading' || (st && st !== 'error'))) { cb(); return; }
        if (!lib.cssUrl && !lib.assetPath) { _libIcons[lib.id] = []; cb(); return; }

        var entry = !force && readLibCache()[lib.cssUrl];
        if (entry && Array.isArray(entry.icons)) {
            _libIcons[lib.id] = entry.icons;
            cb();     // instant from cache; refreshing is an explicit action
            return;
        }

        /* Hosted on this server: read the local copy for the icon list. Never
           reach for the source URL here — that's what Refresh is for. */
        if (lib.assetPath && !force) {
            _libIcons[lib.id] = 'loading';
            cb();
            fetchCssText(lib.assetPath).then(function (cssText) {
                var icons = parseCssForIcons(cssText, lib.prefix);
                _libIcons[lib.id] = icons;
                writeLibCache(lib.cssUrl, icons);
                setLibStatus(lib.id, 'server', { path: lib.assetPath });
                cb();
            }).catch(function () { _libIcons[lib.id] = 'error'; cb(); });
            return;
        }

        _libIcons[lib.id] = 'loading';
        cb();
        ensureLibraryPackage(lib, { force: !!force }).then(function (pkg) {
            _libIcons[lib.id] = Array.isArray(pkg.icons) ? pkg.icons : [];
            cb();
        }).catch(function () {
            _libIcons[lib.id] = 'error';
            cb();
        });
    }

    function removeLibraryCache(lib) {
        var key = libraryKey(lib);
        delete _libIcons[lib.id];
        delete _libStatus[lib.id];
        delete _libPackageLoads[key];
        deleteLibPackage(key).catch(function () {});
        /* Also drop the copy stored on the server, so removing a library
           doesn't leave an orphaned file in www/assets/. */
        if (lib.assetPath) {
            fetch('json.htm?type=command&param=deletewebasset' +
                  '&name=' + encodeURIComponent(assetFileName(lib)),
                  { credentials: 'same-origin' }).catch(function () {});
        }
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

    function formatAge(ts) {
        if (!ts) return '';
        var mins = Math.max(0, Math.floor((Date.now() - ts) / 60000));
        if (mins < 1) return 'just now';
        if (mins < 60) return mins + 'm ago';
        var hours = Math.floor(mins / 60);
        if (hours < 24) return hours + 'h ago';
        return Math.floor(hours / 24) + 'd ago';
    }

    function libraryStatusSummary(lib) {
        var st = _libStatus[lib.id || lib.prefix] || {};
        if (st.state === 'downloading') return 'Downloading…';
        if (st.state === 'missing') {
            return 'Removed from this server on Domoticz’s Custom Icons page — refresh to reinstall';
        }
        if (st.state === 'server') return 'Stored on this server — shared by all devices';
        if (st.state === 'cached') return 'Stored in this browser' + (st.ts ? ' · updated ' + formatAge(st.ts) : '');
        if (st.state === 'remote') return 'Using source URL fallback';
        if (st.state === 'error') return 'Download failed';
        return 'Waiting to download';
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
       always present; other classes need their library (by prefix) configured. */
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
        /* pruneRecent() is deliberately NOT called here — it runs once the
           native registry has been consulted (see the bottom of this function),
           because until then a recent icon from a Domoticz-managed library has
           no library to be recognised by and would be thrown away. */

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
            /* The manual-class field and the library form own their own
               Enter/arrow behaviour. */
            if (e.target && e.target.closest &&
                e.target.closest('.ng-is-manual, .ng-is-lib-form')) return;

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
                /* Domoticz serves its own libraries same-origin and injects the
                   <link> itself, so their glyphs normally arrive via enumerate()
                   already; only read the stylesheet when that found none. */
                if (l.managed === 'domoticz' && groups[l.id] && groups[l.id].icons.length) return;
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
                'Give its stylesheet URL and class prefix (e.g. <code>mdi</code>) and Nightglass downloads ' +
                'the stylesheet + fonts once and stores them <strong>on this Domoticz server</strong>, so every ' +
                'browser loads them locally. If the server can’t store them (not an admin session, or an older ' +
                'Domoticz), it falls back to a per-browser copy. Use refresh to redownload after upstream changes.';
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
                    if ((_libStatus[l.id || l.prefix] || {}).state === 'downloading') {
                        rowEl.className += ' ng-is-lib-row--busy';
                    }
                    if (_nativeGone[l.id || l.prefix]) {
                        rowEl.className += ' ng-is-lib-row--missing';
                    }
                    rowEl.innerHTML =
                        '<div class="ng-is-lib-meta"><strong>' + (l.name || l.prefix || '?') + '</strong>' +
                        '<span>' + (l.prefix ? l.prefix + '-*' : '') + ' · ' + (l.cssUrl || '') + '</span>' +
                        '<em class="ng-is-lib-status">' + libraryStatusSummary(l) + '</em></div>';
                    var actions = document.createElement('div');
                    actions.className = 'ng-is-lib-actions';
                    var refresh = document.createElement('button');
                    refresh.type = 'button';
                    refresh.className = 'ng-is-lib-refresh';
                    refresh.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
                    refresh.title = 'Refresh / redownload library';
                    refresh.disabled = ((_libStatus[l.id || l.prefix] || {}).state === 'downloading');
                    refresh.addEventListener('click', function () {
                        var lib = { id: l.id || l.prefix, name: l.name || l.prefix, cssUrl: l.cssUrl, prefix: l.prefix };
                        setLibStatus(lib.id, 'downloading');
                        /* Redownloading re-uploads it, so a library that was
                           deleted server-side is no longer "gone". */
                        delete _nativeGone[lib.id];
                        delete _libIcons[lib.id];
                        renderManage();
                        renderRail();
                        if (scope === lib.id) renderMain();
                        loadLibraryIcons(lib, function () {
                            if (window.dzInjectIconLibraries) window.dzInjectIconLibraries(readLibsRaw());
                            buildData();
                            renderRail();
                            renderManage();
                            if (scope === lib.id) renderMain();
                        }, true);
                    });
                    var rm = document.createElement('button');
                    rm.type = 'button';
                    rm.className = 'ng-is-lib-remove';
                    rm.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                    rm.addEventListener('click', function () {
                        var arr = readLibsRaw();
                        var removed = arr.splice(i, 1)[0];
                        saveLibsRaw(arr);
                        if (removed && removed.prefix) removeLibraryCache({ id: removed.id || removed.prefix, prefix: removed.prefix, cssUrl: removed.cssUrl, assetPath: removed.assetPath });
                        refreshData();
                        pruneRecent(libs);          // drop now-invalid recent icons
                        renderRail();
                        renderManage();
                    });
                    actions.appendChild(refresh);
                    actions.appendChild(rm);
                    rowEl.appendChild(actions);
                    listWrap.appendChild(rowEl);
                });
            }
            mainEl.appendChild(listWrap);

            /* One-click suggestions for popular libraries (prefill only). */
            var addedPrefixes = {};
            raw.forEach(function (l) { if (l && l.prefix) addedPrefixes[l.prefix] = true; });
            /* Hide the suggestion for anything Domoticz already serves —
               accepting it would just add a second copy under the same prefix. */
            nativeLibraries().forEach(function (n) { addedPrefixes[n.prefix] = true; });
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
                var next = { id: prefix, name: name || prefix, cssUrl: url, prefix: prefix };
                var existing = -1;
                arr.forEach(function (item, idx) {
                    if ((item.id || item.prefix) === prefix) existing = idx;
                });
                if (existing >= 0) {
                    removeLibraryCache({ id: arr[existing].id || arr[existing].prefix, prefix: arr[existing].prefix, cssUrl: arr[existing].cssUrl, assetPath: arr[existing].assetPath });
                    arr[existing] = next;
                } else {
                    arr.push(next);
                }
                saveLibsRaw(arr);
                delete _libIcons[prefix];     // ensure a fresh fetch
                setLibStatus(prefix, 'downloading');
                refreshData();
                scope = prefix;               // jump to the new library (shows loading)
                renderRail();
                renderMain();
                /* Download it locally, inject it, then re-render when the
                   cached icon list lands. */
                loadLibraryIcons(next, function () {
                    if (window.dzInjectIconLibraries) window.dzInjectIconLibraries(readLibsRaw());
                    buildData(); renderRail(); if (scope === prefix) renderMain();
                    renderManage();
                }, true);
            });
        }

        /* ── Main pane ── */
        function renderMain() {
            mainEl.innerHTML = '';
            hi = -1;               // the tiles it indexed no longer exist

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
                /* A specific configured library */
                if (_libIcons[scope] === 'loading') {
                    mainEl.innerHTML = '<div class="ng-is-note"><i class="fa-solid fa-spinner fa-spin"></i> ' +
                        'Loading icons…</div>';
                    return;
                }
                var g = groups[scope];
                if (!g || !g.icons.length) {
                    var scoped = null;
                    libs.forEach(function (l) { if (l.id === scope) scoped = l; });
                    var reason = (scoped && scoped.unavailable)
                        ? 'This library was removed from this server on Domoticz’s ' +
                          'Custom Icons page. Use Refresh under “Add / manage ' +
                          'libraries” to reinstall it.'
                        : _libIcons[scope] === 'error'
                        ? 'Couldn’t download this library into the local cache. ' +
                          'Nightglass will fall back to the source URL if the browser can load it.'
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
        loadLibraries();          // fetch+parse CDN/custom libraries in the background

        /* Reconcile with Domoticz's registry on every open, so the Studio also
           self-heals on builds that never broadcast dz-webassets-changed. The
           same handler serves the broadcast while this overlay is on screen.
           fetchNativeLibraries() always resolves: on a Domoticz without the
           command it yields the empty list, which leaves every step below
           behaving exactly as it did before the registry existed. */
        _onNativeChange = function () {
            if (_overlay !== overlay) return;      // a newer overlay owns the UI
            buildData();
            pruneRecent(libs);    // self-heal: drop recents from removed libraries
            renderRail();
            renderMain();
            loadLibraries();
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
