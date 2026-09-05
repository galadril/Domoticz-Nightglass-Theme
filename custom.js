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

    /* Cache-buster for the modules below. Browsers that already have
       Domoticz open keep the old src/js/*.js in cache indefinitely —
       there is no server-side versioning on these static files — so a
       browser that loaded the theme before a fix shipped can silently
       keep running the stale code (e.g. an old settings/tour bug) until
       a hard refresh. Bump this on every release so returning browsers
       fetch fresh copies automatically instead of needing a hard reload.
       Keep in sync with the version noted in README.md. */
    var THEME_VERSION = '0.1.0';

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
        'src/js/colors.js',         /* Shared colour kit: recently-used colour list */
        'src/js/icons.js',          /* Font Awesome PNG → icon replacement system */
        'src/js/card-features.js',  /* bigtext, timestamps, moon phase, tilt/temp/glow/flash */
        'src/js/sparklines.js',     /* Feature 7: sparkline micro-charts */
        'src/js/search.js',         /* Feature 8: slash-to-search + keyboard shortcuts + icon override dialog */
        'src/js/icon-studio.js',    /* Icon Studio: full icon picker overlay + custom icon libraries */
        'src/js/device-detail.js',  /* Device detail page: Nightglass icon source + override entry point */
        'src/js/popups.js',         /* Feature 9: popup/modal redesigns */
        'src/js/inline-picker.js',  /* Nightglass colour control for device/scene/group/timer pages */
        'src/js/toasts.js',         /* Feature 10: live toasts */
        'src/js/icon-migrate.js',   /* One-shot: per-device icon shapes → Domoticz's Icon column */
        'src/js/realtime.js',       /* Feature 11: WebSocket live card updates */
        'src/js/command-palette.js',/* Feature 12: Ctrl+K command palette */
        'src/js/notifications.js',  /* Feature 13: notification history panel (N key) */
        'src/js/room-filter.js',    /* Feature 14: room filter pill-bar */
        'src/js/events-editor.js',  /* Events editor: language classes + glyphicon swap */
        'src/js/dd-enhance.js',     /* Dynamic Dashboard: glass cards, animations, context menu, fullscreen */
        'src/js/tour.js',           /* First-run feature tour — last, so every global it points at exists */
    ];

    modules.forEach(function (m) {
        var s = document.createElement('script');
        s.src = base + m + '?v=' + THEME_VERSION;
        s.async = false; /* preserve execution order */
        document.head.appendChild(s);
    });
}());
