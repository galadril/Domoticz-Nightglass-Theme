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

    /* -- Angular scope helper: get the device object for a DOM node --
       Walks up the DOM at click-time (lazy) so there are no race
       conditions with Angular's multi-cycle render.                  */
    function getDeviceFromIcon(el) {
        if (!window.angular) return null;
        var node = el;
        while (node && node !== document.body) {
            try {
                var scope = angular.element(node).scope();
                if (scope) {
                    /* dzLightWidget exposes device on ctrl.device or
                       directly as scope.device / scope.item          */
                    var d = (scope.ctrl && scope.ctrl.device) ||
                             scope.device || scope.item || scope.widget;
                    if (d && d.Type !== undefined) return d;
                }
            } catch (e) {}
            node = node.parentElement;
        }
        return null;
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

        // Visually hide the original but keep it for event bubbling
        el.style.opacity      = '0';
        el.style.pointerEvents = 'none';
        el.setAttribute('data-dz-replaced', 'true');
        el.setAttribute('data-dz-orig-href', src);

        // <foreignObject> hosts an HTML <i> inside SVG
        var fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        fo.setAttribute('x',       x);
        fo.setAttribute('y',       y);
        fo.setAttribute('width',   w);
        fo.setAttribute('height',  h);
        fo.setAttribute('overflow', 'visible');
        fo.setAttribute('class',   'dz-fp-icon-wrap');

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

    /* Expose a device-icon lookup for other modules (e.g. command palette).
       Given a Domoticz device object with TypeImg + Status fields, returns
       { icon: 'fa-solid fa-...', color: '#rrggbb' } or null.               */
    window._dzIconForDevice = function (device) {
        var typeImg = device.TypeImg || '';
        // Build a synthetic image path that parseDeviceSrc / resolveIcon can parse
        var on   = !!(device.Status && (
            ['On','Group On','Chime','Panic','Mixed'].indexOf(device.Status) >= 0 ||
            device.Status.indexOf('Set ') === 0));
        var suffix = on ? '_On' : '_Off';
        var src = 'images/' + typeImg + '48' + suffix + '.png';
        var r = resolveIcon(src);
        if (r && r.cls) {
            // strip dz-fa-device / dz-wind helper classes — just the FA classes
            var fa = r.cls.split(' ').filter(function (c) {
                return c.indexOf('fa-') === 0 || c === 'fa-solid' || c === 'fa-regular';
            }).join(' ');
            return { icon: fa || r.cls, color: r.color };
        }
        return null;
    };

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
