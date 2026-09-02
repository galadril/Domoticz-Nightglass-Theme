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
        'text':            { icon: 'fa-solid fa-align-left',          on: '#b0b3c6', off: null },
        'alert':           { icon: 'fa-solid fa-circle-exclamation',  on: '#e05555', off: null },
        'clock':           { icon: 'fa-solid fa-clock',               on: '#4e9af1', off: '#555770' },
        'mode':            { icon: 'fa-solid fa-sliders',             on: '#4e9af1', off: null },
        'doorbell':        { icon: 'fa-solid fa-bell',                on: '#f0a832', off: null },
        'adjust':          { icon: 'fa-solid fa-sliders',             on: '#4e9af1', off: null },
        'custom':          { icon: 'fa-solid fa-gear',                on: '#b0b3c6', off: '#555770' },

        /* Scenes & groups */
        'scene':           { icon: 'fa-solid fa-layer-group',        on: '#4caf7d', off: '#555770' },
        'group':           { icon: 'fa-solid fa-layer-group',        on: '#4caf7d', off: '#555770' }
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

    /* Non-English compass abbreviations → English equivalent.
       Dutch : Z=Zuid(South), O=Oost(East)  e.g. BuienRadar plugin
       German: O=Ost(East), S already matches                       */
    var WIND_ALIASES = {
        'Z': 'S', 'O': 'E',
        'ZO': 'SE',  'ZW': 'SW',  'NO': 'NE',
        'NNO': 'NNE', 'ONO': 'ENE', 'OZO': 'ESE',
        'ZZO': 'SSE', 'ZZW': 'SSW', 'WZW': 'WSW',
        /* German SE variants */
        'SO': 'SE', 'OSO': 'ESE', 'SSO': 'SSE'
    };

    /* The letter O is ambiguous across languages and the two readings are
       exact opposites: Oost/Ost (East) in Dutch and German, Ouest/Oeste/
       Ovest (West) in the Romance languages.  Treating every feed as
       Dutch/German sent French easterlies pointing west (issue #257), so
       the O-based abbreviations get a second table picked by the
       Domoticz UI language.                                          */
    var WIND_ALIASES_O_WEST = {
        'O': 'W',
        'NO': 'NW',   'SO': 'SW',
        'NNO': 'NNW', 'ONO': 'WNW', 'OSO': 'WSW', 'SSO': 'SSW'
    };

    /* Languages where O = West.  fr Ouest, es/pt/gl Oeste, it Ovest,
       ca Oest, ro Vest but Nord-Ovest style pairs still use O.       */
    var O_IS_WEST_LANGS = { fr: 1, es: 1, pt: 1, it: 1, ca: 1, gl: 1, ro: 1 };

    /* Domoticz's language, as a plain ISO 639-1 code.  $.i18n is i18next
       1.8.0, loaded by Domoticz itself; navigator.language covers the
       window before it has initialised.                              */
    function dzLang() {
        try {
            var lng = window.jQuery && jQuery.i18n &&
                      typeof jQuery.i18n.lng === 'function' && jQuery.i18n.lng();
            if (lng && lng !== 'cimode') return String(lng).toLowerCase().slice(0, 2);
        } catch (e) { /* i18n not ready */ }
        return String(navigator.language || '').toLowerCase().slice(0, 2);
    }

    /* Compass abbreviation (any language) → English abbreviation. */
    function windDirToEnglish(str) {
        var s = String(str == null ? '' : str).toUpperCase().replace(/[^A-Z]/g, '');
        if (!s) return null;
        if (O_IS_WEST_LANGS[dzLang()] && WIND_ALIASES_O_WEST[s]) {
            return WIND_ALIASES_O_WEST[s];
        }
        return WIND_ALIASES[s] || s;
    }

    /* Rotation in degrees for a compass abbreviation, or null when the
       letters resolve to nothing we know. */
    function windRotationFromStr(str) {
        var eng = windDirToEnglish(str);
        var rot = eng ? WIND_ROTATION[eng] : undefined;
        return (rot === undefined) ? null : rot;
    }

    /* Rotation for an icon.  device.Direction is the true bearing in
       degrees and carries no language at all, so prefer it and fall back
       to the letters only for feeds that publish nothing else.        */
    function windRotationForIcon(el, dirStr) {
        var d = getDeviceFromIcon(el);
        if (d) {
            var deg = parseFloat(d.Direction);
            if (!isNaN(deg)) return ((deg % 360) + 360) % 360;
        }
        return windRotationFromStr(dirStr);
    }

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

    /* -- Angular scope helper: get the device object for a DOM node --
       Walks up the DOM at click-time (lazy) so there are no race
       conditions with Angular's multi-cycle render.                  */
    function getDeviceFromIcon(el) {
        if (!window.angular) return null;
        var node = el;
        while (node && node !== document.body) {
            try {
                var $el = angular.element(node);
                /* dzLightWidget / dzUtilityWidget are ISOLATE-scope directives
                   (scope:{…}, controllerAs 'ctrl').  For their template children
                   .scope() returns the surrounding NON-isolate scope, which has
                   no ctrl.device — so also probe .isolateScope() on the directive
                   element. Checking both is why overrides now reach dimmers /
                   Color Switches (issue #191). */
                var scopes = [
                    $el.scope       ? $el.scope()       : null,
                    $el.isolateScope ? $el.isolateScope() : null
                ];
                for (var s = 0; s < scopes.length; s++) {
                    var scope = scopes[s];
                    if (!scope) continue;
                    var d = (scope.ctrl && scope.ctrl.device) ||
                             scope.device || scope.item || scope.widget;
                    if (d && d.Type !== undefined) return d;
                }
            } catch (e) {}
            node = node.parentElement;
        }
        return null;
    }

    /* Resolve a device IDX for an icon without relying on Angular scope.
       Domoticz stamps the idx on the widget DOM: the card is
       <div class="item itemBlock" id="{{idx}}"> and the name cell carries
       data-idx. Used as a robust fallback when getDeviceFromIcon() can't
       reach the device object (issue #191). */
    function deviceIdxFromDom(img) {
        if (!img || !img.closest) return '';
        var card = img.closest('.item.itemBlock, .itemBlock');
        if (card) {
            var cid = card.getAttribute('id') || '';
            if (/^\d+$/.test(cid)) return cid;
        }
        var table = img.closest('table');
        if (table) {
            var nameCell = table.querySelector('td#name[data-idx]');
            if (nameCell) {
                var di = nameCell.getAttribute('data-idx') || '';
                if (/^\d+$/.test(di)) return di;
            }
        }
        return '';
    }

    /* Best-effort device IDX for an icon: Angular device object first
       (also yields Type/SwitchType for other callers), DOM stamp second. */
    function deviceIdxForIcon(img) {
        var d = getDeviceFromIcon(img);
        if (d) {
            var i = String(d.idx || d.IDX || '');
            if (i) return i;
        }
        return deviceIdxFromDom(img);
    }

    /* -- Determines whether clicking the device icon should optimistically
       swap the on/off color before the API response arrives.
       Only true for devices where the click sends a genuine binary
       toggle command (isActive ? Off : On).
       Source reference: www/app/widgets/dzLightWidget.js             */
    function isDirectToggle(d) {
        if (!d) return false;

        // Only light-family types — everything else (Temperature, Humidity,
        // Wind, Rain, UV, P1, General…) is a read-only utility/sensor widget.
        // Scenes and Groups are excluded: they render two separate on/off
        // action buttons; the single icon does not represent toggleable state.
        var lightTypes = ['Light/Switch', 'Lighting 1', 'Lighting 2',
                          'Lighting 5', 'Lighting 6', 'Color Switch',
                          'Chime', 'Home Confort'];
        if (lightTypes.indexOf(d.Type) < 0) return false;

        // Read-only sensors — isClickable() returns false
        var readOnly = ['Door Contact', 'Contact', 'Motion Sensor', 'Dusk Sensor'];
        if (readOnly.indexOf(d.SwitchType) >= 0) return false;

        // Push On / Push Off always send a fixed command, they don't toggle state
        if (d.SwitchType === 'Push On Button' || d.SwitchType === 'Push Off Button') return false;

        // Doorbell — momentary push signal, not a persistent on/off state
        if (d.SwitchType === 'Doorbell') return false;

        // X10 Siren / Smoke Detector — alarm signals, not meaningful on/off toggles
        if (d.SwitchType === 'X10 Siren' || d.SwitchType === 'Smoke Detector') return false;

        // Security devices — complex arm/disarm logic, not a simple on/off flip
        if (d.Type === 'Security') return false;

        // TPI only active within unit range 64–95
        if (d.SwitchType === 'TPI' && (d.Unit < 64 || d.Unit > 95)) return false;

        // Fan subtypes → opens specialized popup
        if (d.SubType) {
            var sub = d.SubType;
            if (sub.indexOf('Itho')         === 0 || sub.indexOf('Orcon')       === 0 ||
                sub.indexOf('Lucci Air DC') === 0 || sub.indexOf('Lucci')       === 0 ||
                sub.indexOf('Westinghouse') === 0 || sub.indexOf('Falmec')      === 0) {
                return false;
            }
        }

        // Thermostat 3 → ShowTherm3Popup
        if (d.Type === 'Thermostat 3') return false;

        // RGB / RGBW dimmers → ShowRGBWPopup; state changes come from the
        // dialog and are reflected by the MutationObserver on img src change —
        // no optimistic toggle needed on the icon click itself
        var dimmerTypes = ['Dimmer', 'Blinds Percentage', 'Blinds % + Stop', 'TPI'];
        if (dimmerTypes.indexOf(d.SwitchType) >= 0) {
            var isRGB = d.SubType &&
                        (d.SubType.indexOf('RGB') >= 0 || d.SubType.indexOf('WW') >= 0);
            if (isRGB) return false;
            // Non-RGB dimmers fall through: clicking them does toggle on/off
        }

        // Selector → level-based, not a binary on/off toggle
        if (d.SwitchType === 'Selector') return false;

        // Blinds (all variants) → directional (up/down/stop), not on/off
        if (d.SwitchType && d.SwitchType.indexOf('Blinds') >= 0) return false;
        if (d.SwitchType === 'Venetian Blinds US' ||
            d.SwitchType === 'Venetian Blinds EU') return false;

        // Everything else in the light-family: standard On/Off switches,
        // Door Lock / Door Lock Inverted, non-RGB dimmers, Media Player, Chime
        return true;
    }

    /* ── SVG floorplan icon replacement ───────────────────────────
       Domoticz floorplans render device icons as SVG <image> elements
       (xlink:href), not HTML <img> (src).  We replace them with SVG
       <foreignObject> containers holding FA <i> elements so the icon
       set stays consistent with every other page.
       When Domoticz updates a device's state it replaces the entire
       <image> element (not just its href), so the MutationObserver
       childList path already handles live updates.                    */

    var XLINK_NS = 'http://www.w3.org/1999/xlink';

    function getSVGHref(el) {
        return el.getAttribute('href') ||
               el.getAttributeNS(XLINK_NS, 'href') ||
               el.getAttribute('xlink:href') || '';
    }

    function processSVGImageEl(el) {
        if (!el || el.nodeName.toLowerCase() !== 'image') return false;
        if (el.getAttribute('data-dz-replaced') ||
            el.getAttribute('data-dz-skipped'))  return false;

        var src = getSVGHref(el);
        if (!src || src.indexOf('{{') !== -1) return false;

        if (shouldSkip(src)) {
            el.setAttribute('data-dz-skipped', 'true');
            return false;
        }

        var resolved = resolveIcon(src);
        if (!resolved) {
            el.setAttribute('data-dz-skipped', 'true');
            return false;
        }

        var w      = parseFloat(el.getAttribute('width')  || 32);
        var h      = parseFloat(el.getAttribute('height') || w);
        var x      = parseFloat(el.getAttribute('x') || 0);
        var y      = parseFloat(el.getAttribute('y') || 0);
        var iconPx = Math.round(Math.min(w, h) * 0.72);

        // Visually hide the original but keep it interactive so drag-and-drop
        // in floorplan edit mode still works (opacity:0 is still hit-testable
        // in SVG; pointer-events must NOT be none here).
        el.style.opacity = '0';
        el.setAttribute('data-dz-replaced', 'true');
        el.setAttribute('data-dz-orig-href', src);

        // <foreignObject> hosts an HTML <i> inside SVG.
        // pointer-events:none makes it purely visual so events fall through
        // to the underlying <image> element (needed for drag-and-drop in
        // floorplan edit mode).
        var fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        fo.setAttribute('x',       x);
        fo.setAttribute('y',       y);
        fo.setAttribute('width',   w);
        fo.setAttribute('height',  h);
        fo.setAttribute('overflow', 'visible');
        fo.setAttribute('class',   'dz-fp-icon-wrap');
        fo.style.pointerEvents = 'none';

        // Copy interactive attributes so floorplan device popups still trigger
        ['onclick', 'onmouseover', 'onmouseout', 'ontouchstart', 'ontouchend'].forEach(function (a) {
            var v = el.getAttribute(a);
            if (v) fo.setAttribute(a, v);
        });
        var cStyle = (el.getAttribute('style') || '').match(/cursor\s*:\s*([^;]+)/);
        fo.style.cursor = cStyle ? cStyle[1].trim() : 'pointer';

        var iEl = document.createElement('i');
        iEl.className = resolved.cls;
        if (resolved.colorOn)  iEl.setAttribute('data-dz-color-on',  resolved.colorOn);
        if (resolved.colorOff) iEl.setAttribute('data-dz-color-off', resolved.colorOff);
        iEl.setAttribute('data-dz-state', resolved.color === resolved.colorOn ? 'on' : 'off');
        iEl.style.cssText = [
            'font-size:'    + iconPx + 'px',
            'color:'        + (resolved.color || '#b0b3c6'),
            'width:'        + w + 'px',
            'height:'       + h + 'px',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'pointer-events:none',
            'box-sizing:border-box',
            'margin:0',
            'padding:0'
        ].join(';');

        fo.appendChild(iEl);
        iconMap.set(el, fo);

        /* Remove any leftover overlay before inserting the fresh one.
           Domoticz redraws a floorplan device by replaceChild()-ing a brand
           new <image> node over the old one on every state refresh AND on
           every hover (Device.popup → popupRedraw → htmlMinimum).  The old
           <image>'s foreignObject overlay is left behind as the new node's
           sibling, so without this the theme icon and the original PNG stack
           on top of each other — visible as a double icon, especially on
           hover (issue #209).  iconMap-based orphan cleanup can miss this
           when the removed node was never tracked, so we also clear it by
           DOM adjacency here, which is unconditionally correct. */
        var adj = el.nextElementSibling;
        while (adj && adj.getAttribute &&
               (adj.getAttribute('class') || '').indexOf('dz-fp-icon-wrap') !== -1) {
            var nextAdj = adj.nextElementSibling;
            adj.parentNode.removeChild(adj);
            adj = nextAdj;
        }

        el.parentNode.insertBefore(fo, el.nextSibling);
        return true;
    }

    function replaceSVGIcons(root) {
        if (!root || !root.querySelectorAll) return;
        /* querySelector('image') selects SVG <image> elements */
        var svgImgs = root.querySelectorAll(
            'image:not([data-dz-replaced]):not([data-dz-skipped])');
        for (var i = 0; i < svgImgs.length; i++) {
            processSVGImageEl(svgImgs[i]);
        }
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
        /* Action buttons in table rows.
           Use '/up.' and '/down.' (with path separator) to avoid false-
           positives on 'setup.png' which contains the substring 'up.'. */
        if (src.indexOf('delete.') !== -1 ||
            src.indexOf('rename.') !== -1 ||
            src.indexOf('remove.') !== -1 ||
            src.indexOf('add.')    !== -1 ||
            src.indexOf('/up.')    !== -1 ||
            src.indexOf('/down.')  !== -1 ||
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
            /* Keep the raw letters: they are only meaningful once the UI
               language is known, and the device's own bearing in degrees
               beats them anyway — both are handled at rotation time. */
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

    /* ── Per-device icon overrides ─────────────────────────────────
       Keyed by device IDX string.
       Schema: { iconOn, iconOff?, iconOpen?, iconClose?, iconStop?,
                 on, off, keepColor?, anim?, name }
       Legacy field 'icon' is treated as iconOn for backward compat.
       Populated by the settings module via window._dzSetDeviceIconOverrides. */
    var DEVICE_ICON_OVERRIDES = {};

    /* ── Icon animations ───────────────────────────────────────────
       The animations themselves are section 25 of animations.css; all this
       side owns is which one an icon carries.  Named for the job rather
       than for the motion, because the choice is made per device.

       Why this lives in the theme's override blob and not on the device:
       Domoticz's own Icon column is server-validated to {"t","on","off"}
       and capped at 512 chars (NormaliseDeviceIcon()), so an extra key
       would come straight back as "Invalid icon".  Icon identity is the
       device's; colour and motion are presentation and stay ours. */
    var ICON_ANIMATIONS = [
        { id: 'spin',    label: 'Spin',    hint: 'Fans, motors, pumps' },
        { id: 'breathe', label: 'Breathe', hint: 'Motion, presence, heart rate' },
        { id: 'flicker', label: 'Flicker', hint: 'Flame, candle, fireplace' },
        { id: 'ring',    label: 'Ring',    hint: 'Bells, sirens, alarms' },
        { id: 'bounce',  label: 'Bounce',  hint: 'Doorbells, notifications' },
        { id: 'glow',    label: 'Glow',    hint: 'Lights, lamps, strips' },
        { id: 'blink',   label: 'Blink',   hint: 'Recording, faults' },
        { id: 'swing',   label: 'Swing',   hint: 'Doors, gates, blinds' },
        { id: 'drift',   label: 'Drift',   hint: 'Wind, water, air quality' }
    ];
    var ANIM_PREFIX = 'dz-anim-';
    var ANIM_KNOWN = {};
    ICON_ANIMATIONS.forEach(function (a) { ANIM_KNOWN[a.id] = true; });

    /* The catalogue is read by the Icon Studio (tiles + previews), the
       settings panel and the device icon field, so it is published once
       here rather than transcribed into each of them. */
    window.dzIconAnimations = ICON_ANIMATIONS;

    /* Whitelisted, never interpolated: the value comes out of
       user-editable settings storage and ends up in a class attribute. */
    window.dzIconAnimClass = function (id) {
        return ANIM_KNOWN[id] ? ANIM_PREFIX + id : '';
    };

    function animClassFor(devIdx) {
        var ov = devIdx ? DEVICE_ICON_OVERRIDES[devIdx] : null;
        return (ov && ANIM_KNOWN[ov.anim]) ? ANIM_PREFIX + ov.anim : '';
    }

    /* Apply the device's chosen animation class to an icon element.
       Writes only on a change: decorateNativeGlyph() runs on every burst
       pass, and re-adding the class would restart the keyframes from frame
       zero each time — visible as a stutter every few hundred ms. */
    function applyIconAnim(el, devIdx) {
        var want = animClassFor(devIdx);
        var cur  = '';
        for (var i = 0; i < el.classList.length; i++) {
            if (el.classList[i].indexOf(ANIM_PREFIX) === 0) { cur = el.classList[i]; break; }
        }
        if (cur === want) return;
        if (cur)  el.classList.remove(cur);
        if (want) el.classList.add(want);
    }

    /* Bumped whenever the map above changes.  Read by the native-glyph
       colour cache further down, which keys off the device rather than off
       an image src and so has nothing else to invalidate on. */
    var _nativeColorGen = 0;

    /* Returns an overridden resolved spec for a given device IDX + src,
       or null when no override is configured for that device.             */
    function applyDeviceOverride(devIdx, src, fallbackResolved) {
        if (!devIdx || !DEVICE_ICON_OVERRIDES[devIdx]) return null;
        var ov = DEVICE_ICON_OVERRIDES[devIdx];
        /* An entry with colours but no shape is the normal case on a Domoticz
           that owns the icon itself: the theme stores only colour and motion
           there. It still has to tint the icon the resolver picked, so it can
           no longer be dismissed as an empty entry. keepColor means "keep the
           resolver's dynamic colour", which with no shape to change is
           genuinely nothing to do. */
        var hasShape = !!(ov.iconOn || ov.iconOpen || ov.icon || ov.iconStop);
        var hasColor = !!(ov.on || ov.off) && !ov.keepColor;
        if (!hasShape && !hasColor) return null;

        var parsedSrc = parseDeviceSrc(src);
        var base      = parsedSrc ? parsedSrc.base : null;

        /* Blinds: 'sel'→'on' is the only active state; null/no suffix = inactive.
           Replicate the same special-case used in resolveIcon().              */
        var isOn;
        if (base === 'blinds' || base === 'blindsopen') {
            isOn = !!(parsedSrc && parsedSrc.state === 'on');
        } else if (parsedSrc) {
            isOn = parsedSrc.state !== 'off';
        } else {
            /* DEVICE_RE only matches letter-only bases, so a Domoticz custom
               icon whose Base contains digits or hyphens (AWTRIX3,
               xiaomi-mi-robot-vacuum-icon…) doesn't parse and used to fall
               through as permanently "on". Domoticz always writes
               <Base>48_On.png / <Base>48_Off.png, so read the state off the
               filename suffix instead. */
            isOn = !/[_-]off\.png$/i.test(src);
        }

        /* Select icon by image slot:
           blindsopen* → Open button, blinds* → Close button,
           blindsstop  → Stop button, all else → on/off        */
        var iconCls;
        if (base === 'blindsopen') {
            iconCls = ov.iconOpen  || ov.iconOn || ov.icon;
        } else if (base === 'blinds') {
            iconCls = ov.iconClose || ov.iconOn || ov.icon;
        } else if (base === 'blindsstop') {
            iconCls = ov.iconStop;
        } else {
            iconCls = isOn
                ? (ov.iconOn  || ov.icon)
                : (ov.iconOff || ov.iconOn || ov.icon);
        }
        if (!iconCls) {
            /* Colour only: keep the shape the resolver picked (and its type —
               blindsstop is an 'icon', not a device state) and just re-tint. */
            if (!hasColor || !fallbackResolved) return null;
            return {
                type:     fallbackResolved.type || 'device',
                cls:      fallbackResolved.cls,
                color:    isOn ? (ov.on || fallbackResolved.colorOn)
                               : (ov.off || fallbackResolved.colorOff),
                colorOn:  ov.on  || fallbackResolved.colorOn,
                colorOff: ov.off || fallbackResolved.colorOff
            };
        }

        var fbOn  = (fallbackResolved && fallbackResolved.colorOn)  || '#4e9af1';
        var fbOff = (fallbackResolved && fallbackResolved.colorOff) || '#555770';
        var ovOn  = ov.on  || fbOn;
        var ovOff = ov.off || fbOff;

        /* keepColor: override only the icon shape; pass through the resolver's
           dynamic color (temperature range, alert level, wind, etc.)          */
        if (ov.keepColor && fallbackResolved) {
            return {
                type:     'device',
                cls:      iconCls + ' dz-fa-device',
                color:    fallbackResolved.color,
                colorOn:  fallbackResolved.colorOn  || ovOn,
                colorOff: fallbackResolved.colorOff || ovOff
            };
        }

        return {
            type:     'device',
            cls:      iconCls + ' dz-fa-device',
            color:    isOn ? ovOn : ovOff,
            colorOn:  ovOn,
            colorOff: ovOff
        };
    }

    /* Called by the settings module when the override map changes.
       Schedules a replacement burst so already-rendered icons update. */
    window._dzSetDeviceIconOverrides = function (overrides) {
        DEVICE_ICON_OVERRIDES = overrides || {};
        /* Invalidate the native-glyph resolution cache: an override added,
           changed or removed at runtime must re-resolve on the next pass
           even though the glyph's own identity did not change.  Covers a
           changed animation as well as a changed colour — the entry holds
           the device idx both are read from. */
        _nativeColorGen++;
        /* Re-apply to already-rendered device icons right away so overrides
           added, changed, or removed at runtime take effect immediately —
           without waiting for a device state change or a page refresh.  A plain
           burst wouldn't do it: Pass 2 / updateReplacedIcon skip icons whose src
           hasn't changed.  Clearing data-dz-src forces a re-resolve, which also
           reverts to the default icon when an override was removed (issue #196). */
        try {
            /* Include already-replaced device icons that were never tagged with
               an IDX (e.g. isolate-scope widgets before the robust tagging, or
               icons replaced before the map first loaded) so a newly-set override
               applies without a refresh — updateReplacedIcon() self-heals the tag
               via deviceIdxForIcon(). Issue #191. */
            var imgs = document.querySelectorAll('img.dz-icon-replaced');
            for (var i = 0; i < imgs.length; i++) {
                imgs[i].removeAttribute('data-dz-src');
                updateReplacedIcon(imgs[i]);
            }
            /* Reconsider images we previously skipped. An unmapped Domoticz
               custom icon gets marked dz-icon-skipped, and skipped images are
               excluded from every later pass — so without this a freshly added
               override for such a device would never show up on the card.
               Genuinely excluded images simply get re-skipped by processImg(). */
            var skipped = document.querySelectorAll('img.dz-icon-skipped');
            for (var s = 0; s < skipped.length; s++) {
                skipped[s].classList.remove('dz-icon-skipped');
                processImg(skipped[s]);
            }
        } catch (e) { /* best-effort — burst below is the safety net */ }
        if (typeof window._dzScheduleBurst === 'function') window._dzScheduleBurst();
    };

    /* -- Process a single <img> into an FA <i> -------------------- */
    /* Returns true if the image was processed, false if skipped.      */

    function processImg(img) {
        if (img.classList.contains('dz-icon-replaced') ||
            img.classList.contains('dz-icon-skipped'))  return false;

        /* Skip images inside icon-picker dropdowns (Edit Device dialog) and the
           theme's own Icon Studio. These are pictures of icons being chosen from,
           not device icons: replacing one would swap the very thing the user is
           trying to look at, and leaving it queued for a later burst keeps it at
           the pre-hide opacity, which reads as an icon that never loads. */
        if (img.classList.contains('dd-option-image') ||
                img.closest('.dd-options, .dd-select, .iconlist, .ng-is-overlay')) {
            img.classList.add('dz-icon-skipped');
            return false;
        }

        var src = img.getAttribute('src') || '';

        /* Translate non-English wind direction filenames to English equivalents
           before any further processing so both the PNG fallback (which must
           reference a file that actually exists on the Domoticz server) and the
           FA icon resolution work correctly.
           e.g. Dutch: WindZ.png → WindS.png, WindNO.png → WindNE.png
           The translation depends on the UI language: WindO.png is East in
           Dutch/German but West in French (issue #257).                    */
        var _windSrcMatch = /Wind([A-Z]{1,3})\.png/.exec(src);
        if (_windSrcMatch) {
            var _windEng = windDirToEnglish(_windSrcMatch[1]);
            if (_windEng && _windEng !== _windSrcMatch[1]) {
                src = src.replace(
                    'Wind' + _windSrcMatch[1] + '.png',
                    'Wind' + _windEng + '.png'
                );
                img.setAttribute('src', src);
            }
        }

        /* Skip unresolved Angular templates */
        if (!src || src.indexOf('{{') !== -1) return false;

        /* Skip excluded images */
        if (shouldSkip(src)) {
            img.classList.add('dz-icon-skipped');
            return false;
        }

        var resolved = resolveIcon(src);
        if (!resolved) {
            /* A Domoticz custom icon (CustomImage) renders as
               images/<Base>48_On.png, and <Base> has no DEVICE_MAP entry, so
               resolveIcon() returns null. Bailing out here meant a per-device
               override could never reach such a device: the card kept showing
               the PNG even though the detail page reported the override.
               Give the override a chance before writing the image off. */
            var unmappedIdx = (src.indexOf('48') !== -1) ? deviceIdxForIcon(img) : '';
            var unmappedOv  = unmappedIdx ? applyDeviceOverride(unmappedIdx, src, null) : null;
            if (!unmappedOv) {
                img.classList.add('dz-icon-skipped');
                return false;
            }
            img.setAttribute('data-dz-dev-idx', unmappedIdx);
            resolved = unmappedOv;
        }

        /* Per-device icon override — for 48px device state icons and the blinds stop button.
           blindsstop.png matches ICON_MAP (type='icon') so we check it explicitly here so
           that iconStop overrides are applied even though it is not a 48px device icon. */
        if (resolved.type === 'device' || src.indexOf('blindsstop') !== -1) {
            /* Resolve the IDX robustly (Angular device object OR the idx Domoticz
               stamps on the card DOM). Isolate-scope widgets (dimmers, Color
               Switches) don't expose the device via .scope(), so the DOM
               fallback is what makes their overrides work (issue #191). */
            var devIdx = deviceIdxForIcon(img);
            if (devIdx) {
                /* Always tag the device IDX — not only when an override
                   currently exists.  updateReplacedIcon()/Pass 2 read this
                   attribute on every state change to re-apply the override;
                   tagging unconditionally means an override that is loaded
                   async or added at runtime still sticks across state changes
                   instead of reverting to the default icon (issue #196). */
                img.setAttribute('data-dz-dev-idx', devIdx);
                var ovSpec = applyDeviceOverride(devIdx, src, resolved);
                if (ovSpec) resolved = ovSpec;
            }
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
            var rot = windRotationForIcon(img, resolved.dir);
            if (rot !== null) icon.style.transform = 'rotate(' + rot + 'deg)';
            /* Wind icons never went through the override block above, so they
               carry no IDX tag yet — and Drift is the animation they are most
               likely to be given.  Pure DOM, no scope walk. */
            var windIdx = deviceIdxFromDom(img);
            if (windIdx) img.setAttribute('data-dz-dev-idx', windIdx);
            applyIconAnim(icon, windIdx);
        } else if (resolved.type === 'device') {
            icon.className = resolved.cls;
            if (resolved.color) icon.style.color = resolved.color;
            /* Store on/off colours for state tracking */
            if (resolved.colorOn)  icon.setAttribute('data-dz-color-on',  resolved.colorOn);
            if (resolved.colorOff) icon.setAttribute('data-dz-color-off', resolved.colorOff);
            icon.setAttribute('data-dz-state', resolved.color === resolved.colorOn ? 'on' : 'off');
            /* Chosen animation.  Read from the attribute rather than the local:
               an icon whose src carries no override still gets tagged above,
               and a device with an animation but no icon override never enters
               that branch at all. */
            applyIconAnim(icon, img.getAttribute('data-dz-dev-idx') || '');
            /* Optimistic toggle: immediately swap color on click so the user
               sees instant visual feedback before Angular/API round-trip.
               Only fires for devices whose click actually sends a binary
               on/off command — checked lazily via Angular scope so we
               don't fight Angular's multi-cycle render timing.
               Skipped for:
                 • action buttons (popup/blind 2nd-3rd icon cells)
                 • read-only sensors (Contact, Motion, Dusk)
                 • popup devices (RGBW, fans, Thermostat 3)
                 • directional devices (blinds, selectors)
                 • utility/temp/weather/sensor widgets (no SwitchType)  */
            if (!isActionButton(img)) {
                icon.addEventListener('click', function () {
                    var onColor  = this.getAttribute('data-dz-color-on');
                    var offColor = this.getAttribute('data-dz-color-off');
                    if (!onColor || !offColor) return;

                    // Check device type from Angular scope at click-time
                    if (!isDirectToggle(getDeviceFromIcon(this))) return;

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
        hideNativeGlyph(img);
        return true;
    }

    /* Domoticz's own "Icon style" setting pairs each image with a glyph of its own and
       shows the glyph instead of the image when the style is set to glyphs — navbar
       images get a .dz-nav-glyph sibling, the blinds open/stop/close buttons a
       .dz-glyph-only one. The theme pins that setting to glyphs and has already
       replaced the image, so both would draw and the icon would render twice (the
       doubled roller-shutter chevrons). The theme owns the look here, so the native
       glyph is hidden rather than removed — Angular re-renders these nodes, and a
       removed one would just come back.

       Keyed off the sibling the image actually has, so an image the theme skipped
       keeps Domoticz's glyph and never ends up with no icon at all.

       The glyph can land on either side of the <img> — navbar/blinds markup
       puts it after, but scene/group action buttons (dz-scene-on/off) put it
       BEFORE, as the first child of the <td>, ahead of even our own inserted
       <i>. Checking only nextElementSibling missed that case and left the
       native glyph showing alongside the FA icon (double icon on Scenes/
       Groups). Scan both neighbours instead of just the next one. */
    function hideNativeGlyph(img) {
        var next = img.nextElementSibling;
        var prev = img.previousElementSibling;
        if (next && next.tagName === 'I' &&
            (next.classList.contains('dz-nav-glyph') || next.classList.contains('dz-glyph-only'))) {
            next.classList.add('dz-native-glyph-hidden');
        }
        while (prev) {
            if (prev.tagName === 'I' &&
                (prev.classList.contains('dz-nav-glyph') || prev.classList.contains('dz-glyph-only'))) {
                prev.classList.add('dz-native-glyph-hidden');
                break;
            }
            /* Stop once we pass our own inserted icon — anything further back
               belongs to a different button (e.g. the sibling img1/img2 cell's
               own glyph, which must stay untouched). */
            if (prev.tagName === 'I' &&
                (prev.classList.contains('dz-fa-device') || prev.classList.contains('dz-fa-icon') ||
                 prev.classList.contains('dz-fa-fav') || prev.classList.contains('dz-fa-trend') ||
                 prev.classList.contains('dz-fa-action') || prev.classList.contains('dz-fa-nav') ||
                 prev.classList.contains('dz-wind'))) {
                prev = prev.previousElementSibling;
                continue;
            }
            break;
        }
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

        /* A blinds button swaps its src on every open/close, and Angular may have
           rebuilt the paired native glyph along the way, dropping the marker with it.
           Re-applying here is a no-op when the class is already there. */
        hideNativeGlyph(img);

        /* Resolve icon first so colors are available as fallback for overrides */
        var resolved = resolveIcon(curSrc);

        /* Per-device icon override — prefer the stored IDX, but self-heal it
           if missing (e.g. the icon was first replaced before this idx-tagging
           became robust, or before the override map loaded) so isolate-scope
           widgets like dimmers still pick up overrides — issue #191. */
        var devIdx = img.getAttribute('data-dz-dev-idx');
        if (!devIdx && (resolved && resolved.type === 'device')) {
            devIdx = deviceIdxForIcon(img);
            if (devIdx) img.setAttribute('data-dz-dev-idx', devIdx);
        }
        if (devIdx) {
            var ovSpec = applyDeviceOverride(devIdx, curSrc, resolved);
            if (ovSpec) {
                icon.className = ovSpec.cls;
                icon.style.color = ovSpec.color || '';
                icon.setAttribute('data-dz-color-on',  ovSpec.colorOn);
                icon.setAttribute('data-dz-color-off', ovSpec.colorOff);
                icon.setAttribute('data-dz-state', ovSpec.color === ovSpec.colorOn ? 'on' : 'off');
                /* className was just rewritten, which dropped the animation
                   class with it — put it back. */
                applyIconAnim(icon, devIdx);
                img.setAttribute('data-dz-src', curSrc);
                return;
            }
        }

        if (!resolved) {
            /* Nothing maps this src and there's no override any more — e.g. the
               user just removed an override from a device that uses a Domoticz
               custom icon. Put the original <img> back rather than leaving a
               stale Font Awesome icon in place. */
            if (icon.parentNode) icon.parentNode.removeChild(icon);
            try { iconMap.delete(img); } catch (e) {}
            img.classList.remove('dz-icon-replaced');
            img.removeAttribute('data-dz-src');
            return;
        }

        if (resolved.type === 'fav') {
            icon.className = resolved.cls;
        } else if (resolved.type === 'wind') {
            icon.className = resolved.cls;
            icon.style.color = resolved.color || '';
            var rot = windRotationForIcon(img, resolved.dir);
            icon.style.transform = (rot !== null) ? 'rotate(' + rot + 'deg)' : '';
            applyIconAnim(icon, img.getAttribute('data-dz-dev-idx') || '');
        } else if (resolved.type === 'device') {
            icon.className = resolved.cls;
            icon.style.color = resolved.color || '';
            /* Refresh stored on/off colors and state flag so future optimistic
               toggles stay in sync with the authoritative device state.        */
            if (resolved.colorOn)  icon.setAttribute('data-dz-color-on',  resolved.colorOn);
            if (resolved.colorOff) icon.setAttribute('data-dz-color-off', resolved.colorOff);
            icon.setAttribute('data-dz-state', resolved.color === resolved.colorOn ? 'on' : 'off');
            applyIconAnim(icon, devIdx || '');
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

        /* SVG <image> (floorplan): remove the associated <foreignObject> */
        if (node.nodeName && node.nodeName.toLowerCase() === 'image') {
            var fo = iconMap.get(node);
            if (fo && fo.parentNode) fo.parentNode.removeChild(fo);
            iconMap.delete(node);
            return;
        }

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
                var rot = windRotationForIcon(rImg, newResolved.dir);
                prevIcon.style.transform = rot !== null ? 'rotate(' + rot + 'deg)' : '';
                applyIconAnim(prevIcon, rImg.getAttribute('data-dz-dev-idx') || '');
            } else if (newResolved.type === 'device') {
                /* Prefer per-device override if one is configured */
                var p2DevIdx = rImg.getAttribute('data-dz-dev-idx');
                var p2Spec   = p2DevIdx ? applyDeviceOverride(p2DevIdx, curSrc, newResolved) : null;
                var p2Final  = p2Spec || newResolved;
                prevIcon.className = p2Final.cls;
                prevIcon.style.color = p2Final.color || '';
                if (p2Final.colorOn)  prevIcon.setAttribute('data-dz-color-on',  p2Final.colorOn);
                if (p2Final.colorOff) prevIcon.setAttribute('data-dz-color-off', p2Final.colorOff);
                prevIcon.setAttribute('data-dz-state', p2Final.color === p2Final.colorOn ? 'on' : 'off');
                applyIconAnim(prevIcon, p2DevIdx || '');
            }

            rImg.setAttribute('data-dz-src', curSrc);
        }

        /* If any orphaned images were recovered, re-run Pass 1 immediately
           so the replacement icon appears without waiting for the next burst. */
        if (recovered) {
            processNewImages(root);
        }

        /* --- Pass 3: SVG <image> elements on floorplan pages --- */
        replaceSVGIcons(root);
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
            /* SVG <image> element (floorplan device icon) */
            if (node.nodeName && node.nodeName.toLowerCase() === 'image') {
                processSVGImageEl(node);
                return;
            }
            if (node.tagName === 'IMG') {
                if (node.parentNode) processImg(node);
                return;
            }
            processNewImages(node);
            replaceSVGIcons(node);
        } catch (_) { /* ignore — fallback below */ }
        /* Also schedule an async pass as safety net in case Angular hasn't
           finished compiling the node's children yet.                       */
        setTimeout(function () {
            if (!node || node.nodeType !== 1) return;
            if (node.nodeName && node.nodeName.toLowerCase() === 'image') {
                processSVGImageEl(node);
                return;
            }
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
        /* Live device/scene updates.  Domoticz's websocket layer broadcasts
           'device_update' / 'scene_update' on $rootScope whenever a device's
           state changes, then runs a $digest that re-evaluates ng-src on the
           icon <img> (dashboard) or replaceChild()s a fresh SVG <image>
           (floorplan).  We schedule a burst so the icon is re-resolved and
           re-coloured for the new state (issue #211).

           This replaces the previous $rootScope.$watch(scheduleSafetyPass)
           hook, which fired on EVERY digest (many times per second) and
           degraded performance over time.  Keying off the update broadcasts
           instead means a refresh runs only when a device actually changes,
           while still guaranteeing live icons without a page reload. */
        $rootScope.$on('device_update', function () {
            scheduleBurst();
        });
        $rootScope.$on('scene_update', function () {
            scheduleBurst();
        });
        /* NOTE: Do NOT use $rootScope.$watch here. Angular evaluates the
           watch expression on every $digest cycle (which fires many times
           per second in an active Domoticz). Any side-effect in the watch
           expression runs continuously and degrades performance over time. */
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

    /* The icon this module would put in place of a given image. An icon preview
       elsewhere in the theme has to agree with what the lists actually show, and
       the only way to guarantee that is to ask the same function replaceImage()
       asks rather than reimplementing the mapping beside it. */
    window._dzIconForSrc = function (src) {
        return src ? resolveIcon(String(src)) : null;
    };

    /* Re-run a replacement pass when the tab regains visibility / focus, or is
       restored from the back-forward cache.  Browsers throttle timers and the
       MutationObserver in background tabs, and the Dynamic Dashboard rebuilds
       its widgets on refocus — wiping our injected <i> elements while the
       original <img> stays hidden (dz-icon-replaced), so icons come back blank
       until something triggers a burst.  scheduleBurst() runs replaceIcons()
       whose Pass-2 recovery re-creates the missing <i> elements (issue #214).
       Without this, the only recovery was a manual refresh or toggling the
       Device Icons setting off/on. */
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) scheduleBurst();
    });
    window.addEventListener('pageshow', function () { scheduleBurst(); });
    window.addEventListener('focus', function () { scheduleBurst(); });

    /* Expose a device-icon lookup for other modules (e.g. settings dialog).
       Given a Domoticz device object, returns { icon, color } replicating
       the logic of dzLightWidget.js::getDeviceIcon() and
       dzUtilityWidget.js::getDeviceIcon() so the dialog shows the same icon
       that Domoticz actually renders.                                       */
    window._dzIconForDevice = function (device) {
        var sw      = device.SwitchType || '';
        var type    = device.Type       || '';
        var subType = device.SubType    || '';
        var typeImg = (device.TypeImg   || '').toLowerCase();
        var image   = device.Image      || '';
        /* TypeImg values that differ from DEVICE_MAP keys */
        var ALIASES = { 'hum': 'humidity', 'temphum': 'temp', 'temphumbaroew': 'temp',
                        'zwavemelding': 'alarm', 'elec': 'electricityusage' };
        var src;

        /* Mirror getDeviceIcon() special cases */
        if (sw === 'Doorbell') {
            src = 'images/doorbell48.png';
        } else if (sw.indexOf('Blind') >= 0 || sw.indexOf('Venetian') >= 0) {
            /* Show open state so the dialog preview uses the open-arrow icon.
               dzLightWidget always uses blindsopen48sel.png regardless of TypeImg. */
            src = 'images/blindsopen48sel.png';
        } else if (sw === 'Smoke Detector') {
            src = 'images/smoke48on.png';
        } else if (sw === 'Motion Sensor') {
            src = 'images/motion48-on.png';
        } else if (sw === 'Dusk Sensor') {
            /* uvdark/uvsunny are in the skip list — return lux spec directly */
            var luxSpec = DEVICE_MAP['lux'];
            return luxSpec ? { icon: luxSpec.icon, color: luxSpec.on } : null;
        } else if (subType === 'Security Panel') {
            src = 'images/security48.png';
        } else if (sw === 'X10 Siren') {
            /* siren-on/off are in skip list — use alarm */
            var almSpec = DEVICE_MAP['alarm'];
            return almSpec ? { icon: almSpec.icon, color: almSpec.on } : null;
        } else if (sw === 'TPI') {
            src = 'images/Fireplace48_On.png';
        } else if (subType && (subType.indexOf('Itho') === 0 || subType.indexOf('Orcon') === 0 ||
                   subType.indexOf('Lucci') === 0 || subType.indexOf('Falmec') === 0 ||
                   subType.indexOf('Westinghouse') === 0)) {
            src = 'images/Fan48_On.png';
        } else if (type === 'Security') {
            src = 'images/security48.png';
        } else if (sw === 'Door Lock' || sw === 'Door Lock Inverted') {
            var lockImg = image || 'Light';
            if (device.CustomImage == 0) lockImg = lockImg.charAt(0).toUpperCase() + lockImg.slice(1);
            src = 'images/' + lockImg + '48_On.png';
        } else if (sw === 'Contact' || sw === 'Door Contact') {
            var ctImg = image || (sw === 'Door Contact' ? 'Door' : 'Contact');
            if (device.CustomImage == 0) ctImg = ctImg.charAt(0).toUpperCase() + ctImg.slice(1);
            src = 'images/' + ctImg + '48_On.png';
        } else if (type === 'Scene') {
            /* scene_widget.html hardcodes images/Push48_On.png → base='push' → fa-circle-dot */
            var scSpec = DEVICE_MAP['push'];
            return scSpec ? { icon: scSpec.icon, color: scSpec.on } : null;
        } else if (type === 'Group') {
            /* scene_widget.html hardcodes images/Push48_On/Off.png → base='push' → fa-circle-dot */
            var grpSpec = DEVICE_MAP['push'];
            return grpSpec ? { icon: grpSpec.icon, color: grpSpec.on } : null;
        } else if (type === 'Humidity') {
            /* dzUtilityWidget renders gauge48.png for Humidity, not humidity48.png.
               TypeImg 'hum' would alias to 'humidity' (droplet) which is wrong. */
            var humSpec = DEVICE_MAP['gauge'];
            return humSpec ? { icon: humSpec.icon, color: humSpec.on } : null;
        } else if (typeof device.Temp !== 'undefined' || typeof device.Chill !== 'undefined') {
            /* Temperature / weather combo devices (Temp, Temp+Hum, Temp+Hum+Baro, Wind…):
               dzUtilityWidget uses GetTemp48Item(device.Temp) which returns range images.
               In the dialog we show the fixed temp icon — we can't vary by live value. */
            var tempSpec = DEVICE_MAP['temp'];
            return tempSpec ? { icon: tempSpec.icon, color: tempSpec.on } : null;
        } else if (!sw && typeImg) {
            /* Sensor/meter (no SwitchType): look up TypeImg with alias normalisation */
            var normKey = ALIASES[typeImg] || typeImg;
            if (DEVICE_MAP[normKey]) {
                var sSpec = DEVICE_MAP[normKey];
                return { icon: sSpec.icon, color: sSpec.on || '#4e9af1' };
            }
            src = 'images/' + typeImg + '48.png';
        } else if (device.CustomImage == 0 && subType &&
                   (subType.indexOf('RGB') >= 0 || subType.indexOf('WW') >= 0)) {
            /* RGB/RGBW/CCT dimmers: dzLightWidget returns images/RGB48_On.png
               → resolveIcon → DEVICE_MAP['rgb'] = fa-palette.
               Must be checked before the generic image fallback below. */
            var rgbSpec = DEVICE_MAP['rgb'];
            return rgbSpec ? { icon: rgbSpec.icon, color: rgbSpec.on } : null;
        } else {
            /* Standard switch: getDeviceIcon() uses device.Image, not TypeImg */
            var imgBase = image || 'Light';
            if (device.CustomImage == 0) imgBase = imgBase.charAt(0).toUpperCase() + imgBase.slice(1);
            src = 'images/' + imgBase + '48_On.png';
        }

        var r = resolveIcon(src);
        if (r && r.cls) {
            var fa = r.cls.split(' ').filter(function (c) { return c.indexOf('fa-') === 0; }).join(' ');
            return { icon: fa || r.cls, color: r.color };
        }
        /* Final fallback: typeImg alias lookup in DEVICE_MAP */
        var fbKey = ALIASES[typeImg] || typeImg;
        if (fbKey && DEVICE_MAP[fbKey]) {
            var fbSpec = DEVICE_MAP[fbKey];
            return { icon: fbSpec.icon, color: fbSpec.on || '#4e9af1' };
        }
        return null;
    };

    /* ── Native Font Awesome rendering adapter ─────────────────────
       Newer Domoticz resolves device icons itself and renders them as
       glyphs through its own <dz-device-icon> component:

         <dz-device-icon class="dz-icon-48">
             <i class="dz-icon-glyph fa-solid fa-fan dz-icon--on"></i>
         </dz-device-icon>

       There is no <img> left to replace, so replaceImage() never runs and
       the two hooks it used to apply — the dz-fa-device class and the
       data-dz-state attribute — are never applied.  Everything keyed on
       them is silently orphaned: the icon-animation gate in
       animations.css, the sizing/hover/fa-stop rules in layout.css, the
       wind rotation, and the state-change flash observer in
       card-features.js.

       Rather than duplicate Domoticz's icon resolution we decorate its
       own glyph with those two hooks, which makes every existing selector
       match again without touching a single line of CSS.

       Stable Domoticz emits no <dz-device-icon> at all, so this block
       short-circuits on its first querySelector and behaviour there is
       unchanged.                                                        */

    /* Only widget icons put dz-icon-48 / dz-icon-40 on the host element.
       Chrome — row action buttons, table type indicators, favourite stars —
       uses .dz-chrome-icon or .dz-icon-glyph.dz-icon-16, and the scene
       on/off buttons carry .dz-icon-glyph on the <td> itself.  Matching
       only an <i> inside a 48/40 host keeps table buttons and stars out of
       the animation and sizing rules. */
    var NATIVE_GLYPH_SEL = '.dz-icon-48 > i.dz-icon-glyph, .dz-icon-40 > i.dz-icon-glyph';

    /* True once native glyph rendering has been observed.  Re-evaluated on
       every burst pass rather than latched at load: the SPA only mounts
       <dz-device-icon> on pages that show device widgets, and a cold start
       may land on Setup or the Dynamic Dashboard first. */
    var _nativeSeen = false;

    /* The "Device Icons" setting means "let Nightglass restyle device
       icons".  With it off, search.js injects
         i.dz-fa-device, i.dz-wind { display: none !important }
       and un-hides the original PNGs.  Under native rendering there is no
       PNG to fall back to, so an undecorated glyph *is* the off state —
       hence we must not add dz-fa-device at all while the setting is off,
       or the card would go blank.  A live toggle takes effect on the next
       burst (route change, device update, or tab refocus). */
    function nativeDecorEnabled() {
        try {
            var s = window.dzNightglassSettings;
            if (s && typeof s.get === 'function') {
                var v = s.get('deviceIcons');
                if (v !== undefined && v !== null) return !!v;
            }
        } catch (e) { /* settings module not loaded yet */ }
        return true; /* shipped default */
    }

    /* Read the state that dzDeviceIcon published.  It only emits
       dz-icon--on / dz-icon--off when its isActive binding resolves to a
       boolean; a read-only sensor (temperature, wind, UV, rain, counter…)
       reports neither, because it has no on/off state.

       When there is no state class we leave data-dz-state ABSENT rather
       than guessing.  Absent is the useful value: the animation gate stops
       an icon that reports "off", and a sensor that reports nothing keeps
       whatever animation the user picked for it — which is the only reason
       it would have one.  A fabricated "off" would instead cancel that
       animation outright and trip the state-change flash in
       card-features.js the first time the device reports a real state. */
    function nativeGlyphState(glyph) {
        if (glyph.classList.contains('dz-icon--on'))  return 'on';
        if (glyph.classList.contains('dz-icon--off')) return 'off';
        return null;
    }

    /* ── Colour layer ──────────────────────────────────────────────
       Native paints every device glyph the same blue (#43A4D3) with a
       grey off-state; it has no per-device-type colour.  DEVICE_MAP stays
       the colour source, but there is no PNG filename left to key it
       with, so key it off the device record instead — mirroring the
       precedence dzIconService.resolve() uses to pick the glyph itself:
       a built-in CustomImage wins over TypeImg.  Keying off the same
       fields as the glyph means the colour always agrees with the shape
       that is actually on screen.

       device.Icon — the per-device pick in Domoticz's own icon picker —
       carries no type information, so those devices fall through to
       CustomImage / TypeImg for their colour: the user chose the shape,
       Nightglass still supplies the type colour.

       DEVICE_MAP's icon field is unused here; native owns icon identity. */

    /* TypeImg values that differ from the DEVICE_MAP key.  Mirrors
       dzIconService's TYPE_ALIASES, so a device whose glyph Domoticz
       resolved through an alias gets the colour of that same entry. */
    var TYPEIMG_ALIASES = {
        'hardware':      'gauge',
        'hum':           'humidity',
        'temphum':       'temp',
        'temphumbaroew': 'temp',
        'zwavemelding':  'alarm',
        'elec':          'electricityusage',
        'lightbulb':     'light',
        'temperature':   'temp',
        'temp + rain':   'temp',
        'setpoint':      'temp',
        'bbq':           'temp',
        'evohome':       'heating',
        'weather':       'sun',
        'general':       'gauge',
        'utility':       'gauge',
        'siren':         'alarm',
        'pushoff':       'push',
        'override_mini': 'adjust'
    };

    function deviceMapSpecFor(device) {
        if (!device) return null;
        /* CustomImage 1..99 is Domoticz's built-in icon library and
           device.Image carries its name ('Fan', 'Alarm', 'WallSocket'),
           which is exactly the DEVICE_MAP key.  100+ are user-uploaded
           icon sets and carry no device-type meaning. */
        var ci = parseInt(device.CustomImage, 10);
        if (ci > 0 && ci < 100 && device.Image) {
            var imgKey = String(device.Image).toLowerCase();
            if (DEVICE_MAP[imgKey]) return DEVICE_MAP[imgKey];
        }
        var ti = String(device.TypeImg || '').toLowerCase();
        if (!ti) return null;
        return DEVICE_MAP[ti] || DEVICE_MAP[TYPEIMG_ALIASES[ti]] || null;
    }

    /* Resolve the on/off colour pair for a native glyph.  Either side may
       come back empty, which means "do not colour" — DEVICE_MAP stores
       null for entries that must keep the stock colour ('onoff',
       'remote', 'security', and the off-state of read-only sensors), and
       under native the stock colour is Domoticz's own, which is already
       right for those. */
    function resolveNativeSpec(glyph, devIdx) {
        var device = getDeviceFromIcon(glyph);
        var spec   = deviceMapSpecFor(device);
        var on     = spec ? spec.on  : null;
        var off    = spec ? spec.off : null;

        /* A per-device colour the user set in Nightglass must win over
           DEVICE_MAP.  keepColor means "override the shape only, keep the
           resolver's dynamic colour"; native owns the shape, so it
           degrades to "leave the colour alone". */
        var idx = devIdx || (device && String(device.idx || device.IDX || '')) || '';
        var ov  = idx ? DEVICE_ICON_OVERRIDES[idx] : null;
        if (ov && !ov.keepColor) {
            if (ov.on)  on  = ov.on;
            if (ov.off) off = ov.off;
        }

        return {
            on:   on,
            off:  off,
            /* Same test dzUtilityWidget.isValueDrivenIcon() uses to decide
               a reading is encoded in the icon rather than a device state. */
            wind: !!(device && device.Direction !== undefined &&
                     device.Direction !== null && device.Direction !== '')
        };
    }

    /* Resolving the device costs an Angular scope walk, and a burst runs
       several passes, so cache the result per element and recompute only
       when the glyph's identity changes (different device in the slot, or
       Domoticz re-resolved the icon).  WeakMap so entries go away with
       the element. */
    var nativeColorCache = new WeakMap();

    /* Identity signature: the device idx plus the icon classes, ignoring
       the volatile ones (native's state classes and our own hooks — the
       animation class among them, or adding it would invalidate the entry
       we just wrote it from). */
    function nativeColorSig(glyph, devIdx) {
        var sig = _nativeColorGen + '|' + devIdx + '|';
        var cl  = glyph.classList;
        for (var i = 0; i < cl.length; i++) {
            var c = cl[i];
            if (c === 'dz-icon-glyph' || c === 'dz-fa-device' ||
                c === 'dz-wind' || c.indexOf('dz-icon--') === 0 ||
                c.indexOf(ANIM_PREFIX) === 0) continue;
            sig += c + ' ';
        }
        return sig;
    }

    function nativeEntryFor(glyph) {
        /* deviceIdxFromDom is pure DOM (card id / td#name[data-idx]), so
           it is cheap enough to run on every pass as the cache key. */
        var devIdx = deviceIdxFromDom(glyph);
        var entry  = nativeColorCache.get(glyph);
        var sig    = nativeColorSig(glyph, devIdx);

        if (!entry || entry.sig !== sig) {
            var spec = resolveNativeSpec(glyph, devIdx);
            entry = { sig: sig, idx: devIdx, on: spec.on, off: spec.off,
                      wind: spec.wind, applied: null };
            nativeColorCache.set(glyph, entry);
        }
        return entry;
    }

    function applyNativeColor(glyph, entry, state) {
        /* A state-less glyph (read-only sensor) takes the on colour: that
           is what the PNG era did for the same devices, whose filenames
           carried no _On/_Off suffix either. */
        var want = (state === 'off') ? entry.off : entry.on;

        /* Write only when our own target changed.  card-features.js also
           writes inline colour on these elements (temperature accent, bar
           ranges) and runs later in the same burst pass — re-asserting our
           colour every pass would fight it for no reason. */
        if (want) {
            if (entry.applied !== want) {
                glyph.style.color = want;
                entry.applied = want;
            }
        } else if (entry.applied) {
            glyph.style.color = '';
            entry.applied = null;
        }
    }

    /* ── Wind direction ────────────────────────────────────────────
       The rotation used to come from the compass letters in the PNG
       filename (images/WindNNE.png → WIND_ROTATION).  Native resolves the
       icon from the device, so there is no filename; take the direction
       from the device record instead.  weather_widget.html binds
       item.Direction — the true direction in degrees — alongside
       item.DirectionStr, the (possibly localised) compass abbreviation.
       Degrees are exact and need no compass table, so prefer them and
       keep WIND_ROTATION/WIND_ALIASES as the fallback for feeds that only
       publish the abbreviation.

       Native draws fa-wind here, not the fa-arrow-up the PNG era
       substituted, and Nightglass must not override Domoticz's icon
       choice — so the rotation orients a windsock instead of pointing an
       arrow.  Utility-page wind widgets are unaffected: they render with
       use-glyph="false", i.e. still as a WindNNE.png <img>, which the
       existing replacement path handles unchanged. */
    function nativeWindRotation(device) {
        if (!device) return null;
        var deg = parseFloat(device.Direction);
        if (!isNaN(deg)) return ((deg % 360) + 360) % 360;
        return windRotationFromStr(device.DirectionStr);
    }

    function applyNativeWind(glyph) {
        /* The reading changes without the glyph's identity changing, so
           this cannot be cached with the colour — re-read the device.
           Only wind devices get here, so it stays a handful of walks. */
        var rot = nativeWindRotation(getDeviceFromIcon(glyph));
        /* Direction unreachable: degrade cleanly — no rotation, no log. */
        if (rot === null) return;

        if (!glyph.classList.contains('dz-wind')) glyph.classList.add('dz-wind');
        var tf = 'rotate(' + rot + 'deg)';
        if (glyph.style.transform !== tf) glyph.style.transform = tf;
    }

    function decorateNativeGlyph(glyph) {
        /* Idempotent: Nightglass's own <i>s never carry dz-icon-glyph, so
           this can never re-process an icon we created ourselves, and
           re-running over an already-decorated glyph is a no-op. */
        if (!glyph.classList.contains('dz-fa-device')) {
            glyph.classList.add('dz-fa-device');
        }

        var state = nativeGlyphState(glyph);
        var entry = nativeEntryFor(glyph);
        applyNativeColor(glyph, entry, state);
        if (entry.wind) applyNativeWind(glyph);
        /* Native owns the glyph, Nightglass owns its motion.  The gate in
           animations.css keeps an off device still, so this is applied
           regardless of state. */
        applyIconAnim(glyph, entry.idx);

        var cur = glyph.getAttribute('data-dz-state');
        /* Write only on a genuine change.  Every data-dz-state mutation
           wakes the flash observer in card-features.js, so a blind
           setAttribute on each burst pass would strobe every card. */
        if (state === null) {
            if (cur !== null) glyph.removeAttribute('data-dz-state');
        } else if (cur !== state) {
            glyph.setAttribute('data-dz-state', state);
        }
    }

    function undecorateNativeGlyph(glyph) {
        glyph.classList.remove('dz-fa-device', 'dz-wind');
        applyIconAnim(glyph, '');
        glyph.removeAttribute('data-dz-state');
        glyph.style.color = '';
        glyph.style.transform = '';
        /* Drop the cached colour too, or a later re-enable would see its
           own value as already applied and never re-paint. */
        nativeColorCache.delete(glyph);
    }

    /* dzDeviceIcon renders an <img> fallback while dzIconService is still
       fetching the built-in icon table, then swaps it for the glyph.  Our
       MutationObserver replaces that transient <img> with an <i>, and
       cleanupOrphan() deliberately leaves stray <i>s in the DOM (Pass 2
       normally re-adopts them once the <img> reappears).  Here the <img> is
       gone for good, so the shim survives as a permanent duplicate beside
       the native glyph — two icons on one card.  Drop it.

       Hosts that still contain an <img> are the useGlyph="false" path
       (alert level, temperature range, wind direction PNGs), where the
       <img> is the real icon and our replacement is the point. */
    function dropStaleNativeShims() {
        var shims = document.querySelectorAll(
            'dz-device-icon > i.dz-fa-device:not(.dz-icon-glyph)');
        for (var i = 0; i < shims.length; i++) {
            var host = shims[i].parentNode;
            if (host && !host.querySelector('img')) host.removeChild(shims[i]);
        }
    }

    /* Trend arrows carried a "Rising" / "Falling" tooltip while the theme was
       the thing building them from images/arrow_*.png. Domoticz renders them
       natively now and labels neither, so re-apply it to its own markup —
       the colour half of the same feature lives in layout.css. */
    var NATIVE_TREND_SEL =
        '.dz-chrome-icon.fa-arrow-trend-up, .dz-icon-glyph.fa-arrow-trend-up,' +
        '.dz-chrome-icon.fa-arrow-trend-down, .dz-icon-glyph.fa-arrow-trend-down';

    function labelNativeTrends() {
        var arrows = document.querySelectorAll(NATIVE_TREND_SEL);
        for (var i = 0; i < arrows.length; i++) {
            var a = arrows[i];
            if (a.getAttribute('title')) continue;
            a.setAttribute('title',
                a.classList.contains('fa-arrow-trend-up') ? 'Rising' : 'Falling');
        }
    }

    function processNativeGlyphs() {
        /* Runs before the early exit below: trend arrows live in the value
           cell, not in a dz-icon-48/40 box, so a page can show them without
           mounting a single native device glyph. */
        labelNativeTrends();

        var glyphs = document.querySelectorAll(NATIVE_GLYPH_SEL);
        if (!glyphs.length) {
            /* Cheapest possible exit on a Domoticz without native glyph
               rendering, and on native pages that show no device widgets. */
            return;
        }
        _nativeSeen = true;
        dropStaleNativeShims();

        var enabled = nativeDecorEnabled();
        for (var i = 0; i < glyphs.length; i++) {
            if (enabled) decorateNativeGlyph(glyphs[i]);
            else         undecorateNativeGlyph(glyphs[i]);
        }
    }

    /* Registered as an extra processor so it runs inside the existing
       icon-replacement burst — same batch, no second MutationObserver.
       Bursts already fire on route change, $viewContentLoaded,
       device_update / scene_update, DataTables draws and tab refocus,
       which covers every path that can mount or restate a glyph. */
    window._dzExtraProcessors = window._dzExtraProcessors || [];
    window._dzExtraProcessors.push(processNativeGlyphs);

    /* ── Floorplan popup: immediate icon replacement + theme patch ───
       Device.popupRedraw recreates the popup SVG content each time it
       is shown, including new <image> elements for the device icon.
       The MutationObserver won't see these (they're re-drawn inside an
       already-tracked subtree), so we get a 600–2000 ms delay before
       the FA icon appears.  We patch popupRedraw to call replaceSVGIcons
       synchronously immediately after Domoticz finishes drawing.

       We also patch Device.checkDefs to overwrite the PopupGradient stop
       colors with themed values right after Domoticz creates them.         */
    function patchFloorplanPopup() {
        if (typeof Device === 'undefined' || !Device.popupRedraw || !Device.checkDefs) {
            setTimeout(patchFloorplanPopup, 400);
            return;
        }

        /* ── Theme the SVG gradient defs ──────────────────────────── */
        var _origCheckDefs = Device.checkDefs;
        Device.checkDefs = function () {
            _origCheckDefs.apply(this, arguments);
            applyPopupGradient();
        };

        /* ── Immediate icon replacement on popup open ─────────────── */
        var _origRedraw = Device.popupRedraw;
        Device.popupRedraw = function (target) {
            _origRedraw.apply(this, arguments);
            var el = document.getElementById(target + '_Detail');
            if (el) {
                /* Remove stale data-dz-replaced marks so processSVGImageEl
                   re-processes icons that Domoticz just redrew.             */
                var old = el.querySelectorAll('image[data-dz-replaced]');
                for (var i = 0; i < old.length; i++) {
                    old[i].removeAttribute('data-dz-replaced');
                    old[i].removeAttribute('data-dz-skipped');
                    old[i].style.opacity = '';
                    /* Remove associated <foreignObject> so we don't duplicate */
                    var fo = iconMap.get(old[i]);
                    if (fo && fo.parentNode) fo.parentNode.removeChild(fo);
                    iconMap.delete(old[i]);
                }
                replaceSVGIcons(el);
            }
        };
    }

    function applyPopupGradient() {
        var defsEl = document.getElementById('DeviceDefs');
        if (!defsEl) return;
        var grad = document.getElementById('PopupGradient');
        if (!grad) return;
        // Match --dz-surface-2 token values: dark #2a2b35, light #f5f6fa
        var isDark = !document.body.classList.contains('dz-light');
        var stop1 = isDark ? '#2a2b35' : '#f5f6fa';
        var stop2 = isDark ? '#23252f' : '#edf0f5';
        var stops = grad.querySelectorAll('stop');
        if (stops[0]) stops[0].style.cssText = 'stop-color:' + stop1 + ';stop-opacity:1';
        if (stops[1]) stops[1].style.cssText = 'stop-color:' + stop2 + ';stop-opacity:1';
    }

    /* Re-apply gradient when dark/light mode is toggled.
       applyHighchartsTheme is the shared hook called by the dark/light toggle. */
    (function () {
        var _origHC = window.applyHighchartsTheme;
        window.applyHighchartsTheme = function (isDark) {
            if (_origHC) _origHC.apply(this, arguments);
            applyPopupGradient();
        };
    }());

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(patchFloorplanPopup, 300); });
    } else {
        setTimeout(patchFloorplanPopup, 300);
    }
})();

/* ── Domoticz "Icon style" setting ────────────────────────────────
   Domoticz can render its own interface with classic images or with Font
   Awesome glyphs (Settings > Icon style, classic by default). Nightglass is
   built on the glyphs throughout — per-device colours, the animation
   catalogue and the navbar replacement all key off them — so the theme pins
   the running config to glyphs and hides the control rather than offering a
   choice half of the theme cannot render.

   Only the in-memory config is forced; the stored preference is left alone,
   so uninstalling the theme gives the user back whatever they had. */
(function () {
    'use strict';

    function forceGlyphStyle() {
        try {
            var body = window.angular && angular.element(document.body);
            var injector = body && body.injector && body.injector();
            if (injector) {
                var cfg = injector.get('$rootScope').config;
                if (cfg && cfg.IconStyle != 1) cfg.IconStyle = 1;
            }
        } catch (e) { /* Angular not up yet; the next burst retries */ }

        if (window.$ && $.myglobals) $.myglobals.iconGlyphs = true;
        document.documentElement.classList.add('dz-icons-glyph');

        var sel = document.getElementById('comboiconstyle');
        if (sel) {
            /* Hide the whole row, not just the select, so its label goes too. */
            var row = sel.closest && sel.closest('tr');
            if (row) row.style.display = 'none';
        }
    }

    forceGlyphStyle();
    window._dzExtraProcessors = window._dzExtraProcessors || [];
    window._dzExtraProcessors.push(forceGlyphStyle);
})();
