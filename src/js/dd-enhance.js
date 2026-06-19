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

    // ── Helpers ──────────────────────────────────────────────────────

    function onDD(fn) {
        // Wait until .dd-page exists and Angular has processed it
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

    function getWidgetId(gsItem) {
        var cell = gsItem && gsItem.querySelector('[data-widget-id]');
        return cell ? cell.getAttribute('data-widget-id') : null;
    }

    // ── 1. Widget entrance animation — stamp --dd-widget-idx ─────────

    function stampWidgetIndices() {
        var grid = document.querySelector('.dd-grid');
        if (!grid) { return; }
        var items = grid.querySelectorAll('.grid-stack-item');
        items.forEach(function (item, i) {
            var content = item.querySelector('.grid-stack-item-content');
            if (content) { content.style.setProperty('--dd-widget-idx', i); }
        });
        // After all animations complete, disable further entrance animations
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
        // Force a fresh animation on the new card
        content.style.animation = 'none';
        void content.offsetWidth;
        content.style.animation = 'ddWidgetIn 0.38s cubic-bezier(0.22, 1, 0.36, 1) both';
        content.addEventListener('animationend', function () {
            content.style.animation = '';
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
            .on('dragstart', '.dd-grid .grid-stack-item', function () {
                var page = document.querySelector('.dd-page');
                if (page) { page.classList.add('dd-dragging'); }
            })
            .on('dragstop', '.dd-grid .grid-stack-item', function () {
                var page = document.querySelector('.dd-page');
                if (page) { page.classList.remove('dd-dragging'); }
            });
    }

    // ── 3. Unsaved changes indicator ──────────────────────────────────

    function initUnsavedIndicator() {
        // The Cancel button gets .btn-danger when the layout is dirty.
        // We watch its class attribute and mirror the state to .dd-toolbar.
        var toolbar = document.querySelector('.dd-toolbar');
        if (!toolbar) { return; }
        var cancelBtn = toolbar.querySelector('[ng-click="cancelEdit()"]');
        if (!cancelBtn) { return; }

        var mo = new MutationObserver(function () {
            toolbar.classList.toggle(
                'dd-has-unsaved',
                cancelBtn.classList.contains('btn-danger')
            );
        });
        mo.observe(cancelBtn, { attributes: true, attributeFilter: ['class'] });
    }

    // ── 4. Library panel: list/grid toggle ────────────────────────────

    function initLibraryToggle() {
        var panel = document.querySelector('.dd-library-panel');
        if (!panel) { return; }
        var header = panel.querySelector('.dd-library-panel-header');
        if (!header) { return; }

        // Inject toggle button between title and close
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

        // Insert before the close button
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

        // Remove existing recent section before re-injecting
        var old = panel.querySelector('.dd-library-recent');
        if (old) { old.remove(); }

        var recent = getRecent();
        if (!recent.length) { return; }

        // Only include types that are currently available in the library
        var available = recent.filter(function (lbl) {
            return !!findLibraryItemByLabel(lbl);
        });
        if (!available.length) { return; }

        var section = document.createElement('div');
        section.className = 'dd-library-recent';

        var label = document.createElement('div');
        label.className = 'dd-library-recent-label';
        label.textContent = 'Recently Added';
        section.appendChild(label);

        var list = document.createElement('div');
        list.className = 'dd-library-recent-items';

        available.forEach(function (widgetLabel) {
            var original = findLibraryItemByLabel(widgetLabel);
            if (!original) { return; }
            // Clone visual appearance, but wire click to the real item
            var iconEl  = original.querySelector('.dd-library-item-icon');
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

        // Insert at top of panel body, before first category
        var body = panel.querySelector('.dd-library-panel-body');
        if (body) {
            body.insertBefore(section, body.firstChild);
        }
    }

    function initRecentTracking() {
        // Delegated listener: capture label whenever a library item is clicked
        var panel = document.querySelector('.dd-library-panel');
        if (!panel) { return; }

        panel.addEventListener('click', function (e) {
            var item = e.target.closest('.dd-library-item');
            // Ignore clicks on our injected recent-section items (they click the real item)
            if (!item || item.closest('.dd-library-recent')) { return; }
            var lbl = item.querySelector('.dd-library-item-label');
            if (lbl) { saveRecent(lbl.textContent.trim()); }
        });

        // Re-inject recent section each time the panel opens
        var mo = new MutationObserver(function () {
            if (panel.classList.contains('open')) {
                // Wait one tick so Angular has rendered the item list
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
        document.removeEventListener('click', removeCtxMenu, true);
        document.removeEventListener('contextmenu', removeCtxMenu, true);
        document.removeEventListener('keydown', onCtxKey, true);
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

        // Check which actions are available for this widget
        var hasConfig = !!gsItem.querySelector('.dd-widget-header [title="Configure widget"]');

        var menu = document.createElement('div');
        menu.id = '_ctxMenu';
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
            'fa-solid fa-expand', 'Expand to full screen', false,
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
        var x = e.clientX;
        var y = e.clientY;
        menu.style.top  = '-9999px';
        menu.style.left = '-9999px';
        document.body.appendChild(menu);
        _ctxMenu = menu;

        var mw = menu.offsetWidth;
        var mh = menu.offsetHeight;
        if (x + mw > window.innerWidth  - 8) { x = window.innerWidth  - mw - 8; }
        if (y + mh > window.innerHeight - 8) { y = window.innerHeight - mh - 8; }
        menu.style.top  = y + 'px';
        menu.style.left = x + 'px';

        // Dismiss on any outside click or second right-click
        setTimeout(function () {
            document.addEventListener('click',       removeCtxMenu, true);
            document.addEventListener('contextmenu', removeCtxMenu, true);
            document.addEventListener('keydown',     onCtxKey,      true);
        }, 0);
    }

    function initContextMenu() {
        document.addEventListener('contextmenu', function (e) {
            if (!isEditMode()) { return; }
            var gsItem = e.target.closest('.dd-grid .grid-stack-item');
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

        // Backdrop
        var backdrop = document.createElement('div');
        backdrop.className = 'dd-expand-backdrop';
        backdrop.setAttribute('data-dd-expand', '1');
        document.body.appendChild(backdrop);

        // Close button
        var closeBtn = document.createElement('button');
        closeBtn.className = 'dd-expand-close';
        closeBtn.title = 'Close (Esc)';
        closeBtn.setAttribute('data-dd-expand', '1');
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        document.body.appendChild(closeBtn);

        // Store original inline styles so we can restore them
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

        // Pin at current position (no transition yet)
        content.style.cssText +=
            ';position:fixed!important' +
            ';top:'    + rect.top    + 'px' +
            ';left:'   + rect.left   + 'px' +
            ';width:'  + rect.width  + 'px' +
            ';height:' + rect.height + 'px' +
            ';z-index:9001!important' +
            ';transition:none!important' +
            ';border-radius:14px!important';

        void content.offsetWidth; // force reflow

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

        _expanded = { content: content, origStyle: origStyle, rect: rect, gsItem: gsItem };

        // After animation, trigger chart reflow
        setTimeout(function () {
            reflowCharts(content);
        }, 380);

        function close() { collapseWidget(); }
        backdrop.addEventListener('click', close);
        closeBtn.addEventListener('click', close);
    }

    function collapseWidget() {
        if (!_expanded) { return; }
        var content  = _expanded.content;
        var origStyle = _expanded.origStyle;
        var rect     = _expanded.rect;

        // Animate back to original position
        content.style.top          = rect.top    + 'px';
        content.style.left         = rect.left   + 'px';
        content.style.width        = rect.width  + 'px';
        content.style.height       = rect.height + 'px';
        content.style.borderRadius = '14px';

        content.addEventListener('transitionend', function handler() {
            content.removeEventListener('transitionend', handler);
            content.classList.remove('dd-widget-expanded');
            // Restore original inline styles
            Object.keys(origStyle).forEach(function (k) {
                content.style[k] = origStyle[k] || '';
            });
            reflowCharts(content);
        }, { once: true });

        // Remove backdrop + close button
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
            var gsItem = e.target.closest('.dd-grid .grid-stack-item');
            if (!gsItem) { return; }
            // Ignore double-click on interactive elements inside the widget
            if (e.target.closest('button, a, input, select, textarea, [ng-click]')) { return; }
            expandWidget(gsItem);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && _expanded) { collapseWidget(); }
        });
    }

    // ── Init ──────────────────────────────────────────────────────────

    function init() {
        onDD(function () {
            stampWidgetIndices();
            watchForNewWidgets();
            initSnapLines();
            initUnsavedIndicator();
            initLibraryToggle();
            initRecentTracking();
            initContextMenu();
            initFullscreenExpand();
        });
    }

    // Run on load; also re-run when Angular routes into the DD page
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-init on route changes (Angular SPA navigation)
    document.addEventListener('DOMContentLoaded', function () {
        if (!window.angular) { return; }
        try {
            var injector = angular.element(document.body).injector();
            if (!injector) { return; }
            var rootScope = injector.get('$rootScope');
            rootScope.$on('$routeChangeSuccess', function (e, route) {
                var path = route && route.$$route && route.$$route.originalPath || '';
                if (/dashboard/i.test(path)) {
                    // Give Angular time to compile the new view
                    setTimeout(init, 400);
                }
            });
        } catch (e) {}
    });

}());
