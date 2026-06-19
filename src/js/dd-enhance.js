/*
 * dd-enhance.js
 * Dynamic Dashboard UX enhancements
 *
 * Features:
 *  - Glassmorphism card entrance animation with staggered index stamping
 *  - Drag snap-line overlay toggle
 *  - Library panel: list/grid toggle + recently-used section
 *  - Widget context menu (right-click in edit mode)
 *  - Full-screen widget expand (double-click in view mode)
 *  - Unsaved changes dot indicator
 *
 * Init architecture:
 *  - Document-level listeners (ctx menu, fullscreen) register immediately —
 *    they do NOT depend on Angular being ready.
 *  - Angular-dependent features (unsaved indicator, index stamping, library
 *    enhancements) wait for .dd-page to have an Angular scope via onDD().
 *  - Route-change re-init polls for Angular to be ready rather than relying
 *    on a DOMContentLoaded handler that may have already fired.
 */
(function () {
    'use strict';

    var LS_GRID_MODE = 'dd-library-grid';
    var LS_RECENT    = 'dd-recent-widgets';
    var MAX_RECENT   = 6;

    /* Prevent re-registering document-level listeners across re-inits. */
    var _docListeners    = false;
    /* Interval handle for unsaved-indicator polling. */
    var _unsavedInterval = null;

    // ── Helpers ──────────────────────────────────────────────────────────

    /**
     * Poll until .dd-page exists AND Angular has compiled it (scope available).
     * Calls fn(page, scope). Tries for up to 20 seconds.
     */
    function onDD(fn) {
        var tries = 0;
        (function check() {
            var page = document.querySelector('.dd-page');
            if (page && window.angular) {
                try {
                    var scope = angular.element(page).scope();
                    if (scope) { fn(page, scope); return; }
                } catch (e) {}
            }
            if (++tries < 100) { setTimeout(check, 200); }
        }());
    }

    /**
     * Poll until .dd-grid appears in the DOM (ng-if="gridReady" may delay it).
     * Calls fn(grid). Tries for up to 10 seconds.
     */
    function waitForGrid(fn) {
        var tries = 0;
        (function check() {
            var grid = document.querySelector('.dd-grid');
            if (grid) { fn(grid); return; }
            if (++tries < 50) { setTimeout(check, 200); }
        }());
    }

    /**
     * Call a function on the DD page Angular scope.
     * Works whether the functions are on the controller scope directly
     * (addWidgetToGrid, cloneWidget, removeWidget set by ddGrid directive)
     * or on the controller ($scope.configureWidget).
     */
    function callScope(fnName, args) {
        var page = document.querySelector('.dd-page');
        if (!page || !window.angular) { return; }
        try {
            var scope = angular.element(page).scope();
            if (scope && typeof scope[fnName] === 'function') {
                scope.$apply(function () { scope[fnName].apply(scope, args || []); });
            }
        } catch (e) {}
    }

    /** True when .dd-page has the Angular-driven .edit-mode class. */
    function isEditMode() {
        var page = document.querySelector('.dd-page');
        return !!(page && page.classList.contains('edit-mode'));
    }

    /**
     * Walk up from el to the nearest .grid-stack-item that is inside .dd-grid.
     * Returns null if not found (click was outside the grid).
     */
    function getGsItem(el) {
        if (!el || typeof el.closest !== 'function') { return null; }
        var item = el.closest('.grid-stack-item');
        if (!item) { return null; }
        return item.closest('.dd-grid') ? item : null;
    }

    /** Read data-widget-id from the .dd-widget-cell inside a .grid-stack-item. */
    function getWidgetId(gsItem) {
        var cell = gsItem && gsItem.querySelector('[data-widget-id]');
        return cell ? cell.getAttribute('data-widget-id') : null;
    }

    // ── 1. Widget entrance animation — stamp --dd-widget-idx ─────────────

    function stampWidgetIndices() {
        var grid = document.querySelector('.dd-grid');
        if (!grid) { return; }
        var items = grid.querySelectorAll('.grid-stack-item');
        if (!items.length) { return; }

        /* Batch: set all CSS variables + pause animations, single forced
           reflow, then restore — re-triggers animations with correct delays */
        items.forEach(function (item, i) {
            var c = item.querySelector('.grid-stack-item-content');
            if (c) {
                c.style.setProperty('--dd-widget-idx', i);
                c.style.animationName = 'none';
            }
        });
        void grid.offsetWidth; // single reflow to flush style changes
        items.forEach(function (item) {
            var c = item.querySelector('.grid-stack-item-content');
            if (c) { c.style.animationName = ''; }
        });

        /* After all animations complete, stop re-animating on later renders */
        var delay = items.length * 32 + 520;
        setTimeout(function () {
            var g = document.querySelector('.dd-grid');
            if (g) { g.classList.add('dd-grid-loaded'); }
        }, delay);
    }

    function animateNewWidget(gsItem) {
        var c = gsItem && gsItem.querySelector('.grid-stack-item-content');
        if (!c) { return; }
        c.style.setProperty('--dd-widget-idx', 0);
        c.style.animationName = 'none';
        void c.offsetWidth;
        c.style.animationName = '';
    }

    function watchForNewWidgets() {
        var grid = document.querySelector('.dd-grid');
        if (!grid) { return; }
        var mo = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1 && node.classList &&
                        node.classList.contains('grid-stack-item')) {
                        animateNewWidget(node);
                    }
                });
            });
        });
        mo.observe(grid, { childList: true });
    }

    // ── 2. Drag snap-lines — toggle .dd-dragging on .dd-page ─────────────

    function initSnapLines() {
        if (!window.$) { return; }
        /* Use namespaced jQuery events to avoid conflicting with other listeners */
        $(document)
            .on('dragstart.ddEnhance', '.dd-grid .grid-stack-item', function () {
                var p = document.querySelector('.dd-page');
                if (p) { p.classList.add('dd-dragging'); }
            })
            .on('dragstop.ddEnhance',  '.dd-grid .grid-stack-item', function () {
                var p = document.querySelector('.dd-page');
                if (p) { p.classList.remove('dd-dragging'); }
            });
    }

    // ── 3. Unsaved changes indicator ─────────────────────────────────────

    function initUnsavedIndicator(scope) {
        /* Poll Angular's isDirty flag directly — reliable across Angular cycles */
        if (_unsavedInterval) { clearInterval(_unsavedInterval); }
        var toolbar = document.querySelector('.dd-toolbar');
        if (!toolbar) { return; }

        _unsavedInterval = setInterval(function () {
            if (!document.body.contains(toolbar)) {
                clearInterval(_unsavedInterval);
                _unsavedInterval = null;
                return;
            }
            toolbar.classList.toggle('dd-has-unsaved', !!scope.isDirty);
        }, 350);
    }

    // ── 4. Library panel: list/grid toggle ───────────────────────────────

    function initLibraryToggle() {
        var panel = document.querySelector('.dd-library-panel');
        if (!panel || panel.querySelector('.dd-lib-view-btn')) { return; }
        var header = panel.querySelector('.dd-library-panel-header');
        if (!header) { return; }

        var btn = document.createElement('button');
        btn.className = 'dd-lib-view-btn';
        btn.title = 'Toggle list / grid view';
        var isGrid = localStorage.getItem(LS_GRID_MODE) === '1';
        btn.innerHTML = isGrid ? '<i class="fa-solid fa-list"></i>'
                               : '<i class="fa-solid fa-grip"></i>';
        if (isGrid) { panel.classList.add('dd-library-grid-mode'); }

        btn.addEventListener('click', function () {
            var gridMode = panel.classList.toggle('dd-library-grid-mode');
            localStorage.setItem(LS_GRID_MODE, gridMode ? '1' : '0');
            btn.innerHTML = gridMode ? '<i class="fa-solid fa-list"></i>'
                                     : '<i class="fa-solid fa-grip"></i>';
        });

        var closeBtn = header.querySelector('.dd-panel-close');
        header.insertBefore(btn, closeBtn || null);
    }

    // ── 5. Recently-used widgets ─────────────────────────────────────────

    function getRecent() {
        try { return JSON.parse(localStorage.getItem(LS_RECENT) || '[]'); }
        catch (e) { return []; }
    }

    function saveRecent(label) {
        var list = getRecent().filter(function (l) { return l !== label; });
        list.unshift(label);
        if (list.length > MAX_RECENT) { list = list.slice(0, MAX_RECENT); }
        try { localStorage.setItem(LS_RECENT, JSON.stringify(list)); } catch (e) {}
    }

    function findLibraryItemByLabel(label) {
        var items = document.querySelectorAll('.dd-library-panel .dd-library-item');
        for (var i = 0; i < items.length; i++) {
            var lbl = items[i].querySelector('.dd-library-item-label');
            if (lbl && lbl.textContent.trim() === label) { return items[i]; }
        }
        return null;
    }

    function injectRecentSection() {
        var panel = document.querySelector('.dd-library-panel');
        if (!panel) { return; }
        var old = panel.querySelector('.dd-library-recent');
        if (old) { old.remove(); }

        var recent = getRecent().filter(function (lbl) {
            return !!findLibraryItemByLabel(lbl);
        });
        if (!recent.length) { return; }

        var section = document.createElement('div');
        section.className = 'dd-library-recent';

        var labelEl = document.createElement('div');
        labelEl.className = 'dd-library-category-label dd-library-recent-label';
        labelEl.textContent = 'Recently Added';
        section.appendChild(labelEl);

        var list = document.createElement('div');
        list.className = 'dd-library-recent-items dd-library-category';

        recent.forEach(function (widgetLabel) {
            var original = findLibraryItemByLabel(widgetLabel);
            if (!original) { return; }
            var iconEl = original.querySelector('.dd-library-item-icon');
            var row = document.createElement('div');
            row.className = 'dd-library-item';
            row.setAttribute('title', 'Add ' + widgetLabel);
            row.innerHTML =
                (iconEl ? iconEl.outerHTML : '') +
                '<div class="dd-library-item-info">' +
                    '<div class="dd-library-item-label">' + widgetLabel + '</div>' +
                '</div>' +
                '<i class="fa-solid fa-circle-plus" style="color:var(--dz-btn-primary-bg);font-size:18px"></i>';
            row.addEventListener('click', function () {
                var t = findLibraryItemByLabel(widgetLabel);
                if (t) { t.click(); }
            });
            list.appendChild(row);
        });

        section.appendChild(list);
        var body = panel.querySelector('.dd-library-panel-body');
        if (body) { body.insertBefore(section, body.firstChild); }
    }

    function initRecentTracking() {
        var panel = document.querySelector('.dd-library-panel');
        if (!panel || panel._ddRecentBound) { return; }
        panel._ddRecentBound = true;

        panel.addEventListener('click', function (e) {
            var item = e.target.closest('.dd-library-item');
            if (!item || item.closest('.dd-library-recent')) { return; }
            var lbl = item.querySelector('.dd-library-item-label');
            if (lbl) { saveRecent(lbl.textContent.trim()); }
        });

        var mo = new MutationObserver(function () {
            if (panel.classList.contains('open')) {
                setTimeout(injectRecentSection, 60);
            }
        });
        mo.observe(panel, { attributes: true, attributeFilter: ['class'] });
    }

    // ── 6. Context menu (right-click on widget in edit mode) ─────────────

    var _ctxMenu = null;

    function removeCtxMenu() {
        if (_ctxMenu && _ctxMenu.parentNode) {
            _ctxMenu.parentNode.removeChild(_ctxMenu);
        }
        _ctxMenu = null;
        document.removeEventListener('click',       removeCtxMenu, true);
        document.removeEventListener('contextmenu', removeCtxMenu, true);
        document.removeEventListener('keydown',     onCtxKey,      true);
    }

    function onCtxKey(e) {
        if (e.key === 'Escape') { removeCtxMenu(); }
    }

    function buildCtxItem(iconClass, text, danger, action) {
        var el = document.createElement('div');
        el.className = 'dd-ctx-item' + (danger ? ' dd-ctx-item--danger' : '');
        el.innerHTML = '<i class="' + iconClass + '"></i><span>' + text + '</span>';
        el.addEventListener('click', function (e) {
            e.stopPropagation();
            removeCtxMenu();
            action();
        });
        return el;
    }

    function showCtxMenu(e, gsItem) {
        e.preventDefault();
        removeCtxMenu();

        var widgetId = getWidgetId(gsItem);
        var menu = document.createElement('div');
        menu.id = 'dd-ctx-menu';

        /* Only show actions that require widgetId if we have one */
        if (widgetId) {
            var hasConfig = !!gsItem.querySelector('[title="Configure widget"]');
            if (hasConfig) {
                menu.appendChild(buildCtxItem(
                    'fa-solid fa-gear', 'Configure', false,
                    function () { callScope('configureWidget', [widgetId]); }
                ));
            }
            menu.appendChild(buildCtxItem(
                'fa-solid fa-copy', 'Duplicate', false,
                function () { callScope('cloneWidget', [widgetId]); }
            ));
        }

        menu.appendChild(buildCtxItem(
            'fa-solid fa-expand', 'Expand full screen', false,
            function () { expandWidget(gsItem); }
        ));

        if (widgetId) {
            var divider = document.createElement('div');
            divider.className = 'dd-ctx-divider';
            menu.appendChild(divider);
            menu.appendChild(buildCtxItem(
                'fa-solid fa-trash', 'Remove widget', true,
                function () { callScope('removeWidget', [widgetId]); }
            ));
        }

        /* Measure + position to avoid clipping against viewport edges */
        menu.style.cssText = 'top:-9999px;left:-9999px';
        document.body.appendChild(menu);
        _ctxMenu = menu;

        var x = e.clientX, y = e.clientY;
        var mw = menu.offsetWidth, mh = menu.offsetHeight;
        if (x + mw > window.innerWidth  - 8) { x = window.innerWidth  - mw - 8; }
        if (y + mh > window.innerHeight - 8) { y = window.innerHeight - mh - 8; }
        menu.style.cssText = 'top:' + y + 'px;left:' + x + 'px';

        setTimeout(function () {
            document.addEventListener('click',       removeCtxMenu, true);
            document.addEventListener('contextmenu', removeCtxMenu, true);
            document.addEventListener('keydown',     onCtxKey,      true);
        }, 0);
    }

    /**
     * Context menu handler — registered on document immediately at module load.
     * Only activates when .dd-page.edit-mode is in the DOM.
     */
    function initContextMenu() {
        document.addEventListener('contextmenu', function (e) {
            if (!isEditMode()) { return; }
            var gsItem = getGsItem(e.target);
            if (!gsItem) { return; }
            showCtxMenu(e, gsItem);
        });
    }

    // ── 7. Full-screen widget expand ──────────────────────────────────────

    var _expanded = null;

    function expandWidget(gsItem) {
        if (_expanded) { collapseWidget(); return; }
        var content = gsItem && gsItem.querySelector('.grid-stack-item-content');
        if (!content) { return; }

        var rect = content.getBoundingClientRect();

        var backdrop = document.createElement('div');
        backdrop.className = 'dd-expand-backdrop';
        backdrop.setAttribute('data-dd-expand', '1');
        document.body.appendChild(backdrop);

        var closeBtn = document.createElement('button');
        closeBtn.className = 'dd-expand-close';
        closeBtn.title = 'Close (Esc)';
        closeBtn.setAttribute('data-dd-expand', '1');
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        document.body.appendChild(closeBtn);

        /* Capture original inline styles for restore */
        var origStyle = {
            position: content.style.position, top: content.style.top,
            left: content.style.left, width: content.style.width,
            height: content.style.height, zIndex: content.style.zIndex,
            transition: content.style.transition,
            borderRadius: content.style.borderRadius
        };

        /* Step 1: pin at current position with no transition */
        content.style.cssText +=
            ';position:fixed!important' +
            ';top:'    + rect.top    + 'px' +
            ';left:'   + rect.left   + 'px' +
            ';width:'  + rect.width  + 'px' +
            ';height:' + rect.height + 'px' +
            ';z-index:9001!important' +
            ';transition:none!important' +
            ';border-radius:14px!important';

        void content.offsetWidth; // flush

        /* Step 2: animate to fullscreen */
        content.style.transition =
            'top 0.35s cubic-bezier(0.22,1,0.36,1),' +
            'left 0.35s cubic-bezier(0.22,1,0.36,1),' +
            'width 0.35s cubic-bezier(0.22,1,0.36,1),' +
            'height 0.35s cubic-bezier(0.22,1,0.36,1),' +
            'border-radius 0.3s';
        content.style.top    = '0px';
        content.style.left   = '0px';
        content.style.width  = '100vw';
        content.style.height = '100vh';
        content.style.borderRadius = '0px';
        content.classList.add('dd-widget-expanded');

        _expanded = { content: content, origStyle: origStyle, rect: rect };
        setTimeout(function () { reflowCharts(content); }, 380);

        backdrop.addEventListener('click', collapseWidget);
        closeBtn.addEventListener('click', collapseWidget);
    }

    function collapseWidget() {
        if (!_expanded) { return; }
        var content = _expanded.content, orig = _expanded.origStyle,
            rect = _expanded.rect;

        content.style.top    = rect.top    + 'px';
        content.style.left   = rect.left   + 'px';
        content.style.width  = rect.width  + 'px';
        content.style.height = rect.height + 'px';
        content.style.borderRadius = '14px';

        content.addEventListener('transitionend', function handler() {
            content.removeEventListener('transitionend', handler);
            content.classList.remove('dd-widget-expanded');
            Object.keys(orig).forEach(function (k) {
                content.style[k] = orig[k] || '';
            });
            reflowCharts(content);
        }, { once: true });

        document.querySelectorAll('[data-dd-expand]').forEach(function (el) {
            el.remove();
        });
        _expanded = null;
    }

    function reflowCharts(container) {
        if (!window.Highcharts || !Highcharts.charts) { return; }
        Highcharts.charts.forEach(function (chart) {
            if (chart && chart.container && container.contains(chart.container)) {
                try { chart.reflow(); } catch (e) {}
            }
        });
    }

    /**
     * Double-click expand handler — registered on document immediately.
     * Only activates when NOT in edit mode and clicking inside .dd-grid.
     */
    function initFullscreenExpand() {
        document.addEventListener('dblclick', function (e) {
            if (isEditMode()) { return; }
            var gsItem = getGsItem(e.target);
            if (!gsItem) { return; }
            /* Don't intercept double-clicks on interactive elements */
            if (e.target.closest('button, a, input, select, textarea, [ng-click]')) {
                return;
            }
            expandWidget(gsItem);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && _expanded) { collapseWidget(); }
        });
    }

    // ── Init ─────────────────────────────────────────────────────────────

    /**
     * Register document-level listeners immediately — these do NOT need Angular.
     * Using _docListeners flag so they are only registered once ever.
     */
    function initDocListeners() {
        if (_docListeners) { return; }
        _docListeners = true;
        initContextMenu();
        initFullscreenExpand();
    }

    /**
     * Angular-dependent init — called once Angular has processed .dd-page.
     * Safe to call multiple times (each feature guards itself).
     */
    function init() {
        onDD(function (page, scope) {
            /* Grid features wait for ng-if="gridReady" to resolve */
            waitForGrid(function () {
                stampWidgetIndices();
                watchForNewWidgets();
            });
            initSnapLines();
            initUnsavedIndicator(scope);
            initLibraryToggle();
            initRecentTracking();
        });
    }

    /**
     * Wire up Angular $routeChangeSuccess to re-run init() when the user
     * navigates to a dashboard page. Polls for Angular to finish bootstrapping
     * rather than relying on DOMContentLoaded timing.
     */
    function setupRouteListener() {
        var tries = 0;
        (function check() {
            if (window.angular) {
                try {
                    var inj = angular.element(document.body).injector();
                    if (inj) {
                        var $rootScope = inj.get('$rootScope');
                        $rootScope.$on('$routeChangeSuccess', function (e, route) {
                            var path = (route && route.$$route &&
                                        route.$$route.originalPath) || '';
                            if (/dashboard/i.test(path)) {
                                setTimeout(init, 400);
                            }
                        });
                        return; // success — stop polling
                    }
                } catch (e) {}
            }
            if (++tries < 60) { setTimeout(check, 300); }
        }());
    }

    /* ── Bootstrap ──────────────────────────────────────────────────────── */

    /* Document-level listeners work on any page — register right now */
    initDocListeners();

    /* Angular-dependent init — start polling */
    init();

    /* Wire route changes so navigating back to DD re-triggers stamping etc. */
    setupRouteListener();

}());
