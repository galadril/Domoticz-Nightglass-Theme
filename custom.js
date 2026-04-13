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

    /* Apply saved preference as early as possible — but body may be null if
       the script runs in <head>, so guard with a readyState check. */
    function applyStoredTheme() {
        if (localStorage.getItem(STORAGE_KEY) === 'light') {
            document.body.classList.add(LIGHT_CLASS);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyStoredTheme);
    } else {
        applyStoredTheme();
    }

    function updateBtn(light) {
        var a = document.getElementById('dz-theme-style-btn');
        if (!a) return;
        var icon = a.querySelector('i');
        if (icon) icon.className = light ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
        a.title = light ? 'Switch to dark mode' : 'Switch to light mode';
        a.setAttribute('aria-pressed', light ? 'true' : 'false');
        a.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
    }

    function toggle() {
        var nowLight = !document.body.classList.contains(LIGHT_CLASS);
        if (nowLight) {
            document.body.classList.add(LIGHT_CLASS);
        } else {
            document.body.classList.remove(LIGHT_CLASS);
        }
        localStorage.setItem(STORAGE_KEY, nowLight ? 'light' : 'dark');
        updateBtn(nowLight);
        applyHighchartsTheme(!nowLight);
    }

    function injectToggle() {
        if (document.getElementById('dz-theme-style-nav')) return;
        var inner = document.querySelector('.navbar-inner');
        if (!inner) return;

        var light = document.body.classList.contains(LIGHT_CLASS);
        var a = document.createElement('a');
        a.id = 'dz-theme-style-btn';
        a.href = 'javascript:void(0)';
        a.title = light ? 'Switch to dark mode' : 'Switch to light mode';
        a.setAttribute('role', 'button');
        a.setAttribute('aria-pressed', light ? 'true' : 'false');
        a.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode');
        var icon = document.createElement('i');
        icon.className = light ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
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
        'images/arrow_stable.png': 'fa-solid fa-minus',
        'images/arrow_unk.png':    'fa-solid fa-question',

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
    var ALERT_COLORS = ['#4caf7d', '#f0a832', '#ff7043', '#e05555', '#e05555'];

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
       state icon).  Action buttons live inside popups/dialogs or in the
       2nd / 3rd icon columns of double/triple-icon rows (scenes, groups,
       blinds).  These should never get the optimistic click-toggle.     */

    function isActionButton(img) {
        /* Inside a popup / dialog overlay */
        if (img.closest && img.closest('#rgbw_popup, #rfy_popup, #setpoint_popup')) return true;
        /* 2nd / 3rd icon cell in scene/group/blind rows (td#img2, td#img3) */
        var td = img.parentElement;
        if (td && td.tagName === 'TD') {
            var id = td.getAttribute('id');
            if (id === 'img2' || id === 'img3') return true;
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
        setTimeout(function () {
            if (!node || node.nodeType !== 1) return;
            if (node.tagName === 'IMG') {
                if (node.parentNode) processImg(node);
                return;
            }
            replaceIcons(node);
        }, 0);
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
    if (window.$) {
        $(document).on('draw.dt', function () {
            scheduleBurst();
        });
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            if (window.$) {
                $(document).on('draw.dt', function () {
                    scheduleBurst();
                });
            }
        });
    }
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
        if (needsUpdate && typeof scheduleBurst === 'function') scheduleBurst();
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
                if (needsUpdate && typeof scheduleBurst === 'function') scheduleBurst();
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
