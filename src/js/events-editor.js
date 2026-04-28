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
                setTimeout(swapIcons, 400);
                setTimeout(swapIcons, 1200);
            });
        } catch (e) {}

        // Watch for Angular re-renders (folder expand, filter changes)
        var mo = new MutationObserver(function (mutations) {
            if (mutations.some(function (m) { return m.addedNodes.length > 0; })) {
                setTimeout(swapIcons, 80);
            }
        });

        function hookEditor() {
            var ed = document.querySelector('.events-editor');
            if (ed) {
                mo.observe(ed, { childList: true, subtree: true });
            } else {
                setTimeout(hookEditor, 1000);
            }
        }
        hookEditor();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

