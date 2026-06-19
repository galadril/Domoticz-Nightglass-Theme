/*
 * dd-enhance.js
 * Dynamic Dashboard UX enhancements — Sprint 1 & 2
 *
 * Features:
 *  - Widget entrance animation index stamping
 *  - Drag snap-line toggle
 *  - Library panel: list/grid toggle + recently-used section
 *  - Widget context menu (right-click in edit mode)
 *  - Full-screen widget expand (double-click in view mode)
 *  - Unsaved changes dot indicator
 */
(function () {
    'use strict';

    var LS_GRID_MODE = 'dd-library-grid';
    var LS_RECENT    = 'dd-recent-widgets';
    var MAX_RECENT   = 6;

    /* Prevent registering document-level listeners more than once across
       Angular SPA navigations (init() can be called multiple times). */
    var _docListeners = false;

    /* Interval handle for unsaved-indicator polling — cleared on teardown */
    var _unsavedInterval = null;

    // ── Helpers ──────────────────────────────────────────────────────

    /* Poll until .dd-page exists and Angular has compiled it, then call fn(page, scope) */
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
            if (++tries < 80) { setTimeout(check, 150); }
        }());
    }

    /* Poll until .dd-grid exists (ng-if="gridReady" may delay it), then call fn(grid) */
    function waitForGrid(fn) {
        var tries = 0;
        (function check() {
            var grid = document.querySelector('.dd-grid');
            if (grid) { fn(grid); return; }
            if (++tries < 40) { setTimeout(check, 200); }
        }());
    }

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

    function isEditMode() {
        var page = document.querySelector('.dd-page');
        return page && page.classList.contains('edit-mode');
    }

    /* Safely get the nearest .grid-stack-item ancestor inside .dd-grid */
    function getGsItem(el) {
        if (!el || !el.closest) { return null; }
        var item = el.closest('.grid-stack-item');
        if (!item) { return null; }
        return item.closest('.dd-grid') ? item : null;
    }

    function getWidgetId(gsItem) {
        var cell = gsItem && gsItem.querySelector('[data-widget-id]');
        return cell ? cell.getAttribute('data-widget-id') : null;
    }

    // ── 1. Widget entrance animation — stamp --dd-widget-idx ─────────

    function stampWidgetIndices() {
        var grid = document.querySelector('.dd-grid');
        if (!grid) { return; }
        var items = grid.querySelectorAll('.grid-stack-item');

        /* Batch: set variables + pause animation for all items at once,
           then force a single reflow, then restore — avoids layout thrashing */
        items.forEach(function (item, i) {
            var c = item.querySelector('.grid-stack-item-content');
            if (c) {
                c.style.setProperty('--dd-widget-idx', i);
                c.style.animationName = 'none'; // pause so new delay applies
            }
        });

        void grid.offsetWidth; // single forced reflow

        items.forEach(function (item) {
            var c = item.querySelector('.grid-stack-item-content');
            if (c) { c.style.animationName = ''; } // re-trigger with correct delay
        });

        // After all animations complete, prevent future entrance animations
        var delay = items.length * 32 + 520;
        setTimeout(function () {
            var g = document.querySelector('.dd-grid');
            if (g) { g.classList.add('dd-grid-loaded'); }
        }, delay);
    }

    function animateNewWidget(gsItem) {
        var content = gsItem && gsItem.querySelector('.grid-stack-item-content');
        if (!content) { return; }
        content.style.setProperty('--dd-widget-idx', 0);
        content.style.animationName = 'none';
        void content.offsetWidth;
        content.style.animationName = '';
        content.addEventListener('animationend', function () {
            content.style.animationName = '';
        }, { once: true });
    }

    function watchForNewWidgets() {
        var grid = document.querySelector('.dd-grid');
        if (!grid) { return; }
        var mo = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (node.nodeType === 1 &&
                        node.classList &&
                        node.classList.contains('grid-stack-item')) {
                        animateNewWidget(node);
                    }
                });
            });
        });
        mo.observe(grid, { childList: true });
    }

    // ── 2. Drag snap-lines — toggle .dd-dragging on .dd-page ─────────

    function initSnapLines() {
        if (!window.$) { return; }
        $(document)
            .on('dragstart.ddEnhance', '.dd-grid .grid-stack-item', function () {
                var page = document.querySelector('.dd-page');
                if (page) { page.classList.add('dd-dragging'); }
            })
            .on('dragstop.ddEnhance', '.dd-grid .grid-stack-item', function () {
                var page = document.querySelector('.dd-page');
                if (page) { page.classList.remove('dd-dragging'); }
            });
    }

    // ── 3. Unsaved changes indicator ──────────────────────────────────

    function initUnsavedIndicator(scope) {
        /* Poll Angular's isDirty flag rather than watching DOM class changes.
           More reliable across Angular digest cycles.
           The interval self-destructs once the toolbar leaves the DOM. */
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

    // ── 4. Library panel: list/grid toggle ────────────────────────────

    function initLibraryToggle() {
        var panel = document.querySelector('.dd-library-panel');
        if (!panel) { return; }
        // Avoid double-injecting on re-init
        if (panel.querySelector('.dd-lib-view-btn')) { return; }

        var header = panel.querySelector('.dd-library-panel-header');
        if (!header) { return; }

        var btn = document.createElement('button');
        btn.className = 'dd-lib-view-btn';
        btn.title = 'Toggle list / grid view';
        var isGrid = localStorage.getItem(LS_GRID_MODE) === '1';
        btn.innerHTML = isGrid
            ? '<i class="fa-solid fa-list"></i>'
            : '<i class="fa-solid fa-grip"></i>';
        if (isGrid) { panel.classList.add('dd-library-grid-mode'); }

        btn.addEventListener('click', function () {
            var gridMode = panel.classList.toggle('dd-library-grid-mode');
            localStorage.setItem(LS_GRID_MODE, gridMode ? '1' : '0');
            btn.innerHTML = gridMode
                ? '<i class="fa-solid fa-list"></i>'
                : '<i class="fa-solid fa-grip"></i>';
        });

        var closeBtn = header.querySelector('.dd-panel-close');
        if (closeBtn) {
            header.insertBefore(btn, closeBtn);
        } else {
            header.appendChild(btn);
        }
    }

    // ── 5. Recently-used widgets ──────────────────────────────────────

    function getRecent() {
        try { return JSON.parse(localStorage.getItem(LS_RECENT) || '[]'); } catch (e) { return []; }
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

        var recent = getRecent();
        if (!recent.length) { return; }

        var available = recent.filter(function (lbl) {
            return !!findLibraryItemByLabel(lbl);
        });
        if (!available.length) { return; }

        var section = document.createElement('div');
        section.className = 'dd-library-recent';

        var labelEl = document.createElement('div');
        labelEl.className = 'dd-library-category-label dd-library-recent-label';
        labelEl.textContent = 'Recently Added';
        section.appendChild(labelEl);

        var list = document.createElement('div');
        list.className = 'dd-library-recent-items dd-library-category';

        available.forEach(function (widgetLabel) {
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
                var target = findLibraryItemByLabel(widgetLabel);
                if (target) { target.click(); }
            });
            list.appendChild(row);
        });

        section.appendChild(list);

        var body = panel.querySelector('.dd-library-panel-body');
        if (body) { body.insertBefore(section, body.firstChild); }
    }

    function initRecentTracking() {
        var panel = document.querySelector('.dd-library-panel');
        if (!panel) { return; }
        // Avoid double-binding on re-init
        if (panel._ddRecentBound) { return; }
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

    // ── 6. Context menu (right-click on widget in edit mode) ──────────

    var _ctxMenu = null;

    function removeCtxMenu() {
        if (_ctxMenu && _ctxMenu.parentNode) { _ctxMenu.parentNode.removeChild(_ctxMenu); }
        _ctxMenu = null;
        document.removeEventListener('click',       removeCtxMenu, true);
        document.removeEventListener('contextmenu', removeCtxMenu, true);
        document.removeEventListener('keydown',     onCtxKey,      true);
    }

    function onCtxKey(e) {
        if (e.key === 'Escape') { removeCtxMenu(); }
    }

    function buildCtxItem(iconClass, text, danger, action) {
        var item = document.createElement('div');
        item.className = 'dd-ctx-item' + (danger ? ' dd-ctx-item--danger' : '');
        item.innerHTML = '<i class="' + iconClass + '"></i><span>' + text + '</span>';
        item.addEventListener('click', function (e) {
            e.stopPropagation();
            removeCtxMenu();
            action();
        });
        return item;
    }

    function showCtxMenu(e, gsItem) {
        e.preventDefault();
        removeCtxMenu();

        var widgetId = getWidgetId(gsItem);
        if (!widgetId) { return; }

        var hasConfig = !!gsItem.querySelector('.dd-widget-header [title="Configure widget"]');

        var menu = document.createElement('div');
        menu.id = 'dd-ctx-menu';

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

        menu.appendChild(buildCtxItem(
            'fa-solid fa-expand', 'Expand full screen', false,
            function () { expandWidget(gsItem); }
        ));

        var divider = document.createElement('div');
        divider.className = 'dd-ctx-divider';
        menu.appendChild(divider);

        menu.appendChild(buildCtxItem(
            'fa-solid fa-trash', 'Remove widget', true,
            function () { callScope('removeWidget', [widgetId]); }
        ));

        // Position: keep inside viewport
        menu.style.top  = '-9999px';
        menu.style.left = '-9999px';
        document.body.appendChild(menu);
        _ctxMenu = menu;

        var x = e.clientX;
        var y = e.clientY;
        var mw = menu.offsetWidth;
        var mh = menu.offsetHeight;
        if (x + mw > window.innerWidth  - 8) { x = window.innerWidth  - mw - 8; }
        if (y + mh > window.innerHeight - 8) { y = window.innerHeight - mh - 8; }
        menu.style.top  = y + 'px';
        menu.style.left = x + 'px';

        // Dismiss on outside click / second right-click / Esc
        setTimeout(function () {
            document.addEventListener('click',       removeCtxMenu, true);
            document.addEventListener('contextmenu', removeCtxMenu, true);
            document.addEventListener('keydown',     onCtxKey,      true);
        }, 0);
    }

    function initContextMenu() {
        document.addEventListener('contextmenu', function (e) {
            if (!isEditMode()) { return; }
            var gsItem = getGsItem(e.target);
            if (!gsItem) { return; }
            showCtxMenu(e, gsItem);
        });
    }

    // ── 7. Full-screen widget expand (double-click in view mode) ──────

    var _expanded = null;

    function expandWidget(gsItem) {
        if (_expanded) { return; }
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

        var origStyle = {
            position:     content.style.position,
            top:          content.style.top,
            left:         content.style.left,
            width:        content.style.width,
            height:       content.style.height,
            zIndex:       content.style.zIndex,
            transition:   content.style.transition,
            borderRadius: content.style.borderRadius
        };

        // Pin at current position (no transition)
        content.style.cssText +=
            ';position:fixed!important' +
            ';top:'    + rect.top    + 'px' +
            ';left:'   + rect.left   + 'px' +
            ';width:'  + rect.width  + 'px' +
            ';height:' + rect.height + 'px' +
            ';z-index:9001!important' +
            ';transition:none!important' +
            ';border-radius:14px!important';

        void content.offsetWidth;

        // Animate to fullscreen
        content.style.transition =
            'top 0.35s cubic-bezier(0.22,1,0.36,1),' +
            'left 0.35s cubic-bezier(0.22,1,0.36,1),' +
            'width 0.35s cubic-bezier(0.22,1,0.36,1),' +
            'height 0.35s cubic-bezier(0.22,1,0.36,1),' +
            'border-radius 0.3s';
        content.style.top          = '0px';
        content.style.left         = '0px';
        content.style.width        = '100vw';
        content.style.height       = '100vh';
        content.style.borderRadius = '0px';
        content.classList.add('dd-widget-expanded');

        _expanded = { content: content, origStyle: origStyle, rect: rect };

        setTimeout(function () { reflowCharts(content); }, 380);

        backdrop.addEventListener('click', collapseWidget);
        closeBtn.addEventListener('click', collapseWidget);
    }

    function collapseWidget() {
        if (!_expanded) { return; }
        var content   = _expanded.content;
        var origStyle = _expanded.origStyle;
        var rect      = _expanded.rect;

        content.style.top          = rect.top    + 'px';
        content.style.left         = rect.left   + 'px';
        content.style.width        = rect.width  + 'px';
        content.style.height       = rect.height + 'px';
        content.style.borderRadius = '14px';

        content.addEventListener('transitionend', function handler() {
            content.removeEventListener('transitionend', handler);
            content.classList.remove('dd-widget-expanded');
            Object.keys(origStyle).forEach(function (k) {
                content.style[k] = origStyle[k] || '';
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

    function initFullscreenExpand() {
        document.addEventListener('dblclick', function (e) {
            if (isEditMode()) { return; }
            var gsItem = getGsItem(e.target);
            if (!gsItem) { return; }
            if (e.target.closest('button, a, input, select, textarea, [ng-click]')) { return; }
            expandWidget(gsItem);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && _expanded) { collapseWidget(); }
        });
    }

    // ── Init ──────────────────────────────────────────────────────────

    function init() {
        onDD(function (page, scope) {
            // Grid-dependent features wait for ng-if="gridReady" to resolve
            waitForGrid(function () {
                stampWidgetIndices();
                watchForNewWidgets();
            });

            initSnapLines();
            initUnsavedIndicator(scope);
            initLibraryToggle();
            initRecentTracking();

            // Document-level listeners must only be registered once
            if (!_docListeners) {
                initContextMenu();
                initFullscreenExpand();
                _docListeners = true;
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-init on Angular SPA navigation to the DD page
    document.addEventListener('DOMContentLoaded', function () {
        if (!window.angular) { return; }
        try {
            var injector = angular.element(document.body).injector();
            if (!injector) { return; }
            var rootScope = injector.get('$rootScope');
            rootScope.$on('$routeChangeSuccess', function (e, route) {
                var path = route && route.$$route && route.$$route.originalPath || '';
                if (/dashboard/i.test(path)) {
                    setTimeout(init, 400);
                }
            });
        } catch (e) {}
    });

}());
