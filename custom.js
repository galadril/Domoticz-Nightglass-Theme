/*
 *  Domoticz Dark Theme - custom.js
 *  A clean, modern dark dashboard theme for Domoticz
 *
 *  Entry point — loads modules from src/js/ in dependency order.
 *  Each module is a self-contained IIFE; load order is preserved via
 *  async=false so later modules can rely on globals from earlier ones
 *  (e.g. window._dzScheduleBurst set by icons.js).
 */

(function () {
    'use strict';

    /* Resolve base URL from the executing script tag so module paths
       work whether served by Domoticz (styles/default/), the demo, or
       any other static server.                                        */
    var base = (function () {
        var cs = document.currentScript;
        if (cs && cs.src) return cs.src.replace(/custom\.js(\?.*)?$/, '');
        /* Fallback: search for the script tag (IE / edge cases) */
        var tags = document.querySelectorAll('script[src]');
        for (var i = tags.length - 1; i >= 0; i--) {
            if (/custom\.js(\?|$)/.test(tags[i].src)) {
                return tags[i].src.replace(/custom\.js(\?.*)?$/, '');
            }
        }
        return '';
    }());

    var modules = [
        'src/js/core.js',           /* Ace editor, Highcharts theme, logo, dark/light toggle */
        'src/js/icons.js',          /* Font Awesome PNG → icon replacement system */
        'src/js/card-features.js',  /* bigtext, timestamps, moon phase, tilt/temp/glow/flash */
        'src/js/sparklines.js',     /* Feature 7: sparkline micro-charts */
        'src/js/search.js',         /* Feature 8: slash-to-search + keyboard shortcuts */
        'src/js/popups.js',         /* Feature 9: popup/modal redesigns */
        'src/js/toasts.js',         /* Feature 10: live toasts */
        'src/js/realtime.js',       /* Feature 11: WebSocket live card updates */
        'src/js/command-palette.js',/* Feature 12: Ctrl+K command palette */
        'src/js/notifications.js',  /* Feature 13: notification history panel (N key) */
        'src/js/room-filter.js',    /* Feature 14: room filter pill-bar */
        'src/js/events-editor.js',  /* Events editor: language classes + glyphicon swap */
    ];

    modules.forEach(function (m) {
        var s = document.createElement('script');
        s.src = base + m;
        s.async = false; /* preserve execution order */
        document.head.appendChild(s);
    });
}());
