
/*
 /*
 *  Domoticz Dark Theme - custom.js
 *  A clean, modern dark dashboard theme for Domoticz
 *
 *  This file runs after the theme CSS is loaded.
 *  jQuery ($), Highcharts and all Domoticz globals are available.
 */

/* -- Highcharts palette (callable on mode change) ------------------ */
(function() {
    'use strict';
    var ACE_THEME_KEY = 'dz-ace-theme';
    var DEFAULT_ACE_THEME = 'string:ace/theme/tomorrow_night';
    var aceListenerAttached = false;

    // Apply the saved (or default) Ace editor theme on the events page.
    // Respects any theme the user has explicitly chosen via the dropdown.
    function setAceTheme() {
        // Only run on the events page (URL contains /events or #/events)
        if (!/\bevents\b/i.test(window.location.href)) return;
        var applyTheme = localStorage.getItem(ACE_THEME_KEY) || DEFAULT_ACE_THEME;
        // Wait for Angular to render the select
        var trySet = function() {
            var sel = document.querySelector('select[ng-model="$ctrl.aceSettings.theme"]');
            if (sel) {
                if (sel.value !== applyTheme) {
                    sel.value = applyTheme;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
                // Save future user-initiated changes so they persist across navigation
                if (!aceListenerAttached) {
                    aceListenerAttached = true;
                    sel.addEventListener('change', function() {
                        localStorage.setItem(ACE_THEME_KEY, this.value);
                    });
                }
            } else {
                setTimeout(trySet, 200);
            }
        };
        trySet();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setAceTheme);
    } else {
        setAceTheme();
    }
    // Also hook into Angular route changes (SPA navigation)
    window.addEventListener('hashchange', function() {
        aceListenerAttached = false; /* select is re-rendered on route change */
        setAceTheme();
    });
})();

function applyHighchartsTheme(isDark) {
    if (typeof Highcharts === 'undefined') return;
    var c = isDark ? {
        text:     '#e2e4ed',
        textSoft: '#b0b3c6',
        textMuted:'#7c7f93',
        surface:  '#23252f',
        surface2: '#2a2b35',
        surface3: '#33354a',
        border:   '#2e3040',
        borderB:  '#3a3b47',
        accent:   '#4e9af1',
        accentRgb:'78, 154, 241',
        tooltip:  'rgba(35, 37, 47, 0.95)',
        series:   ['#4e9af1','#4caf7d','#f0a832','#e05555','#c8a0ff','#ff7043','#29b6f6','#66bb6a','#ab47bc','#78909c']
    } : {
        text:     '#1a1c24',
        textSoft: '#4a4d5e',
        textMuted:'#6b6e7f',
        surface:  '#ffffff',
        surface2: '#f5f6fa',
        surface3: '#e8eaed',
        border:   '#d0d3dc',
        borderB:  '#c4c7d0',
        accent:   '#2a7de1',
        accentRgb:'42, 125, 225',
        tooltip:  'rgba(255, 255, 255, 0.97)',
        series:   ['#2a7de1','#2e8c58','#c07818','#d63b3b','#9c5fe0','#e05535','#0288d1','#4caf50','#8e24aa','#546e7a']
    };
    Highcharts.setOptions({
        colors: c.series,
        chart: {
            backgroundColor: 'transparent',
            plotBackgroundColor: 'transparent',
            plotBorderColor: c.border,
            style: {
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                color: c.text
            }
        },
        title:    { style: { color: c.text } },
        subtitle: { style: { color: c.textMuted } },
        xAxis: {
            gridLineColor: c.border,
            lineColor: c.borderB,
            tickColor: c.borderB,
            labels: { style: { color: c.textMuted } },
            title:  { style: { color: c.textSoft } }
        },
        yAxis: {
            gridLineColor: c.border,
            lineColor: c.borderB,
            tickColor: c.borderB,
            labels: { style: { color: c.textMuted } },
            title:  { style: { color: c.textSoft } }
        },
        legend: {
            backgroundColor: 'transparent',
            itemStyle:       { color: c.textSoft },
            itemHoverStyle:  { color: c.text },
            itemHiddenStyle: { color: c.borderB }
        },
        tooltip: {
            backgroundColor: c.tooltip,
            borderColor: c.borderB,
            style: { color: c.text }
        },
        plotOptions: {
            series: {
                dataLabels: { color: c.text },
                marker:     { lineColor: c.surface }
            },
            pie: { dataLabels: { color: c.textSoft } }
        },
        drilldown: {
            activeAxisLabelStyle: { color: c.accent },
            activeDataLabelStyle: { color: c.accent }
        },
        credits: { style: { color: c.borderB } },
        navigation: {
            buttonOptions: {
                symbolStroke: c.textSoft,
                theme: {
                    fill: c.surface2,
                    stroke: c.borderB,
                    states: {
                        hover:  { fill: c.surface3, stroke: c.accent },
                        select: { fill: c.surface3, stroke: c.accent }
                    }
                }
            },
            menuStyle: {
                background: c.surface,
                border: '1px solid ' + c.border,
                padding: '4px 0'
            },
            menuItemStyle:      { color: c.textSoft },
            menuItemHoverStyle: { background: 'rgba(' + c.accentRgb + ', 0.12)', color: c.text }
        }
    });
}

/* Highcharts theme is applied after DOM ready (body may be null in <head>) */
function _applyHCThemeOnReady() {
    applyHighchartsTheme(!document.body.classList.contains('dz-light'));
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _applyHCThemeOnReady);
} else {
    _applyHCThemeOnReady();
}


/* -- Replace navbar logo with theme icon --------------------------- */

(function () {
    'use strict';
    function replaceLogo() {
        var img = document.querySelector('.brand > img');
        if (img && img.src.indexOf('ic_launcher') === -1) {
            img.src = 'styles/default/images/ic_launcher.png';
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', replaceLogo);
    } else {
        replaceLogo();
    }
})();


/* -- Dark / Light mode toggle -------------------------------------- */

(function () {
    'use strict';

    var STORAGE_KEY = 'dz-theme-style';
    var LIGHT_CLASS = 'dz-light';
    var _mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

    function systemPrefersLight() {
        return _mql ? _mql.matches : false;
    }

    function resolveTheme(stored) {
        if (stored === 'auto') return systemPrefersLight() ? 'light' : 'dark';
        return stored || 'dark';
    }

    /* Apply saved preference as early as possible — but body may be null if
       the script runs in <head>, so guard with a readyState check. */
    function applyStoredTheme() {
        var stored = localStorage.getItem(STORAGE_KEY) || 'dark';
        var effective = resolveTheme(stored);
        if (effective === 'light') {
            document.body.classList.add(LIGHT_CLASS);
        } else {
            document.body.classList.remove(LIGHT_CLASS);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyStoredTheme);
    } else {
        applyStoredTheme();
    }

    function updateBtn(stored) {
        var a = document.getElementById('dz-theme-style-btn');
        if (!a) return;
        var icon = a.querySelector('i');
        var isLight = (stored === 'light') || (stored === 'auto' && systemPrefersLight());
        if (isLight) {
            if (icon) icon.className = 'fa-solid fa-moon';
            a.title = 'Switch to dark mode';
            a.setAttribute('aria-pressed', 'true');
            a.setAttribute('aria-label', 'Switch to dark mode');
        } else {
            if (icon) icon.className = 'fa-solid fa-sun';
            a.title = 'Switch to light mode';
            a.setAttribute('aria-pressed', 'false');
            a.setAttribute('aria-label', 'Switch to light mode');
        }
    }

    function applyEffective(stored) {
        var effective = resolveTheme(stored);
        if (effective === 'light') {
            document.body.classList.add(LIGHT_CLASS);
        } else {
            document.body.classList.remove(LIGHT_CLASS);
        }
        applyHighchartsTheme(effective !== 'light');
    }

    function toggle() {
        var stored = localStorage.getItem(STORAGE_KEY) || 'dark';
        // Simple two-state toggle: dark ↔ light
        // Auto mode is only set via the settings panel
        var next = (stored === 'light') ? 'dark' : 'light';
        localStorage.setItem(STORAGE_KEY, next);
        applyEffective(next);
        updateBtn(next);
    }

    /* Listen for OS theme changes when in auto mode */
    if (_mql && _mql.addEventListener) {
        _mql.addEventListener('change', function () {
            var stored = localStorage.getItem(STORAGE_KEY) || 'dark';
            if (stored === 'auto') {
                applyEffective('auto');
            }
        });
    }

    function injectToggle() {
        if (document.getElementById('dz-theme-style-nav')) return;
        var inner = document.querySelector('.navbar-inner');
        if (!inner) return;

        var stored = localStorage.getItem(STORAGE_KEY) || 'dark';
        var a = document.createElement('a');
        a.id = 'dz-theme-style-btn';
        a.href = 'javascript:void(0)';
        a.setAttribute('role', 'button');
        var icon = document.createElement('i');
        a.appendChild(icon);
        a.addEventListener('click', toggle);

        var li = document.createElement('li');
        li.id = 'dz-theme-style-toggle';
        li.appendChild(a);

        var nav = document.createElement('ul');
        nav.id = 'dz-theme-style-nav';
        nav.appendChild(li);
        /* Append to navbar-inner directly; positioned absolutely via CSS
           so it doesn't affect the container's float layout at all. */
        inner.appendChild(nav);
        /* updateBtn must run after the element is in the DOM,
           because it uses getElementById to find the button. */
        updateBtn(stored);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectToggle);
    } else {
        injectToggle();
    }
})();


/* ==================================================================
 *  Font Awesome icon replacement system
 *  Replaces PNG sprite icons with FA icons throughout the UI.
 *  Uses a filename -> FA-class mapping so original PNGs are hidden
 *  and a clean <i> element is inserted instead.
 * ================================================================== */

(function () {
    'use strict';

    /* -- PNG filename -> Font Awesome class mapping ---------------- */
    /* Key: substring matched against the img src attribute.          */
    /* Value: FA classes (uses FA 7 / FA 6 Free solid + regular).    */

    var ICON_MAP = {
        /* Main navbar tabs */
        'images/desktop.png':      'fa-solid fa-gauge',
        'images/house.png':        'fa-solid fa-house',
        'images/lightbulb.png':    'fa-solid fa-lightbulb',
        'images/lightbulboff.png': 'fa-regular fa-lightbulb',
        'images/scenes.png':       'fa-solid fa-layer-group',
        'images/temperature.png':  'fa-solid fa-temperature-half',
        'images/rain.png':         'fa-solid fa-cloud-rain',
        'images/utility.png':      'fa-solid fa-bolt',

        /* Setup dropdown */
        'images/setup.png':        'fa-solid fa-gear',
        'images/hardware.png':     'fa-solid fa-microchip',
        'images/devices.png':      'fa-solid fa-sliders',
        'images/energy.png':       'fa-solid fa-charging-station',
        'images/users.png':        'fa-solid fa-users',
        'images/update.png':       'fa-solid fa-download',
        'images/log.png':          'fa-solid fa-terminal',
        'images/about.png':        'fa-solid fa-circle-info',
        'images/logout.png':       'fa-solid fa-right-from-bracket',
        'images/restart.png':      'fa-solid fa-rotate-right',
        'images/shutdown.png':     'fa-solid fa-power-off',

        /* More options sub-menu */
        'images/events.png':       'fa-solid fa-code',
        'images/customicons.png':  'fa-solid fa-icons',
        'images/variables.png':    'fa-solid fa-list',
        'images/contact.png':      'fa-solid fa-share-nodes',
        'images/camera-web.png':   'fa-solid fa-video',
        'images/security.png':     'fa-solid fa-shield-halved',
        'images/notification.png': 'fa-solid fa-bell',
        'images/floorplans.png':   'fa-solid fa-map',
        'images/report.png':       'fa-solid fa-chart-bar',

        /* Action icons (data tables, edit forms) */
        'images/delete.png':       'fa-solid fa-trash-can',
        'images/rename.png':       'fa-solid fa-pen-to-square',
        'images/add.png':          'fa-solid fa-plus',

        /* Dashboard / card inline icons */
        'images/webcam.png':       'fa-solid fa-video',
        'images/override.png':     'fa-solid fa-sliders',
        'images/next.png':         'fa-solid fa-chevron-right',
        'images/capture.png':      'fa-solid fa-camera',
        'images/location.png':     'fa-solid fa-location-dot',

        /* Trend arrows (inline in bigtext / status) */
        'images/arrow_up.png':     'fa-solid fa-arrow-trend-up',
        'images/arrow_down.png':   'fa-solid fa-arrow-trend-down',
        'images/arrow_stable.png': 'fa-solid fa-right-long',
        'images/arrow_unk.png':    'fa-solid fa-question dz-trend-unk',

        /* Blinds stop (no 48 in filename) */
        'images/blindsstop.png':   'fa-solid fa-stop',

        /* Table row-ordering and set-unused */
        'images/up.png':           'fa-solid fa-arrow-up',
        'images/down.png':         'fa-solid fa-arrow-down',
        'images/remove.png':       'fa-solid fa-circle-minus',

        /* Table status / state indicators */
        'images/ok.png':           'fa-solid fa-circle-check',
        'images/failed.png':       'fa-solid fa-circle-xmark',
        'images/unknown.png':      'fa-solid fa-circle-question',
        'images/sleep.png':        'fa-solid fa-moon',
        'images/heal.png':         'fa-solid fa-heart-pulse',

        /* Table column header icons */
        'images/battery-ok.png':   'fa-solid fa-battery-full dz-batt-ok',
        'images/battery-low.png':  'fa-solid fa-battery-quarter dz-batt-low',
        'images/battery.png':      'fa-solid fa-battery-half dz-batt-mid',
        'images/air_signal.png':   'fa-solid fa-signal',

        /* Report trend icons (g-prefix = gas variant) */
        'images/equal.png':        'fa-solid fa-minus',
        'images/gup.png':          'fa-solid fa-arrow-trend-up',
        'images/gdown.png':        'fa-solid fa-arrow-trend-down',
        'images/gequal.png':       'fa-solid fa-minus'
    };

    /* -- Device type 48px icon mapping -------------------------------- */
    /* Maps device image base names to FA icon + on/off colours.         */
    /* Key: lowercase base name (e.g. 'light', 'fan').                   */
    /* Value: { icon, on, off } where on/off are CSS colour values.      */
    /* The matcher extracts the base name from filenames like             */
    /*   images/Light48_On.png  ?  base='light', state='on'              */
    /*   images/baro48.png      ?  base='baro',  state=null (always-on)  */

    var DEVICE_MAP = {
        /* Lights & dimmers */
        'light':           { icon: 'fa-solid fa-lightbulb',           on: '#f0a832', off: '#555770' },
        'dimmer':          { icon: 'fa-solid fa-circle-half-stroke',  on: '#f0a832', off: '#555770' },
        'glight':          { icon: 'fa-solid fa-lightbulb',           on: '#4caf7d', off: '#555770' },
        'strip':           { icon: 'fa-solid fa-grip-lines',          on: '#c8a0ff', off: '#555770' },

        /* RGB / colour */
        'rgb':             { icon: 'fa-solid fa-palette',             on: '#c8a0ff', off: '#555770' },

        /* Switches & push buttons */
        'generic':         { icon: 'fa-solid fa-toggle-on',           on: '#4caf7d', off: '#555770' },
        'push':            { icon: 'fa-solid fa-circle-dot',          on: '#4e9af1', off: '#555770' },
        'onoff':           { icon: 'fa-solid fa-power-off',           on: null,      off: null },
        'pushon':          { icon: 'fa-solid fa-circle-dot',          on: '#4e9af1', off: null },

        /* Contacts & doors */
        'contact':         { icon: 'fa-solid fa-door-closed',         on: '#e05555', off: '#4caf7d' },
        'door':            { icon: 'fa-solid fa-door-open',           on: '#e05555', off: '#4caf7d' },
        'window':          { icon: 'fa-solid fa-window-maximize',     on: '#e05555', off: '#4caf7d' },

        /* Blinds / shades (sel = active/highlighted, no suffix = inactive) */
        'blinds':          { icon: 'fa-solid fa-chevron-down',        on: '#4e9af1', off: '#555770' },
        'blindsopen':      { icon: 'fa-solid fa-chevron-up',          on: '#4e9af1', off: '#555770' },

        /* Climate */
        'heating':         { icon: 'fa-solid fa-fire',               on: '#e05555', off: '#555770' },
        'cooling':         { icon: 'fa-solid fa-snowflake',           on: '#29b6f6', off: '#555770' },
        'radiator':        { icon: 'fa-solid fa-fire-flame-curved',   on: '#e05555', off: '#555770' },
        'fireplace':       { icon: 'fa-solid fa-fire',                on: '#ff7043', off: '#555770' },
        'fan':             { icon: 'fa-solid fa-fan',                 on: '#4e9af1', off: '#555770' },
        'ac':              { icon: 'fa-solid fa-snowflake',           on: '#29b6f6', off: '#555770' },
        'ehome':           { icon: 'fa-solid fa-house-chimney',       on: '#4caf7d', off: '#555770' },

        /* Water & irrigation */
        'water':           { icon: 'fa-solid fa-droplet',             on: '#29b6f6', off: '#555770' },
        'tap':             { icon: 'fa-solid fa-faucet',              on: '#29b6f6', off: '#555770' },
        'irrigation':      { icon: 'fa-solid fa-hand-holding-droplet',on: '#4caf7d', off: '#555770' },
        'pool':            { icon: 'fa-solid fa-water-ladder',        on: '#29b6f6', off: '#555770' },
        'pump':            { icon: 'fa-solid fa-pump-soap',           on: '#4e9af1', off: '#555770' },

        /* Energy & power */
        'solar':           { icon: 'fa-solid fa-solar-panel',         on: '#f0a832', off: '#555770' },
        'pv':              { icon: 'fa-solid fa-solar-panel',         on: '#f0a832', off: null },
        'inverter':        { icon: 'fa-solid fa-bolt',                on: '#f0a832', off: '#555770' },
        'charger':         { icon: 'fa-solid fa-charging-station',    on: '#4caf7d', off: '#555770' },
        'laadpaal':        { icon: 'fa-solid fa-charging-station',    on: '#4caf7d', off: '#555770' },
        'wallsocket':      { icon: 'fa-solid fa-plug',                on: '#4caf7d', off: '#555770' },
        'current':         { icon: 'fa-solid fa-bolt',                on: '#f0a832', off: null },

        /* Media & entertainment */
        'tv':              { icon: 'fa-solid fa-tv',                  on: '#4e9af1', off: '#555770' },
        'media':           { icon: 'fa-solid fa-play',                on: '#4e9af1', off: '#555770' },
        'speaker':         { icon: 'fa-solid fa-volume-high',         on: '#4e9af1', off: '#555770' },
        'amplifier':       { icon: 'fa-solid fa-volume-high',         on: '#c8a0ff', off: '#555770' },
        'logitechmediaserver': { icon: 'fa-solid fa-music',           on: '#4caf7d', off: '#555770' },
        'remote':          { icon: 'fa-solid fa-gamepad',             on: null,      off: null },

        /* Computing & phones */
        'computer':        { icon: 'fa-solid fa-display',             on: '#4e9af1', off: '#555770' },
        'computerpc':      { icon: 'fa-solid fa-computer',            on: '#4e9af1', off: '#555770' },
        'harddisk':        { icon: 'fa-solid fa-hard-drive',          on: '#4e9af1', off: '#555770' },
        'phone':           { icon: 'fa-solid fa-phone',               on: '#4caf7d', off: '#555770' },
        'printer':         { icon: 'fa-solid fa-print',               on: '#4e9af1', off: '#555770' },

        /* Security & alarms */
        'alarm':           { icon: 'fa-solid fa-bell',                on: '#e05555', off: '#555770' },
        'smoke':           { icon: 'fa-solid fa-triangle-exclamation',on: '#e05555', off: '#555770' },
        'motion':          { icon: 'fa-solid fa-person-running',      on: '#e05555', off: '#555770' },
        'security':        { icon: 'fa-solid fa-shield-halved',       on: null,      off: null },

        /* Appliances */
        'coffee':          { icon: 'fa-solid fa-mug-hot',             on: '#ff7043', off: '#555770' },
        'washingmachine':  { icon: 'fa-solid fa-shirt',               on: '#4e9af1', off: '#555770' },
        'christmastree':   { icon: 'fa-solid fa-tree',                on: '#4caf7d', off: '#555770' },

        /* Sensors (read-only, no on/off) */
        'temp':            { icon: 'fa-solid fa-temperature-half',    on: '#e05555', off: null },
        'humidity':        { icon: 'fa-solid fa-droplet',             on: '#29b6f6', off: '#555770' },
        'baro':            { icon: 'fa-solid fa-gauge',               on: '#4e9af1', off: null },
        'rain':            { icon: 'fa-solid fa-cloud-showers-heavy', on: '#29b6f6', off: '#555770' },
        'wind':            { icon: 'fa-solid fa-wind',                on: '#b0b3c6', off: null },
        'uv':              { icon: 'fa-solid fa-sun',                 on: '#f0a832', off: null },
        'lux':             { icon: 'fa-solid fa-sun',                 on: '#f0a832', off: null },
        'visibility':      { icon: 'fa-solid fa-eye',                 on: '#b0b3c6', off: null },
        'radiation':       { icon: 'fa-solid fa-radiation',           on: '#e05555', off: null },
        'gauge':           { icon: 'fa-solid fa-gauge',               on: '#4e9af1', off: null },
        'counter':         { icon: 'fa-solid fa-hashtag',             on: '#4e9af1', off: null },
        'percentage':      { icon: 'fa-solid fa-percent',             on: '#4e9af1', off: null },
        'scale':           { icon: 'fa-solid fa-scale-balanced',      on: '#b0b3c6', off: null },
        'gas':             { icon: 'fa-solid fa-gas-pump',            on: '#f0a832', off: null },
        'leaf':            { icon: 'fa-solid fa-leaf',                on: '#4caf7d', off: null },
        'moisture':        { icon: 'fa-solid fa-hand-holding-droplet',on: '#29b6f6', off: null },
        'soil':            { icon: 'fa-solid fa-seedling',            on: '#4caf7d', off: '#555770' },
        'air':             { icon: 'fa-solid fa-wind',                on: '#b0b3c6', off: null },
        'airmeasure':      { icon: 'fa-solid fa-lungs',               on: '#4e9af1', off: '#555770' },
        'sun':             { icon: 'fa-solid fa-sun',                 on: '#f0a832', off: '#555770' },
        'victron':         { icon: 'fa-solid fa-car-battery',         on: '#4caf7d', off: '#555770' },

        /* Locks */
        'doorlock':        { icon: 'fa-solid fa-lock',                on: '#4caf7d', off: '#e05555' },
        'doorlockcontact': { icon: 'fa-solid fa-lock',                on: '#4caf7d', off: '#e05555' },

        /* Energy meters */
        'smartmeter':      { icon: 'fa-solid fa-bolt',                on: '#f0a832', off: null },
        'p1smartmeter':    { icon: 'fa-solid fa-bolt',                on: '#f0a832', off: null },
        'electricityusage':{ icon: 'fa-solid fa-bolt',                on: '#f0a832', off: null },

        /* Air quality */
        'airquality':      { icon: 'fa-solid fa-smog',                on: '#f0a832', off: null },
        'pm25':            { icon: 'fa-solid fa-smog',                on: '#f0a832', off: null },
        'co2':             { icon: 'fa-solid fa-cloud',               on: '#f0a832', off: null },
        'co':              { icon: 'fa-solid fa-cloud',               on: '#e05555', off: null },

        /* Water leak / flood */
        'leaksensor':      { icon: 'fa-solid fa-droplet',             on: '#e05555', off: '#4caf7d' },
        'flood':           { icon: 'fa-solid fa-droplet',             on: '#e05555', off: '#4caf7d' },

        /* Curtains (distinct from roller blinds) */
        'curtain':         { icon: 'fa-solid fa-table-columns',       on: '#4e9af1', off: '#555770' },

        /* Presence / PIR */
        'presence':        { icon: 'fa-solid fa-circle-dot',          on: '#e05555', off: '#555770' },
        'pir':             { icon: 'fa-solid fa-person-running',       on: '#e05555', off: '#555770' },

        /* Misc */
        'text':            { icon: 'fa-solid fa-font',                on: '#b0b3c6', off: null },
        'alert':           { icon: 'fa-solid fa-circle-exclamation',  on: '#e05555', off: null },
        'clock':           { icon: 'fa-solid fa-clock',               on: '#4e9af1', off: '#555770' },
        'mode':            { icon: 'fa-solid fa-sliders',             on: '#4e9af1', off: null },
        'doorbell':        { icon: 'fa-solid fa-bell',                on: '#f0a832', off: null },
        'adjust':          { icon: 'fa-solid fa-sliders',             on: '#4e9af1', off: null },
        'custom':          { icon: 'fa-solid fa-gear',                on: '#b0b3c6', off: '#555770' }
    };

    /* -- Favorite star icons -------------------------------------- */

    var FAV_MAP = {
        'images/nofavorite.png': 'fa-regular fa-star dz-fa-fav dz-fav-off',
        'images/favorite.png':   'fa-solid fa-star dz-fa-fav dz-fav-on'
    };
    var FAV_KEYS = Object.keys(FAV_MAP);
    var ICON_KEYS = Object.keys(ICON_MAP);

    /* -- Temperature range icons (module-level so keys are cached) -- */
    var TEMP_COLORS = {
        'ice.png':         { cls: 'fa-solid fa-snowflake',                  color: '#29b6f6' },
        'temp-0-5.png':    { cls: 'fa-solid fa-temperature-empty',          color: '#29b6f6' },
        'temp-5-10.png':   { cls: 'fa-solid fa-temperature-quarter',        color: '#4caf7d' },
        'temp-10-15.png':  { cls: 'fa-solid fa-temperature-low',            color: '#4caf7d' },
        'temp-15-20.png':  { cls: 'fa-solid fa-temperature-half',           color: '#f0a832' },
        'temp-20-25.png':  { cls: 'fa-solid fa-temperature-three-quarters', color: '#ff7043' },
        'temp-25-30.png':  { cls: 'fa-solid fa-temperature-high',           color: '#e05555' },
        'temp-gt-30.png':  { cls: 'fa-solid fa-temperature-full',           color: '#e05555' }
    };
    var TEMP_KEYS = Object.keys(TEMP_COLORS);

    /* -- Device icon parser ---------------------------------------- */
    /* Extracts base name + state from filenames like:                 */
    /*   images/Light48_On.png   ? { base:'light', state:'on' }       */
    /*   images/smoke48on.png    ? { base:'smoke', state:'on' }       */
    /*   images/baro48.png       ? { base:'baro', state:null }        */
    /*   images/blinds48sel.png  ? { base:'blinds', state:'on' }      */
    /*   images/motion48-on.png  ? { base:'motion', state:'on' }      */

    var DEVICE_RE = /images\/([A-Za-z]+)(?:48)?(?:[_-]?(On|Off|on|off|sel))?\.png/;

    function parseDeviceSrc(src) {
        var m = DEVICE_RE.exec(src);
        if (!m) return null;
        var base = m[1].toLowerCase();
        var state = m[2] ? m[2].toLowerCase() : null;
        if (state === 'sel') state = 'on';
        return { base: base, state: state };
    }

    /* -- Alert level icons (Alert48_0 .. Alert48_4) --------------- */
    var ALERT_RE = /images\/Alert48_(\d)\.png/i;
    var ALERT_COLORS = ['#8a8a8a','#4caf7d', '#f0a832', '#ff7043', '#e05555'];

    /* -- Wind direction rotation map ------------------------------ */
    /* fa-arrow-up points North at 0�. Rotate clockwise for each dir. */
    var WIND_ROTATION = {
        'N': 0, 'NNE': 22, 'NE': 45, 'ENE': 67,
        'E': 90, 'ESE': 112, 'SE': 135, 'SSE': 157,
        'S': 180, 'SSW': 202, 'SW': 225, 'WSW': 247,
        'W': 270, 'WNW': 292, 'NW': 315, 'NNW': 337
    };

    /* -- Action-button detector ------------------------------------- */
    /* Returns true when the <img> is an action button (not a toggleable
       state icon).  Action buttons live inside popups/dialogs, in
       scene/group/blind multi-icon rows, or in any non-switch context.
       Only single-icon switch devices get the optimistic click-toggle. */

    function isActionButton(img) {
        /* Inside a popup / dialog overlay */
        if (img.closest && img.closest('#rgbw_popup, #rfy_popup, #setpoint_popup')) return true;

        var td = img.parentElement;
        if (td && td.tagName === 'TD') {
            var id = td.getAttribute('id');
            /* 2nd / 3rd icon cell — always an action button */
            if (id === 'img2' || id === 'img3') return true;

            /* Scene/group/blind cards use multi-icon table layouts
               (itemtabledoubleicon, itemtabletrippleicon).  ALL icons
               in these rows are action buttons, not toggleable state
               indicators — only single-icon switch cards should toggle. */
            var tr = td.closest('tr');
            if (tr && (id === 'img' || id === 'img1')) {
                /* If the row has sibling img2/img3 cells, this is a
                   multi-icon (scene/group/blind) layout */
                if (tr.querySelector('td#img2') || tr.querySelector('td#img3')) return true;
            }

            /* Also check the table id directly for double/triple icon tables */
            var tbl = td.closest('table');
            if (tbl) {
                var tblId = tbl.getAttribute('id') || '';
                if (tblId.indexOf('doubleicon') !== -1 ||
                    tblId.indexOf('trippleicon') !== -1) return true;
            }
        }
        return false;
    }

    /* -- Core replacement function -------------------------------- */

    function getSizeClass(img, src) {
        /* Trend arrows — arrow_ prefix and report trend icons.           */
        /* gup./gdown. must be checked before up./down. to avoid mismatch */
        if (src.indexOf('arrow_') !== -1 ||
            src.indexOf('gup.')   !== -1 ||
            src.indexOf('gdown.') !== -1 ||
            src.indexOf('gequal.') !== -1 ||
            src.indexOf('equal.') !== -1)        return 'dz-fa-trend';
        /* Action buttons in table rows */
        if (src.indexOf('delete.') !== -1 ||
            src.indexOf('rename.') !== -1 ||
            src.indexOf('remove.') !== -1 ||
            src.indexOf('add.')    !== -1 ||
            src.indexOf('up.')     !== -1 ||
            src.indexOf('down.')   !== -1 ||
            src.indexOf('override.') !== -1)     return 'dz-fa-action';
        /* Table status / state icons */
        if (src.indexOf('ok.')      !== -1 ||
            src.indexOf('failed.')  !== -1 ||
            src.indexOf('unknown.') !== -1 ||
            src.indexOf('sleep.')   !== -1 ||
            src.indexOf('heal.')    !== -1)      return 'dz-fa-action';
        if (src.indexOf('next.') !== -1)         return 'dz-fa-nav';
        if (src.indexOf('48') !== -1)            return 'dz-fa-device';
        /* Temperature range icons + blinds stop → device size */
        if (src.indexOf('temp-') !== -1 ||
            src.indexOf('ice.') !== -1 ||
            src.indexOf('blindsstop') !== -1)    return 'dz-fa-device';
        return 'dz-fa-icon';
    }

    /* Should this src be skipped entirely? (keep original PNG) */
    function shouldSkip(src) {
        if (!src || src.indexOf('{{') !== -1) return true;
        if (src.indexOf('images/evohome/') !== -1) return true;
        if (src.indexOf('Coltemp48') !== -1 ||
            src.indexOf('White48')   !== -1 ||
            src.indexOf('Customw48') !== -1 ||
            src.indexOf('Customww48') !== -1 ||
            src.indexOf('RGB48_Sel')  !== -1 ||
            src.indexOf('RGB48.png')  !== -1) return true;
        if (src.indexOf('Up48') !== -1 ||
            src.indexOf('Down48') !== -1 ||
            src.indexOf('Stop48') !== -1) return true;
        if (src.indexOf('uvdark') !== -1 ||
            src.indexOf('uvsunny') !== -1 ||
            src.indexOf('siren-') !== -1) return true;
        if (src.indexOf('camera_default') !== -1) return true;
        if (src.indexOf('empty16') !== -1)        return true;
        return false;
    }

    /* Try to resolve a src to an FA spec. Returns null if no match. */
    function resolveIcon(src) {
        /* Favorites */
        for (var f = 0; f < FAV_KEYS.length; f++) {
            if (src.indexOf(FAV_KEYS[f]) !== -1) {
                return { type: 'fav', cls: FAV_MAP[FAV_KEYS[f]], color: null };
            }
        }
        /* ICON_MAP check first — explicit navbar/action/status icons take priority
           over the device parser, preventing e.g. rain.png → device match      */
        for (var m = 0; m < ICON_KEYS.length; m++) {
            if (src.indexOf(ICON_KEYS[m]) !== -1) {
                return { type: 'icon', cls: ICON_MAP[ICON_KEYS[m]], color: null };
            }
        }
        /* Device icons (48px cards + non-48 table type indicators) */
        var dev = parseDeviceSrc(src);
        if (dev && DEVICE_MAP[dev.base]) {
            var spec = DEVICE_MAP[dev.base];
            /* For blinds: only 'sel' (→ 'on') is active; no suffix = inactive */
            var isOn = (dev.base === 'blinds' || dev.base === 'blindsopen')
                ? dev.state === 'on'
                : dev.state !== 'off';
            var color = isOn ? (spec.on || '#b0b3c6') : (spec.off || '#555770');
            if (src.indexOf('48') !== -1) {
                return { type: 'device', cls: spec.icon + ' dz-fa-device', color: color,
                         colorOn: spec.on || '#b0b3c6', colorOff: spec.off || '#555770' };
            } else {
                /* Non-48 table icons: use on-colour for type indicator, icon-size */
                return { type: 'icon', cls: spec.icon, color: spec.on || '#b0b3c6' };
            }
        }
        /* Alert level icons */
        var alertMatch = ALERT_RE.exec(src);
        if (alertMatch) {
            var level = parseInt(alertMatch[1], 10);
            return { type: 'device', cls: 'fa-solid fa-circle-exclamation dz-fa-device', color: ALERT_COLORS[level] || '#e05555',
                     colorOn: ALERT_COLORS[level] || '#e05555', colorOff: '#555770' };
        }
        /* Wind direction compass icons */
        var windMatch = /images\/Wind([A-Z]{1,3})\.png/.exec(src);
        if (windMatch) {
            return { type: 'wind', dir: windMatch[1], cls: 'fa-solid fa-arrow-up dz-fa-device dz-wind', color: '#29b6f6' };
        }
        /* Wind0 / wind48 (calm / generic wind) */
        if (src.indexOf('Wind0.png') !== -1 || src.indexOf('wind48.png') !== -1) {
            return { type: 'device', cls: 'fa-solid fa-wind dz-fa-device', color: '#b0b3c6' };
        }
        /* Temperature range icons (need device size + colour) */
        for (var t = 0; t < TEMP_KEYS.length; t++) {
            if (src.indexOf(TEMP_KEYS[t]) !== -1) {
                var tc = TEMP_COLORS[TEMP_KEYS[t]];
                return { type: 'device', cls: tc.cls + ' dz-fa-device', color: tc.color };
            }
        }
        return null;
    }

    /* -- img → <i> map for direct updates & orphan cleanup -------- */
    /* WeakMap so entries are GC'd automatically when the img is gone */
    var iconMap = new WeakMap();

    /* -- Process a single <img> into an FA <i> -------------------- */
    /* Returns true if the image was processed, false if skipped.      */

    function processImg(img) {
        if (img.classList.contains('dz-icon-replaced') ||
            img.classList.contains('dz-icon-skipped'))  return false;

        /* Skip images inside icon-picker dropdowns (Edit Device dialog) */
        if (img.classList.contains('dd-option-image') || img.closest('.dd-options, .dd-select, .iconlist')) {
            img.classList.add('dz-icon-skipped');
            return false;
        }

        var src = img.getAttribute('src') || '';

        /* Skip unresolved Angular templates */
        if (!src || src.indexOf('{{') !== -1) return false;

        /* Skip excluded images */
        if (shouldSkip(src)) {
            img.classList.add('dz-icon-skipped');
            return false;
        }

        var resolved = resolveIcon(src);
        if (!resolved) {
            img.classList.add('dz-icon-skipped');
            return false;
        }

        var icon = document.createElement('i');

        if (resolved.type === 'fav') {
            icon.className = resolved.cls;
            icon.style.cursor = 'pointer';
            icon.addEventListener('click', function () {
                if (this.classList.contains('dz-fav-on')) {
                    this.classList.remove('dz-fav-on', 'fa-solid');
                    this.classList.add('dz-fav-off', 'fa-regular');
                } else {
                    this.classList.remove('dz-fav-off', 'fa-regular');
                    this.classList.add('dz-fav-on', 'fa-solid');
                }
            });
            /* Hide the sibling favorite image (Domoticz keeps both
               favorite.png and nofavorite.png side by side, toggling
               visibility). Mark the other one as replaced and map it
               to the same FA <i> so src-change updates and recovery
               logic don't create a duplicate star. */
            var siblings = img.parentNode ? img.parentNode.querySelectorAll('img[src*="favorite"]') : [];
            for (var si = 0; si < siblings.length; si++) {
                if (siblings[si] !== img && !siblings[si].classList.contains('dz-icon-replaced')) {
                    siblings[si].classList.add('dz-icon-replaced');
                    siblings[si].setAttribute('data-dz-src', siblings[si].getAttribute('src') || '');
                    iconMap.set(siblings[si], icon);
                }
            }
        } else if (resolved.type === 'wind') {
            icon.className = resolved.cls;
            if (resolved.color) icon.style.color = resolved.color;
            var rot = WIND_ROTATION[resolved.dir];
            if (rot !== null) icon.style.transform = 'rotate(' + rot + 'deg)';
        } else if (resolved.type === 'device') {
            icon.className = resolved.cls;
            if (resolved.color) icon.style.color = resolved.color;
            /* Store on/off colours for state tracking */
            if (resolved.colorOn)  icon.setAttribute('data-dz-color-on',  resolved.colorOn);
            if (resolved.colorOff) icon.setAttribute('data-dz-color-off', resolved.colorOff);
            icon.setAttribute('data-dz-state', resolved.color === resolved.colorOn ? 'on' : 'off');
            /* Optimistic toggle: immediately swap color on click so the user
               sees instant visual feedback before Angular/API round-trip.
               Skip for action buttons (popup on/off, scene/group/blind
               2nd/3rd icons) — those are not toggleable state icons.       */
            if (!isActionButton(img)) {
                icon.addEventListener('click', function () {
                    var onColor  = this.getAttribute('data-dz-color-on');
                    var offColor = this.getAttribute('data-dz-color-off');
                    if (!onColor || !offColor) return;
                    var nowOn = this.getAttribute('data-dz-state') === 'on';
                    this.setAttribute('data-dz-state', nowOn ? 'off' : 'on');
                    this.style.color = nowOn ? offColor : onColor;
                });
            }
        } else {
            var sizeClass = getSizeClass(img, src);
            icon.className = resolved.cls + ' ' + sizeClass;
            if (resolved.color) icon.style.color = resolved.color;
        }

        var prev = img.previousElementSibling;
        if (prev && prev.tagName === 'I' &&
                (prev.classList.contains('dz-fa-device') ||
                 prev.classList.contains('dz-fa-fav')    ||
                 prev.classList.contains('dz-fa-icon')   ||
                 prev.classList.contains('dz-fa-trend')  ||
                 prev.classList.contains('dz-fa-action') ||
                 prev.classList.contains('dz-fa-nav')    ||
                 prev.classList.contains('dz-wind'))) {
            prev.parentNode.removeChild(prev);
        }

        copyAttrs(img, icon);

        /* Trend indicator tooltips — explain the arrow meaning on hover */
        if (icon.classList.contains('dz-fa-trend') && !icon.getAttribute('title')) {
            if (icon.classList.contains('fa-arrow-trend-up'))   icon.title = 'Rising';
            else if (icon.classList.contains('fa-arrow-trend-down')) icon.title = 'Falling';
            else if (icon.classList.contains('fa-right-long'))  icon.title = 'Stable';
        }

        img.setAttribute('data-dz-src', src);
        img.classList.add('dz-icon-replaced');
        iconMap.set(img, icon);
        img.parentNode.insertBefore(icon, img);
        return true;
    }

    /* -- Process unprocessed images (used by Pass 1 & recovery) -- */
    function processNewImages(root) {
        var newImgs = root.querySelectorAll('img:not(.dz-icon-replaced):not(.dz-icon-skipped)');
        for (var i = 0; i < newImgs.length; i++) {
            processImg(newImgs[i]);
        }
    }

    /* -- Directly update an already-replaced icon when src changes - */
    /* Called immediately from the MutationObserver — no burst delay. */
    function updateReplacedIcon(img) {
        var icon = iconMap.get(img);
        if (!icon) return;

        var curSrc  = img.getAttribute('src') || '';
        var prevSrc = img.getAttribute('data-dz-src') || '';

        if (!curSrc || curSrc === prevSrc || curSrc.indexOf('{{') !== -1) return;
        if (shouldSkip(curSrc)) return;

        var resolved = resolveIcon(curSrc);
        if (!resolved) return;

        if (resolved.type === 'fav') {
            icon.className = resolved.cls;
        } else if (resolved.type === 'wind') {
            icon.className = resolved.cls;
            icon.style.color = resolved.color || '';
            var rot = WIND_ROTATION[resolved.dir];
            icon.style.transform = (rot !== undefined && rot !== null)
                ? 'rotate(' + rot + 'deg)' : '';
        } else if (resolved.type === 'device') {
            icon.className = resolved.cls;
            icon.style.color = resolved.color || '';
            /* Refresh stored on/off colors and state flag so future optimistic
               toggles stay in sync with the authoritative device state.        */
            if (resolved.colorOn)  icon.setAttribute('data-dz-color-on',  resolved.colorOn);
            if (resolved.colorOff) icon.setAttribute('data-dz-color-off', resolved.colorOff);
            icon.setAttribute('data-dz-state', resolved.color === resolved.colorOn ? 'on' : 'off');
        } else {
            icon.className = resolved.cls + ' ' + getSizeClass(img, curSrc);
            icon.style.color = resolved.color || '';
        }

        img.setAttribute('data-dz-src', curSrc);
    }

    /* -- Detach orphaned iconMap entries when Angular removes <img>s -- */
    /* The <i> itself is NOT removed here — it stays in the DOM briefly
       so there is no visible gap.  If Angular removed the whole
       container, the <i> is already gone.  If only the <img> was
       swapped, the stale <i> will be cleaned up by Pass 2 recovery
       in replaceIcons once the burst runs and finds the new <img>.     */
    function cleanupOrphan(node) {
        if (node.nodeType !== 1) return;
        /* Don't clean up nodes that are still connected to the document —
           DataTables temporarily detaches rows during pagination/redraw
           and re-attaches them shortly after. Cleaning up too eagerly
           causes icons to disappear on those rows. */
        if (node.isConnected) return;
        if (node.tagName === 'IMG') {
            iconMap.delete(node);
        }
        var inner = node.querySelectorAll ? node.querySelectorAll('img') : [];
        for (var q = 0; q < inner.length; q++) {
            iconMap.delete(inner[q]);
        }
    }

    function replaceIcons(root) {
        if (!root) return;

        /* --- Pass 1: new images that haven't been processed yet --- */
        processNewImages(root);

        /* --- Pass 2: update already-replaced icons / recover orphans --- */
        var replaced = root.querySelectorAll('img.dz-icon-replaced');
        var recovered = false;
        for (var j = 0; j < replaced.length; j++) {
            var rImg = replaced[j];
            var curSrc = rImg.getAttribute('src') || '';
            var prevSrc = rImg.getAttribute('data-dz-src') || '';

            /* Recovery: if the FA <i> sibling was removed (e.g. Angular
               re-rendered the container), reset the img so it can be
               re-processed immediately.                                  */
            var sibling = rImg.previousElementSibling;
            var hasSibling = sibling && (sibling.tagName === 'I') &&
                (sibling.classList.contains('dz-fa-device') ||
                 sibling.classList.contains('dz-fa-fav')    ||
                 sibling.classList.contains('dz-fa-icon')   ||
                 sibling.classList.contains('dz-fa-trend')  ||
                 sibling.classList.contains('dz-fa-action') ||
                 sibling.classList.contains('dz-fa-nav')    ||
                 sibling.classList.contains('dz-wind'));
            if (!hasSibling) {
                /* Also clean up any stale iconMap entry */
                var stale = iconMap.get(rImg);
                if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
                iconMap.delete(rImg);
                rImg.classList.remove('dz-icon-replaced');
                rImg.removeAttribute('data-dz-src');
                recovered = true;
                continue;
            }

            if (!curSrc || curSrc === prevSrc || curSrc.indexOf('{{') !== -1) continue;

            /* src changed (e.g. Light48_On -> Light48_Off, or fav toggle) */
            var prevIcon = sibling;

            if (shouldSkip(curSrc)) continue;

            var newResolved = resolveIcon(curSrc);
            if (!newResolved) continue;

            if (newResolved.type === 'fav') {
                prevIcon.className = newResolved.cls;
            } else if (newResolved.type === 'wind') {
                prevIcon.className = newResolved.cls;
                prevIcon.style.color = newResolved.color || '';
                var rot = WIND_ROTATION[newResolved.dir];
                prevIcon.style.transform = rot !== null ? 'rotate(' + rot + 'deg)' : '';
            } else if (newResolved.type === 'device') {
                prevIcon.className = newResolved.cls;
                prevIcon.style.color = newResolved.color || '';
                if (newResolved.colorOn)  prevIcon.setAttribute('data-dz-color-on',  newResolved.colorOn);
                if (newResolved.colorOff) prevIcon.setAttribute('data-dz-color-off', newResolved.colorOff);
                prevIcon.setAttribute('data-dz-state', newResolved.color === newResolved.colorOn ? 'on' : 'off');
            }

            rImg.setAttribute('data-dz-src', curSrc);
        }

        /* If any orphaned images were recovered, re-run Pass 1 immediately
           so the replacement icon appears without waiting for the next burst. */
        if (recovered) {
            processNewImages(root);
        }
    }

    /* -- Helper: copy relevant attributes from img to icon -------- */
    function copyAttrs(img, icon) {
        var title = img.getAttribute('title') || '';
        if (!title) {
            var di = img.getAttribute('data-i18n') || '';
            title = di.replace(/^\[title\]/, '');
        }
        if (title) icon.setAttribute('title', title);

        /* Forward clicks to the original (hidden) img so that Angular's
           compiled ng-click bindings and native onclick handlers remain
           intact. jQuery's .trigger() fires through Angular's event system
           even on display:none elements, preserving all live bindings.    */
        var hasClick = img.getAttribute('ng-click') ||
                       img.getAttribute('onclick')  ||
                       img.classList.contains('lcursor');
        if (hasClick) {
            icon.style.cursor = 'pointer';
            icon.addEventListener('click', function (e) {
                e.stopPropagation();
                /* Forward with the original pointer coordinates so popup-
                   positioning functions (ShowRGBWPopup, ShowSetpointPopup,
                   etc.) receive correct pageX/pageY and place dialogs near
                   the device that was clicked, not at (0, 0).             */
                var synth = new MouseEvent('click', {
                    bubbles:    true,
                    cancelable: true,
                    view:       window,
                    clientX:    e.clientX,
                    clientY:    e.clientY,
                    screenX:    e.screenX,
                    screenY:    e.screenY,
                    ctrlKey:    e.ctrlKey,
                    shiftKey:   e.shiftKey,
                    altKey:     e.altKey,
                    metaKey:    e.metaKey
                });
                img.dispatchEvent(synth);
            });
        }
    }

    /* -- Run on load + observe for dynamic content ---------------- */

    function init() {
        replaceIcons(document.body);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* After a DOM mutation we fire a short burst of passes to catch
       Angular's multi-cycle rendering.  replaceIcons is cheap because
       it skips already-processed images immediately.                    */

    var _burstTimers = [];
    /* Delays cover Angular's multi-cycle rendering.  The last two entries
       (800 ms, 2 s) act as a safety net on cold/force-refresh page loads
       where Angular bootstraps slower than the earlier ticks.             */
    var BURST_DELAYS = [10, 80, 300, 800, 2000];

    function scheduleQuickReplace(node) {
        /* Try synchronous replacement first — the node is already in the DOM
           when the MutationObserver fires, so this usually succeeds.          */
        try {
            if (!node || node.nodeType !== 1) return;
            if (node.tagName === 'IMG') {
                if (node.parentNode) processImg(node);
                return;
            }
            processNewImages(node);
        } catch (_) { /* ignore — fallback below */ }
        /* Also schedule an async pass as safety net in case Angular hasn't
           finished compiling the node's children yet.                       */
        setTimeout(function () {
            if (!node || node.nodeType !== 1) return;
            if (node.tagName === 'IMG') {
                if (node.parentNode) processImg(node);
                return;
            }
            replaceIcons(node);
        }, 0);
    }

    /* Non-cancellable safety-net timer — ensures at least one full
       replacement pass runs even when scheduleBurst keeps debouncing
       due to rapid mutations (e.g. device data refresh via websocket). */
    var _safetyTimer = null;
    function scheduleSafetyPass() {
        if (_safetyTimer) return;
        _safetyTimer = setTimeout(function () {
            _safetyTimer = null;
            replaceIcons(document.body);
            var extras = window._dzExtraProcessors;
            if (extras) for (var p = 0; p < extras.length; p++) extras[p]();
        }, 150);
    }

    function scheduleBurst() {
        for (var b = 0; b < _burstTimers.length; b++) {
            clearTimeout(_burstTimers[b]);
        }
        _burstTimers = [];
        for (var d = 0; d < BURST_DELAYS.length; d++) {
            _burstTimers.push(setTimeout(function () {
                replaceIcons(document.body);
                /* Run co-processors (status→bigtext, card footer) in the same
                   tick so all DOM changes land in one batch, not three.        */
                var extras = window._dzExtraProcessors;
                if (extras) for (var p = 0; p < extras.length; p++) extras[p]();
            }, BURST_DELAYS[d]));
        }
        /* Always schedule a non-cancellable safety pass */
        scheduleSafetyPass();
    }

    var iconObserver = new MutationObserver(function (mutations) {
        var needsBurst = false;

        for (var i = 0; i < mutations.length; i++) {
            var m = mutations[i];

            if (m.type === 'attributes' && m.attributeName === 'src' &&
                    m.target.tagName === 'IMG') {
                if (m.target.classList.contains('dz-icon-replaced')) {
                    /* Already-replaced image: update the icon directly and
                       immediately — no timer, no cancellation of other bursts. */
                    updateReplacedIcon(m.target);
                } else {
                    scheduleQuickReplace(m.target);
                    needsBurst = true;
                }
            } else if (m.type === 'childList') {
                /* Clean up orphaned <i> elements when Angular ng-if removes
                   an <img> from the DOM (e.g. fav toggle, device removal).  */
                for (var r = 0; r < m.removedNodes.length; r++) {
                    cleanupOrphan(m.removedNodes[r]);
                }
                for (var a = 0; a < m.addedNodes.length; a++) {
                    var added = m.addedNodes[a];
                    if (added && added.nodeType === 1) scheduleQuickReplace(added);
                }
                if (m.addedNodes.length > 0) needsBurst = true;
            }
        }

        if (needsBurst) scheduleBurst();
    });

    function startObserving() {
        var target = document.getElementById('main-view') ||
                     document.getElementById('main-content') ||
                     document.body;
        iconObserver.observe(target, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src']
        });

        var navbar = document.getElementById('appnavbar');
        if (navbar && navbar !== target) {
            iconObserver.observe(navbar, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src']
            });
        }

        /* Initial burst for first Angular render */
        scheduleBurst();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserving);
    } else {
        startObserving();
    }

    /* Safety net for force-refresh (F5): fires after all assets including
       FA fonts are downloaded, guaranteeing a final replacement pass even
       if Angular's first render landed outside the earlier burst window.  */
    window.addEventListener('load', function () { scheduleBurst(); });

    /* Hook into Angular route changes so icons are replaced after
       each SPA navigation.  Websocket-driven src changes are already
       handled instantly by the MutationObserver → updateReplacedIcon. */
    function hookAngularRouteChange() {
        var $body = document.querySelector('[ng-app]') || document.body;
        var injector = window.angular && window.angular.element($body).injector();
        if (!injector) {
            /* Angular not ready yet, retry */
            setTimeout(hookAngularRouteChange, 500);
            return;
        }
        var $rootScope = injector.get('$rootScope');
        $rootScope.$on('$routeChangeSuccess', function () {
            scheduleBurst();
        });
        $rootScope.$on('$viewContentLoaded', function () {
            scheduleBurst();
        });
        /* Watch for digest cycles — when device data refreshes via
           websocket/polling, Angular re-renders table rows during
           $digest. Schedule a non-cancellable safety pass after each
           digest so icons are re-applied even during rapid updates.  */
        $rootScope.$watch(function () {
            scheduleSafetyPass();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(hookAngularRouteChange, 500);
        });
    } else {
        setTimeout(hookAngularRouteChange, 500);
    }

    /* Hook into DataTables draw event so icons are replaced on every
       page change, sort, or filter — DataTables pagination often just
       toggles CSS display on existing rows rather than inserting new
       DOM nodes, so the MutationObserver alone won't catch it.        */
    function hookDataTables() {
        if (!window.$) return;
        $(document).on('draw.dt', function () {
            scheduleBurst();
        });
        /* Also hook into row invalidation / AJAX reload — these fire when
           device data refreshes in the background and may not always
           trigger a full draw.dt event.                                   */
        $(document).on('xhr.dt', function () {
            scheduleSafetyPass();
        });
    }

    if (window.$) {
        hookDataTables();
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            hookDataTables();
        });
    }

    /* Expose scheduleBurst so code outside this IIFE (e.g. tab-switch
       observers in the processCards block) can trigger a replacement pass. */
    window._dzScheduleBurst = scheduleBurst;
})();


/* -- Promote status text to bigtext when bigtext is empty ---------- */
/*    Runs after Angular renders each digest cycle.                   */

(function () {
    'use strict';

    function promoteStatusToBigtext() {
        var cards = document.querySelectorAll(
            'table[id^="itemtable"] tbody tr'
        );
        for (var i = 0; i < cards.length; i++) {
            var tr = cards[i];
            var bigtext = tr.querySelector('td#bigtext');
            var status  = tr.querySelector('td#status');
            if (!bigtext || !status) continue;

            var btText = (bigtext.textContent || '').replace(/\s+/g, ' ').trim();
            var stText = (status.textContent  || '').replace(/\s+/g, ' ').trim();

            if (!btText && stText) {
                bigtext.innerHTML = status.innerHTML;
                status.innerHTML  = '';
            }
        }
    }

    /* Register with the icon-replacement burst so all DOM changes land
       in the same batch as icon replacement, reducing layout reflows.  */
    window._dzExtraProcessors = window._dzExtraProcessors || [];
    window._dzExtraProcessors.push(promoteStatusToBigtext);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', promoteStatusToBigtext);
    } else {
        promoteStatusToBigtext();
    }

    var _timer = null;
    var observer = new MutationObserver(function () {
        clearTimeout(_timer);
        _timer = setTimeout(promoteStatusToBigtext, 200);
    });

    function startPromoteObserver() {
        var target = document.getElementById('dashcontent') ||
                     document.getElementById('main-content') ||
                     document.body;
        if (target) {
            observer.observe(target, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startPromoteObserver);
    } else {
        startPromoteObserver();
    }
})();


/* -- Text device card enhancement --------------------------------- */
/*    For "General, Text" devices the bigtext contains long messages  */
/*    that don't fit the hero-value style. Move the full text into    */
/*    the status area as a scrollable message block and show a        */
/*    truncated preview in bigtext.                                   */

(function () {
    'use strict';

    var maxPreviewLen = 60;

    function processTextDevices() {
        var cards = document.querySelectorAll(
            'table[id^="itemtable"] tbody tr'
        );
        for (var i = 0; i < cards.length; i++) {
            var tr = cards[i];
            if (tr.getAttribute('data-dz-text-done')) continue;

            var typeTd  = tr.querySelector('td#type');
            if (!typeTd) continue;
            var typeText = (typeTd.textContent || '').trim();
            if (!/\bText\b/i.test(typeText)) continue;

            var bigtext = tr.querySelector('td#bigtext');
            var status  = tr.querySelector('td#status');
            if (!bigtext || !status) continue;

            /* Extract and decode the bigtext cell content.
               Domoticz can double-escape HTML entities (&amp;nbsp; instead
               of &nbsp;, &lt;br&gt; instead of <br>).  One decode pass via
               a <textarea> (RCDATA: entities decoded, tags kept as text)
               normalises both cases so the content can be re-inserted as
               HTML and rendered naturally by the browser.  Styling (spans,
               min-width columns, images) from the device plugin is preserved
               this way; extracting plain text would lose the visual spacing
               built into the markup. */
            var rawHtml = bigtext.innerHTML || '';
            var tmp = document.createElement('textarea');
            tmp.innerHTML = rawHtml;
            var decoded = tmp.value;          /* entities decoded, tags intact */

            /* Parse the decoded HTML once into a temporary container.
               Moving parsed DOM nodes into msgDiv avoids a second innerHTML
               assignment and limits the innerHTML surface to one call on
               content already in the page's own trusted DOM. */
            var tmpDiv = document.createElement('div');
            tmpDiv.innerHTML = decoded; /* lgtm[js/xss-through-dom] */
            var plainText = (tmpDiv.textContent || tmpDiv.innerText || '').replace(/\s+/g, ' ').trim();
            if (!plainText) continue;

            tr.setAttribute('data-dz-text-done', '1');

            var itemBlock = tr.closest('.itemBlock');
            if (itemBlock) itemBlock.classList.add('dz-text-device');

            status.textContent = '';
            var msgDiv = document.createElement('div');
            msgDiv.className = 'dz-text-msg';
            /* Move already-parsed nodes — no second HTML re-parse. */
            while (tmpDiv.firstChild) {
                msgDiv.appendChild(tmpDiv.firstChild);
            }
            status.appendChild(msgDiv);

            if (plainText.length > maxPreviewLen) {
                bigtext.textContent = plainText.substring(0, maxPreviewLen) + '…';
            }
        }
    }

    window._dzExtraProcessors = window._dzExtraProcessors || [];
    window._dzExtraProcessors.push(processTextDevices);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processTextDevices);
    } else {
        processTextDevices();
    }

    var _timer = null;
    var observer = new MutationObserver(function () {
        clearTimeout(_timer);
        _timer = setTimeout(processTextDevices, 250);
    });

    function startObserver() {
        var target = document.getElementById('dashcontent') ||
                     document.getElementById('main-content') ||
                     document.body;
        if (target) {
            observer.observe(target, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }
})();


/* -- Format last-update timestamps + strip "Type:" prefix --------- */
/*    Runs after Angular renders each digest cycle.                   */

(function () {
    'use strict';

    var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function formatTimestamp(raw) {
        var m = raw.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
        if (!m) return null;

        var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
        var now       = new Date();
        var today     = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var yesterday = new Date(today.getTime() - 86400000);
        var cardDay   = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        var h    = d.getHours();
        var min  = ('0' + d.getMinutes()).slice(-2);
        var ampm = h >= 12 ? 'pm' : 'am';
        var h12  = h % 12 || 12;
        var time = h12 + ':' + min + '\u202f' + ampm;

        if (cardDay.getTime() === today.getTime())     return 'today ' + time;
        if (cardDay.getTime() === yesterday.getTime()) return 'yesterday ' + time;
        return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + time;
    }

    /* Register with the icon-replacement burst so footer injection lands
       in the same batch as icon replacement, reducing layout reflows.  */
    window._dzExtraProcessors = window._dzExtraProcessors || [];
    window._dzExtraProcessors.push(processCards);

    function processCards() {
        /* Dashboard cards: div.item.itemBlock
           Temperature/weather tab views: .itemBlock (custom element) > div.item
           Guard with table[id^="itemtable"] to skip any non-card matches.  */
        var cards = document.querySelectorAll('div.item.itemBlock, .itemBlock > div.item');
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];

            /* Skip anything that isn't a real device card */
            if (!card.querySelector('table[id^="itemtable"]')) continue;

            var lu = card.querySelector('td#lastupdate');
            if (!lu) continue;

            /* Get or create the pinned footer div */
            var footer = card.querySelector('.dz-card-footer');
            if (!footer) {
                footer = document.createElement('div');
                footer.className = 'dz-card-footer';
                var luSpan = document.createElement('span');
                luSpan.className = 'dz-time';
                footer.appendChild(luSpan);
                card.appendChild(footer);
            }

            var luSpan = footer.querySelector('.dz-time');

            /* Update timestamp */
            if (lu) {
                var raw = (lu.textContent || '').trim();
                var formatted = formatTimestamp(raw) || raw;
                if (luSpan.textContent !== formatted) luSpan.textContent = formatted;
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processCards);
    } else {
        processCards();
    }
// Ensure icons are replaced when switching tabs in dynamic dashboard widgets (handles ng-show/ng-hide/class changes)
document.addEventListener('DOMContentLoaded', function () {
    var tabObserver = new MutationObserver(function(mutations) {
        var needsUpdate = false;
        mutations.forEach(function(m) {
            if (m.type === 'attributes' && (m.attributeName === 'class' || m.attributeName === 'style')) {
                needsUpdate = true;
            }
        });
        if (needsUpdate) {
            if (window._dzScheduleBurst) window._dzScheduleBurst();
            processCards();
        }
    });
    function observeTabs() {
        var tabLists = document.querySelectorAll('.dd-favorites-tabs');
        tabLists.forEach(function(tabList) {
            tabObserver.observe(tabList, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
        });
    }
    observeTabs();
    // Also re-observe if new tab lists are added dynamically
    var bodyObserver = new MutationObserver(function() { observeTabs(); });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
});

    var _timer = null;
    var observer = new MutationObserver(function () {
        clearTimeout(_timer);
        _timer = setTimeout(processCards, 200);
    });

    function startObserver() {
        var target = document.getElementById('dashcontent') ||
                     document.getElementById('main-content') ||
                     document.body;
        if (target) observer.observe(target, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }
// Ensure icons are replaced when switching tabs in dynamic dashboard widgets (handles tab content visibility)
document.addEventListener('DOMContentLoaded', function () {
    function observeFavoritesTabContent() {
        var containers = document.querySelectorAll('.dd-favorites-main');
        containers.forEach(function(container) {
            if (container._dzTabContentObserved) return;
            var observer = new MutationObserver(function(mutations) {
                var needsUpdate = false;
                mutations.forEach(function(m) {
                    if (m.type === 'childList' || (m.type === 'attributes' && (m.attributeName === 'class' || m.attributeName === 'style'))) {
                        needsUpdate = true;
                    }
                });
                if (needsUpdate) {
                    if (window._dzScheduleBurst) window._dzScheduleBurst();
                    processCards();
                }
            });
            observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
            container._dzTabContentObserved = true;
        });
    }
    observeFavoritesTabContent();
    // Re-observe if new tab content containers are added dynamically
    var bodyObserver = new MutationObserver(function() { observeFavoritesTabContent(); });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
});
})();


(function () {
    'use strict';
    // Map moon phase keywords to FA icons (adjust as needed for your FA version)
    var moonPhaseMap = {
        'new': 'fa-moon',
        'waxing-crescent': 'fa-moon',
        'first-quarter': 'fa-moon-first-quarter',
        'waxing-gibbous': 'fa-moon',
        'full': 'fa-moon',
        'waning-gibbous': 'fa-moon',
        'last-quarter': 'fa-moon-last-quarter',
        'waning-crescent': 'fa-moon',
    };

    function replaceMoonImages() {
        var imgs = document.querySelectorAll('.dd-moon-image img');
        imgs.forEach(function (img) {
            if (img.classList.contains('dz-moon-replaced')) return;
            var src = img.getAttribute('src') || '';
            var alt = (img.getAttribute('alt') || '').toLowerCase();
            var phase = null;
            var match = src.match(/moon-([a-z-]+)\\.png/i);
            if (match) phase = match[1];
            else if (alt) phase = alt.replace(/ /g, '-');
            var faClass = moonPhaseMap[phase] || 'fa-moon';
            var i = document.createElement('i');
            i.className = 'fa-solid ' + faClass + ' fa-3x dz-moon-fa';
            i.title = img.alt || phase || 'Moon';
            img.style.display = 'none';
            img.classList.add('dz-moon-replaced');
            img.parentNode.insertBefore(i, img);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', replaceMoonImages);
    } else {
        replaceMoonImages();
    }
    window.addEventListener('hashchange', replaceMoonImages);
    window._dzExtraProcessors = window._dzExtraProcessors || [];
    window._dzExtraProcessors.push(replaceMoonImages);
})();


/* ══════════════════════════════════════════════════════════════════
   MIND-BLOWING FEATURES
   ══════════════════════════════════════════════════════════════════ */


/* ── Features: 3D Tilt · Temperature Accent · Ambient Glow · Staleness · Flash observer ── */
(function () {
    'use strict';

    /* ── 3D Card Tilt (Feature 3) ─────────────────────────────────── */
    var TILT_MAX = 3; // degrees

    function applyTilt(card) {
        if (card._dzTiltAttached) return;
        card._dzTiltAttached = true;
        card.classList.add('dz-tilt-enabled');
        card.addEventListener('mousemove', function (e) {
            var rect = card.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            var dx = (e.clientX - cx) / (rect.width / 2);
            var dy = (e.clientY - cy) / (rect.height / 2);
            var rx = (-dy * TILT_MAX).toFixed(1);
            var ry = ( dx * TILT_MAX).toFixed(1);
            card.style.transform = 'perspective(700px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
        });
        card.addEventListener('mouseleave', function () {
            card.style.transform = '';
        });
    }

    /* ── Temperature-Reactive Card Accent (Feature 4) ─────────────── */
    var TEMP_ACCENT = [
        [  0, '#29b6f6'], //  ≤ 0 °C — ice blue
        [  5, '#29b6f6'], //  ≤ 5   — cold
        [ 10, '#4dd0e1'], //  ≤ 10  — cool
        [ 15, '#66bb6a'], //  ≤ 15  — mild
        [ 20, '#4caf7d'], //  ≤ 20  — comfortable
        [ 25, '#ffa726'], //  ≤ 25  — warm
        [ 30, '#ff7043'], //  ≤ 30  — hot
        [999, '#e05555']  //  > 30  — very hot
    ];

    function tempToAccentColor(c) {
        for (var i = 0; i < TEMP_ACCENT.length; i++) {
            if (c <= TEMP_ACCENT[i][0]) return TEMP_ACCENT[i][1];
        }
        return '#e05555';
    }

    function parseCelsius(text) {
        // Match "21.5 °C", "21.5°C", "21.5 C", "21.5 °F", "21.5 F" etc.
        var m = text.match(/([-\d.]+)\s*°?\s*([CF])\b/i);
        if (!m) return null;
        var v = parseFloat(m[1]);
        if (m[2].toUpperCase() === 'F') v = (v - 32) * 5 / 9;
        return v;
    }

    /* ── UV / Rain / Wind / Visibility accent colors ─────────────── */

    // UV index (WHO scale 0–11+)
    var UV_ACCENT = [
        [ 2, '#4caf7d'], // low
        [ 5, '#f0a832'], // moderate
        [ 7, '#ff7043'], // high
        [10, '#e05555'], // very high
        [99, '#9c27b0']  // extreme
    ];

    // Rain (mm — daily accumulation or current rate)
    var RAIN_ACCENT = [
        [  0, '#555770'], // dry
        [  2, '#64b5f6'], // light
        [ 10, '#1e88e5'], // moderate
        [ 25, '#1565c0'], // heavy
        [999, '#0d47a1']  // very heavy
    ];

    // Wind speed (m/s)
    var WIND_ACCENT = [
        [  1, '#b0b3c6'], // calm
        [  3, '#4caf7d'], // light breeze
        [  8, '#f0a832'], // moderate
        [ 14, '#ff7043'], // strong
        [999, '#e05555']  // storm
    ];

    // Visibility (km)
    var VIS_ACCENT = [
        [  1, '#e05555'], // very poor
        [  2, '#ff7043'], // poor
        [  5, '#f0a832'], // moderate
        [ 10, '#4e9af1'], // good
        [999, '#4caf7d']  // excellent
    ];

    function accentFromScale(scale, value) {
        for (var i = 0; i < scale.length; i++) {
            if (value <= scale[i][0]) return scale[i][1];
        }
        return scale[scale.length - 1][1];
    }

    function firstNumber(text) {
        var m = text.match(/([\d.]+)/);
        return m ? parseFloat(m[1]) : null;
    }

    // Convert wind speed to m/s regardless of unit
    function parseWindMs(text) {
        var m;
        m = text.match(/([\d.]+)\s*km\/h/i);
        if (m) return parseFloat(m[1]) / 3.6;
        m = text.match(/([\d.]+)\s*mph/i);
        if (m) return parseFloat(m[1]) * 0.447;
        m = text.match(/([\d.]+)\s*Bft/i);
        if (m) return parseFloat(m[1]); // Beaufort ≈ m/s close enough for color scale
        m = text.match(/([\d.]+)\s*m\/s/i);
        if (m) return parseFloat(m[1]);
        return null;
    }

    // Parse visibility, normalise to km
    function parseVisKm(text) {
        var m;
        m = text.match(/([\d.]+)\s*km/i);
        if (m) return parseFloat(m[1]);
        m = text.match(/([\d.]+)\s*m\b/i); // metres, not m/s
        if (m) return parseFloat(m[1]) / 1000;
        return null;
    }

    function resolveAccentColor(btText, iconCls) {
        // Temperature
        var c = parseCelsius(btText);
        if (c === null && /fa-temperature|fa-thermometer/.test(iconCls)) {
            var nm = btText.match(/([-\d.]+)/);
            if (nm) c = parseFloat(nm[1]);
        }
        if (c !== null && !isNaN(c)) return tempToAccentColor(c);

        // UV (fa-sun shared with lux — use value range to distinguish: UV 0–12, lux can be 0–100000)
        if (/fa-sun/.test(iconCls)) {
            var n = firstNumber(btText);
            if (n !== null && n <= 15) return accentFromScale(UV_ACCENT, n);
        }

        // Rain
        if (/fa-cloud-showers|fa-cloud-rain|fa-droplet/.test(iconCls)) {
            var n = firstNumber(btText);
            if (n !== null) return accentFromScale(RAIN_ACCENT, n);
        }

        // Wind
        if (/fa-wind/.test(iconCls)) {
            var ms = parseWindMs(btText);
            if (ms === null) ms = firstNumber(btText); // fallback bare number
            if (ms !== null) return accentFromScale(WIND_ACCENT, ms);
        }

        // Visibility
        if (/fa-eye/.test(iconCls)) {
            var km = parseVisKm(btText);
            if (km === null) km = firstNumber(btText);
            if (km !== null) return accentFromScale(VIS_ACCENT, km);
        }

        return null;
    }

    /* ── Staleness Indicator (Feature 9) ─────────────────────────── */
    var STALE_MS = 24 * 60 * 60 * 1000; // 1 day

    function parseFooterDate(text) {
        var now = new Date();
        var m;
        m = text.match(/today\s+(\d+):(\d+)\s*(am|pm)/i);
        if (m) {
            var h = +m[1], min = +m[2], ap = m[3].toLowerCase();
            if (ap === 'pm' && h !== 12) h += 12;
            if (ap === 'am' && h === 12) h = 0;
            return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min);
        }
        m = text.match(/yesterday\s+(\d+):(\d+)\s*(am|pm)/i);
        if (m) {
            var h = +m[1], min = +m[2], ap = m[3].toLowerCase();
            if (ap === 'pm' && h !== 12) h += 12;
            if (ap === 'am' && h === 12) h = 0;
            var yd = new Date(now - 86400000);
            return new Date(yd.getFullYear(), yd.getMonth(), yd.getDate(), h, min);
        }
        return null; // older than yesterday → stale
    }

    function updateStaleness(card) {
        var span = card.querySelector('.dz-time');
        if (!span) return;
        var text = (span.textContent || '').trim();
        if (!text) return;
        var date = parseFooterDate(text);
        if (date && (Date.now() - date) < STALE_MS) {
            card.classList.remove('dz-stale');
        } else {
            card.classList.add('dz-stale');
        }
    }

    /* ── Main enhancement loop ───────────────────────────────────── */
    function enhanceCards() {
        var cards = document.querySelectorAll('div.item.itemBlock, .itemBlock > div.item');
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            if (!card.querySelector('table[id^="itemtable"]')) continue;

            applyTilt(card);
            updateStaleness(card);

            var bigtext = card.querySelector('td#bigtext');
            if (bigtext) {
                var btText = bigtext.textContent || '';
                var accentIcon = card.querySelector('i.dz-fa-device');
                var accentCls  = accentIcon ? (accentIcon.className || '') : '';
                var accentColor = resolveAccentColor(btText, accentCls);
                if (accentColor) {
                    card.classList.add('dz-temp-accent');
                    card.style.setProperty('--dz-temp-accent', accentColor);
                }
            }

        }
    }

    /* ── State-Change Flash (Feature 2) ──────────────────────────── */
    (function () {
        var stateObs = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                if (m.attributeName !== 'data-dz-state') return;
                var icon = m.target;
                var newState = icon.getAttribute('data-dz-state');
                // Walk up to card
                var el = icon;
                var card = null;
                while (el && el !== document.body) {
                    if (el.classList && el.classList.contains('item') && el.classList.contains('itemBlock')) {
                        card = el; break;
                    }
                    el = el.parentElement;
                }
                if (!card) return;

                // Flash ring
                card.classList.remove('dz-flash-on', 'dz-flash-off');
                void card.offsetWidth; // force reflow to restart animation
                card.classList.add(newState === 'on' ? 'dz-flash-on' : 'dz-flash-off');
                card.addEventListener('animationend', function rm() {
                    card.removeEventListener('animationend', rm);
                    card.classList.remove('dz-flash-on', 'dz-flash-off');
                });

            });
        });

        function watchIcons() {
            var icons = document.querySelectorAll('i.dz-fa-device:not([data-dz-watched])');
            icons.forEach(function (icon) {
                icon.setAttribute('data-dz-watched', '1');
                stateObs.observe(icon, { attributes: true, attributeFilter: ['data-dz-state'] });
            });
        }

        var domWatch = new MutationObserver(function () { watchIcons(); });
        function start() {
            watchIcons();
            domWatch.observe(document.body, { childList: true, subtree: true });
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            start();
        }
    })();

    window._dzExtraProcessors = window._dzExtraProcessors || [];
    window._dzExtraProcessors.push(enhanceCards);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enhanceCards);
    } else {
        enhanceCards();
    }
    window.addEventListener('hashchange', function () { setTimeout(enhanceCards, 350); });
})();


/* ── Update Page Enhancer ───────────────────────────────────────── */
/* Transforms the stock Domoticz update/restart page into the
   Nightglass styled version with SVG progress ring, icon wrap,
   and themed console output section.                              */
(function () {
    'use strict';

    var enhanced = false;

    function enhanceUpdatePage() {
        var uc = document.getElementById('updatecontent');
        if (!uc || enhanced) return;

        var center = uc.querySelector('center');
        if (!center) return;

        enhanced = true;

        /* ── 1. Inject spinning icon wrap before h1 ─────────────── */
        var h1 = center.querySelector('h1');
        if (h1 && !center.querySelector('.update-icon-wrap')) {
            var iconWrap = document.createElement('div');
            iconWrap.className = 'update-icon-wrap';
            iconWrap.innerHTML = '<i class="fa-solid fa-arrow-rotate-right update-spin-icon"></i>';
            center.insertBefore(iconWrap, h1);
        }

        /* ── 2. Hide the stock canvas progress (styled via CSS) ──── */
        var divProg = document.getElementById('divprogress');
        if (divProg) {

            /* ── 3. Style the warning span ──────────────────────── */
            var warnSpan = divProg.querySelector('span[ng-bind-html="bottomText"]');
            if (warnSpan && !warnSpan.classList.contains('update-warning')) {
                warnSpan.classList.add('update-warning');
                if (!warnSpan.querySelector('i')) {
                    warnSpan.insertAdjacentHTML('afterbegin', '<i class="fa-solid fa-triangle-exclamation"></i> ');
                }
            }
        }

        /* ── 4. Wrap the console output section ─────────────────── */
        var consoleEl = document.getElementById('updateconsole');
        if (consoleEl && !consoleEl.closest('.update-output-section')) {
            var showDiv = consoleEl.parentElement;
            if (showDiv) {
                showDiv.classList.add('update-output-section');
                /* Replace the plain h4 with themed one */
                var h4 = showDiv.querySelector('h4');
                if (h4 && !h4.querySelector('i')) {
                    h4.innerHTML = '<i class="fa-solid fa-terminal"></i> ' + h4.textContent;
                }
                /* Strip inline styles from pre so CSS takes over */
                consoleEl.removeAttribute('style');
            }
        }
    }

    /* Run on load and watch for the update page appearing */
    function init() {
        enhanceUpdatePage();
        var obs = new MutationObserver(function () {
            if (!enhanced) enhanceUpdatePage();
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    window.addEventListener('hashchange', function () {
        enhanced = false;
        setTimeout(enhanceUpdatePage, 300);
    });
})();


/* ── Feature 7: Sparkline Micro-Charts ──────────────────────────── */
(function () {
    'use strict';

    var SENSORS    = ['temp', 'counter', 'Percentage', 'uv', 'rain', 'wind'];
    var VALUE_KEYS = ['v', 'v_max', 'te', 'hu', 'ba', 'sp', 'u', 'lux', 'mm', 'baro'];
    var cache      = {}; // idx → values[]

    function svgSparkline(values, idx) {
        var W = 100, H = 100;
        // Leave breathing room top/bottom so the line isn't clipped
        var TOP = 15, BOT = 5;
        var min = Infinity, max = -Infinity;
        for (var i = 0; i < values.length; i++) {
            if (values[i] < min) min = values[i];
            if (values[i] > max) max = values[i];
        }
        var range = max - min || 1;
        var step  = W / (values.length - 1);
        var pts   = values.map(function (v, i) {
            var x = (i * step).toFixed(2);
            var y = (TOP + (1 - (v - min) / range) * (H - TOP - BOT)).toFixed(2);
            return x + ',' + y;
        });
        var linePts  = pts.join(' ');
        // Close the area path along the bottom edge
        var areaPath = 'M' + pts[0] +
                       ' L' + pts.join(' L') +
                       ' L' + (W) + ',' + H + ' L0,' + H + ' Z';
        // Resolve accent color at render time (CSS vars don't resolve in innerHTML SVGs)
        var color = getComputedStyle(document.documentElement)
                        .getPropertyValue('--dz-accent-color').trim() || '#4e9af1';
        var gid = 'dzsg' + (idx || '0');
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"' +
               ' xmlns="http://www.w3.org/2000/svg">' +
               '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
               '<stop offset="0%" stop-color="' + color + '" stop-opacity="0.9"/>' +
               '<stop offset="100%" stop-color="' + color + '" stop-opacity="0.1"/>' +
               '</linearGradient></defs>' +
               '<path d="' + areaPath + '" fill="url(#' + gid + ')"/>' +
               '<polyline points="' + linePts + '" fill="none" stroke="' + color + '"' +
               ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
               '</svg>';
    }

    // Base path: strips the hash and trailing filename, keeps the directory
    // e.g. "http://server:8080/"        → ""
    //      "http://server/domoticz/"    → "domoticz/"
    var BASE = (function () {
        var p = window.location.pathname.replace(/\/[^/]*$/, '/');
        return p;
    })();

    function tryNextSensor(idx, wrap, si) {
        if (si >= SENSORS.length) return;
        var url = BASE + 'json.htm?type=command&param=graph&sensor=' + SENSORS[si] + '&idx=' + idx + '&range=day';
        fetch(url, { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var result = data && data.result;
                if (!result || !result.length) { tryNextSensor(idx, wrap, si + 1); return; }
                var field = null;
                VALUE_KEYS.forEach(function (k) {
                    if (field === null && result[0][k] !== undefined) field = k;
                });
                if (!field) { tryNextSensor(idx, wrap, si + 1); return; }
                var vals = result.map(function (r) { return parseFloat(r[field]); })
                                 .filter(function (v) { return !isNaN(v); });
                if (vals.length < 4) { tryNextSensor(idx, wrap, si + 1); return; }
                cache[idx] = vals;
                wrap.innerHTML = svgSparkline(vals, idx);
                wrap.style.display = '';
            })
            .catch(function () { tryNextSensor(idx, wrap, si + 1); });
    }

    function getCardIdx(card) {
        // Primary: Angular scope has item.idx
        if (window.angular) {
            try {
                var scope = angular.element(card).scope();
                if (scope) {
                    var item = scope.item || scope.device || scope.widget;
                    if (item && item.idx) return String(item.idx);
                }
            } catch (e) {}
        }
        // Fallback: numeric suffix in the itemtable id
        var tbl = card.querySelector('table[id^="itemtable"]');
        if (tbl) {
            var m = tbl.id.match(/\d+/);
            if (m) return m[0];
        }
        return null;
    }

    function addSparklines() {
        var cards = document.querySelectorAll('div.item.itemBlock, .itemBlock > div.item');
        for (var c = 0; c < cards.length; c++) {
            var card = cards[c];
            if (card.querySelector('.dz-sparkline-wrap')) continue;
            if (!card.querySelector('table[id^="itemtable"]')) continue;
            // Any card showing a numeric reading is a candidate
            var bigtext = card.querySelector('td#bigtext');
            if (!bigtext || !/\d/.test(bigtext.textContent || '')) continue;
            var idx = getCardIdx(card);
            if (!idx) continue;
            // Ensure card is a positioning context for the absolute overlay
            card.style.position = 'relative';
            var wrap = document.createElement('div');
            wrap.className = 'dz-sparkline-wrap';
            wrap.style.display = 'none';
            // Insert as first child so it sits behind all card content
            card.insertBefore(wrap, card.firstChild);
            if (cache[idx]) {
                wrap.innerHTML = svgSparkline(cache[idx], idx);
                wrap.style.display = '';
            } else {
                tryNextSensor(idx, wrap, 0);
            }
        }
    }

    window._dzExtraProcessors = window._dzExtraProcessors || [];
    window._dzExtraProcessors.push(addSparklines);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addSparklines);
    } else {
        addSparklines();
    }
    window.addEventListener('hashchange', function () { setTimeout(addSparklines, 500); });

    // ── Sparkline Auto-Refresh ────────────────────────────────────────
    // Re-fetches a device's sparkline data when its displayed value changes,
    // using a rolling 1-hour window to keep datasets lean on always-on tablets.

    var MAX_POINTS       = 60;         // rolling cap: ~1 h at 1-min update intervals
    var REFRESH_COOLDOWN = 30 * 1000;  // ignore re-triggers for same device within 30 s
    var lastRefresh      = {};         // idx → timestamp (ms)

    function findCardByIdx(idx) {
        var tbl = document.getElementById('itemtable' + idx);
        if (!tbl) return null;
        var el = tbl.parentElement;
        while (el && el !== document.body) {
            if (el.classList.contains('itemBlock')) return el;
            if (el.classList.contains('item') &&
                el.parentElement && el.parentElement.classList.contains('itemBlock')) return el;
            el = el.parentElement;
        }
        return null;
    }

    function refreshSingle(idx) {
        var now = Date.now();
        if (lastRefresh[idx] && (now - lastRefresh[idx]) < REFRESH_COOLDOWN) return;
        lastRefresh[idx] = now;

        var card = findCardByIdx(idx);
        if (!card) return;
        var wrap = card.querySelector('.dz-sparkline-wrap');
        if (!wrap) return;

        (function fetchHour(si) {
            if (si >= SENSORS.length) return;
            var url = BASE + 'json.htm?type=command&param=graph&sensor=' + SENSORS[si] +
                      '&idx=' + idx + '&range=hour';
            fetch(url, { credentials: 'same-origin' })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    var result = data && data.result;
                    if (!result || !result.length) { fetchHour(si + 1); return; }
                    var field = null;
                    VALUE_KEYS.forEach(function (k) {
                        if (field === null && result[0][k] !== undefined) field = k;
                    });
                    if (!field) { fetchHour(si + 1); return; }
                    var vals = result.map(function (r) { return parseFloat(r[field]); })
                                     .filter(function (v) { return !isNaN(v); });
                    if (vals.length < 2) { fetchHour(si + 1); return; }
                    if (vals.length > MAX_POINTS) vals = vals.slice(vals.length - MAX_POINTS);
                    cache[idx] = vals;
                    wrap.innerHTML = svgSparkline(vals, idx);
                    wrap.style.display = '';
                })
                .catch(function () { fetchHour(si + 1); });
        })(0);
    }

    // Watch for bigtext mutations (Angular rewrites text nodes when a device updates)
    var _sparkObs = null;
    function startSparklineObserver() {
        if (_sparkObs || !window.MutationObserver) return;
        _sparkObs = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var target = mutations[i].target;
                var td = null;
                if (target.id === 'bigtext' && target.tagName === 'TD') {
                    td = target;
                } else if (target.querySelector) {
                    td = target.querySelector('td#bigtext');
                }
                if (!td) continue;
                var card = td.closest
                    ? td.closest('div.item.itemBlock, .itemBlock > div.item')
                    : null;
                if (!card) continue;
                var idx = getCardIdx(card);
                if (idx) refreshSingle(idx);
            }
        });
        if (!document.body) return;
        _sparkObs.observe(document.body, { subtree: true, childList: true });
    }

    // Periodic safety net: refresh all visible sparklines every 5 minutes
    function schedulePeriodicRefresh() {
        setInterval(function () {
            var cards = document.querySelectorAll('div.item.itemBlock, .itemBlock > div.item');
            for (var c = 0; c < cards.length; c++) {
                var wrap = cards[c].querySelector('.dz-sparkline-wrap');
                if (!wrap || wrap.style.display === 'none') continue;
                var idx = getCardIdx(cards[c]);
                if (idx) refreshSingle(idx);
            }
        }, 5 * 60 * 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startSparklineObserver);
    } else {
        startSparklineObserver();
    }
    schedulePeriodicRefresh();
})();


/* ── Feature 8: Slash-to-Search + Keyboard Tab Shortcuts ─────────── */
(function () {
    'use strict';

    // Press 1–9 while not in a text field to jump to these routes
    var NAV = {
        '1': 'Dashboard',
        '2': 'Switches',
        '3': 'Scenes',
        '4': 'Temp',
        '5': 'Weather',
        '6': 'Utility',
        '7': 'Cameras',
        '8': 'Log',
        '9': 'Setup'
    };

    var overlay = null;
    var inputEl = null;
    var listEl  = null;
    var activeI = -1;

    function escHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function getCards() {
        var out = [];
        document.querySelectorAll('div.item.itemBlock, .itemBlock > div.item').forEach(function (card) {
            if (!card.querySelector('table[id^="itemtable"]')) return;
            var nameEl = card.querySelector('td#name');
            var name   = nameEl ? (nameEl.textContent || '').trim() : '';
            if (!name) return;
            var icon   = card.querySelector('i.dz-fa-device');
            var iCls   = icon ? ((icon.className.match(/fa-[\w-]+/) || [])[0] || 'fa-circle') : 'fa-circle';
            out.push({ name: name, card: card, icon: iCls });
        });
        return out;
    }

    function render(query) {
        var q = query.trim().toLowerCase();
        var all = getCards();
        var hits = q ? all.filter(function (d) { return d.name.toLowerCase().indexOf(q) !== -1; })
                      : all.slice(0, 9);
        listEl.innerHTML = '';
        activeI = -1;
        hits.slice(0, 10).forEach(function (d, i) {
            var el = document.createElement('div');
            el.className = 'dz-search-item';
            el.innerHTML = '<i class="fa-solid ' + d.icon + '"></i>' + escHtml(d.name);
            el.addEventListener('mouseenter', function () { highlight(i); });
            el.addEventListener('click', function () { pick(d); });
            listEl.appendChild(el);
        });
    }

    function highlight(i) {
        var items = listEl.querySelectorAll('.dz-search-item');
        if (activeI >= 0 && items[activeI]) items[activeI].classList.remove('dz-search-active');
        activeI = i;
        if (items[activeI]) items[activeI].classList.add('dz-search-active');
    }

    function pick(d) {
        close();
        d.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        d.card.classList.add('dz-flash-on');
        setTimeout(function () { d.card.classList.remove('dz-flash-on'); }, 700);
    }

    function open() {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.id = 'dz-search-overlay';

        var box = document.createElement('div');
        box.id  = 'dz-search-box';

        inputEl = document.createElement('input');
        inputEl.id          = 'dz-search-input';
        inputEl.type        = 'text';
        inputEl.placeholder = 'Search devices…';
        inputEl.autocomplete = 'off';

        listEl = document.createElement('div');
        listEl.id = 'dz-search-results';

        var hint = document.createElement('div');
        hint.className = 'dz-search-hint';
        hint.innerHTML =
            '<span><kbd>↑↓</kbd> navigate</span>' +
            '<span><kbd>↵</kbd> go to</span>' +
            '<span><kbd>Esc</kbd> close</span>' +
            '<span><kbd>1–9</kbd> jump to section</span>';

        box.appendChild(inputEl);
        box.appendChild(listEl);
        box.appendChild(hint);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        inputEl.addEventListener('input', function () { render(this.value); });
        inputEl.addEventListener('keydown', function (e) {
            var items = listEl.querySelectorAll('.dz-search-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault(); highlight(Math.min(activeI + 1, items.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault(); highlight(Math.max(activeI - 1, 0));
            } else if (e.key === 'Enter') {
                if (activeI >= 0 && items[activeI]) items[activeI].click();
            } else if (e.key === 'Escape') {
                close();
            }
        });

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });

        render('');
        setTimeout(function () { if (inputEl) inputEl.focus(); }, 25);
    }

    function close() {
        if (overlay) { overlay.remove(); overlay = null; inputEl = null; listEl = null; }
    }

    function inInputField(target) {
        var tag = (target.tagName || '').toUpperCase();
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    }

    document.addEventListener('keydown', function (e) {
        if (inInputField(e.target) && !overlay) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;

        if (e.key === '/' && !overlay && !inInputField(e.target)) {
            e.preventDefault();
            open();
            return;
        }

        if (!overlay && !inInputField(e.target) && NAV[e.key]) {
            e.preventDefault();
            window.location.hash = '/' + NAV[e.key];
        }
    });
})();


/* ==================================================================
 *  Navbar sliding indicator + hover tracking
 *  Positions a glowing pill under the active nav item and smoothly
 *  slides it to hovered items, returning to active on mouse-leave.
 * ================================================================== */

(function () {
    'use strict';

    function initIndicator() {
        var nav = document.getElementById('appnavbar');
        if (!nav) return;

        var ind = nav.querySelector('.dz-nav-indicator');
        if (!ind) {
            ind = document.createElement('div');
            ind.className = 'dz-nav-indicator';
            ind.id = 'dzNavIndicator';
            nav.insertBefore(ind, nav.firstChild);
        }

        function positionTo(el, animate) {
            if (!el) return;
            var navRect = nav.getBoundingClientRect();
            var elRect = el.getBoundingClientRect();
            if (animate) ind.classList.add('dz-nav-indicator--animated');
            else ind.classList.remove('dz-nav-indicator--animated');
            ind.style.width = elRect.width + 'px';
            ind.style.left = (elRect.left - navRect.left) + 'px';
            ind.style.opacity = '1';
        }

        var activeLink = nav.querySelector('.current_page_item > a');
        positionTo(activeLink, false);

        var navItems = nav.querySelectorAll(':scope > li:not(.dropdown) > a');
        for (var i = 0; i < navItems.length; i++) {
            (function (link) {
                link.addEventListener('mouseenter', function () {
                    positionTo(link, true);
                });
            })(navItems[i]);
        }

        nav.addEventListener('mouseleave', function () {
            positionTo(activeLink, true);
        });

        window.addEventListener('resize', function () {
            positionTo(activeLink, false);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initIndicator);
    } else {
        initIndicator();
    }
})();


/* ==================================================================
 *  Nightglass Theme Settings Panel
 *  Injects a themed config panel into the Domoticz Settings page.
 *  Persists settings as Domoticz user variables so they sync across
 *  all browsers / devices.
 * ================================================================== */

(function () {
    'use strict';

    var UVAR_PREFIX = 'ngTheme_';
    var UVAR_TYPE = 2; // string type for user variables

    // Base path for API calls
    var BASE = (function () {
        return window.location.pathname.replace(/\/[^/]*$/, '/');
    })();

    /* ── Default settings ──────────────────────────────────────── */
    var DEFAULTS = {
        navbarIcons:        true,
        deviceIcons:        true,
        animateDeviceIcons: true,
        favStarIcons:       true,
        trendArrowIcons:    true,
        actionIcons:        true,
        showThemeToggle:    true,
        defaultMode:        'dark',
        themeMode:          'toggle',
        accentColor:        '#4e9af1',
        dangerColor:        '#e05555',
        warningColor:       '#f0a832',
        successColor:       '#4caf7d',
        accentColorLight:   '#2a7de1',
        dangerColorLight:   '#d63b3b',
        warningColorLight:  '#c07818',
        successColorLight:  '#2e8c58',
        bgColor:            '#23252f',
        surfaceColor:       '#2a2b35',
        borderColor:        '#33354a',
        textColor:          '#e2e4ed',
        bgColorLight:       '#ffffff',
        surfaceColorLight:  '#f5f6fa',
        borderColorLight:   '#d0d3dc',
        textColorLight:     '#1a1c24',
        pageBgColor:        '#1b1d25',
        pageBgColorLight:   '#f0f2f5',
        cardTilt:           true,
        sparklines:         true,
        stalenessIndicator: true,
        stateFlash:         true,
        tempAccent:         true,
        cardAnimations:     true,
        navAnimations:      true,
        smoothScrolling:    true,
        showLastUpdate:     false,
        uppercaseNames:     true,
        iconSize:           '100',
        enableIcons:        true,
        enableAppearance:   true,
        enableEffects:      true,
        enableColors:       true,
        fontSize:           '100',

        liveToasts:         true,
        liveToastFilter:    'meaningful',
        liveToastDuration:  '4',
        liveToastPosition:  'bottom-right',
        toastBlacklist:     '[]'
    };

    var _settings = null;
    var _uvarCache = {}; // name → {idx, value}
    var _panelInjected = false;
    var _apiAvailable = true; // false if Domoticz API is unreachable
    var LS_KEY = 'ngThemeSettings';

    /* ── Domoticz User Variable API helpers ─────────────────────── */

    function apiCall(params) {
        var url = BASE + 'json.htm?' + Object.keys(params).map(function (k) {
            return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
        }).join('&');
        return fetch(url, {
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        }).then(function (r) { return r.json(); });
    }

    function loadAllUvars() {
        return apiCall({ type: 'command', param: 'getuservariables' }).then(function (data) {
            _uvarCache = {};
            if (data && data.result) {
                data.result.forEach(function (uv) {
                    if (uv.Name.indexOf(UVAR_PREFIX) === 0) {
                        _uvarCache[uv.Name] = { idx: uv.idx, value: uv.Value };
                    }
                });
            }
        });
    }

    function getUvar(key) {
        var name = UVAR_PREFIX + key;
        return _uvarCache[name] ? _uvarCache[name].value : undefined;
    }

    function setUvar(key, value) {
        var name = UVAR_PREFIX + key;
        var strVal = String(value);
        if (_uvarCache[name] && _uvarCache[name].idx) {
            _uvarCache[name].value = strVal;
            return apiCall({
                type: 'command', param: 'updateuservariable',
                idx: _uvarCache[name].idx, vname: name, vtype: UVAR_TYPE, vvalue: strVal
            });
        } else {
            _uvarCache[name] = { idx: null, value: strVal };
            return apiCall({
                type: 'command', param: 'adduservariable',
                vname: name, vtype: UVAR_TYPE, vvalue: strVal
            }).then(function () {
                // Reload to get the new idx
                return loadAllUvars();
            });
        }
    }

    /* ── Settings object ───────────────────────────────────────── */

    function loadFromLocalStorage() {
        try {
            var stored = localStorage.getItem(LS_KEY);
            if (stored) return JSON.parse(stored);
        } catch (e) {}
        return null;
    }

    function saveToLocalStorage() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(_settings)); } catch (e) {}
    }

    function loadSettings() {
        return loadAllUvars().then(function () {
            _settings = {};
            Object.keys(DEFAULTS).forEach(function (key) {
                var raw = getUvar(key);
                if (raw === undefined) {
                    _settings[key] = DEFAULTS[key];
                } else if (typeof DEFAULTS[key] === 'boolean') {
                    _settings[key] = raw === 'true';
                } else {
                    _settings[key] = raw;
                }
            });
            _apiAvailable = true;
            saveToLocalStorage();
            return _settings;
        }).catch(function () {
            _apiAvailable = false;
            var stored = loadFromLocalStorage();
            _settings = Object.assign({}, DEFAULTS, stored || {});
            return _settings;
        });
    }

    function saveSetting(key, value) {
        _settings[key] = value;
        if (_apiAvailable) setUvar(key, value);
        saveToLocalStorage();
        applySettings();
    }

    /* ── Apply settings to the page ────────────────────────────── */

    function applySettings() {
        if (!_settings) return;
        var root = document.documentElement;

        // --- Icon visibility (granular per-category) ---

        // Navbar icons (menu items in the top bar)
        var navIconStyle = document.getElementById('dz-ng-navicon-style');
        if (!_settings.navbarIcons) {
            if (!navIconStyle) {
                navIconStyle = document.createElement('style');
                navIconStyle.id = 'dz-ng-navicon-style';
                navIconStyle.textContent =
                    '.navbar .nav li a > i.dz-fa-icon { display: none !important; }' +
                    '.navbar .nav .dropdown-menu li a > i.dz-fa-icon { display: none !important; }' +
                    '.navbar img.dz-icon-replaced { display: inline !important; opacity: 1 !important; pointer-events: auto !important; }' +
                    '.navbar img[src^="images/"] { opacity: 1 !important; pointer-events: auto !important; }';
                document.head.appendChild(navIconStyle);
            }
        } else if (navIconStyle) {
            navIconStyle.remove();
        }

        // Device / card icons (48px device state icons)
        var devIconStyle = document.getElementById('dz-ng-devicon-style');
        if (!_settings.deviceIcons) {
            if (!devIconStyle) {
                devIconStyle = document.createElement('style');
                devIconStyle.id = 'dz-ng-devicon-style';
                devIconStyle.textContent =
                    'i.dz-fa-device, i.dz-wind { display: none !important; }' +
                    'body table[id^="itemtable"] img.dz-icon-replaced:not([data-dz-src*="favorite"]) { display: inline !important; opacity: 1 !important; pointer-events: auto !important; }' +
                    'body table[id^="itemtable"] img[src*="48"]:not([src*="favorite"]) { opacity: 1 !important; pointer-events: auto !important; }';
                document.head.appendChild(devIconStyle);
            }
        } else if (devIconStyle) {
            devIconStyle.remove();
        }

        // Animate device icons (spinning fans, flickering flames, etc.)
        var animStyle = document.getElementById('dz-ng-anim-icon-style');
        if (!_settings.animateDeviceIcons || !_settings.deviceIcons) {
            if (!animStyle) {
                animStyle = document.createElement('style');
                animStyle.id = 'dz-ng-anim-icon-style';
                animStyle.textContent =
                    'i.dz-fa-device[data-dz-state="on"] { animation: none !important; }';
                document.head.appendChild(animStyle);
            }
        } else if (animStyle) {
            animStyle.remove();
        }

        // Favorite star icons
        var favIconStyle = document.getElementById('dz-ng-favicon-style');
        if (!_settings.favStarIcons) {
            if (!favIconStyle) {
                favIconStyle = document.createElement('style');
                favIconStyle.id = 'dz-ng-favicon-style';
                favIconStyle.textContent =
                    'i.dz-fa-fav { display: none !important; }' +
                    'img[src*="favorite"].dz-icon-replaced { display: inline !important; opacity: 1 !important; pointer-events: auto !important; }' +
                    'img[src*="favorite"] { opacity: 1 !important; pointer-events: auto !important; }';
                document.head.appendChild(favIconStyle);
            }
        } else if (favIconStyle) {
            favIconStyle.remove();
        }

        // Trend arrow icons
        var trendIconStyle = document.getElementById('dz-ng-trendicon-style');
        if (!_settings.trendArrowIcons) {
            if (!trendIconStyle) {
                trendIconStyle = document.createElement('style');
                trendIconStyle.id = 'dz-ng-trendicon-style';
                trendIconStyle.textContent =
                    'i.dz-fa-trend { display: none !important; }' +
                    'img[src*="arrow_"].dz-icon-replaced { display: inline !important; opacity: 1 !important; pointer-events: auto !important; }' +
                    'img[src*="arrow_"] { opacity: 1 !important; pointer-events: auto !important; }';
                document.head.appendChild(trendIconStyle);
            }
        } else if (trendIconStyle) {
            trendIconStyle.remove();
        }

        // Action icons (delete, rename, add, etc. in tables)
        var actionIconStyle = document.getElementById('dz-ng-actionicon-style');
        if (!_settings.actionIcons) {
            if (!actionIconStyle) {
                actionIconStyle = document.createElement('style');
                actionIconStyle.id = 'dz-ng-actionicon-style';
                actionIconStyle.textContent =
                    'i.dz-fa-action, i.dz-fa-nav { display: none !important; }' +
                    'img.dz-icon-replaced[data-dz-src*="delete"], img.dz-icon-replaced[data-dz-src*="rename"],' +
                    'img.dz-icon-replaced[data-dz-src*="add."], img.dz-icon-replaced[data-dz-src*="remove."],' +
                    'img.dz-icon-replaced[data-dz-src*="up."], img.dz-icon-replaced[data-dz-src*="down."],' +
                    'img.dz-icon-replaced[data-dz-src*="next."]' +
                    '{ display: inline !important; opacity: 1 !important; pointer-events: auto !important; }';
                document.head.appendChild(actionIconStyle);
            }
        } else if (actionIconStyle) {
            actionIconStyle.remove();
        }

        // Theme mode: toggle (manual navbar button), auto, dark, light
        var themeMode = _settings.themeMode || 'toggle';
        // Backward compat: if themeMode not set, derive from old keys
        if (!_settings.themeMode && _settings.showThemeToggle === false) {
            themeMode = _settings.defaultMode || 'dark';
        }
        var toggleNav = document.getElementById('dz-theme-style-nav');
        if (themeMode === 'toggle') {
            if (toggleNav) toggleNav.style.display = '';
        } else {
            if (toggleNav) toggleNav.style.display = 'none';
            var wantLight;
            if (themeMode === 'auto') {
                wantLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
            } else {
                wantLight = themeMode === 'light';
            }
            var isLight = document.body.classList.contains('dz-light');
            if (isLight !== wantLight) {
                if (wantLight) document.body.classList.add('dz-light');
                else document.body.classList.remove('dz-light');
            }
            localStorage.setItem('dz-theme-style', themeMode);
            if (typeof applyHighchartsTheme === 'function') applyHighchartsTheme(!wantLight);
        }

        // Accent colors — apply via a dynamic <style> so both :root and body.dz-light are covered
        var hexToRgb = function (hex) {
            var r = parseInt(hex.slice(1, 3), 16);
            var g = parseInt(hex.slice(3, 5), 16);
            var b = parseInt(hex.slice(5, 7), 16);
            return r + ', ' + g + ', ' + b;
        };
        var darkenHex = function (hex, amt) {
            var r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amt);
            var g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amt);
            var b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amt);
            var toH = function (n) { var h = n.toString(16); return h.length < 2 ? '0' + h : h; };
            return '#' + toH(r) + toH(g) + toH(b);
        };
        var lightenHex = function (hex, amt) {
            var r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amt);
            var g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amt);
            var b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amt);
            var toH = function (n) { var h = n.toString(16); return h.length < 2 ? '0' + h : h; };
            return '#' + toH(r) + toH(g) + toH(b);
        };

        var ac = _settings.accentColor;
        var dc = _settings.dangerColor;
        var wc = _settings.warningColor;
        var sc = _settings.successColor;
        var acL = _settings.accentColorLight  || darkenHex(ac, 15);
        var dcL = _settings.dangerColorLight  || darkenHex(dc, 15);
        var wcL = _settings.warningColorLight || darkenHex(wc, 25);
        var scL = _settings.successColorLight || darkenHex(sc, 20);
        var bg  = _settings.bgColor      || '#23252f';
        var sf  = _settings.surfaceColor  || '#2a2b35';
        var bd  = _settings.borderColor   || '#33354a';
        var tx  = _settings.textColor     || '#e2e4ed';
        var bgL = _settings.bgColorLight     || '#ffffff';
        var sfL = _settings.surfaceColorLight || '#f5f6fa';
        var bdL = _settings.borderColorLight  || '#d0d3dc';
        var txL = _settings.textColorLight    || '#1a1c24';
        var pbg  = _settings.pageBgColor       || '#1b1d25';
        var pbgL = _settings.pageBgColorLight  || '#f0f2f5';

        var colorCSS =
            ':root {\n' +
            '  --dz-accent: ' + ac + ';\n' +
            '  --dz-accent-color: ' + ac + ';\n' +
            '  --dz-widget-accent: ' + ac + ';\n' +
            '  --dz-btn-primary-bg: ' + ac + ';\n' +
            '  --dz-btn-info-bg: ' + ac + ';\n' +
            '  --dz-accent-rgb: ' + hexToRgb(ac) + ';\n' +
            '  --dz-accent-light: ' + lightenHex(ac, 30) + ';\n' +
            '  --dz-accent-hover: ' + darkenHex(ac, 20) + ';\n' +
            '  --dz-danger: ' + dc + ';\n' +
            '  --dz-accent-red: ' + dc + ';\n' +
            '  --dz-danger-hover: ' + darkenHex(dc, 20) + ';\n' +
            '  --dz-warning: ' + wc + ';\n' +
            '  --dz-warning-hover: ' + darkenHex(wc, 20) + ';\n' +
            '  --dz-success: ' + sc + ';\n' +
            '  --dz-success-hover: ' + darkenHex(sc, 20) + ';\n' +
            '  --dz-surface: ' + bg + ';\n' +
            '  --dz-surface-2: ' + sf + ';\n' +
            '  --dz-surface-3: ' + lightenHex(sf, 10) + ';\n' +
            '  --dz-border: ' + bd + ';\n' +
            '  --dz-border-b: ' + lightenHex(bd, 10) + ';\n' +
            '  --dz-text: ' + tx + ';\n' +
            '  --dz-text-soft: ' + darkenHex(tx, 30) + ';\n' +
            '  --dz-text-muted: ' + darkenHex(tx, 60) + ';\n' +
            '  --dz-text-faint: ' + darkenHex(tx, 90) + ';\n' +
            '  --dz-bg: ' + pbg + ';\n' +
            '  --dz-bg-alt: ' + lightenHex(pbg, 5) + ';\n' +
            '  --dz-nav-bg: ' + bg + ';\n' +
            '  --dz-table-odd-bg: ' + bg + ';\n' +
            '  --dz-table-even-bg: ' + pbg + ';\n' +
            '  --dz-table-odd-text: ' + tx + ';\n' +
            '  --dz-table-even-text: ' + tx + ';\n' +
            '  --dz-panel-bg: ' + bg + ';\n' +
            '  --dz-panel-text: ' + tx + ';\n' +
            '  --dz-modal-bg: ' + bg + ';\n' +
            '  --dz-modal-text: ' + tx + ';\n' +
            '  --dz-modal-header-bg: ' + sf + ';\n' +
            '  --dz-input-bg: ' + sf + ';\n' +
            '  --dz-input-text: ' + tx + ';\n' +
            '  --dz-input-border: ' + bd + ';\n' +
            '  --dz-btn-bg: ' + sf + ';\n' +
            '  --dz-btn-text: ' + tx + ';\n' +
            '  --dz-btn-border: ' + lightenHex(bd, 10) + ';\n' +
            '  --dz-btn-hover-bg: ' + lightenHex(sf, 10) + ';\n' +
            '  --dz-btn-primary-text: #fff;\n' +
            '  --dz-btn-warning-bg: ' + wc + ';\n' +
            '  --dz-btn-danger-bg: ' + dc + ';\n' +
            '  --dz-btn-success-bg: ' + sc + ';\n' +
            '  --dz-overlay-rgb: 255, 255, 255;\n' +
            '  --dz-surface-rgb: ' + hexToRgb(bg) + ';\n' +
            '  --dz-border-rgb: ' + hexToRgb(bd) + ';\n' +
            '  --dz-border-color: ' + bd + ';\n' +
            '  --dz-body-bg: ' + pbg + ';\n' +
            '  --dz-body-text: ' + tx + ';\n' +
            '  --dz-widget-bg: ' + bg + ';\n' +
            '  --dz-widget-text: ' + tx + ';\n' +
            '}\n' +
            'body.dz-light {\n' +
            '  --dz-accent: ' + acL + ';\n' +
            '  --dz-accent-color: ' + acL + ';\n' +
            '  --dz-widget-accent: ' + acL + ';\n' +
            '  --dz-btn-primary-bg: ' + acL + ';\n' +
            '  --dz-btn-info-bg: ' + acL + ';\n' +
            '  --dz-accent-rgb: ' + hexToRgb(acL) + ';\n' +
            '  --dz-accent-light: ' + lightenHex(acL, 30) + ';\n' +
            '  --dz-accent-hover: ' + darkenHex(acL, 20) + ';\n' +
            '  --dz-danger: ' + dcL + ';\n' +
            '  --dz-accent-red: ' + dcL + ';\n' +
            '  --dz-danger-hover: ' + darkenHex(dcL, 20) + ';\n' +
            '  --dz-warning: ' + wcL + ';\n' +
            '  --dz-warning-hover: ' + darkenHex(wcL, 20) + ';\n' +
            '  --dz-success: ' + scL + ';\n' +
            '  --dz-success-hover: ' + darkenHex(scL, 20) + ';\n' +
            '  --dz-surface: ' + bgL + ';\n' +
            '  --dz-surface-2: ' + sfL + ';\n' +
            '  --dz-surface-3: ' + darkenHex(sfL, 10) + ';\n' +
            '  --dz-border: ' + bdL + ';\n' +
            '  --dz-border-b: ' + darkenHex(bdL, 10) + ';\n' +
            '  --dz-text: ' + txL + ';\n' +
            '  --dz-text-soft: ' + lightenHex(txL, 30) + ';\n' +
            '  --dz-text-muted: ' + lightenHex(txL, 60) + ';\n' +
            '  --dz-text-faint: ' + lightenHex(txL, 90) + ';\n' +
            '  --dz-bg: ' + pbgL + ';\n' +
            '  --dz-bg-alt: ' + darkenHex(pbgL, 10) + ';\n' +
            '  --dz-nav-bg: ' + bgL + ';\n' +
            '  --dz-table-odd-bg: ' + bgL + ';\n' +
            '  --dz-table-even-bg: ' + sfL + ';\n' +
            '  --dz-table-odd-text: ' + txL + ';\n' +
            '  --dz-table-even-text: ' + txL + ';\n' +
            '  --dz-panel-bg: ' + bgL + ';\n' +
            '  --dz-panel-text: ' + txL + ';\n' +
            '  --dz-modal-bg: ' + bgL + ';\n' +
            '  --dz-modal-text: ' + txL + ';\n' +
            '  --dz-modal-header-bg: ' + sfL + ';\n' +
            '  --dz-input-bg: ' + sfL + ';\n' +
            '  --dz-input-text: ' + txL + ';\n' +
            '  --dz-input-border: ' + bdL + ';\n' +
            '  --dz-btn-bg: ' + sfL + ';\n' +
            '  --dz-btn-text: ' + txL + ';\n' +
            '  --dz-btn-border: ' + darkenHex(bdL, 10) + ';\n' +
            '  --dz-btn-hover-bg: ' + darkenHex(sfL, 10) + ';\n' +
            '  --dz-btn-primary-text: #fff;\n' +
            '  --dz-btn-warning-bg: ' + wcL + ';\n' +
            '  --dz-btn-danger-bg: ' + dcL + ';\n' +
            '  --dz-btn-success-bg: ' + scL + ';\n' +
            '  --dz-overlay-rgb: 0, 0, 0;\n' +
            '  --dz-surface-rgb: ' + hexToRgb(bgL) + ';\n' +
            '  --dz-border-rgb: ' + hexToRgb(bdL) + ';\n' +
            '  --dz-border-color: ' + bdL + ';\n' +
            '  --dz-body-bg: ' + pbgL + ';\n' +
            '  --dz-body-text: ' + txL + ';\n' +
            '  --dz-widget-bg: ' + bgL + ';\n' +
            '  --dz-widget-text: ' + txL + ';\n' +
            '}\n';

        var colorStyle = document.getElementById('dz-ng-color-style');
        if (!colorStyle) {
            colorStyle = document.createElement('style');
            colorStyle.id = 'dz-ng-color-style';
            document.head.appendChild(colorStyle);
        }
        colorStyle.textContent = colorCSS;

        // Card tilt
        var tiltStyle = document.getElementById('dz-ng-tilt-style');
        if (!_settings.cardTilt) {
            if (!tiltStyle) {
                tiltStyle = document.createElement('style');
                tiltStyle.id = 'dz-ng-tilt-style';
                tiltStyle.textContent = '.dz-tilt-enabled { transform: none !important; }';
                document.head.appendChild(tiltStyle);
            }
        } else if (tiltStyle) {
            tiltStyle.remove();
        }

        // Sparklines
        var sparkStyle = document.getElementById('dz-ng-spark-style');
        if (!_settings.sparklines) {
            if (!sparkStyle) {
                sparkStyle = document.createElement('style');
                sparkStyle.id = 'dz-ng-spark-style';
                sparkStyle.textContent = '.dz-sparkline-wrap { display: none !important; }';
                document.head.appendChild(sparkStyle);
            }
        } else if (sparkStyle) {
            sparkStyle.remove();
        }

        // Staleness indicator
        var staleStyle = document.getElementById('dz-ng-stale-style');
        if (!_settings.stalenessIndicator) {
            if (!staleStyle) {
                staleStyle = document.createElement('style');
                staleStyle.id = 'dz-ng-stale-style';
                staleStyle.textContent = '.dz-stale::before { display: none !important; }';
                document.head.appendChild(staleStyle);
            }
        } else if (staleStyle) {
            staleStyle.remove();
        }

        // State flash
        var flashStyle = document.getElementById('dz-ng-flash-style');
        if (!_settings.stateFlash) {
            if (!flashStyle) {
                flashStyle = document.createElement('style');
                flashStyle.id = 'dz-ng-flash-style';
                flashStyle.textContent = '.dz-flash-on, .dz-flash-off { animation: none !important; }';
                document.head.appendChild(flashStyle);
            }
        } else if (flashStyle) {
            flashStyle.remove();
        }

        // Temperature accent
        var tempStyle = document.getElementById('dz-ng-temp-style');
        if (!_settings.tempAccent) {
            if (!tempStyle) {
                tempStyle = document.createElement('style');
                tempStyle.id = 'dz-ng-temp-style';
                tempStyle.textContent = '.dz-temp-accent { border-top: none !important; }';
                document.head.appendChild(tempStyle);
            }
        } else if (tempStyle) {
            tempStyle.remove();
        }

        // Card animations
        var cardAnimStyle = document.getElementById('dz-ng-cardanim-style');
        if (!_settings.cardAnimations) {
            if (!cardAnimStyle) {
                cardAnimStyle = document.createElement('style');
                cardAnimStyle.id = 'dz-ng-cardanim-style';
                cardAnimStyle.textContent =
                    'body table[id^="itemtable"] tbody tr { animation: none !important; }' +
                    'div.item.itemBlock, .itemBlock > div.item { transition: none !important; }';
                document.head.appendChild(cardAnimStyle);
            }
        } else if (cardAnimStyle) {
            cardAnimStyle.remove();
        }

        // Nav animations
        var navAnimStyle = document.getElementById('dz-ng-navanim-style');
        if (!_settings.navAnimations) {
            if (!navAnimStyle) {
                navAnimStyle = document.createElement('style');
                navAnimStyle.id = 'dz-ng-navanim-style';
                navAnimStyle.textContent =
                    '.navbar .nav > li { animation-duration: 0s !important; animation-delay: 0s !important; }' +
                    '.navbar .nav .dropdown-menu > li { animation-duration: 0s !important; animation-delay: 0s !important; }' +
                    '.navbar .nav .dropdown-menu { animation-duration: 0s !important; animation-delay: 0s !important; }' +
                    '.dz-nav-indicator { display: none !important; }';
                document.head.appendChild(navAnimStyle);
            }
        } else if (navAnimStyle) {
            navAnimStyle.remove();
        }

        // Smooth scrolling
        root.style.scrollBehavior = _settings.smoothScrolling ? 'smooth' : 'auto';

        // Show last update
        var luStyle = document.getElementById('dz-ng-lu-style');
        if (!_settings.showLastUpdate) {
            if (!luStyle) {
                luStyle = document.createElement('style');
                luStyle.id = 'dz-ng-lu-style';
                luStyle.textContent = '.dz-card-footer { display: none !important; }';
                document.head.appendChild(luStyle);
            }
        } else if (luStyle) {
            luStyle.remove();
        }

        // Uppercase device names
        var ucStyle = document.getElementById('dz-ng-uc-style');
        if (!_settings.uppercaseNames) {
            if (!ucStyle) {
                ucStyle = document.createElement('style');
                ucStyle.id = 'dz-ng-uc-style';
                ucStyle.textContent = 'body table[id^="itemtable"] tr td:first-child { text-transform: none !important; }';
                document.head.appendChild(ucStyle);
            }
        } else if (ucStyle) {
            ucStyle.remove();
        }


        // Font size
        var pct = parseInt(_settings.fontSize, 10) || 100;
        root.style.fontSize = pct === 100 ? '' : (pct + '%');

        // Icon size
        var iconPct = parseInt(_settings.iconSize, 10) || 100;
        root.style.setProperty('--ng-icon-scale', iconPct === 100 ? '1' : (iconPct / 100));

        // Section-level master toggles
        // When Icons section is disabled, revert all icon replacements
        var iconsDisabledStyle = document.getElementById('dz-ng-icons-disabled');
        if (!_settings.enableIcons) {
            if (!iconsDisabledStyle) {
                iconsDisabledStyle = document.createElement('style');
                iconsDisabledStyle.id = 'dz-ng-icons-disabled';
                iconsDisabledStyle.textContent =
                    'i.dz-fa-device, i.dz-fa-icon, i.dz-fa-fav, i.dz-fa-trend, i.dz-fa-action, i.dz-fa-nav, i.dz-wind { display: none !important; }' +
                    'img.dz-icon-replaced { display: inline !important; opacity: 1 !important; pointer-events: auto !important; }' +
                    'img.dz-icon-replaced[data-dz-src*="favorite"] ~ img.dz-icon-replaced[data-dz-src*="favorite"] { display: none !important; }';
                document.head.appendChild(iconsDisabledStyle);
            }
        } else if (iconsDisabledStyle) { iconsDisabledStyle.remove(); }

        // When Effects section is disabled, kill all effects
        var effectsDisabledStyle = document.getElementById('dz-ng-effects-disabled');
        if (!_settings.enableEffects) {
            if (!effectsDisabledStyle) {
                effectsDisabledStyle = document.createElement('style');
                effectsDisabledStyle.id = 'dz-ng-effects-disabled';
                effectsDisabledStyle.textContent =
                    '.dz-tilt-enabled { transform: none !important; }' +
                    '.dz-sparkline-wrap { display: none !important; }' +
                    '.dz-stale::before { display: none !important; }' +
                    '.dz-flash-on, .dz-flash-off { animation: none !important; }' +
                    '.dz-temp-accent { border-top: none !important; }' +
                    'div.item.itemBlock, .itemBlock > div.item { transition: none !important; }' +
                    'body table[id^="itemtable"] tbody tr { animation: none !important; }' +
                    '.navbar .nav > li, .navbar .nav .dropdown-menu > li, .navbar .nav .dropdown-menu { animation-duration: 0s !important; animation-delay: 0s !important; }' +
                    '.dz-nav-indicator { display: none !important; }';
                document.head.appendChild(effectsDisabledStyle);
            }
        } else if (effectsDisabledStyle) { effectsDisabledStyle.remove(); }

        // When Colors section is disabled, remove the custom color overrides
        if (!_settings.enableColors) {
            var cs = document.getElementById('dz-ng-color-style');
            if (cs) cs.textContent = '';
        }

        // Update toast stack position if the system is already running
        if (window.ngUpdateToastPosition) window.ngUpdateToastPosition();
    }

    /* ── Build the settings panel HTML ─────────────────────────── */

    function buildPanel(opts) {
        opts = opts || {};
        var s = _settings || DEFAULTS;

        function toggle(key, label, desc) {
            var checked = s[key] ? ' checked' : '';
            return '<div class="ng-setting-row">' +
                '<div class="ng-setting-info"><span class="ng-setting-label">' + label + '</span>' +
                (desc ? '<span class="ng-setting-desc">' + desc + '</span>' : '') + '</div>' +
                '<label class="ng-toggle"><input type="checkbox" data-ng-key="' + key + '"' + checked + '>' +
                '<span class="ng-toggle-slider"></span></label></div>';
        }

        var COLOR_PRESETS = [
            '#4e9af1','#2a7de1','#29b6f6','#4dd0e1','#4caf7d','#66bb6a',
            '#f0a832','#ffa726','#ff7043','#e05555','#c8a0ff','#ab47bc',
            '#78909c','#b0b3c6','#555770','#ffffff'
        ];

        function colorPicker(key, label) {
            var val = s[key] || '#4e9af1';
            var presetHtml = COLOR_PRESETS.map(function (c) {
                var sel = (c.toLowerCase() === val.toLowerCase()) ? ' ng-cp-preset--active' : '';
                return '<button class="ng-cp-preset' + sel + '" data-color="' + c + '" style="background:' + c + '" title="' + c + '"></button>';
            }).join('');
            return '<div class="ng-color-wrap" data-ng-color-key="' + key + '">' +
                '<button class="ng-cp-swatch" style="background:' + val + ';"></button>' +
                '<input type="text" class="ng-cp-hex" value="' + val + '" maxlength="7" spellcheck="false">' +
                '<div class="ng-cp-popover">' +
                '<canvas class="ng-cp-sv" width="232" height="148"></canvas>' +
                '<canvas class="ng-cp-hue" width="232" height="14"></canvas>' +
                '<div class="ng-cp-presets">' + presetHtml + '</div>' +
                '</div></div>';
        }

        function dualColorPicker(darkKey, lightKey, label) {
            return '<div class="ng-setting-row ng-setting-row--dual">' +
                '<div class="ng-setting-info"><span class="ng-setting-label">' + label + '</span></div>' +
                '<div class="ng-dual-colors">' +
                '<div class="ng-dual-col">' +
                colorPicker(darkKey, '') + '</div>' +
                '<div class="ng-dual-col">' +
                colorPicker(lightKey, '') + '</div>' +
                '</div></div>';
        }

        function select(key, label, options, desc) {
            var opts = options.map(function (o) {
                var sel = s[key] === o.value ? ' selected' : '';
                return '<option value="' + o.value + '"' + sel + '>' + o.label + '</option>';
            }).join('');
            return '<div class="ng-setting-row">' +
                '<div class="ng-setting-info"><span class="ng-setting-label">' + label + '</span>' +
                (desc ? '<span class="ng-setting-desc">' + desc + '</span>' : '') + '</div>' +
                '<select data-ng-key="' + key + '" class="ng-select">' + opts + '</select></div>';
        }

        function slider(key, label, min, max, step, unit, desc) {
            var val = s[key] || DEFAULTS[key];
            return '<div class="ng-setting-row">' +
                '<div class="ng-setting-info"><span class="ng-setting-label">' + label + '</span>' +
                (desc ? '<span class="ng-setting-desc">' + desc + '</span>' : '') + '</div>' +
                '<div class="ng-slider-wrap"><input type="range" data-ng-key="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">' +
                '<span class="ng-slider-value">' + val + (unit || '') + '</span></div></div>';
        }

        function sectionToggle(key) {
            var checked = s[key] ? ' checked' : '';
            return '<label class="ng-section-toggle" title="Enable / disable this section">' +
                '<input type="checkbox" data-ng-section-key="' + key + '"' + checked + '>' +
                '<span class="ng-section-toggle-slider"></span></label>';
        }
        return '<div id="ng-theme-settings" class="ng-settings-panel">' +

            '<div class="ng-settings-header">' +
            '<div class="ng-settings-header-left">' +
            '<i class="fa-solid fa-palette ng-header-icon"></i>' +
            '<div><h3 class="ng-settings-title">Nightglass Theme</h3>' +
            '<span class="ng-settings-subtitle">Customize your dashboard experience</span></div></div>' +
            '<button class="ng-reset-btn" id="ngResetBtn" title="Reset all settings to defaults">' +
            '<i class="fa-solid fa-rotate-left"></i> Reset</button></div>' +

            '<div class="ng-presets-section" id="ngPresetsSection">' +
            '<button class="ng-presets-toggle' + (opts.presetsOpen ? ' ng-presets-toggle--open' : '') + '" id="ngPresetsToggle" type="button">' +
            '<div class="ng-presets-toggle-left"><i class="fa-solid fa-swatchbook"></i> Theme Presets</div>' +
            '<i class="fa-solid fa-chevron-down ng-presets-chevron"></i>' +
            '</button>' +
            '<div class="ng-presets-body" id="ngPresetsBody"' + (opts.presetsOpen ? '' : ' style="display:none;"') + '>' +
            '<div class="ng-presets-grid" id="ngPresetsGrid">' +
            '<div class="ng-preset-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading presets…</div>' +
            '</div></div></div>' +

            '<div class="ng-settings-grid">' +

            /* Left column: Icons, Appearance, Effects */
            '<div class="ng-settings-section">' +
            '<div class="ng-section-header"><i class="fa-solid fa-bars"></i> Navbar Icons</div>' +
            toggle('navbarIcons', 'Navbar Menu Icons', 'Replace PNG menu icons with Font Awesome in the navigation bar') +
            '</div>' +

            '<div class="ng-settings-section">' +
            '<div class="ng-section-header"><i class="fa-solid fa-cube"></i> Device &amp; Card Icons</div>' +
            toggle('deviceIcons', 'Device Icons', 'Replace 48px PNG device icons with Font Awesome on cards') +
            toggle('animateDeviceIcons', 'Animate Device Icons', 'Spin fans, flicker flames, pulse presence sensors when active') +
            toggle('favStarIcons', 'Favorite Star Icons', 'Replace PNG stars with Font Awesome star icons') +
            toggle('trendArrowIcons', 'Trend Arrow Icons', 'Replace PNG trend arrows with Font Awesome arrows') +
            toggle('actionIcons', 'Action Icons', 'Replace PNG action icons (delete, rename, add) in data tables') +
            '</div>' +

            '<div class="ng-settings-section">' +
            '<div class="ng-section-header"><i class="fa-solid fa-swatchbook"></i> Appearance</div>' +
            select('themeMode', 'Theme Mode', [
                { value: 'toggle', label: '🔀 Manual toggle' },
                { value: 'auto', label: '🖥️ Auto (follow system)' },
                { value: 'dark', label: '🌙 Always dark' },
                { value: 'light', label: '☀️ Always light' }
            ], 'Manual shows a navbar button to switch; Auto follows your OS preference') +
            slider('fontSize', 'Base Font Size', 80, 130, 5, '%', 'Scale the entire interface') +
            slider('iconSize', 'Device Icon Size', 60, 150, 5, '%', 'Scale device icons on cards') +
            toggle('showLastUpdate', 'Show Last Update', 'Show the formatted timestamp footer on device cards') +
            toggle('uppercaseNames', 'Uppercase Device Names', 'Force device names to UPPERCASE on cards') +

            '</div>' +

            '<div class="ng-settings-section">' +
            '<div class="ng-section-header"><i class="fa-solid fa-wand-magic-sparkles"></i> Effects &amp; Animations</div>' +
            toggle('cardTilt', '3D Card Tilt', 'Subtle perspective tilt on hover') +
            toggle('sparklines', 'Sparkline Charts', 'Mini 24h trend charts as card watermarks') +
            toggle('stalenessIndicator', 'Staleness Dot', 'Pulsing red dot on devices that haven\'t updated in 24h') +
            toggle('stateFlash', 'State-Change Flash', 'Blue/red ring flash when a device changes state') +
            toggle('tempAccent', 'Temperature Accent', 'Color-coded top border based on temperature value') +
            toggle('cardAnimations', 'Card Animations', 'Entrance animations and hover transitions on cards') +
            toggle('navAnimations', 'Navbar Animations', 'Staggered entrances, sliding indicator, dropdown effects') +
            toggle('smoothScrolling', 'Smooth Scrolling', 'Enable smooth scroll behavior page-wide') +
            '</div>' +

            '<div class="ng-settings-section">' +
            '<div class="ng-section-header"><i class="fa-solid fa-bell"></i> Live Notifications</div>' +
            toggle('liveToasts', 'Device State Toasts', 'Show a toast when any device changes state via the live WebSocket feed') +
            select('liveToastFilter', 'Event Filter', [
                { value: 'meaningful', label: 'Meaningful (switches & event sensors)' },
                { value: 'all',        label: 'All device changes' }
            ], 'Meaningful skips continuous sensors like temperature and power meters') +
            select('liveToastDuration', 'Visible Duration', [
                { value: '2',  label: '2 seconds' },
                { value: '4',  label: '4 seconds' },
                { value: '6',  label: '6 seconds' },
                { value: '10', label: '10 seconds' }
            ], 'How long each toast stays on screen before fading') +
            select('liveToastPosition', 'Position', [
                { value: 'bottom-right',  label: 'Bottom right' },
                { value: 'bottom-center', label: 'Bottom center' },
                { value: 'top-right',     label: 'Top right' }
            ], 'Where toasts appear on screen') +
            '<div class="ng-setting-row ng-setting-row--action">' +
            '  <div class="ng-setting-info">' +
            '    <span class="ng-setting-label">Suppressed Devices</span>' +
            '    <span class="ng-setting-desc">Block specific devices from triggering notifications</span>' +
            '  </div>' +
            '  <button class="ng-action-chip" id="ng-bl-manage-btn">' +
            '    <i class="fa-solid fa-filter-circle-xmark"></i> Manage</button>' +
            '</div>' +
            '</div>' +

            /* Right column: Color panels (together) */
            '<div class="ng-settings-section ng-settings-section--colors">' +
            '<div class="ng-section-header"><i class="fa-solid fa-droplet"></i> Colors</div>' +
            '<div class="ng-dual-col-headers"><span class="ng-dual-label"><i class="fa-solid fa-moon"></i> Dark</span><span class="ng-dual-label"><i class="fa-solid fa-sun"></i> Light</span></div>' +
            dualColorPicker('accentColor', 'accentColorLight', 'Accent Color') +
            dualColorPicker('dangerColor', 'dangerColorLight', 'Danger Color') +
            dualColorPicker('warningColor', 'warningColorLight', 'Warning Color') +
            dualColorPicker('successColor', 'successColorLight', 'Success Color') +
            '</div>' +

            '<div class="ng-settings-section ng-settings-section--colors">' +
            '<div class="ng-section-header"><i class="fa-solid fa-fill-drip"></i> Background &amp; Surface</div>' +
            '<div class="ng-dual-col-headers"><span class="ng-dual-label"><i class="fa-solid fa-moon"></i> Dark</span><span class="ng-dual-label"><i class="fa-solid fa-sun"></i> Light</span></div>' +
            dualColorPicker('pageBgColor', 'pageBgColorLight', 'Page Background') +
            dualColorPicker('bgColor', 'bgColorLight', 'Navbar &amp; Cards') +
            dualColorPicker('surfaceColor', 'surfaceColorLight', 'Card Surface') +
            dualColorPicker('borderColor', 'borderColorLight', 'Borders') +
            dualColorPicker('textColor', 'textColorLight', 'Text') +
            '</div>' +

            '</div>' + /* grid end */

            '<div class="ng-settings-footer">' +
            '<div class="ng-footer-actions">' +
            '<button class="ng-export-btn" id="ngExportBtn" title="Export settings as JSON file">' +
            '<i class="fa-solid fa-file-export"></i> Export</button>' +
            '<button class="ng-import-btn" id="ngImportBtn" title="Import settings from JSON file">' +
            '<i class="fa-solid fa-file-import"></i> Import</button>' +
            '<input type="file" id="ngImportFile" accept=".json" style="display:none">' +
            '</div>' +
            '<span class="ng-footer-note"><i class="fa-solid fa-cloud-arrow-up"></i> ' +
            (_apiAvailable
                ? 'Settings are stored as Domoticz user variables and sync across all your browsers.'
                : 'API unavailable — settings are stored in this browser\'s local storage.') +
            '</span></div>' +

            '</div>';
    }

    /* ── Theme Preset Loader ───────────────────────────────────── */

    var PRESET_FILES = [
        'nightglass', 'emerald-forest', 'solar-flare', 'arctic-ice',
        'violet-nebula', 'rose-gold', 'monochrome', 'crimson-ember',
        'matrix', 'cyberpunk', 'dracula', 'solarized',
        'synthwave', 'nord', 'hacker', 'ocean-depth'
    ];

    var _presetsCache = null;

    function loadPresets(container) {
        var grid = container.querySelector('#ngPresetsGrid');
        if (!grid) return;

        if (_presetsCache) {
            renderPresets(grid, _presetsCache);
            return;
        }

        var themePath = (function () {
            var scripts = document.querySelectorAll('script[src*="custom.js"]');
            for (var i = 0; i < scripts.length; i++) {
                var src = scripts[i].getAttribute('src') || '';
                var idx = src.indexOf('custom.js');
                if (idx !== -1) return src.substring(0, idx) + 'themes/';
            }
            var links = document.querySelectorAll('link[href*="custom.css"]');
            for (var j = 0; j < links.length; j++) {
                var href = links[j].getAttribute('href') || '';
                var idx2 = href.indexOf('custom.css');
                if (idx2 !== -1) return href.substring(0, idx2) + 'themes/';
            }
            return 'themes/';
        })();

        var promises = PRESET_FILES.map(function (name) {
            return fetch(themePath + name + '.json', { credentials: 'same-origin' })
                .then(function (r) { return r.json(); })
                .catch(function () { return null; });
        });

        Promise.all(promises).then(function (results) {
            _presetsCache = results.filter(function (r) { return r !== null; });
            renderPresets(grid, _presetsCache);
        });
    }

    function renderPresets(grid, presets) {
        if (!presets || !presets.length) {
            grid.innerHTML = '<div class="ng-preset-loading">No presets found</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < presets.length; i++) {
            var p = presets[i];
            var pv = p.preview || {};
            var bg = pv.bg || '#1b1d25';
            var sf = pv.surface || '#23252f';
            var ac = pv.accent || '#4e9af1';
            var tx = pv.text || '#e2e4ed';
            var icon = p.icon || 'fa-solid fa-palette';

            html += '<button class="ng-preset-card" data-ng-preset-idx="' + i + '" title="' + (p.description || p.name) + '">' +
                '<div class="ng-preset-preview" style="background:' + bg + ';">' +
                '<div class="ng-preset-preview-bar" style="background:' + sf + ';border-bottom:2px solid ' + ac + ';"></div>' +
                '<div class="ng-preset-preview-body">' +
                '<div class="ng-preset-preview-card" style="background:' + sf + ';border:1px solid ' + ac + '30;">' +
                '<i class="' + icon + '" style="color:' + ac + ';font-size:14px;"></i>' +
                '<div class="ng-preset-preview-lines">' +
                '<div style="background:' + tx + ';width:70%;height:3px;border-radius:2px;opacity:0.7;"></div>' +
                '<div style="background:' + ac + ';width:45%;height:3px;border-radius:2px;opacity:0.6;"></div>' +
                '</div></div>' +
                '<div class="ng-preset-preview-card" style="background:' + sf + ';border:1px solid ' + ac + '30;">' +
                '<div class="ng-preset-preview-lines">' +
                '<div style="background:' + tx + ';width:55%;height:3px;border-radius:2px;opacity:0.5;"></div>' +
                '<div style="background:' + ac + ';width:35%;height:3px;border-radius:2px;opacity:0.4;"></div>' +
                '</div></div>' +
                '</div></div>' +
                '<div class="ng-preset-info">' +
                '<span class="ng-preset-name">' + p.name + '</span>' +
                '<span class="ng-preset-desc">' + (p.description || '') + '</span>' +
                '</div></button>';
        }
        grid.innerHTML = html;

        grid.querySelectorAll('.ng-preset-card').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = parseInt(this.getAttribute('data-ng-preset-idx'), 10);
                applyPreset(presets[idx]);
                grid.querySelectorAll('.ng-preset-card').forEach(function (b) {
                    b.classList.remove('ng-preset-card--active');
                });
                this.classList.add('ng-preset-card--active');
            });
        });
    }

    function applyPreset(preset) {
        if (!preset || !preset.colors) return;
        var colors = preset.colors;
        var keys = Object.keys(colors);
        var total = keys.length;
        var completed = 0;

        // Show progress toast
        var toast = document.createElement('div');
        toast.className = 'ng-preset-toast';
        toast.innerHTML =
            '<div class="ng-preset-toast-inner">' +
            '<i class="fa-solid fa-palette ng-preset-toast-icon"></i>' +
            '<div class="ng-preset-toast-content">' +
            '<span class="ng-preset-toast-label">Applying theme…</span>' +
            '<div class="ng-preset-toast-bar"><div class="ng-preset-toast-fill"></div></div>' +
            '<span class="ng-preset-toast-pct">0 / ' + total + '</span>' +
            '</div></div>';
        document.body.appendChild(toast);
        var fill = toast.querySelector('.ng-preset-toast-fill');
        var pct = toast.querySelector('.ng-preset-toast-pct');
        var label = toast.querySelector('.ng-preset-toast-label');

        // Force reflow then add visible class for entrance animation
        toast.offsetHeight;
        toast.classList.add('ng-preset-toast--visible');

        var promises = keys.map(function (key) {
            _settings[key] = colors[key];
            saveToLocalStorage();
            if (_apiAvailable) {
                var p = setUvar(key, colors[key]);
                if (p && typeof p.then === 'function') {
                    return p.then(function () {
                        completed++;
                        var percent = Math.round((completed / total) * 100);
                        fill.style.width = percent + '%';
                        pct.textContent = completed + ' / ' + total;
                    }).catch(function () {
                        completed++;
                        var percent = Math.round((completed / total) * 100);
                        fill.style.width = percent + '%';
                        pct.textContent = completed + ' / ' + total;
                    });
                }
            }
            completed++;
            return Promise.resolve();
        });

        Promise.all(promises).then(function () {
            applySettings();
            label.textContent = 'Theme applied!';
            fill.style.width = '100%';
            pct.textContent = total + ' / ' + total;
            toast.querySelector('.ng-preset-toast-icon').className = 'fa-solid fa-circle-check ng-preset-toast-icon';

            // Re-render the settings panel to reflect new colors
            var wrap = document.getElementById('ng-theme-settings-wrap');
            if (wrap) {
                var presetsBody = wrap.querySelector('#ngPresetsBody');
                var presetsWereOpen = presetsBody && presetsBody.style.display !== 'none';
                wrap.innerHTML = buildPanel({ presetsOpen: presetsWereOpen });
                bindEvents(wrap);
                loadPresets(wrap);
            }

            setTimeout(function () {
                toast.classList.remove('ng-preset-toast--visible');
                setTimeout(function () { toast.remove(); }, 350);
            }, 1500);
        });
    }

    /* ── Inject panel into settings page ───────────────────────── */

    function injectPanel() {
        if (_panelInjected) return;
        var settingsContent = document.getElementById('settingscontent');
        if (!settingsContent) return;
        if (document.getElementById('ng-theme-settings')) return;

        var subTabs = settingsContent.querySelector('.sub-tabs');
        if (!subTabs) return;

        _panelInjected = true;

        // Pre-create the wrap (hidden) so it's ready when tab is clicked
        var wrap = document.createElement('div');
        wrap.id = 'ng-theme-settings-wrap';
        wrap.style.display = 'none';
        wrap.innerHTML = buildPanel();
        settingsContent.appendChild(wrap);
        bindEvents(wrap);
        loadPresets(wrap);

        var li = document.createElement('li');
        li.id = 'ng-settings-tab';
        var a = document.createElement('a');
        a.href = 'javascript:void(0)';
        a.textContent = 'Nightglass';
        a.addEventListener('click', function () {
            showNightglassTab(settingsContent, subTabs);
        });
        li.appendChild(a);

        // Keep the Nightglass tab directly after the localized Backup/Restore tab
        // when that tab exists, and otherwise fall back to placing it before the
        // apply button.
        var applyBtn = subTabs.querySelector('a.sub-tabs-apply');
        var applyLi  = applyBtn ? applyBtn.closest('li') : null;
        var backupLi = Array.from(subTabs.querySelectorAll('li')).find(function (tab) {
            var link = tab.querySelector('a');
            var label = link ? link.textContent.replace(/\s+/g, '').toLowerCase() : '';
            return label === 'backup/herstel' || label === 'backup/restore';
        });
        if (applyLi) {
            applyLi.classList.add('ng-apply-li');
        }
        if (backupLi) {
            if (backupLi.nextElementSibling) {
                subTabs.insertBefore(li, backupLi.nextElementSibling);
            } else if (applyLi) {
                subTabs.insertBefore(li, applyLi);
            } else {
                subTabs.appendChild(li);
            }
        } else if (applyLi) {
            subTabs.insertBefore(li, applyLi);
        } else {
            subTabs.appendChild(li);
        }
    }

    function showNightglassTab(settingsContent, subTabs) {
        var tabs = subTabs.querySelectorAll('li');
        tabs.forEach(function (t) { t.classList.remove('active'); });
        document.getElementById('ng-settings-tab').classList.add('active');
        settingsContent.classList.add('ng-showing');
        var wrap = document.getElementById('ng-theme-settings-wrap');
        if (wrap) wrap.style.display = '';
        settingsContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (!document.getElementById('dz-ng-settings-hide')) {
            var style = document.createElement('style');
            style.id = 'dz-ng-settings-hide';
            style.textContent =
                '#settingscontent.ng-showing #my-tab-content { display: none !important; }' +
                '#settingscontent.ng-showing .sub-tabs-apply { display: none !important; }' +
                '#settingscontent.ng-showing #ng-theme-settings-wrap { display: block !important; }';
            document.head.appendChild(style);
        }
    }
    /* Restore other panes when clicking a non-Nightglass tab */
    function hookOtherTabs() {
        var settingsContent = document.getElementById('settingscontent');
        if (!settingsContent) return;
        var subTabs = settingsContent.querySelector('.sub-tabs');
        if (!subTabs) return;

        subTabs.addEventListener('click', function (e) {
            var li = e.target.closest('li');
            if (!li || li.id === 'ng-settings-tab') return;
            // Remove the CSS-based hiding class
            settingsContent.classList.remove('ng-showing');
            var wrap = document.getElementById('ng-theme-settings-wrap');
            if (wrap) wrap.style.display = 'none';
            var ngTab = document.getElementById('ng-settings-tab');
            if (ngTab) ngTab.classList.remove('active');
        });
    }

    /* ── Bind interactive events ───────────────────────────────── */

    function applySectionStates(container) {
        container.querySelectorAll('input[data-ng-section-key]').forEach(function (cb) {
            var section = cb.closest('.ng-settings-section');
            if (!section) return;
            if (cb.checked) {
                section.classList.remove('ng-section-disabled');
            } else {
                section.classList.add('ng-section-disabled');
            }
        });
    }

    /* ── Notification Blacklist Dialog ─────────────────────────── */

    function openBlacklistDialog() {
        // Remove any existing dialog
        var existing = document.getElementById('ng-bl-overlay');
        if (existing) existing.remove();

        // Load current blacklist
        var currentBl = [];
        try {
            currentBl = JSON.parse(
                (window.dzNightglassSettings && window.dzNightglassSettings.get('toastBlacklist')) || '[]'
            );
        } catch (e) {}

        // Build dialog shell
        var overlay = document.createElement('div');
        overlay.id = 'ng-bl-overlay';
        overlay.className = 'ng-bl-overlay';
        overlay.innerHTML =
            '<div class="ng-bl-dialog" role="dialog" aria-label="Notification Blacklist">' +
            '  <div class="ng-bl-header">' +
            '    <div class="ng-bl-title">' +
            '      <i class="fa-solid fa-filter-circle-xmark"></i>' +
            '      <span>Suppressed Devices</span>' +
            '    </div>' +
            '    <button class="ng-bl-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
            '  </div>' +
            '  <div class="ng-bl-search-wrap">' +
            '    <i class="fa-solid fa-magnifying-glass ng-bl-search-icon"></i>' +
            '    <input class="ng-bl-search" id="ng-bl-search" placeholder="Search devices…" autocomplete="off">' +
            '  </div>' +
            '  <div class="ng-bl-list" id="ng-bl-list">' +
            '    <div class="ng-bl-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading devices…</div>' +
            '  </div>' +
            '  <div class="ng-bl-footer">' +
            '    <span class="ng-bl-count" id="ng-bl-count"></span>' +
            '    <div class="ng-bl-footer-btns">' +
            '      <button class="ng-bl-btn ng-bl-btn--cancel">Cancel</button>' +
            '      <button class="ng-bl-btn ng-bl-btn--save">Save</button>' +
            '    </div>' +
            '  </div>' +
            '</div>';
        document.body.appendChild(overlay);

        // Animate in
        requestAnimationFrame(function () { overlay.classList.add('ng-bl-overlay--open'); });

        var dialog    = overlay.querySelector('.ng-bl-dialog');
        var listEl    = overlay.querySelector('#ng-bl-list');
        var searchEl  = overlay.querySelector('#ng-bl-search');
        var countEl   = overlay.querySelector('#ng-bl-count');
        var pending   = currentBl.slice(); // copy to mutate

        function close() {
            overlay.classList.remove('ng-bl-overlay--open');
            setTimeout(function () { overlay.remove(); }, 260);
        }

        function updateCount() {
            if (countEl) {
                var n = pending.length;
                countEl.textContent = n === 0 ? 'None suppressed' : n + ' suppressed';
            }
        }

        function filterList(q) {
            var rows = listEl.querySelectorAll('.ng-bl-row');
            q = (q || '').toLowerCase();
            for (var i = 0; i < rows.length; i++) {
                var name = (rows[i].dataset.name || '').toLowerCase();
                rows[i].style.display = (!q || name.indexOf(q) !== -1) ? '' : 'none';
            }
        }

        function renderDevices(devices) {
            if (!devices || !devices.length) {
                listEl.innerHTML = '<div class="ng-bl-empty">No devices found.</div>';
                return;
            }
            var html = '';
            for (var i = 0; i < devices.length; i++) {
                var d = devices[i];
                var isBlocked = pending.indexOf(String(d.idx)) !== -1;
                html +=
                    '<label class="ng-bl-row' + (isBlocked ? ' ng-bl-row--active' : '') + '" ' +
                    '  data-idx="' + d.idx + '" data-name="' + (d.Name || '').replace(/"/g,'&quot;') + '">' +
                    '  <span class="ng-bl-row-info">' +
                    '    <span class="ng-bl-row-name">' + (d.Name || 'Device ' + d.idx) + '</span>' +
                    '    <span class="ng-bl-row-type">' + (d.HardwareName || '') + (d.Type ? ' · ' + d.Type : '') + '</span>' +
                    '  </span>' +
                    '  <input type="checkbox" class="ng-bl-cb" ' + (isBlocked ? 'checked' : '') + ' aria-label="Suppress">' +
                    '  <span class="ng-bl-toggle-track"><span class="ng-bl-toggle-thumb"></span></span>' +
                    '</label>';
            }
            listEl.innerHTML = html;

            // Wire up checkbox changes
            listEl.addEventListener('change', function (e) {
                var cb = e.target;
                if (!cb.classList.contains('ng-bl-cb')) return;
                var row = cb.closest('.ng-bl-row');
                if (!row) return;
                var idxStr = String(row.dataset.idx);
                var pos = pending.indexOf(idxStr);
                if (cb.checked) {
                    row.classList.add('ng-bl-row--active');
                    if (pos === -1) pending.push(idxStr);
                } else {
                    row.classList.remove('ng-bl-row--active');
                    if (pos !== -1) pending.splice(pos, 1);
                }
                updateCount();
            });

            updateCount();
        }

        // Close handlers
        overlay.querySelector('.ng-bl-close').addEventListener('click', close);
        overlay.querySelector('.ng-bl-btn--cancel').addEventListener('click', close);
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

        // Search
        if (searchEl) {
            searchEl.addEventListener('input', function () { filterList(this.value); });
        }

        // Save
        overlay.querySelector('.ng-bl-btn--save').addEventListener('click', function () {
            if (window.dzNightglassSettings) {
                window.dzNightglassSettings.set('toastBlacklist', JSON.stringify(pending));
            }
            close();
        });

        // Fetch devices from Domoticz
        fetch('/json.htm?type=command&param=getdevices&filter=all&used=true&order=Name', { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (data) { renderDevices(data.result || []); })
            .catch(function () {
                listEl.innerHTML =
                    '<div class="ng-bl-empty">' +
                    '  <i class="fa-solid fa-triangle-exclamation"></i>' +
                    '  Could not load device list.' +
                    '</div>';
            });
    }

    function bindEvents(container) {
        // Presets panel collapse/expand
        var presetsToggle = container.querySelector('#ngPresetsToggle');
        var presetsBody = container.querySelector('#ngPresetsBody');
        if (presetsToggle && presetsBody) {
            presetsToggle.addEventListener('click', function () {
                var open = presetsBody.style.display !== 'none';
                presetsBody.style.display = open ? 'none' : '';
                presetsToggle.classList.toggle('ng-presets-toggle--open', !open);
            });
        }

        // Toggles
        container.querySelectorAll('input[type="checkbox"][data-ng-key]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                saveSetting(this.getAttribute('data-ng-key'), this.checked);
                // Sub-setting visibility
                updateSubSettings(container);
            });
        });

        // Section toggles (enable/disable entire section)
        container.querySelectorAll('input[data-ng-section-key]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var key = this.getAttribute('data-ng-section-key');
                saveSetting(key, this.checked);
                applySectionStates(container);
            });
        });
        applySectionStates(container);

        // Color pickers (custom HSV canvas)
        initColorPickers(container);

        // Selects
        container.querySelectorAll('select[data-ng-key]').forEach(function (sel) {
            sel.addEventListener('change', function () {
                saveSetting(this.getAttribute('data-ng-key'), this.value);
            });
        });

        // Sliders
        container.querySelectorAll('input[type="range"][data-ng-key]').forEach(function (sl) {
            sl.addEventListener('input', function () {
                var val = this.value;
                this.closest('.ng-slider-wrap').querySelector('.ng-slider-value').textContent = val + '%';
                saveSetting(this.getAttribute('data-ng-key'), val);
            });
        });

        // Reset button
        var resetBtn = container.querySelector('#ngResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
                if (!confirm('Reset all Nightglass theme settings to defaults?')) return;
                Object.keys(DEFAULTS).forEach(function (key) {
                    saveSetting(key, DEFAULTS[key]);
                });
                // Re-render
                var wrap = document.getElementById('ng-theme-settings-wrap');
                if (wrap) {
                    wrap.innerHTML = buildPanel();
                    bindEvents(wrap);
                    loadPresets(wrap);
                }
            });
        }

        // Notification blacklist manage button
        var blBtn = container.querySelector('#ng-bl-manage-btn');
        if (blBtn) {
            blBtn.addEventListener('click', openBlacklistDialog);
        }

        // Export button
        var exportBtn = container.querySelector('#ngExportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', function () {
                var data = JSON.stringify(_settings, null, 2);
                var blob = new Blob([data], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'nightglass-settings.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });
        }

        // Import button
        var importBtn = container.querySelector('#ngImportBtn');
        var importFile = container.querySelector('#ngImportFile');
        if (importBtn && importFile) {
            importBtn.addEventListener('click', function () {
                importFile.click();
            });
            importFile.addEventListener('change', function () {
                var file = this.files && this.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function (e) {
                    try {
                        var imported = JSON.parse(e.target.result);
                        var count = 0;
                        Object.keys(DEFAULTS).forEach(function (key) {
                            if (imported[key] !== undefined) {
                                saveSetting(key, imported[key]);
                                count++;
                            }
                        });
                        // Re-render panel with new values
                        var wrap = document.getElementById('ng-theme-settings-wrap');
                        if (wrap) {
                            wrap.innerHTML = buildPanel();
                            bindEvents(wrap);
                            loadPresets(wrap);
                        }
                        alert('Imported ' + count + ' settings successfully.');
                    } catch (err) {
                        alert('Failed to import settings: invalid JSON file.');
                    }
                };
                reader.readAsText(file);
                this.value = ''; // allow re-importing the same file
            });
        }

        updateSubSettings(container);
    }

    /* ── Custom HSV Color Picker logic ─────────────────────────── */

    function hexToHsv(hex) {
        var r = parseInt(hex.slice(1,3),16)/255;
        var g = parseInt(hex.slice(3,5),16)/255;
        var b = parseInt(hex.slice(5,7),16)/255;
        var mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx - mn;
        var h = 0, s = mx === 0 ? 0 : d / mx, v = mx;
        if (d !== 0) {
            if (mx === r)      h = ((g - b) / d + 6) % 6;
            else if (mx === g) h = (b - r) / d + 2;
            else               h = (r - g) / d + 4;
            h /= 6;
        }
        return { h: h, s: s, v: v };
    }

    function hsvToHex(h, s, v) {
        var i = Math.floor(h * 6), f = h * 6 - i;
        var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
        var r, g, b;
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        var toHex = function (n) { var h = Math.round(n * 255).toString(16); return h.length < 2 ? '0' + h : h; };
        return '#' + toHex(r) + toHex(g) + toHex(b);
    }

    function drawSV(canvas, hue) {
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;
        // Fill with hue
        ctx.fillStyle = hsvToHex(hue, 1, 1);
        ctx.fillRect(0, 0, w, h);
        // White gradient left to right
        var gW = ctx.createLinearGradient(0, 0, w, 0);
        gW.addColorStop(0, 'rgba(255,255,255,1)');
        gW.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gW;
        ctx.fillRect(0, 0, w, h);
        // Black gradient top to bottom
        var gB = ctx.createLinearGradient(0, 0, 0, h);
        gB.addColorStop(0, 'rgba(0,0,0,0)');
        gB.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = gB;
        ctx.fillRect(0, 0, w, h);
    }

    function drawHueBar(canvas) {
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;
        var grad = ctx.createLinearGradient(0, 0, w, 0);
        for (var i = 0; i <= 6; i++) {
            grad.addColorStop(i / 6, hsvToHex(i / 6, 1, 1));
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
    }

    function initColorPickers(container) {
        container.querySelectorAll('.ng-color-wrap[data-ng-color-key]').forEach(function (wrap) {
            var key = wrap.getAttribute('data-ng-color-key');
            var swatch = wrap.querySelector('.ng-cp-swatch');
            var hexInput = wrap.querySelector('.ng-cp-hex');
            var popover = wrap.querySelector('.ng-cp-popover');
            var svCanvas = wrap.querySelector('.ng-cp-sv');
            var hueCanvas = wrap.querySelector('.ng-cp-hue');
            var presetBtns = wrap.querySelectorAll('.ng-cp-preset');

            var hsv = hexToHsv(hexInput.value || '#4e9af1');

            function updateFromHsv(commit) {
                var hex = hsvToHex(hsv.h, hsv.s, hsv.v);
                swatch.style.background = hex;
                hexInput.value = hex;
                drawSV(svCanvas, hsv.h);
                // Highlight active preset
                presetBtns.forEach(function (b) {
                    b.classList.toggle('ng-cp-preset--active',
                        b.getAttribute('data-color').toLowerCase() === hex.toLowerCase());
                });
                if (commit) saveSetting(key, hex);
            }

            // Init canvases
            drawSV(svCanvas, hsv.h);
            drawHueBar(hueCanvas);

            // Toggle popover (fixed positioning to escape overflow)
            swatch.addEventListener('click', function (e) {
                e.stopPropagation();
                var open = popover.style.display === 'block';
                closeAllPopovers(container);
                if (!open) {
                    popover.style.display = 'block';
                    // Position fixed relative to the swatch button
                    var rect = swatch.getBoundingClientRect();
                    var popW = 260; // matches CSS width
                    var left = rect.right - popW;
                    var top = rect.bottom + 8;
                    // Keep within viewport
                    if (left < 8) left = 8;
                    if (top + 300 > window.innerHeight) top = rect.top - 308;
                    popover.style.left = left + 'px';
                    popover.style.top = top + 'px';
                    drawSV(svCanvas, hsv.h);
                    drawHueBar(hueCanvas);
                }
            });

            // SV canvas interaction
            function handleSV(e) {
                var rect = svCanvas.getBoundingClientRect();
                var x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                var y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                hsv.s = x;
                hsv.v = 1 - y;
                updateFromHsv(true);
            }
            var svDragging = false;
            svCanvas.addEventListener('pointerdown', function (e) {
                svDragging = true;
                svCanvas.setPointerCapture(e.pointerId);
                handleSV(e);
            });
            svCanvas.addEventListener('pointermove', function (e) {
                if (svDragging) handleSV(e);
            });
            svCanvas.addEventListener('pointerup', function () { svDragging = false; });

            // Hue bar interaction
            function handleHue(e) {
                var rect = hueCanvas.getBoundingClientRect();
                hsv.h = Math.max(0, Math.min(0.9999, (e.clientX - rect.left) / rect.width));
                updateFromHsv(true);
            }
            var hueDragging = false;
            hueCanvas.addEventListener('pointerdown', function (e) {
                hueDragging = true;
                hueCanvas.setPointerCapture(e.pointerId);
                handleHue(e);
            });
            hueCanvas.addEventListener('pointermove', function (e) {
                if (hueDragging) handleHue(e);
            });
            hueCanvas.addEventListener('pointerup', function () { hueDragging = false; });

            // Hex input
            hexInput.addEventListener('input', function () {
                var v = this.value.trim();
                if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                    hsv = hexToHsv(v);
                    updateFromHsv(true);
                }
            });
            hexInput.addEventListener('blur', function () {
                var v = this.value.trim();
                if (!/^#[0-9a-fA-F]{6}$/.test(v)) {
                    this.value = hsvToHex(hsv.h, hsv.s, hsv.v);
                }
            });
            hexInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { this.blur(); }
            });

            // Presets
            presetBtns.forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var c = this.getAttribute('data-color');
                    hsv = hexToHsv(c);
                    updateFromHsv(true);
                });
            });
        });

        // Close popover when clicking outside
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.ng-color-wrap')) {
                closeAllPopovers(container);
            }
        });
    }

    function closeAllPopovers(container) {
        container.querySelectorAll('.ng-cp-popover').forEach(function (p) {
            p.style.display = 'none';
        });
    }

    function updateSubSettings(container) {
        // animateDeviceIcons only relevant if deviceIcons is on
        var animRow = container.querySelector('[data-ng-key="animateDeviceIcons"]');
        if (animRow) {
            var row = animRow.closest('.ng-setting-row');
            if (row) row.style.opacity = _settings.deviceIcons ? '1' : '0.4';
        }
    }

    /* ── Initialize ────────────────────────────────────────────── */

    function retryInjectPanel(attempts) {
        if (_panelInjected || attempts <= 0) return;
        injectPanel();
        if (!_panelInjected) {
            setTimeout(function () { retryInjectPanel(attempts - 1); }, 500);
        } else {
            hookOtherTabs();
        }
    }

    function init() {
        loadSettings().then(function () {
            applySettings();
            injectPanel();
            hookOtherTabs();
            if (!_panelInjected) {
                retryInjectPanel(10);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-inject on SPA navigation (settings page may load later)
    window.addEventListener('hashchange', function () {
        _panelInjected = false;
        setTimeout(function () {
            if (_settings) {
                injectPanel();
                hookOtherTabs();
            }
        }, 500);
    });

    // Also watch for Angular route changes
    var _retryCount = 0;
    function hookAngularForSettings() {
        var $body = document.querySelector('[ng-app]') || document.body;
        var injector = window.angular && window.angular.element($body).injector();
        if (!injector) {
            if (++_retryCount < 20) setTimeout(hookAngularForSettings, 500);
            return;
        }
        var $rootScope = injector.get('$rootScope');
        $rootScope.$on('$viewContentLoaded', function () {
            _panelInjected = false;
            setTimeout(function () {
                if (_settings) {
                    injectPanel();
                    hookOtherTabs();
                }
            }, 500);
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setTimeout(hookAngularForSettings, 500);
        });
    } else {
        setTimeout(hookAngularForSettings, 500);
    }

    // Expose for external use
    window.dzNightglassSettings = {
        get: function (key) { return _settings ? _settings[key] : DEFAULTS[key]; },
        set: saveSetting,
        reset: function () {
            Object.keys(DEFAULTS).forEach(function (key) {
                saveSetting(key, DEFAULTS[key]);
            });
        }
    };
})();


/* ── Feature 9: Popup Redesigns ─────────────────────────────────────── */
(function () {
    'use strict';

    /* ── Overlay / modal management ────────────────────────────────── */

    var _activePopupId = null;

    function getOrCreateOverlay() {
        var ov = document.getElementById('ng-popup-overlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'ng-popup-overlay';
            ov.addEventListener('click', function (e) {
                if (e.target === ov) ngCloseActivePopup();
            });
            document.body.appendChild(ov);
        }
        return ov;
    }

    function ngOpenPopup(id) {
        var popup = document.getElementById(id);
        if (!popup) return;
        if (_activePopupId && _activePopupId !== id) ngClosePopup(_activePopupId);
        _activePopupId = id;
        popup.style.display = 'block';
        getOrCreateOverlay().classList.add('ng-popup-overlay--open');
        popup.classList.add('ng-popup--modal');
    }

    function ngClosePopup(id) {
        var ov = document.getElementById('ng-popup-overlay');
        if (ov) ov.classList.remove('ng-popup-overlay--open');
        var popup = id ? document.getElementById(id) : null;
        if (popup) {
            popup.classList.remove('ng-popup--modal');
            popup.style.display = 'none';
        }
        _activePopupId = null;
    }

    function ngCloseActivePopup() {
        ngClosePopup(_activePopupId);
    }

    window.ngOpenPopup        = ngOpenPopup;
    window.ngCloseActivePopup = ngCloseActivePopup;

    /* ── Arc math helpers ──────────────────────────────────────────── */

    // SVG viewport 220×220, dial centre 110,115, radius 80
    // Arc: 150° (8 o'clock, cold) → clockwise 240° → 30° (4 o'clock, hot)
    var CX = 110, CY = 115, R = 80, START = 150, SWEEP = 240;

    function d2r(deg) { return deg * Math.PI / 180; }

    function pt(deg) {
        return {
            x: +(CX + R * Math.cos(d2r(deg))).toFixed(2),
            y: +(CY + R * Math.sin(d2r(deg))).toFixed(2)
        };
    }

    function arcPath(startDeg, sweepDeg) {
        if (sweepDeg <= 0) return '';
        var s = pt(startDeg);
        var e = pt(startDeg + sweepDeg);
        var la = sweepDeg > 180 ? 1 : 0;
        return 'M' + s.x + ' ' + s.y + ' A' + R + ' ' + R + ' 0 ' + la + ' 1 ' + e.x + ' ' + e.y;
    }

    function tempColor(t) {
        var stops = [
            [0.00, [30,  144, 255]],
            [0.35, [0,   200, 210]],
            [0.55, [76,  175, 125]],
            [0.75, [240, 168,  50]],
            [1.00, [224,  85,  85]]
        ];
        for (var i = 0; i < stops.length - 1; i++) {
            var t0 = stops[i][0], t1 = stops[i + 1][0];
            if (t >= t0 && t <= t1) {
                var f  = (t - t0) / (t1 - t0);
                var c  = stops[i][1], d = stops[i + 1][1];
                return 'rgb(' + [0, 1, 2].map(function (j) {
                    return Math.round(c[j] + f * (d[j] - c[j]));
                }).join(',') + ')';
            }
        }
        return t < 0.5 ? 'rgb(30,144,255)' : 'rgb(224,85,85)';
    }

    /* ── Setpoint state ────────────────────────────────────────────── */

    var _spMin = -200, _spMax = 200, _spStep = 0.5;

    function valToT(v)  { return Math.max(0, Math.min(1, (v - _spMin) / (_spMax - _spMin || 1))); }
    function tToVal(t)  {
        var raw = _spMin + t * (_spMax - _spMin);
        raw = Math.round(raw / _spStep) * _spStep;
        return +(Math.max(_spMin, Math.min(_spMax, raw)).toFixed(2));
    }

    /* ── Setpoint SVG template ─────────────────────────────────────── */

    function setpointSVG() {
        var trackPath = arcPath(START, SWEEP);
        var startPt   = pt(START);
        var endPt     = pt(START + SWEEP);
        return '<svg id="ng-sp-svg" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" ' +
               'style="width:100%;display:block;touch-action:none">' +
            '<defs>' +
              '<filter id="ng-sp-glow" x="-60%" y="-60%" width="220%" height="220%">' +
                '<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/>' +
                '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
              '</filter>' +
              '<filter id="ng-sp-sh" x="-60%" y="-60%" width="220%" height="220%">' +
                '<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,.45)"/>' +
              '</filter>' +
            '</defs>' +
            '<path class="ng-sp-track" d="' + trackPath + '" fill="none" stroke-width="10" stroke-linecap="round"/>' +
            '<path id="ng-sp-progress" d="" fill="none" stroke-width="10" stroke-linecap="round"/>' +
            '<circle id="ng-sp-thumb" r="11" fill="#fff" filter="url(#ng-sp-sh)" style="cursor:grab"/>' +
            '<circle cx="' + startPt.x + '" cy="' + startPt.y + '" r="5" class="ng-sp-cold-dot"/>' +
            '<circle cx="' + endPt.x + '"   cy="' + endPt.y   + '" r="5" class="ng-sp-hot-dot"/>' +
            '<text id="ng-sp-val-text" x="' + CX + '" y="' + (CY - 5)  + '" ' +
                  'text-anchor="middle" dominant-baseline="middle" class="ng-sp-val-big"></text>' +
            '<text id="ng-sp-unit-text" x="' + CX + '" y="' + (CY + 23) + '" ' +
                  'text-anchor="middle" class="ng-sp-unit">°</text>' +
        '</svg>';
    }

    /* ── Arc rendering ─────────────────────────────────────────────── */

    function updateArc(val) {
        var t        = valToT(val);
        var color    = tempColor(t);
        var sweepDeg = t * SWEEP;

        var progress = document.getElementById('ng-sp-progress');
        if (progress) {
            var d = sweepDeg >= 2 ? arcPath(START, sweepDeg) : '';
            progress.setAttribute('d', d);
            progress.setAttribute('stroke', color);
            if (sweepDeg > 15) {
                progress.setAttribute('filter', 'url(#ng-sp-glow)');
            } else {
                progress.removeAttribute('filter');
            }
        }

        var thumb = document.getElementById('ng-sp-thumb');
        if (thumb) {
            var p = pt(START + sweepDeg);
            thumb.setAttribute('cx', p.x);
            thumb.setAttribute('cy', p.y);
            thumb.setAttribute('fill', color);
        }

        var valText = document.getElementById('ng-sp-val-text');
        if (valText) {
            valText.textContent = (+val).toFixed(1);
            valText.setAttribute('fill', color);
        }

        var readout = document.getElementById('ng-sp-display');
        if (readout) {
            readout.textContent = (+val).toFixed(1) + '°';
            readout.style.color = color;
        }
    }

    function syncArcFromInput() {
        if (window.$) {
            _spMin  = parseFloat(window.$.setmin)  !== undefined ? parseFloat(window.$.setmin)  : -200;
            _spMax  = parseFloat(window.$.setmax)  !== undefined ? parseFloat(window.$.setmax)  :  200;
            _spStep = parseFloat(window.$.setstep) || 0.5;
        }
        var input = document.getElementById('popup_setpoint');
        if (!input) return;
        updateArc(parseFloat(input.value) || 0);

        var actual  = document.getElementById('actual_value');
        var actDisp = document.getElementById('ng-sp-actual');
        if (actDisp && actual) {
            actDisp.textContent = actual.textContent || actual.innerHTML || '—';
        }
    }

    /* ── Global step handler (called from onclick) ─────────────────── */

    window.ngSetpointChange = function (dir) {
        if (window.$) {
            _spStep = parseFloat(window.$.setstep) || 0.5;
            _spMin  = parseFloat(window.$.setmin)  !== undefined ? parseFloat(window.$.setmin)  : -200;
            _spMax  = parseFloat(window.$.setmax)  !== undefined ? parseFloat(window.$.setmax)  :  200;
        }
        var input = document.getElementById('popup_setpoint');
        if (!input) return;
        var val = tToVal(valToT(parseFloat(input.value) || 0) + dir * _spStep / (_spMax - _spMin || 1));
        // Use Domoticz's own step functions for clamping precision, fall back to direct edit
        var newVal = +(Math.max(_spMin, Math.min(_spMax,
                        Math.round(((parseFloat(input.value) || 0) + dir * _spStep) * 1000) / 1000
                     )).toFixed(2));
        input.value = newVal;
        if (window.$) $(input).val(newVal);
        updateArc(newVal);
    };

    /* ── Arc drag interaction ──────────────────────────────────────── */

    function attachArcDrag(svg) {
        if (!svg) return;
        var dragging = false;

        function angleFrom(e) {
            var rect = svg.getBoundingClientRect();
            var sx   = 220 / (rect.width  || 220);
            var sy   = 220 / (rect.height || 220);
            var cx   = e.touches ? e.touches[0].clientX : e.clientX;
            var cy   = e.touches ? e.touches[0].clientY : e.clientY;
            var deg  = Math.atan2((cy - rect.top) * sy - CY,
                                  (cx - rect.left) * sx - CX) * 180 / Math.PI;
            return deg < 0 ? deg + 360 : deg;
        }

        function applyAngle(e) {
            var rel = angleFrom(e) - START;
            if (rel < 0) rel += 360;
            if (rel > SWEEP + 60) rel = 0;
            if (rel > SWEEP) rel = SWEEP;
            var val = tToVal(rel / SWEEP);
            var inp = document.getElementById('popup_setpoint');
            if (inp) { inp.value = val; if (window.$) $(inp).val(val); }
            updateArc(val);
        }

        svg.addEventListener('mousedown',  function (e) { dragging = true;  applyAngle(e); });
        document.addEventListener('mousemove',  function (e) { if (dragging) applyAngle(e); });
        document.addEventListener('mouseup',    function ()  { dragging = false; });
        svg.addEventListener('touchstart', function (e) { dragging = true;  applyAngle(e); e.preventDefault(); }, { passive: false });
        document.addEventListener('touchmove',  function (e) { if (dragging) { applyAngle(e); e.preventDefault(); } }, { passive: false });
        document.addEventListener('touchend',   function ()  { dragging = false; });
    }

    /* ── Popup redesigns ───────────────────────────────────────────── */

    function redesignSetpointPopup() {
        var popup = document.getElementById('setpoint_popup');
        if (!popup || popup.dataset.ngDone) return;
        popup.dataset.ngDone = '1';

        popup.innerHTML =
            // Domoticz-required hidden elements
            '<input type="hidden" id="popup_setpoint">' +
            '<span id="actual_value" style="display:none" aria-hidden="true"></span>' +

            '<button class="ng-popup-close" onclick="CloseSetpointPopup(); ngCloseActivePopup();" aria-label="Close">' +
            '  <i class="fa-solid fa-xmark"></i></button>' +

            '<div class="ng-popup-title"><i class="fa-solid fa-thermometer-half"></i> Setpoint</div>' +

            '<div class="ng-sp-actual-row">' +
            '  <span class="ng-sp-actual-label">Current</span>' +
            '  <span id="ng-sp-actual" class="ng-sp-actual-val">—</span>' +
            '</div>' +

            '<div class="ng-sp-arc-wrap">' + setpointSVG() + '</div>' +

            '<div class="ng-sp-controls">' +
            '  <button class="ng-sp-btn" onclick="ngSetpointChange(-1)" aria-label="Decrease">' +
            '    <i class="fa-solid fa-minus"></i></button>' +
            '  <div id="ng-sp-display" class="ng-sp-readout">—</div>' +
            '  <button class="ng-sp-btn" onclick="ngSetpointChange(1)"  aria-label="Increase">' +
            '    <i class="fa-solid fa-plus"></i></button>' +
            '</div>' +

            '<button class="ng-sp-set-btn" onclick="SetSetpoint()">' +
            '  <i class="fa-solid fa-check"></i> Set</button>';

        attachArcDrag(document.getElementById('ng-sp-svg'));

        // Render a neutral default so the arc is never blank on first open
        setTimeout(function () { updateArc(20); }, 0);

        // Mirror actual_value updates to our display
        var actualEl = document.getElementById('actual_value');
        if (actualEl && window.MutationObserver) {
            new MutationObserver(function () {
                var d = document.getElementById('ng-sp-actual');
                if (d) d.textContent = actualEl.textContent || '—';
            }).observe(actualEl, { childList: true, characterData: true, subtree: true });
        }
    }

    function redesignIthoPopup() {
        var p = document.getElementById('itho_popup');
        if (!p || p.dataset.ngDone) return;
        p.dataset.ngDone = '1';
        p.innerHTML =
            '<button class="ng-popup-close" onclick="CloseIthoPopup(); ngCloseActivePopup();" aria-label="Close">' +
            '  <i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ng-popup-title"><i class="fa-solid fa-fan"></i> Ventilation</div>' +
            '<div class="ng-seg-group">' +
            '  <button class="ng-seg-btn" onclick="IthoSendCommand(\'1\')">' +
            '    <i class="fa-solid fa-wind"></i><span>Low</span></button>' +
            '  <button class="ng-seg-btn" onclick="IthoSendCommand(\'2\')">' +
            '    <i class="fa-solid fa-wind"></i><span>Med</span></button>' +
            '  <button class="ng-seg-btn" onclick="IthoSendCommand(\'3\')">' +
            '    <i class="fa-solid fa-wind"></i><span>High</span></button>' +
            '</div>' +
            '<button class="ng-seg-btn ng-seg-btn--full" onclick="IthoSendCommand(\'timer\')">' +
            '  <i class="fa-solid fa-clock"></i> Timer</button>';
    }

    function redesignLucciPopup() {
        var p = document.getElementById('lucci_popup');
        if (!p || p.dataset.ngDone) return;
        p.dataset.ngDone = '1';
        p.innerHTML =
            '<button class="ng-popup-close" onclick="CloseLucciPopup(); ngCloseActivePopup();" aria-label="Close">' +
            '  <i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ng-popup-title"><i class="fa-solid fa-fan"></i> Ceiling Fan</div>' +
            '<div class="ng-seg-group">' +
            '  <button class="ng-seg-btn" onclick="LucciSendCommand(\'lo\')">' +
            '    <i class="fa-solid fa-fan"></i><span>Low</span></button>' +
            '  <button class="ng-seg-btn" onclick="LucciSendCommand(\'med\')">' +
            '    <i class="fa-solid fa-fan"></i><span>Med</span></button>' +
            '  <button class="ng-seg-btn" onclick="LucciSendCommand(\'hi\')">' +
            '    <i class="fa-solid fa-fan"></i><span>High</span></button>' +
            '</div>' +
            '<div class="ng-popup-row-2">' +
            '  <button class="ng-action-btn ng-action-btn--danger" onclick="LucciSendCommand(\'off\')">' +
            '    <i class="fa-solid fa-power-off"></i> Off</button>' +
            '  <button class="ng-action-btn" onclick="LucciSendCommand(\'light\')">' +
            '    <i class="fa-solid fa-lightbulb"></i> Light</button>' +
            '</div>';
    }

    function redesignLucciDCPopup() {
        var p = document.getElementById('lucci_dc_popup');
        if (!p || p.dataset.ngDone) return;
        p.dataset.ngDone = '1';
        p.innerHTML =
            '<button class="ng-popup-close" onclick="CloseLucciPopup(); ngCloseActivePopup();" aria-label="Close">' +
            '  <i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ng-popup-title"><i class="fa-solid fa-fan"></i> DC Fan</div>' +
            '<div class="ng-popup-row-2" style="padding-top:10px">' +
            '  <button class="ng-sp-btn" onclick="LucciSendCommand(\'min\')" aria-label="Slower">' +
            '    <i class="fa-solid fa-minus"></i></button>' +
            '  <button class="ng-action-btn ng-action-btn--danger" onclick="LucciSendCommand(\'pow\')">' +
            '    <i class="fa-solid fa-power-off"></i></button>' +
            '  <button class="ng-sp-btn" onclick="LucciSendCommand(\'plus\')" aria-label="Faster">' +
            '    <i class="fa-solid fa-plus"></i></button>' +
            '</div>' +
            '<button class="ng-seg-btn ng-seg-btn--full" onclick="LucciSendCommand(\'light\')">' +
            '  <i class="fa-solid fa-lightbulb"></i> Light</button>';
    }

    function redesignFalmecPopup() {
        var p = document.getElementById('falmec_popup');
        if (!p || p.dataset.ngDone) return;
        p.dataset.ngDone = '1';
        p.innerHTML =
            '<button class="ng-popup-close" onclick="CloseFalmecPopup(); ngCloseActivePopup();" aria-label="Close">' +
            '  <i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ng-popup-title"><i class="fa-solid fa-wind"></i> Kitchen Fan</div>' +
            '<div class="ng-seg-group">' +
            '  <button class="ng-seg-btn" onclick="FalmecSendCommand(\'1\')"><span class="ng-seg-num">1</span></button>' +
            '  <button class="ng-seg-btn" onclick="FalmecSendCommand(\'2\')"><span class="ng-seg-num">2</span></button>' +
            '  <button class="ng-seg-btn" onclick="FalmecSendCommand(\'3\')"><span class="ng-seg-num">3</span></button>' +
            '  <button class="ng-seg-btn" onclick="FalmecSendCommand(\'4\')"><span class="ng-seg-num">4</span></button>' +
            '</div>' +
            '<div class="ng-popup-row-2">' +
            '  <button class="ng-action-btn ng-action-btn--danger" onclick="FalmecSendCommand(\'poff\')">' +
            '    <i class="fa-solid fa-power-off"></i> Off</button>' +
            '  <button class="ng-action-btn" onclick="FalmecSendCommand(\'lon\')">' +
            '    <i class="fa-solid fa-lightbulb"></i> On</button>' +
            '  <button class="ng-action-btn" onclick="FalmecSendCommand(\'loff\')">' +
            '    <i class="fa-solid fa-lightbulb" style="opacity:.4"></i> Off</button>' +
            '</div>';
    }

    function redesignThermostat3Popup() {
        var p = document.getElementById('thermostat3_popup');
        if (!p || p.dataset.ngDone) return;
        p.dataset.ngDone = '1';
        p.innerHTML =
            // Keep original <a> anchors hidden — Domoticz's ShowTherm3PopupInt
            // attaches jQuery click handlers to them, our buttons delegate here.
            '<a id="popup_therm_on"  style="display:none"></a>' +
            '<a id="popup_therm_off" style="display:none"></a>' +

            '<button class="ng-popup-close" onclick="CloseTherm3Popup(); ngCloseActivePopup();" aria-label="Close">' +
            '  <i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ng-popup-title"><i class="fa-solid fa-sliders"></i> Motor Control</div>' +

            '<div class="ng-motor-grid">' +
            '  <div class="ng-motor-col">' +
            '    <span class="ng-motor-label">Motor 1</span>' +
            '    <button class="ng-motor-btn" id="ng-therm3-on" aria-label="On">' +
            '      <i class="fa-solid fa-power-off"></i></button>' +
            '    <button class="ng-motor-btn" onclick="ThermUp()" aria-label="Up">' +
            '      <i class="fa-solid fa-chevron-up"></i></button>' +
            '    <button class="ng-motor-btn ng-motor-btn--stop" onclick="ThermStop()" aria-label="Stop">' +
            '      <i class="fa-solid fa-stop"></i></button>' +
            '    <button class="ng-motor-btn" onclick="ThermDown()" aria-label="Down">' +
            '      <i class="fa-solid fa-chevron-down"></i></button>' +
            '    <button class="ng-motor-btn ng-motor-btn--off" id="ng-therm3-off" aria-label="Off">' +
            '      <i class="fa-regular fa-circle-xmark"></i></button>' +
            '  </div>' +
            '  <div class="ng-motor-divider"></div>' +
            '  <div class="ng-motor-col">' +
            '    <span class="ng-motor-label">Motor 2</span>' +
            '    <button class="ng-motor-btn" onclick="ThermUp2()" aria-label="Up 2">' +
            '      <i class="fa-solid fa-chevron-up"></i></button>' +
            '    <button class="ng-motor-btn" onclick="ThermDown2()" aria-label="Down 2">' +
            '      <i class="fa-solid fa-chevron-down"></i></button>' +
            '  </div>' +
            '</div>';

        // Delegate our on/off buttons to the hidden Domoticz anchor elements
        document.getElementById('ng-therm3-on').addEventListener('click', function () {
            var a = document.getElementById('popup_therm_on');
            if (a) a.click();
        });
        document.getElementById('ng-therm3-off').addEventListener('click', function () {
            var a = document.getElementById('popup_therm_off');
            if (a) a.click();
        });
    }

    function redesignRGBWPopup() {
        var p = document.getElementById('rgbw_popup');
        if (!p) return;

        /* ── State ──────────────────────────────────────────────────── */
        var _idx     = null;
        var _subType = 'RGB';
        var _mode    = 'color';   // 'color' | 'white'
        var _isRGBW  = false;
        var _h = 0, _s = 1, _v = 1;
        var _bright  = 100;
        var _warmth  = 0.5;       // 0 = cool white, 1 = warm white
        var WSIZE    = 200;       // canvas pixel size
        var WR       = WSIZE / 2; // wheel radius

        /* ── Colour math ─────────────────────────────────────────────── */
        function hsvToRgb(h, s, v) {
            var r, g, b, i = Math.floor(h * 6), f = h * 6 - i;
            var p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
            switch (i % 6) {
                case 0: r=v; g=t; b=p; break; case 1: r=q; g=v; b=p; break;
                case 2: r=p; g=v; b=t; break; case 3: r=p; g=q; b=v; break;
                case 4: r=t; g=p; b=v; break; default: r=v; g=p; b=q;
            }
            return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
        }

        function rgbToHsv(r, g, b) {
            r/=255; g/=255; b/=255;
            var max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
            var h, s=max===0?0:d/max, v=max;
            if (max===min) { h=0; }
            else {
                switch (max) {
                    case r: h=((g-b)/d+(g<b?6:0))/6; break;
                    case g: h=((b-r)/d+2)/6; break;
                    default: h=((r-g)/d+4)/6;
                }
            }
            return { h: h, s: s, v: v };
        }

        function warmthToRgb(w) {
            // w=0 → cool #E8F4FD, w=1 → warm #FFB347
            return {
                r: Math.round(232 + (255-232)*w),
                g: Math.round(244 + (179-244)*w),
                b: Math.round(253 + (71-253)*w)
            };
        }

        function toHex(n) { return ('0'+n.toString(16)).slice(-2); }

        /* ── Canvas wheel rendering ──────────────────────────────────── */
        function drawWheel(canvas) {
            var ctx = canvas.getContext('2d');
            var img = ctx.createImageData(WSIZE, WSIZE);
            var d = img.data;
            for (var y=0; y<WSIZE; y++) {
                for (var x=0; x<WSIZE; x++) {
                    var dx=x-WR, dy=y-WR, dist=Math.sqrt(dx*dx+dy*dy);
                    var i4=(y*WSIZE+x)*4;
                    if (dist > WR) { d[i4+3]=0; continue; }
                    var h=((Math.atan2(dy,dx)/(2*Math.PI))+1)%1;
                    var s=dist/WR;
                    var rgb=hsvToRgb(h,s,1);
                    d[i4]=rgb.r; d[i4+1]=rgb.g; d[i4+2]=rgb.b; d[i4+3]=255;
                }
            }
            ctx.putImageData(img, 0, 0);
        }

        function drawWheelCursor(canvas) {
            var ctx = canvas.getContext('2d');
            var angle = _h * 2 * Math.PI;
            var rad   = _s * (WR - 6);
            var cx = WR + rad * Math.cos(angle);
            var cy = WR + rad * Math.sin(angle);
            var rgb = hsvToRgb(_h, _s, 1);
            ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 2*Math.PI);
            ctx.fillStyle = 'rgb('+rgb.r+','+rgb.g+','+rgb.b+')';
            ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 2*Math.PI);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
        }

        function renderWheel(canvas) {
            drawWheel(canvas);
            drawWheelCursor(canvas);
        }

        /* ── Preview + slider update ─────────────────────────────────── */
        function updatePreview() {
            var swatch = p.querySelector('.ng-rgbw-swatch');
            var hexEl  = p.querySelector('.ng-rgbw-hex');
            var rgb;
            if (_mode === 'color') {
                rgb = hsvToRgb(_h, _s, 1);
                if (swatch) swatch.style.background =
                    'rgb('+rgb.r+','+rgb.g+','+rgb.b+')';
                if (hexEl) hexEl.textContent =
                    '#'+toHex(rgb.r)+toHex(rgb.g)+toHex(rgb.b);
            } else {
                rgb = warmthToRgb(_warmth);
                if (swatch) swatch.style.background =
                    'rgb('+rgb.r+','+rgb.g+','+rgb.b+')';
                if (hexEl) hexEl.textContent =
                    _warmth < 0.3 ? 'Cool white' : _warmth > 0.7 ? 'Warm white' : 'Natural';
            }
        }

        /* ── Warmth bar snippet (reused in both WW-only and RGBW white tab) ── */
        function warmthPaneHTML(canvasId) {
            return '<div class="ng-rgbw-warmth-wrap">' +
                   '  <canvas id="' + canvasId + '" width="240" height="36"' +
                   '    style="display:block;border-radius:18px;touch-action:none;cursor:crosshair"></canvas>' +
                   '</div>' +
                   '<div class="ng-rgbw-warmth-labels">' +
                   '  <span><i class="fa-solid fa-snowflake"></i> Cool</span>' +
                   '  <span>Warm <i class="fa-solid fa-fire"></i></span>' +
                   '</div>';
        }

        function brightnessRowHTML() {
            return '<div class="ng-rgbw-slider-row">' +
                   '  <i class="fa-solid fa-moon ng-rgbw-icon-dim"></i>' +
                   '  <input type="range" class="ng-rgbw-slider" id="ng-rgbw-bright" min="1" max="100" value="100">' +
                   '  <i class="fa-solid fa-sun ng-rgbw-icon-bright"></i>' +
                   '</div>';
        }

        function presetsHTML(includeColourPresets) {
            return '<div class="ng-rgbw-presets">' +
                   '  <button class="ng-rgbw-preset" onclick="ngRgbwPreset(\'on\',this)">' +
                   '    <i class="fa-solid fa-power-off"></i> On</button>' +
                   (includeColourPresets ?
                   '  <button class="ng-rgbw-preset" onclick="ngRgbwPreset(\'full\',this)">' +
                   '    <i class="fa-solid fa-lightbulb"></i> Full</button>' +
                   '  <button class="ng-rgbw-preset" onclick="ngRgbwPreset(\'night\',this)">' +
                   '    <i class="fa-solid fa-moon"></i> Night</button>' : '') +
                   '  <button class="ng-rgbw-preset ng-rgbw-preset--off" onclick="ngRgbwPreset(\'off\',this)">' +
                   '    <i class="fa-regular fa-circle-xmark"></i> Off</button>' +
                   '</div>';
        }

        /* ── Build popup HTML ────────────────────────────────────────── */
        // subType: 'RGB' | 'RGBW' | 'RGBWW' | 'RGBWWZ' | 'WW' | 'CW' | '' (fallback=RGB)
        function buildUI(subType) {
            _subType = subType || 'RGB';
            var isWWOnly  = (_subType === 'WW' || _subType === 'CW');
            var hasWhite  = !isWWOnly && (_subType === 'RGBW' || _subType === 'RGBWW' || _subType === 'RGBWWZ');
            _isRGBW = hasWhite;

            // For WW-only devices start in white mode
            if (isWWOnly) _mode = 'white';

            /* ── WW / CW — white-temperature only popup ── */
            if (isWWOnly) {
                p.innerHTML =
                    '<button class="ng-popup-close" onclick="ngCloseActivePopup();" aria-label="Close">' +
                    '  <i class="fa-solid fa-xmark"></i></button>' +
                    '<div class="ng-popup-title"><i class="fa-solid fa-lightbulb"></i> White Light</div>' +
                    '<div class="ng-rgbw-pane">' + warmthPaneHTML('ng-rgbw-warmth-canvas') + '</div>' +
                    '<div class="ng-rgbw-preview">' +
                    '  <div class="ng-rgbw-swatch"></div>' +
                    '  <span class="ng-rgbw-hex">Natural</span>' +
                    '</div>' +
                    brightnessRowHTML() +
                    presetsHTML(false) +
                    '<button class="ng-sp-set-btn" onclick="ngRgbwApply()">' +
                    '  <i class="fa-solid fa-check"></i> Set Light</button>';

                var wt = document.getElementById('ng-rgbw-warmth-canvas');
                if (wt) { drawWarmthBar(wt); attachWarmthInteraction(wt); }

            /* ── RGB / RGBW / RGBWW — colour popup (with optional White tab) ── */
            } else {
                var colorModeActive = (_mode !== 'white');
                p.innerHTML =
                    '<button class="ng-popup-close" onclick="ngCloseActivePopup();" aria-label="Close">' +
                    '  <i class="fa-solid fa-xmark"></i></button>' +
                    '<div class="ng-popup-title"><i class="fa-solid fa-palette"></i> Colour</div>' +

                    // Mode tabs — only shown for devices that have white channels too
                    (hasWhite ?
                    '<div class="ng-rgbw-tabs">' +
                    '  <button class="ng-rgbw-tab' + (colorModeActive ? ' ng-rgbw-tab--active' : '') + '" data-mode="color" onclick="ngRgbwSetMode(\'color\')">' +
                    '    <i class="fa-solid fa-circle-half-stroke"></i> Colour</button>' +
                    '  <button class="ng-rgbw-tab' + (!colorModeActive ? ' ng-rgbw-tab--active' : '') + '" data-mode="white" onclick="ngRgbwSetMode(\'white\')">' +
                    '    <i class="fa-solid fa-sun"></i> White</button>' +
                    '</div>' : '') +

                    // Colour wheel pane
                    '<div class="ng-rgbw-pane" id="ng-rgbw-pane-color"' + (!colorModeActive ? ' style="display:none"' : '') + '>' +
                    '  <div class="ng-rgbw-wheel-wrap">' +
                    '    <canvas id="ng-rgbw-canvas" width="' + WSIZE + '" height="' + WSIZE + '"' +
                    '      style="border-radius:50%;touch-action:none;cursor:crosshair;display:block"></canvas>' +
                    '  </div>' +
                    '</div>' +

                    // White temperature pane (only for RGBW/RGBWW)
                    (hasWhite ?
                    '<div class="ng-rgbw-pane" id="ng-rgbw-pane-white"' + (colorModeActive ? ' style="display:none"' : '') + '>' +
                    warmthPaneHTML('ng-rgbw-warmth-canvas') +
                    '</div>' : '') +

                    '<div class="ng-rgbw-preview">' +
                    '  <div class="ng-rgbw-swatch"></div>' +
                    '  <span class="ng-rgbw-hex">#ffffff</span>' +
                    '</div>' +
                    brightnessRowHTML() +
                    presetsHTML(true) +
                    '<button class="ng-sp-set-btn" onclick="ngRgbwApply()">' +
                    '  <i class="fa-solid fa-check"></i> Set Colour</button>';

                // Draw colour wheel
                var wc = document.getElementById('ng-rgbw-canvas');
                if (wc) { renderWheel(wc); attachWheelInteraction(wc); }

                // Draw warmth bar if applicable
                if (hasWhite) {
                    var wt2 = document.getElementById('ng-rgbw-warmth-canvas');
                    if (wt2) { drawWarmthBar(wt2); attachWarmthInteraction(wt2); }
                }
            }

            // Bind brightness slider
            var bright = document.getElementById('ng-rgbw-bright');
            if (bright) {
                bright.value = _bright;
                bright.addEventListener('input', function () {
                    _bright = parseInt(this.value, 10);
                });
            }

            updatePreview();
        }

        /* ── Warmth bar (for white mode) ─────────────────────────────── */
        function drawWarmthBar(canvas) {
            var ctx = canvas.getContext('2d');
            var g = ctx.createLinearGradient(0, 0, canvas.width, 0);
            g.addColorStop(0,   '#E8F4FD'); // cool 6500K
            g.addColorStop(0.5, '#FFF5E0'); // natural 4000K
            g.addColorStop(1,   '#FFB347'); // warm 2700K
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(0,0,canvas.width,canvas.height,16)
                          : ctx.rect(0,0,canvas.width,canvas.height);
            ctx.fill();
            drawWarmthCursor(canvas);
        }

        function drawWarmthCursor(canvas) {
            var ctx = canvas.getContext('2d');
            var x = _warmth * (canvas.width - 1);
            ctx.beginPath();
            ctx.arc(x, canvas.height/2, 12, 0, 2*Math.PI);
            var rgb = warmthToRgb(_warmth);
            ctx.fillStyle = 'rgb('+rgb.r+','+rgb.g+','+rgb.b+')';
            ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();
        }

        function attachWarmthInteraction(canvas) {
            var dragging = false;
            function pick(e) {
                var rect = canvas.getBoundingClientRect();
                var cx = e.touches ? e.touches[0].clientX : e.clientX;
                _warmth = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
                drawWarmthBar(canvas);
                updatePreview();
            }
            canvas.addEventListener('mousedown', function(e) { dragging=true; pick(e); });
            document.addEventListener('mousemove', function(e) { if (dragging) pick(e); });
            document.addEventListener('mouseup', function() { dragging=false; });
            canvas.addEventListener('touchstart', function(e) { dragging=true; pick(e); e.preventDefault(); }, { passive:false });
            document.addEventListener('touchmove', function(e) { if (dragging) { pick(e); e.preventDefault(); } }, { passive:false });
            document.addEventListener('touchend', function() { dragging=false; });
        }

        /* ── Wheel interaction ───────────────────────────────────────── */
        function attachWheelInteraction(canvas) {
            var dragging = false;
            function pick(e) {
                var rect  = canvas.getBoundingClientRect();
                var scale = WSIZE / (rect.width || WSIZE);
                var cx = e.touches ? e.touches[0].clientX : e.clientX;
                var cy = e.touches ? e.touches[0].clientY : e.clientY;
                var dx = (cx - rect.left)  * scale - WR;
                var dy = (cy - rect.top)   * scale - WR;
                var dist = Math.sqrt(dx*dx + dy*dy);
                _h = ((Math.atan2(dy, dx) / (2*Math.PI)) + 1) % 1;
                _s = Math.min(dist / WR, 1);
                drawWheel(canvas);
                drawWheelCursor(canvas);
                updatePreview();
            }
            canvas.addEventListener('mousedown', function(e) { dragging=true; pick(e); });
            document.addEventListener('mousemove', function(e) { if (dragging) pick(e); });
            document.addEventListener('mouseup', function() { dragging=false; });
            canvas.addEventListener('touchstart', function(e) { dragging=true; pick(e); e.preventDefault(); }, { passive:false });
            document.addEventListener('touchmove', function(e) { if (dragging) { pick(e); e.preventDefault(); } }, { passive:false });
            document.addEventListener('touchend', function() { dragging=false; });
        }

        /* ── Global functions (bound via onclick) ────────────────────── */
        window.ngRgbwSetMode = function (mode) {
            _mode = mode;
            var tabs = p.querySelectorAll('.ng-rgbw-tab');
            for (var i=0; i<tabs.length; i++) {
                tabs[i].classList.toggle('ng-rgbw-tab--active', tabs[i].dataset.mode === mode);
            }
            var cp = document.getElementById('ng-rgbw-pane-color');
            var wp = document.getElementById('ng-rgbw-pane-white');
            if (cp) cp.style.display = mode === 'color' ? '' : 'none';
            if (wp) wp.style.display = mode === 'white' ? '' : 'none';
            updatePreview();
        };

        function flashBtn(btn, label) {
            if (!btn) return;
            var orig = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> ' + (label || 'Applied!');
            btn.style.opacity = '0.7';
            setTimeout(function () {
                btn.innerHTML = orig;
                btn.style.opacity = '';
            }, 1200);
        }

        function sendRGBW() {
            if (!_idx) return;
            var colorObj;
            var isWWOnly = (_subType === 'WW' || _subType === 'CW');
            if (!isWWOnly && _mode === 'color') {
                // m=3: ColorModeRGB — valid fields: r, g, b
                var rgb = hsvToRgb(_h, _s, 1);
                colorObj = { m:3, t:0, r:rgb.r, g:rgb.g, b:rgb.b, cw:0, ww:0 };
            } else {
                // m=2: ColorModeTemp — valid field: t (0=cool 6500K, 255=warm 2700K)
                var t = Math.round(_warmth * 255);
                colorObj = { m:2, t:t, r:0, g:0, b:0,
                             cw: Math.round((1 - _warmth) * 255),
                             ww: Math.round(_warmth * 255) };
            }
            var url = '/json.htm?type=command&param=setcolbrightnessvalue' +
                      '&idx=' + _idx +
                      '&color=' + encodeURIComponent(JSON.stringify(colorObj)) +
                      '&brightness=' + _bright;
            fetch(url).catch(function() {});
        }

        window.ngRgbwPreset = function (preset, btn) {
            if (preset === 'on') {
                if (_idx) fetch('/json.htm?type=command&param=switchlight&idx=' + _idx + '&switchcmd=On').catch(function(){});
                flashBtn(btn, 'On');
            } else if (preset === 'off') {
                if (_idx) fetch('/json.htm?type=command&param=switchlight&idx=' + _idx + '&switchcmd=Off').catch(function(){});
                ngCloseActivePopup();
            } else if (preset === 'full') {
                // Full brightness — white/neutral for WW, near-white for RGB
                var isWW = (_subType === 'WW' || _subType === 'CW');
                if (isWW || _isRGBW) {
                    _mode = 'white'; _warmth = 0.5; _bright = 100;
                    if (_isRGBW) window.ngRgbwSetMode('white');
                    var wtc = document.getElementById('ng-rgbw-warmth-canvas');
                    if (wtc) { drawWarmthBar(wtc); }
                } else {
                    _h = 0.15; _s = 0.05; _bright = 100;
                    var wc2 = document.getElementById('ng-rgbw-canvas');
                    if (wc2) renderWheel(wc2);
                }
                var bs = document.getElementById('ng-rgbw-bright');
                if (bs) bs.value = 100;
                updatePreview();
                sendRGBW();
                flashBtn(btn, 'Applied');
            } else if (preset === 'night') {
                // Warm amber dim
                _mode = 'color'; _h = 0.08; _s = 0.85; _bright = 15;
                var wc3 = document.getElementById('ng-rgbw-canvas');
                if (wc3) renderWheel(wc3);
                var bs2 = document.getElementById('ng-rgbw-bright');
                if (bs2) bs2.value = 15;
                if (_isRGBW) window.ngRgbwSetMode('color');
                updatePreview();
                sendRGBW();
                flashBtn(btn, 'Applied');
            }
        };

        window.ngRgbwApply = function () {
            sendRGBW();
            // Flash the Set button — keep modal open so user can tweak
            var btn = p.querySelector('.ng-sp-set-btn');
            flashBtn(btn, 'Applied!');
        };

        /* ── Hook ShowRGBWPopup ──────────────────────────────────────── */
        // Actual Domoticz signature (domoticz.js):
        //   ShowRGBWPopup(event, idx, Protected, MaxDimLevel, LevelInt, color, SubType, DimmerType)
        // The first arg is the mouse/touch event — idx is the second arg.
        function hookShowRGBWPopup() {
            if (!window.ShowRGBWPopup) { setTimeout(hookShowRGBWPopup, 300); return; }
            if (window.ShowRGBWPopup._ngHooked) return;
            window.ShowRGBWPopup = function (event, idx, Protected, MaxDimLevel, LevelInt, color, SubType, DimmerType) {
                _idx = String(idx || '');

                // color is a JSON string from device.Color
                var col = {};
                try {
                    col = typeof color === 'string' ? JSON.parse(color) : (color || {});
                } catch (e) {}

                // ColorMode: 1=white, 2=colour-temperature, 3=RGB, 4=custom(RGB+white)
                _mode = (col.m === 1 || col.m === 2) ? 'white' : 'color';

                // Seed HSV from RGB channels
                if (col.r !== undefined || col.g !== undefined || col.b !== undefined) {
                    var hsv = rgbToHsv(col.r || 0, col.g || 0, col.b || 0);
                    _h = hsv.h; _s = hsv.s; _v = hsv.v;
                    if (_s < 0.05) _s = 0;
                }

                // Warmth from colour-temperature field (0-255 → 0-1)
                _warmth = col.t !== undefined ? col.t / 255 : 0.5;

                // Seed brightness from current device level (LevelInt is 0-100)
                _bright = (LevelInt !== undefined && LevelInt !== null)
                    ? Math.max(1, Math.min(100, parseInt(LevelInt, 10) || 100))
                    : 100;

                // Show popup — MutationObserver in initPopups picks this up and calls ngOpenPopup
                p.style.display = 'block';

                // Pass SubType directly so buildUI can choose the right layout
                buildUI(SubType || 'RGB');
            };
            window.ShowRGBWPopup._ngHooked = true;
        }

        hookShowRGBWPopup();
    }

    function redesignRFYPopup() {
        var p = document.getElementById('rfy_popup');
        if (!p || p.dataset.ngDone) return;
        p.dataset.ngDone = '1';
        p.innerHTML =
            '<button class="ng-popup-close" onclick="CloseRFYPopup(); ngCloseActivePopup();" aria-label="Close">' +
            '  <i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ng-popup-title"><i class="fa-solid fa-sun"></i> Sun/Wind Detector</div>' +
            '<button class="ng-rfy-btn ng-rfy-btn--enable" onclick="RFYEnableSunWind(1)">' +
            '  <i class="fa-solid fa-toggle-on"></i> Enable</button>' +
            '<button class="ng-rfy-btn ng-rfy-btn--disable" onclick="RFYEnableSunWind(0)">' +
            '  <i class="fa-solid fa-toggle-off"></i> Disable</button>';
    }

    /* ── Hook ShowSetpointPopupInt to sync arc after Domoticz populates values ── */

    function hookSetpointShow() {
        if (!window.ShowSetpointPopupInt) { setTimeout(hookSetpointShow, 300); return; }
        if (window.ShowSetpointPopupInt._ngHooked) return;
        var orig = window.ShowSetpointPopupInt;
        window.ShowSetpointPopupInt = function () {
            orig.apply(this, arguments);
            setTimeout(syncArcFromInput, 0);
        };
        window.ShowSetpointPopupInt._ngHooked = true;
    }

    /* ── Init ──────────────────────────────────────────────────────── */

    function initPopups() {
        redesignSetpointPopup();
        redesignIthoPopup();
        redesignLucciPopup();
        redesignLucciDCPopup();
        redesignFalmecPopup();
        redesignThermostat3Popup();
        redesignRFYPopup();
        redesignRGBWPopup();
        hookSetpointShow();

        // Watch each popup for Domoticz's native show/hide (jQuery Mobile)
        // so the overlay opens/closes automatically without needing to hook every show function
        var POPUP_IDS = ['setpoint_popup', 'thermostat3_popup', 'itho_popup',
                         'lucci_popup', 'lucci_dc_popup', 'falmec_popup', 'rfy_popup',
                         'rgbw_popup'];
        if (window.MutationObserver) {
            POPUP_IDS.forEach(function (id) {
                var el = document.getElementById(id);
                if (!el) return;
                new MutationObserver(function () {
                    var visible = el.style.display === 'block' ||
                        (el.style.display === '' &&
                         window.getComputedStyle(el).display !== 'none');
                    if (visible && _activePopupId !== id) {
                        ngOpenPopup(id);
                    } else if (!visible && _activePopupId === id) {
                        ngClosePopup(id);
                    }
                }).observe(el, { attributes: true, attributeFilter: ['style'] });
            });
        }
    }

    // Public API — callable from demo pages and Domoticz hooks without knowledge of internals
    window.ngShowSetpointArc = function (val, min, max, step, actualVal) {
        if (min  !== undefined) _spMin  = +min;
        if (max  !== undefined) _spMax  = +max;
        if (step !== undefined) _spStep = +step || 0.5;
        var inp = document.getElementById('popup_setpoint');
        var act = document.getElementById('actual_value');
        var actDisp = document.getElementById('ng-sp-actual');
        if (inp) inp.value = val;
        if (act) act.textContent = (actualVal !== undefined ? actualVal : val);
        if (actDisp) actDisp.textContent = (actualVal !== undefined ? actualVal : val);
        updateArc(+val);
        var disp = document.getElementById('ng-sp-display');
        if (disp) { disp.textContent = (+val).toFixed(1) + '°'; disp.style.color = tempColor(valToT(+val)); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPopups);
    } else {
        initPopups();
    }
})();


/* ── Feature 10: Live Toasts & Domoticz Notification Restyling ──────── */
(function () {
    'use strict';

    var MAX_TOASTS   = 4;
    var DEBOUNCE_MS  = 3000;   // suppress repeat toasts for the same device idx
    var _stack       = null;
    var _count       = 0;
    var _lastShown   = {};     // idx → timestamp

    /* ── Device-type → Font Awesome icon lookup ─────────────────── */
    var ICON_MAP = [
        ['Light',       'fa-lightbulb'],
        ['Switch',      'fa-toggle-on'],
        ['Dimmer',      'fa-lightbulb'],
        ['Scene',       'fa-layer-group'],
        ['Group',       'fa-layer-group'],
        ['Thermostat',  'fa-thermometer-half'],
        ['Setpoint',    'fa-thermometer-half'],
        ['Temp',        'fa-temperature-half'],
        ['Humidity',    'fa-droplet'],
        ['Motion',      'fa-person-running'],
        ['Door',        'fa-door-open'],
        ['Contact',     'fa-door-open'],
        ['Window',      'fa-window-maximize'],
        ['Smoke',       'fa-triangle-exclamation'],
        ['Fire',        'fa-fire-flame-curved'],
        ['Flood',       'fa-droplet'],
        ['Water',       'fa-droplet'],
        ['Gas',         'fa-fire-flame-curved'],
        ['Security',    'fa-shield-halved'],
        ['Alarm',       'fa-bell'],
        ['Fan',         'fa-fan'],
        ['Blind',       'fa-table-columns'],
        ['Curtain',     'fa-table-columns'],
        ['Shutter',     'fa-table-columns'],
        ['Lock',        'fa-lock'],
        ['Energy',      'fa-bolt'],
        ['Power',       'fa-bolt'],
        ['P1',          'fa-bolt'],
        ['Meter',       'fa-gauge'],
        ['Solar',       'fa-sun'],
        ['Wind',        'fa-wind'],
        ['Rain',        'fa-cloud-rain'],
        ['UV',          'fa-sun'],
        ['Air',         'fa-leaf'],
        ['Camera',      'fa-video'],
        ['Selector',    'fa-sliders'],
        ['Lux',         'fa-sun'],
        ['Sound',       'fa-volume-high'],
    ];

    /* ── Sensor/continuous types to skip in "meaningful" mode ───── */
    var SKIP_IN_MEANINGFUL = [
        'Temp', 'Humidity', 'Barometer', 'Wind', 'Rain', 'UV',
        'Forecast', 'Air Quality', 'Lux', 'Noise', 'Visibility',
        'P1 Smart Meter', 'YouLess Meter', 'Usage', 'Counter Incremental',
        'Waterflow', 'Distance', 'Current', 'Scale', 'Soil Temperature',
        'Radiation', 'Particulates'
    ];

    function iconFor(device) {
        var t = (device.Type || '') + ' ' + (device.SubType || '');
        for (var i = 0; i < ICON_MAP.length; i++) {
            if (t.toLowerCase().indexOf(ICON_MAP[i][0].toLowerCase()) !== -1) return ICON_MAP[i][1];
        }
        return 'fa-circle-dot';
    }

    function colorFor(device) {
        var s = (device.Status || device.Data || '').toLowerCase();
        if (/\bon\b|open|motion|active|alert|alarm|detected|locked/.test(s)) return 'var(--dz-accent)';
        if (/off|closed|no motion|normal|unlocked/.test(s)) return 'var(--dz-text-muted)';
        return 'var(--dz-accent)';
    }

    function isMeaningful(device) {
        var t = device.Type || '';
        return SKIP_IN_MEANINGFUL.every(function (s) {
            return t.toLowerCase().indexOf(s.toLowerCase()) === -1;
        });
    }

    /* ── Toast stack management ──────────────────────────────────── */

    function getStack() {
        if (_stack) return _stack;
        _stack = document.createElement('div');
        _stack.id = 'ng-toast-stack';
        document.body.appendChild(_stack);
        updateStackPosition();
        return _stack;
    }

    function updateStackPosition() {
        if (!_stack) return;
        var pos = (window.dzNightglassSettings && window.dzNightglassSettings.get('liveToastPosition')) || 'bottom-right';
        _stack.className = 'ng-toast-pos--' + pos;
    }
    window.ngUpdateToastPosition = updateStackPosition;

    function removeToast(el) {
        if (!el || !el.parentNode) return;
        el.classList.remove('ng-toast--visible');
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }

    /* ── Core toast renderer ─────────────────────────────────────── */
    function ngShowToast(opts) {
        var stack    = getStack();
        var duration = opts.duration !== undefined ? opts.duration
                     : ((window.dzNightglassSettings && +window.dzNightglassSettings.get('liveToastDuration')) || 4) * 1000;

        // Trim to max stack size (remove oldest = first child)
        var existing = stack.querySelectorAll('.ng-toast');
        if (existing.length >= MAX_TOASTS) removeToast(existing[0]);

        var id   = 'ng-toast-' + (++_count);
        var icon  = opts.icon  || 'fa-circle-dot';
        var color = opts.color || 'var(--dz-accent)';
        var title = opts.title || '';
        var body  = opts.body  || '';

        var el = document.createElement('div');
        el.id        = id;
        el.className = 'ng-toast ng-toast--' + (opts.type || 'device');
        el.style.setProperty('--ng-toast-color', color);
        el.innerHTML =
            '<div class="ng-toast-icon"><i class="fa-solid ' + icon + '"></i></div>' +
            '<div class="ng-toast-content">' +
            '<div class="ng-toast-title">' + title + '</div>' +
            (body ? '<div class="ng-toast-body">' + body + '</div>' : '') +
            '</div>' +
            '<button class="ng-toast-close" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ng-toast-progress"></div>';

        el.querySelector('.ng-toast-close').addEventListener('click', function () { removeToast(el); });

        stack.appendChild(el);

        // Animate in (needs reflow first)
        el.offsetHeight;
        el.classList.add('ng-toast--visible');

        // Drain progress bar
        var progress  = el.querySelector('.ng-toast-progress');
        var remaining = duration;
        var startedAt = Date.now();
        var timerId;

        function startDrain(ms) {
            progress.offsetHeight;
            progress.style.transition = 'width ' + (ms / 1000).toFixed(2) + 's linear';
            progress.style.width = '0%';
            timerId = setTimeout(function () { removeToast(el); }, ms);
        }

        el.addEventListener('mouseenter', function () {
            clearTimeout(timerId);
            remaining = Math.max(0, remaining - (Date.now() - startedAt));
            progress.style.transition = 'none';
            progress.style.width = ((remaining / duration) * 100).toFixed(1) + '%';
        });
        el.addEventListener('mouseleave', function () {
            startedAt = Date.now();
            startDrain(remaining);
        });

        startDrain(duration);
        return el;
    }
    window.ngShowToast = ngShowToast;

    /* ── Only notify for devices currently visible on screen ────── */

    function isDeviceVisible(idx) {
        var s = String(idx || '');
        if (!s) return false;
        var cards = document.querySelectorAll('div.item.itemBlock, .itemBlock > div.item');
        for (var i = 0; i < cards.length; i++) {
            if (window.angular) {
                try {
                    var scope = angular.element(cards[i]).scope();
                    if (scope) {
                        var item = scope.item || scope.device || scope.widget;
                        if (item && String(item.idx) === s) return true;
                    }
                } catch (e) {}
            }
            var tbl = cards[i].querySelector('table[id^="itemtable"]');
            if (tbl) {
                var m = tbl.id.match(/\d+/);
                if (m && m[0] === s) return true;
            }
        }
        return false;
    }

    /* ── Device update handler (Angular $rootScope hook) ─────────── */

    function onDeviceUpdate(device) {
        if (!window.dzNightglassSettings || !window.dzNightglassSettings.get('liveToasts')) return;
        var filter = (window.dzNightglassSettings && window.dzNightglassSettings.get('liveToastFilter')) || 'meaningful';
        if (filter === 'meaningful' && !isMeaningful(device)) return;

        // Per-device debounce
        var idx = String(device.idx || device.ID || '');

        // Blacklist check
        try {
            var bl = JSON.parse(window.dzNightglassSettings.get('toastBlacklist') || '[]');
            if (bl.indexOf(idx) !== -1) return;
        } catch (e) {}
        var now = Date.now();
        if (idx && _lastShown[idx] && (now - _lastShown[idx]) < DEBOUNCE_MS) return;

        // Only show a toast if the device has a card on the current page
        if (!isDeviceVisible(idx)) return;

        if (idx) _lastShown[idx] = now;

        ngShowToast({
            icon:  iconFor(device),
            color: colorFor(device),
            title: device.Name || ('Device ' + idx),
            body:  device.Status || device.Data || '',
            type:  'device'
        });
    }

    /* ── Angular $rootScope hooks ────────────────────────────────── */

    function attachAngularHooks() {
        if (!window.angular) { setTimeout(attachAngularHooks, 600); return; }
        var bodyEl = angular.element(document.body);
        if (!bodyEl || !bodyEl.injector || !bodyEl.injector()) { setTimeout(attachAngularHooks, 400); return; }
        try {
            var $rootScope = bodyEl.injector().get('$rootScope');
            $rootScope.$on('device_update', function (event, device) { onDeviceUpdate(device); });
            $rootScope.$on('notification',  function (event, notif)  {
                ngShowToast({
                    icon:     'fa-bell',
                    color:    'var(--dz-accent)',
                    title:    notif.Subject || notif.title || 'Notification',
                    body:     notif.Text    || notif.body  || '',
                    type:     'alert',
                    duration: 6000
                });
            });
        } catch (e) {
            setTimeout(attachAngularHooks, 600);
        }
    }

    /* ── Intercept & replace Domoticz's Bootstrap .alert divs ───── */

    function interceptAlert(alertEl) {
        if (!alertEl || alertEl._ngDone) return;
        if (!alertEl.classList.contains('alert-dismissable') &&
            !alertEl.classList.contains('alert-dismissible')) return;
        alertEl._ngDone = true;

        var labelEl = alertEl.querySelector('label');
        var bodyEl  = alertEl.querySelector('div');
        var title   = labelEl ? labelEl.textContent.trim() : '';
        var body    = bodyEl  ? bodyEl.textContent.trim()  : '';
        if (!title && !body) body = alertEl.textContent.replace('×', '').trim();

        var TYPE_MAP = {
            'alert-danger':  { type: 'error',   icon: 'fa-circle-xmark',        color: 'var(--dz-danger)'  },
            'alert-warning': { type: 'warning',  icon: 'fa-triangle-exclamation', color: 'var(--dz-warning)' },
            'alert-success': { type: 'success',  icon: 'fa-circle-check',        color: 'var(--dz-success)' }
        };
        var match = { type: 'info', icon: 'fa-circle-info', color: 'var(--dz-accent)' };
        Object.keys(TYPE_MAP).forEach(function (cls) {
            if (alertEl.classList.contains(cls)) match = TYPE_MAP[cls];
        });

        ngShowToast({ icon: match.icon, color: match.color, title: title, body: body, type: match.type, duration: 5000 });

        var container = alertEl.closest('.alerts');
        alertEl.remove();
        if (container && !container.children.length) container.remove();
    }

    function watchForAlerts() {
        if (!window.MutationObserver) return;
        new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                m.addedNodes.forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    if (node.classList && node.classList.contains('alert')) {
                        interceptAlert(node);
                    } else {
                        node.querySelectorAll && node.querySelectorAll('.alert').forEach(interceptAlert);
                    }
                });
            });
        }).observe(document.body, { childList: true, subtree: true });
    }

    /* ── Hook Domoticz's own notification systems ────────────────── */

    // 1) ShowNotify — centered #notification div (info/error messages)
    function hookShowNotify() {
        if (!window.ShowNotify || window.ShowNotify._ngHooked) return false;
        window.ShowNotify = function (txt, ntype) {
            var err = ntype && /error/i.test(ntype);
            ngShowToast({
                icon:     err ? 'fa-circle-xmark'  : 'fa-circle-info',
                color:    err ? 'var(--dz-danger)' : 'var(--dz-accent)',
                title:    err ? 'Error'            : 'Notification',
                body:     txt ? txt.replace(/<[^>]*>/g, '').trim() : '',
                type:     err ? 'error' : 'info',
                duration: 5000
            });
            // Suppress the original #notification div
            var el = document.getElementById('notification');
            if (el) { el.style.display = 'none'; el.style.opacity = '0'; }
        };
        window.ShowNotify._ngHooked = true;
        return true;
    }

    // 2) generate_noty — Noty library toasts (used for most in-app feedback)
    function hookGenerateNoty() {
        if (!window.generate_noty || window.generate_noty._ngHooked) return false;
        window.generate_noty = function (ntype, ntext, ntimeout) {
            var MAP = {
                success:     { icon: 'fa-circle-check',         color: 'var(--dz-success)' },
                warning:     { icon: 'fa-triangle-exclamation', color: 'var(--dz-warning)' },
                error:       { icon: 'fa-circle-xmark',         color: 'var(--dz-danger)'  },
                alert:       { icon: 'fa-triangle-exclamation', color: 'var(--dz-warning)' }
            };
            var m = MAP[ntype] || { icon: 'fa-circle-info', color: 'var(--dz-accent)' };
            var label = (ntype || 'info');
            label = label.charAt(0).toUpperCase() + label.slice(1);
            ngShowToast({
                icon:     m.icon,
                color:    m.color,
                title:    label,
                body:     ntext ? ntext.replace(/<[^>]*>/g, '').trim() : '',
                type:     ntype || 'info',
                duration: ntimeout || 5000
            });
        };
        window.generate_noty._ngHooked = true;
        return true;
    }

    // 3) ShowUpdateNotification — fired when a new Domoticz version is available
    function hookUpdateNotification() {
        if (!window.ShowUpdateNotification || window.ShowUpdateNotification._ngHooked) return false;
        window.ShowUpdateNotification = function (revision, systemName) {
            ngShowToast({
                icon:     'fa-circle-arrow-up',
                color:    'var(--dz-warning)',
                title:    'Update Available',
                body:     'Domoticz ' + (revision || 'new version') + ' is ready to install',
                type:     'warning',
                duration: 12000
            });
        };
        window.ShowUpdateNotification._ngHooked = true;
        return true;
    }

    // Poll until each function is defined then hook it (Domoticz.js loads asynchronously)
    function hookDomoticzNotifications() {
        var pending = [hookShowNotify, hookGenerateNoty, hookUpdateNotification];
        // Try immediately
        pending = pending.filter(function (fn) { return !fn(); });
        if (!pending.length) return;
        var attempts = 0;
        var iv = setInterval(function () {
            pending = pending.filter(function (fn) { return !fn(); });
            if (!pending.length || ++attempts > 120) clearInterval(iv);
        }, 500);
    }

    /* ── Init ────────────────────────────────────────────────────── */

    function init() {
        watchForAlerts();
        attachAngularHooks();
        hookDomoticzNotifications();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
