(function () {
    'use strict';

    var LANG_MAP = {
        dzvents: 'ng-lang-dzvents',
        lua:     'ng-lang-lua',
        python:  'ng-lang-python',
        blockly: 'ng-lang-blockly',
    };

    function stampLangClasses() {
        var editor = document.querySelector('.events-editor');
        if (!editor) return;

        // Get controller via Angular scope on the events-editor element
        var scope;
        try {
            scope = angular.element(editor).scope();
            if (scope && scope.$ctrl) scope = scope.$ctrl;
            else scope = angular.element(editor).isolateScope() || angular.element(editor).scope();
        } catch (e) { return; }

        var ctrl = scope && (scope.$ctrl || scope);
        if (!ctrl || !ctrl.folders) return;

        // Build a map of eventId → interpreter from all known events
        var interpMap = {};
        var allEvents = (ctrl.events || []);
        for (var i = 0; i < allEvents.length; i++) {
            var ev = allEvents[i];
            if (ev && ev.id != null && ev.interpreter) {
                interpMap[String(ev.id)] = ev.interpreter.toLowerCase();
            }
        }

        // Stamp classes on tree items
        var items = editor.querySelectorAll('.events-editor-tree-item');
        for (var j = 0; j < items.length; j++) {
            var li = items[j];
            // Angular repeats set ng-repeat on <li>; we can pull the event from scope
            var itemScope;
            try { itemScope = angular.element(li).scope(); } catch (e) { continue; }
            if (!itemScope || !itemScope.event) continue;

            var lang = interpMap[String(itemScope.event.id)];
            if (!lang) lang = (itemScope.event.interpreter || '').toLowerCase();
            var cls  = LANG_MAP[lang];

            // Remove old lang classes, add new one
            for (var key in LANG_MAP) {
                li.classList.remove(LANG_MAP[key]);
            }
            if (cls) li.classList.add(cls);
        }
    }

    function init() {
        // Run after Angular has rendered the events tree
        var delays = [600, 1200, 2500];
        delays.forEach(function (d) { setTimeout(stampLangClasses, d); });

        // Re-stamp on route change (navigating to Events page)
        try {
            var $rootScope = angular.element(document.body).injector().get('$rootScope');
            $rootScope.$on('$routeChangeSuccess', function () {
                setTimeout(stampLangClasses, 800);
                setTimeout(stampLangClasses, 1800);
            });
        } catch (e) {}

        // Also re-stamp when tree items appear (MutationObserver)
        var treeObserver = new MutationObserver(function (mutations) {
            var relevant = mutations.some(function (m) {
                return m.target.closest && m.target.closest('.events-editor-tree');
            });
            if (relevant) setTimeout(stampLangClasses, 150);
        });

        function hookTree() {
            var tree = document.querySelector('.events-editor-tree');
            if (tree) {
                treeObserver.observe(tree, { childList: true, subtree: true });
            } else {
                setTimeout(hookTree, 1000);
            }
        }
        hookTree();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

/* ── Feature 12b: Events Editor — Bootstrap glyphicon → FA swap ─── */
// Bootstrap 2 renders icon-* classes via sprite sheet.
// This replaces them with proper FA classes so FA's own CSS handles rendering.
(function () {
    'use strict';

    // Bootstrap 2 icon-* class → FA 6 solid icon name
    var ICON_CLASS_MAP = {
        'icon-folder-open':   'fa-folder-open',
        'icon-folder-close':  'fa-folder',
        'icon-plus-sign':     'fa-circle-plus',
        'icon-minus-sign':    'fa-circle-minus',
        'icon-chevron-left':  'fa-chevron-left',
        'icon-chevron-right': 'fa-chevron-right',
        'icon-tasks':         'fa-list-check',
        'icon-info-sign':     'fa-circle-info',
        'icon-plus':          'fa-plus',
        'icon-pencil':        'fa-pencil',
        'icon-trash':         'fa-trash',
        'icon-align-justify': 'fa-align-justify',
        'icon-question-sign': 'fa-circle-question',
        'icon-asterisk':      'fa-asterisk',
        'icon-ok':            'fa-check',
        'icon-arrow-left':    'fa-arrow-left',
        'icon-arrow-right':   'fa-arrow-right',
        'icon-bell':          'fa-bell',
        'icon-off':           'fa-power-off',
        'icon-time':          'fa-clock',
        'icon-star':          'fa-sun',
        'icon-refresh':       'fa-rotate',
        'icon-lock':          'fa-shield-halved',
        'icon-list-alt':      'fa-list-check',
        'icon-edit':          'fa-pen-to-square',
        'icon-globe':         'fa-globe',
        'icon-file':          'fa-code',
        'icon-th-large':      'fa-layer-group',
        'icon-cog':           'fa-gear',
        'icon-certificate':   'fa-wand-magic-sparkles',
    };

    var iconClasses = Object.keys(ICON_CLASS_MAP);

    function swapIcons() {
        if (!document.querySelector('.events-editor')) return;
        // Swap within the editor AND in wizard overlays appended to body
        var roots = [document.querySelector('.events-editor'), document.querySelector('automation-wizard')].filter(Boolean);
        var selector = iconClasses.map(function (c) { return '.' + c; }).join(',');
        var els = [];
        roots.forEach(function (r) { els = els.concat(Array.prototype.slice.call(r.querySelectorAll(selector))); });
        // Also swap the wizard trigger button itself
        document.querySelectorAll('.events-editor__file-list ' + selector).forEach(function (el) {
            if (els.indexOf(el) === -1) els.push(el);
        });
        els.forEach(function (el) {
            iconClasses.forEach(function (src) {
                if (!el.classList.contains(src)) return;
                var fa = ICON_CLASS_MAP[src];
                if (el.classList.contains(fa)) { el.classList.remove(src); return; }
                el.classList.remove(src);
                el.classList.add('fa-solid', fa);
            });
        });
    }

    function init() {
        [300, 800, 1600].forEach(function (d) { setTimeout(swapIcons, d); });

        try {
            var $rootScope = angular.element(document.body).injector().get('$rootScope');
            $rootScope.$on('$routeChangeSuccess', function () {
                [400, 1200, 2500].forEach(function (d) { setTimeout(swapIcons, d); });
            });
        } catch (e) {}

        // Watch for Angular re-renders (initial editor mount, folder expand,
        // filter changes, wizard overlay). We observe a STABLE ancestor that
        // exists before the editor mounts rather than the editor itself: on
        // the first SPA navigation to the events page, DOMContentLoaded has
        // long since fired, so the editor and its toolbar buttons appear only
        // as later mutations. Attaching to `.events-editor` after a poll used
        // to miss buttons rendered in the same tick it appeared — leaving them
        // blank (the sprite is hidden by CSS) until a full page refresh.
        var _t = null;
        var mo = new MutationObserver(function (mutations) {
            if (!mutations.some(function (m) { return m.addedNodes.length > 0; })) return;
            clearTimeout(_t);
            _t = setTimeout(swapIcons, 80);
        });
        var host = document.getElementById('dashcontent') ||
                   document.getElementById('main-content') ||
                   document.body;
        mo.observe(host, { childList: true, subtree: true });

        // Catch any buttons already in the DOM when we attach.
        swapIcons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();



/* ── Events Editor — mobile layout glue ────────────────────────────
   On phones / small tablets the script tree can't share the width with
   the editor, so the CSS (src/css/events-editor.css) turns it into a
   full-width slide-in panel. This module supplies the interactive glue
   that CSS alone can't do:
     • injects the dimmed backdrop behind the open panel and mirrors
       AngularJS's `.ng-hide` state onto `.events-editor` as
       `.dz-tree-open`; the splitter button opens/closes it, a backdrop
       tap or opening a script closes it;
     • fixes the Ace/Blockly content offset — that content is absolutely
       positioned at a fixed `top` sized for a one-row desktop toolbar,
       so the wrapped mobile toolbar would be hidden behind it. We set
       `top` to the toolbar's real height and nudge Ace/Blockly to
       re-measure (both listen for window "resize");
     • repositions the tab-strip pop-out menus (new script / tab menu)
       as fixed sheets so the strip's horizontal scroll can't clip them,
       and toggles the Lua / dzVents submenus on tap (no hover on touch).
   Angular keeps ownership of tree visibility (ng-show=isListExpanded);
   we only ever toggle it through the existing splitter button, so the
   Angular state and the DOM never diverge.
   ─────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var MOBILE_MQ = '(max-width: 820px)';

    function editorEl()   { return document.querySelector('.events-editor'); }
    function treeEl()     { return document.querySelector('.events-editor__tree'); }
    function splitterEl() { return document.querySelector('.events-editor__splitter'); }

    function isMobile()   { return window.matchMedia(MOBILE_MQ).matches; }

    /* AngularJS ng-show toggles the `.ng-hide` class; absence = open. */
    function treeIsOpen(tree) {
        return !!tree && !tree.classList.contains('ng-hide');
    }

    /* Toggle the tree via the splitter button so Angular owns the state.
       Only ever called while the panel is open, so this always closes. */
    function closeDrawer() {
        var sp = splitterEl();
        if (sp) sp.click();
    }

    function ensureBackdrop(editor) {
        var bd = editor.querySelector('.events-editor__tree-backdrop');
        if (bd) return bd;
        bd = document.createElement('div');
        bd.className = 'events-editor__tree-backdrop';
        bd.addEventListener('click', closeDrawer);
        editor.appendChild(bd);
        return bd;
    }

    function syncState() {
        var editor = editorEl();
        var tree = treeEl();
        if (!editor || !tree) return;
        editor.classList.toggle('dz-tree-open', isMobile() && treeIsOpen(tree));
    }

    /* Full-screen mobile state: pin the editor right below the navbar and
       lock page scroll so the (mobile-static) navbar can't scroll away and
       expose a gap. The navbar height varies (collapsed menu, wrapped rows),
       so measure it live and expose it to the CSS as `--dz-ee-top`.
       All of this is torn down on desktop or when we leave the page. */
    function applyMobileState() {
        var editor = editorEl();
        var active = !!editor && isMobile();
        var wasActive = document.documentElement.classList.contains('dz-ee-lock');
        document.documentElement.classList.toggle('dz-ee-lock', active);

        if (!editor) return;
        if (!active) {
            editor.style.removeProperty('--dz-ee-top');
            return;
        }
        /* Reset scroll to the top when first locking, so the (mobile-static)
           navbar sits at the viewport top and the fixed editor lines up flush
           beneath it. */
        if (!wasActive) {
            try { window.scrollTo(0, 0); } catch (e) {}
        }
        var nav = document.querySelector('.navbar-fixed-top') ||
                  document.querySelector('.navbar');
        var top = nav ? Math.max(0, Math.round(nav.getBoundingClientRect().bottom)) : 50;
        editor.style.setProperty('--dz-ee-top', top + 'px');
    }

    function unlockScroll() {
        document.documentElement.classList.remove('dz-ee-lock');
    }

    /* ── Editor content offset ─────────────────────────────────────
       Set each visible viewer's Ace/Blockly container `top` to its
       toolbar's real height so the wrapped toolbar is never hidden. */
    function fixEditorOffsets() {
        var editor = editorEl();
        if (!editor) return;
        var mobile = isMobile();
        var viewers = editor.querySelectorAll('.events-editor-file');
        var needWindowResize = false;

        for (var i = 0; i < viewers.length; i++) {
            var header  = viewers[i].querySelector('.events-editor-file__header');
            var content = viewers[i].querySelector('.events-editor-file__content');
            if (!header || !content) continue;   /* e.g. current-states table */

            var target = mobile ? (header.offsetHeight > 0 ? header.offsetHeight + 'px' : null)
                                : '';             /* '' restores desktop stylesheet */
            if (target === null || content.style.top === target) continue;

            content.style.top = target;

            /* Nudge that viewer's editor to re-measure its resized box.
               Ace stores its instance on the container as `.env.editor`
               and can resize directly; Blockly (and anything else) has to
               be told via a window "resize" event, which it listens for. */
            var env = content.env;
            if (env && env.editor && typeof env.editor.resize === 'function') {
                try { env.editor.resize(true); } catch (e) { needWindowResize = true; }
            } else {
                needWindowResize = true;
            }
        }

        if (needWindowResize) {
            try { window.dispatchEvent(new Event('resize')); } catch (e) {}
        }
    }

    /* Async mounts (Ace/Blockly, interpreter-specific toolbar controls)
       settle over a few hundred ms — re-apply across a short burst. */
    function scheduleFix() {
        [60, 260, 700, 1500].forEach(function (d) { setTimeout(fixEditorOffsets, d); });
    }

    /* ── Tab-strip pop-out menus ───────────────────────────────────
       Reposition the open Bootstrap dropdown as a fixed sheet anchored
       under its toggle, so the tab strip's overflow can't clip it. */
    function positionMenu(toggle) {
        var wrap = toggle.parentNode;
        if (!wrap) return;
        var menu = wrap.querySelector('.dropdown-menu');
        if (!menu) return;

        if (!wrap.classList.contains('open') || !isMobile()) {
            menu.style.position = '';
            menu.style.top = menu.style.left = menu.style.right = '';
            menu.style.margin = menu.style.zIndex = '';
            return;
        }

        var r = toggle.getBoundingClientRect();
        var mw = menu.offsetWidth || 200;
        menu.style.position = 'fixed';
        menu.style.top = Math.round(r.bottom + 4) + 'px';
        menu.style.left = Math.round(
            Math.min(Math.max(8, r.left), window.innerWidth - mw - 8)) + 'px';
        menu.style.right = 'auto';
        menu.style.margin = '0';
        menu.style.zIndex = '3000';
    }

    function onEditorClick(e) {
        if (!isMobile()) return;
        var t = e.target;
        if (!t || !t.closest) return;

        /* Opening a script reveals the editor: close the panel. */
        if (t.closest('.events-editor-tree-item__file') && treeIsOpen(treeEl())) {
            setTimeout(closeDrawer, 0);
            return;
        }

        /* Switching tabs may change the toolbar height. */
        if (t.closest('.events-editor__file') && !t.closest('[data-toggle="dropdown"]')) {
            scheduleFix();
        }

        /* Lua / dzVents submenu label: toggle it open instead of following
           the (empty) link or closing the whole menu. */
        var subLink = t.closest('.dropdown-submenu > a');
        if (subLink) {
            e.preventDefault();
            e.stopPropagation();
            var li = subLink.parentNode;
            var wasOpen = li.classList.contains('dz-submenu-open');
            var siblings = li.parentNode.querySelectorAll('.dropdown-submenu.dz-submenu-open');
            for (var s = 0; s < siblings.length; s++) siblings[s].classList.remove('dz-submenu-open');
            if (!wasOpen) li.classList.add('dz-submenu-open');
            return;
        }

        /* A dropdown toggle was tapped — reposition its menu after
           Bootstrap has toggled `.open`. */
        var toggle = t.closest('[data-toggle="dropdown"]');
        if (toggle) setTimeout(function () { positionMenu(toggle); }, 0);
    }

    var treeObserver = null;

    /* Idempotent: safe to call repeatedly (route changes recreate the DOM). */
    function setup() {
        var editor = editorEl();
        var tree = treeEl();
        if (!editor || !tree) return false;

        ensureBackdrop(editor);

        if (!editor.dataset.dzMobileBound) {
            editor.dataset.dzMobileBound = '1';
            editor.addEventListener('click', onEditorClick);
            /* Keep an open pop-out anchored while the tab strip scrolls. */
            editor.addEventListener('scroll', function (e) {
                if (!isMobile()) return;
                var open = editor.querySelector('.open > [data-toggle="dropdown"]');
                if (open) positionMenu(open);
            }, true);
        }

        if (treeObserver) treeObserver.disconnect();
        treeObserver = new MutationObserver(syncState);
        treeObserver.observe(tree, { attributes: true, attributeFilter: ['class'] });

        applyMobileState();
        syncState();
        scheduleFix();
        return true;
    }

    function init() {
        var tries = 0;
        (function wait() {
            if (!setup() && tries++ < 40) setTimeout(wait, 500);
        })();

        /* Re-run when navigating (back) to the Events page; unlock scroll
           immediately when leaving so other pages aren't frozen. */
        try {
            var $rootScope = angular.element(document.body).injector().get('$rootScope');
            $rootScope.$on('$routeChangeStart', unlockScroll);
            $rootScope.$on('$routeChangeSuccess', function () {
                unlockScroll();
                setTimeout(setup, 600);
                setTimeout(setup, 1600);
            });
        } catch (e) {}

        /* fixEditorOffsets is idempotent (acts only on real change and only
           then dispatches "resize"), so binding it here can't loop. */
        window.addEventListener('resize', function () {
            applyMobileState();
            syncState();
            fixEditorOffsets();
        });
        window.addEventListener('orientationchange', function () {
            applyMobileState();
            syncState();
            scheduleFix();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();



/* ── Automation Wizard — Ace editor on the review/code step ─────────
   Replaces the plain .aw-code-review textarea with a full Ace editor
   (Lua mode, user's saved theme) and keeps ng-model in sync.
   ─────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var ACE_THEME_KEY = 'dz-ace-theme';
    var DEFAULT_THEME = 'ace/theme/tomorrow_night';

    function resolvedTheme() {
        var raw = localStorage.getItem(ACE_THEME_KEY) || ('string:' + DEFAULT_THEME);
        return raw.replace(/^string:/, '');
    }

    function mountAce() {
        var ta = document.querySelector('automation-wizard .aw-code-review');
        if (!ta || ta._awAce || !window.ace) return;
        ta._awAce = true;

        // Build the Ace container, insert before the hidden textarea
        var wrap = document.createElement('div');
        wrap.className = 'aw-ace-wrap';
        ta.parentNode.insertBefore(wrap, ta);
        ta.style.display = 'none';

        var editor = ace.edit(wrap);
        editor.setTheme(resolvedTheme());
        editor.session.setMode('ace/mode/lua');
        editor.setOptions({
            fontSize: '13px',
            showPrintMargin: false,
            tabSize: 4,
            useSoftTabs: true,
            wrap: false,
            highlightActiveLine: true,
        });
        editor.setValue(ta.value, -1);

        // Ace → Angular: trigger a native input event so ng-model picks up the change
        editor.session.on('change', function () {
            var val = editor.getValue();
            if (ta.value === val) return;
            ta.value = val;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
        });

        // Angular → Ace: poll for external value changes (the "name change" hook
        // in the wizard controller regenerates code while the editor is open)
        var lastVal = ta.value;
        (function poll() {
            if (!document.body.contains(wrap)) return;
            if (ta.value !== lastVal) {
                lastVal = ta.value;
                var pos = editor.getCursorPosition();
                editor.setValue(ta.value, -1);
                editor.moveCursorToPosition(pos);
            }
            setTimeout(poll, 250);
        })();

        // Resize Ace when the step panel is shown/hidden by ng-show
        new MutationObserver(function () {
            if (wrap.offsetParent !== null) editor.resize();
        }).observe(wrap.parentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    // Watch for the textarea to be added to the DOM (Angular renders step 4 lazily)
    new MutationObserver(function () {
        var ta = document.querySelector('automation-wizard .aw-code-review');
        if (ta && !ta._awAce) setTimeout(mountAce, 80);
    }).observe(document.body, { childList: true, subtree: true });

})();


/* ── Range Color Picker — replaces <input type="color" class="dd-range-color-picker">
   with a themed canvas-based HSV color picker dialog.
   Fires native 'input'/'change' events so Angular ng-model stays in sync.
   ─────────────────────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    // ── colour math helpers ───────────────────────────────────────────────

    function hsvToRgb(h, s, v) {
        var i = Math.floor(h / 60) % 6;
        var f = h / 60 - Math.floor(h / 60);
        var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
        var pairs = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]];
        var c = pairs[i];
        return [Math.round(c[0]*255), Math.round(c[1]*255), Math.round(c[2]*255)];
    }

    function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
        var v = max, s = max === 0 ? 0 : d / max, h = 0;
        if (d !== 0) {
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
        }
        return [h * 360, s, v];
    }

    function hexToRgb(hex) {
        hex = (hex || '').replace(/^#/, '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        if (hex.length !== 6 || isNaN(parseInt(hex, 16))) return null;
        var n = parseInt(hex, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    }

    // ── canvas wheel ──────────────────────────────────────────────────────

    var WHEEL_SIZE = 200;

    function buildWheelImage(canvas, brightness) {
        var w = canvas.width, h = canvas.height;
        var cx = w / 2, cy = h / 2, r = Math.min(cx, cy) - 1;
        var ctx = canvas.getContext('2d');
        var img = ctx.createImageData(w, h);
        var d = img.data;
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var dx = x - cx, dy = y - cy;
                var dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > r) continue;
                var hue = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
                var sat = dist / r;
                var rgb = hsvToRgb(hue, sat, brightness);
                var i = (y * w + x) * 4;
                d[i] = rgb[0]; d[i+1] = rgb[1]; d[i+2] = rgb[2]; d[i+3] = 255;
            }
        }
        return img;
    }

    function drawCursor(canvas, cx, cy) {
        var ctx = canvas.getContext('2d');
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();
    }

    function redraw() {
        if (!_canvas) return;
        var ctx = _canvas.getContext('2d');
        if (_wheelCacheV !== _v || !_wheelCache) {
            _wheelCache = buildWheelImage(_canvas, _v);
            _wheelCacheV = _v;
        }
        ctx.putImageData(_wheelCache, 0, 0);
        drawCursor(_canvas, _curX, _curY);
    }

    // ── state ─────────────────────────────────────────────────────────────

    var _overlay = null, _canvas = null, _swatch = null, _hexInput = null, _slider = null;
    var _h = 210, _s = 0.6, _v = 1.0, _curX = 0, _curY = 0;
    var _target = null, _dragging = false;
    var _wheelCache = null, _wheelCacheV = -1;

    // ── overlay DOM (built once) ──────────────────────────────────────────

    function buildOverlay() {
        if (_overlay) return;

        _overlay = document.createElement('div');
        _overlay.id = 'ng-rcp-overlay';

        var popup = document.createElement('div');
        popup.className = 'ng-rcp-popup';

        // title
        var title = document.createElement('div');
        title.className = 'ng-popup-title';
        title.innerHTML = '<i class="fa-solid fa-palette"></i> Pick Color';
        popup.appendChild(title);

        // close button
        var closeBtn = document.createElement('button');
        closeBtn.className = 'ng-popup-close';
        closeBtn.type = 'button';
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.addEventListener('click', closeOverlay);
        popup.appendChild(closeBtn);

        // wheel
        var wheelWrap = document.createElement('div');
        wheelWrap.className = 'ng-rcp-wheel-wrap';
        _canvas = document.createElement('canvas');
        _canvas.width = WHEEL_SIZE; _canvas.height = WHEEL_SIZE;
        wheelWrap.appendChild(_canvas);
        popup.appendChild(wheelWrap);

        // brightness slider
        var bRow = document.createElement('div');
        bRow.className = 'ng-rcp-brightness-row';
        var dimIco = document.createElement('i');
        dimIco.className = 'fa-solid fa-circle ng-rcp-icon-dim';
        _slider = document.createElement('input');
        _slider.type = 'range'; _slider.className = 'ng-rgbw-slider';
        _slider.min = '5'; _slider.max = '100'; _slider.value = '100';
        var brightIco = document.createElement('i');
        brightIco.className = 'fa-solid fa-circle ng-rcp-icon-bright';
        bRow.appendChild(dimIco); bRow.appendChild(_slider); bRow.appendChild(brightIco);
        popup.appendChild(bRow);

        // preview row
        var preview = document.createElement('div');
        preview.className = 'ng-rcp-preview';
        _swatch = document.createElement('div'); _swatch.className = 'ng-rcp-swatch';
        _hexInput = document.createElement('input');
        _hexInput.type = 'text'; _hexInput.className = 'ng-rcp-hex-input';
        _hexInput.placeholder = '#rrggbb'; _hexInput.maxLength = 7;
        preview.appendChild(_swatch); preview.appendChild(_hexInput);
        popup.appendChild(preview);

        // action buttons
        var actions = document.createElement('div');
        actions.className = 'ng-rcp-actions';
        var cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-default'; cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', closeOverlay);
        var okBtn = document.createElement('button');
        okBtn.className = 'btn btn-primary'; okBtn.type = 'button';
        okBtn.textContent = 'OK';
        okBtn.addEventListener('click', commitAndClose);
        actions.appendChild(cancelBtn); actions.appendChild(okBtn);
        popup.appendChild(actions);

        _overlay.appendChild(popup);
        document.body.appendChild(_overlay);

        // backdrop click closes
        _overlay.addEventListener('click', function (e) { if (e.target === _overlay) closeOverlay(); });

        // canvas interaction
        var _pickRaf = 0;
        _canvas.addEventListener('mousedown', function (e) { _dragging = true; pick(e); });
        document.addEventListener('mouseup',  function ()  { _dragging = false; });
        _canvas.addEventListener('mousemove', function (e) {
            if (!_dragging) return;
            var ev = e;
            if (!_pickRaf) _pickRaf = requestAnimationFrame(function () { _pickRaf = 0; pick(ev); });
        });
        _canvas.addEventListener('touchstart', function (e) { e.preventDefault(); pick(e.touches[0]); }, { passive: false });
        _canvas.addEventListener('touchmove',  function (e) {
            e.preventDefault();
            var touch = e.touches[0];
            if (!_pickRaf) _pickRaf = requestAnimationFrame(function () { _pickRaf = 0; pick(touch); });
        }, { passive: false });

        // brightness slider
        var _sliderRaf = 0;
        _slider.addEventListener('input', function () {
            var self = this;
            if (!_sliderRaf) _sliderRaf = requestAnimationFrame(function () {
                _sliderRaf = 0;
                _v = parseInt(self.value) / 100;
                redraw(); syncFromHsv();
            });
        });

        // hex input
        _hexInput.addEventListener('input', function () {
            var rgb = hexToRgb(this.value);
            if (!rgb) return;
            var hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
            _h = hsv[0]; _s = hsv[1]; _v = hsv[2];
            _slider.value = Math.round(_v * 100);
            updateCursorFromHsv();
            redraw(); updateSwatch();
        });
        _hexInput.addEventListener('blur', function () {
            var rgb = hexToRgb(this.value);
            if (rgb) this.value = rgbToHex(rgb[0], rgb[1], rgb[2]);
        });
    }

    function pick(e) {
        var rect = _canvas.getBoundingClientRect();
        var sx = _canvas.width / rect.width, sy = _canvas.height / rect.height;
        var x = (e.clientX - rect.left) * sx;
        var y = (e.clientY - rect.top)  * sy;
        var cx = _canvas.width / 2, cy = _canvas.height / 2;
        var r = Math.min(cx, cy) - 1;
        var dx = x - cx, dy = y - cy, dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > r) { dx *= r/dist; dy *= r/dist; dist = r; }
        _curX = cx + dx; _curY = cy + dy;
        _h = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
        _s = dist / r;
        redraw(); syncFromHsv();
    }

    function syncFromHsv() {
        var rgb = hsvToRgb(_h, _s, _v);
        updateSwatch(rgb);
        _hexInput.value = rgbToHex(rgb[0], rgb[1], rgb[2]);
    }

    function updateSwatch(rgb) {
        if (!rgb) rgb = hsvToRgb(_h, _s, _v);
        _swatch.style.background = rgbToHex(rgb[0], rgb[1], rgb[2]);
    }

    function updateCursorFromHsv() {
        var cx = WHEEL_SIZE / 2, cy = WHEEL_SIZE / 2, r = Math.min(cx, cy) - 1;
        var rad = _h * Math.PI / 180;
        _curX = cx + Math.cos(rad) * _s * r;
        _curY = cy + Math.sin(rad) * _s * r;
    }

    function openOverlay(input) {
        buildOverlay();
        _target = input;
        var rgb = hexToRgb(input.value) || [78, 154, 241];
        var hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
        _h = hsv[0]; _s = hsv[1]; _v = hsv[2];
        _slider.value = Math.round(_v * 100);
        updateCursorFromHsv();
        redraw(); syncFromHsv();
        _overlay.classList.add('ng-rcp-overlay--open');
    }

    function closeOverlay() {
        if (_overlay) _overlay.classList.remove('ng-rcp-overlay--open');
        _target = null;
    }

    function commitAndClose() {
        if (_target) {
            var rgb = hexToRgb(_hexInput.value) || hsvToRgb(_h, _s, _v);
            var hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
            _target.value = hex;
            _target.dispatchEvent(new Event('input',  { bubbles: true }));
            _target.dispatchEvent(new Event('change', { bubbles: true }));
            if (_target._ngRcpTrigger) _target._ngRcpTrigger.style.background = hex;
        }
        closeOverlay();
    }

    // ── inject swatch triggers ────────────────────────────────────────────

    function injectTriggers() {
        var inputs = document.querySelectorAll('.dd-range-color-picker:not([data-ng-rcp])');
        inputs.forEach(function (input) {
            input.setAttribute('data-ng-rcp', '1');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ng-rcp-trigger';
            btn.title = 'Pick color';
            btn.style.background = input.value || '#4e9af1';
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                openOverlay(input);
            });
            input._ngRcpTrigger = btn;
            input.parentNode.insertBefore(btn, input);
        });
    }

    new MutationObserver(function (muts) {
        if (muts.some(function (m) { return m.addedNodes.length > 0; })) injectTriggers();
    }).observe(document.body, { childList: true, subtree: true });

    if (document.readyState !== 'loading') {
        injectTriggers();
    } else {
        document.addEventListener('DOMContentLoaded', injectTriggers);
    }
})();

/* ── Hardware page — scroll to edit panel on row click ──────────────
   When a hardware table row is clicked, Domoticz populates the edit
   form below the table. We smooth-scroll there automatically.
   ─────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    document.addEventListener('click', function (e) {
        var table = document.getElementById('hardwaretable');
        if (!table) return;
        var tbody = table.querySelector('tbody');
        if (!tbody || !tbody.contains(e.target)) return;
        if (!e.target.closest('tr')) return;
        setTimeout(function () {
            var panel = document.querySelector('#hardwarecontent .page-content-container');
            if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
    });
})();

