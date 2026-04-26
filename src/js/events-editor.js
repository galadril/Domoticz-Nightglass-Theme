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
    };

    var iconClasses = Object.keys(ICON_CLASS_MAP);

    function swapIcons() {
        var container = document.querySelector('.events-editor');
        if (!container) return;
        var selector = iconClasses.map(function (c) { return '.' + c; }).join(',');
        var els = container.querySelectorAll(selector);
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

/* ── Automation Wizard ─────────────────────────────────────────────
   A multi-step overlay that lets users visually compose a trigger +
   actions and generates ready-to-use dzVents code, optionally
   injected directly into the Ace editor.
   ─────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    /* ── Trigger / action definitions ──────────────────────────────── */
    var TRIGGERS = [
        { id: 'device',   icon: 'fa-plug',         label: 'Device State',  desc: 'When a device turns on, off, or changes value' },
        { id: 'time',     icon: 'fa-clock',         label: 'Time Schedule', desc: 'At a specific time with optional day filter' },
        { id: 'sun',      icon: 'fa-sun',           label: 'Sun Event',     desc: 'At sunrise or sunset with optional offset' },
        { id: 'interval', icon: 'fa-rotate',        label: 'Interval',      desc: 'Repeat every N minutes or hours' },
        { id: 'security', icon: 'fa-shield-halved', label: 'Security',      desc: 'When the security panel state changes' },
        { id: 'variable', icon: 'fa-list-check',    label: 'Variable',      desc: 'When a user variable is updated' },
    ];

    var ACTIONS = [
        { id: 'switch',   icon: 'fa-toggle-on',    label: 'Switch Device', desc: 'Turn on, off, toggle or dim a device' },
        { id: 'notify',   icon: 'fa-bell',          label: 'Notification',  desc: 'Send a push notification or alert' },
        { id: 'scene',    icon: 'fa-layer-group',   label: 'Scene',         desc: 'Activate or deactivate a scene' },
        { id: 'variable', icon: 'fa-pen-to-square', label: 'Set Variable',  desc: 'Update a user variable value' },
        { id: 'http',     icon: 'fa-globe',         label: 'HTTP Request',  desc: 'Call a webhook or external service' },
        { id: 'custom',   icon: 'fa-code',          label: 'Custom Code',   desc: 'Write your own dzVents Lua snippet' },
    ];

    var STEP_LABELS = ['Trigger', 'Configure', 'Actions', 'Review'];

    /* ── Per-device-category condition options ──────────────────────── */
    var DEVICE_CONDITIONS = {
        switch:      [{ id:'any',label:'Any change'},{id:'on',label:'Turns On'},{id:'off',label:'Turns Off'}],
        dimmer:      [{ id:'any',label:'Any change'},{id:'on',label:'Turns On'},{id:'off',label:'Turns Off'},
                      {id:'level_above',label:'Level above',hasValue:true,unit:'%',def:50},
                      {id:'level_below',label:'Level below',hasValue:true,unit:'%',def:50}],
        motion:      [{id:'any',label:'Any change'},{id:'on',label:'Motion detected'},{id:'off',label:'No motion'}],
        door:        [{id:'any',label:'Any change'},{id:'open',label:'Opens'},{id:'closed',label:'Closes'}],
        temperature: [{id:'any',label:'Any change'},
                      {id:'above',label:'Above',hasValue:true,unit:'°',def:20},
                      {id:'below',label:'Below',hasValue:true,unit:'°',def:20}],
        temphum:     [{id:'any',label:'Any change'},
                      {id:'temp_above',label:'Temperature above',hasValue:true,unit:'°',def:20},
                      {id:'temp_below',label:'Temperature below',hasValue:true,unit:'°',def:20},
                      {id:'hum_above', label:'Humidity above',  hasValue:true,unit:'%',def:60},
                      {id:'hum_below', label:'Humidity below',  hasValue:true,unit:'%',def:60}],
        humidity:    [{id:'any',label:'Any change'},
                      {id:'above',label:'Above',hasValue:true,unit:'%',def:60},
                      {id:'below',label:'Below',hasValue:true,unit:'%',def:60}],
        percentage:  [{id:'any',label:'Any change'},
                      {id:'above',label:'Above',hasValue:true,unit:'%',def:50},
                      {id:'below',label:'Below',hasValue:true,unit:'%',def:50}],
        power:       [{id:'any',label:'Any change'},
                      {id:'above',label:'Usage above',hasValue:true,unit:'W',def:100},
                      {id:'below',label:'Usage below',hasValue:true,unit:'W',def:100}],
        wind:        [{id:'any',label:'Any change'},{id:'above',label:'Speed above',hasValue:true,unit:'bft',def:5}],
        rain:        [{id:'any',label:'Any change'},{id:'above',label:'Rate above',hasValue:true,unit:'mm/h',def:5}],
        uv:          [{id:'any',label:'Any change'},{id:'above',label:'UV index above',hasValue:true,unit:'',def:5}],
        co2:         [{id:'any',label:'Any change'},
                      {id:'above',label:'CO₂ above',hasValue:true,unit:'ppm',def:1000},
                      {id:'below',label:'CO₂ below',hasValue:true,unit:'ppm',def:1000}],
        lux:         [{id:'any',label:'Any change'},
                      {id:'above',label:'Above',hasValue:true,unit:'lux',def:500},
                      {id:'below',label:'Below',hasValue:true,unit:'lux',def:500}],
        voltage:     [{id:'any',label:'Any change'},
                      {id:'above',label:'Above',hasValue:true,unit:'V',def:12},
                      {id:'below',label:'Below',hasValue:true,unit:'V',def:12}],
        counter:     [{id:'any',label:'Any change'},{id:'above',label:'Counter above',hasValue:true,unit:'',def:100}],
        custom:      [{id:'any',label:'Any change'},
                      {id:'above',label:'Value above',hasValue:true,unit:'',def:0},
                      {id:'below',label:'Value below',hasValue:true,unit:'',def:0}],
    };

    /* ── State ──────────────────────────────────────────────────────── */
    var st = { step: 1, triggerType: null, triggerConfig: {}, actions: [], name: '' };
    var _devs = null, _scenes = null, _wizAce = null;

    /* ── API ────────────────────────────────────────────────────────── */
    function loadDevs(cb) {
        if (_devs) { cb(_devs); return; }
        fetch('json.htm?type=command&param=getdevices&filter=all&used=true&order=Name', { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (d) { _devs = d.result || []; cb(_devs); })
            .catch(function () { cb([]); });
    }

    function loadScenes(cb) {
        if (_scenes) { cb(_scenes); return; }
        $.getJSON('json.htm?type=command&param=getscenes', function (d) {
            _scenes = (d && d.result) ? d.result : [];
            cb(_scenes);
        }).fail(function () { cb([]); });
    }

    /* ── Device category detection ──────────────────────────────────── */
    function getDeviceCategory(dev) {
        if (!dev) return 'switch';
        var type   = (dev.Type       || '').toLowerCase();
        var sub    = (dev.SubType    || '').toLowerCase();
        var sw     = (dev.SwitchType || '').toLowerCase();

        if (sw === 'dimmer' || sw === 'blinds' || sw === 'venetian blinds') return 'dimmer';
        if (sw === 'motion sensor')                                          return 'motion';
        if (/door/.test(sw))                                                 return 'door';

        if (type === 'temp')                                       return 'temperature';
        if (/^temp\s*\+\s*hum/.test(type))                        return 'temphum';
        if (type === 'humidity')                                   return 'humidity';
        if (type === 'wind')                                       return 'wind';
        if (type === 'rain')                                       return 'rain';
        if (type === 'uv')                                         return 'uv';
        if (type === 'air quality')                                return 'co2';
        if (type === 'lux')                                        return 'lux';
        if (/p1 smart meter/.test(type) || sub === 'kwh')         return 'power';
        if (type === 'rfxmeter')                                   return 'counter';

        if (sub === 'temperature')                                 return 'temperature';
        if (sub === 'humidity')                                    return 'humidity';
        if (sub === 'percentage')                                  return 'percentage';
        if (sub === 'custom sensor')                               return 'custom';
        if (sub === 'kwh')                                         return 'power';
        if (sub === 'voltage')                                     return 'voltage';
        if (sub === 'lux')                                         return 'lux';

        return 'switch';
    }

    /* ── Condition → Lua expression ─────────────────────────────────── */
    var _COND_EXPR = {
        on:         "device.state == 'On'",
        off:        "device.state == 'Off'",
        open:       "device.state == 'Open'",
        closed:     "device.state == 'Closed'",
        level_above:'device.level > {v}',
        level_below:'device.level < {v}',
        above: {
            temperature:'device.temperature > {v}',
            temphum:    'device.temperature > {v}',
            humidity:   'device.humidity > {v}',
            percentage: 'device.percentage > {v}',
            power:      'device.usage > {v}',
            wind:       'device.speed > {v}',
            rain:       'device.rain > {v}',
            uv:         'device.uv > {v}',
            co2:        'device.co2 > {v}',
            lux:        'device.lux > {v}',
            voltage:    'device.voltage > {v}',
            counter:    'device.counter > {v}',
            custom:     'device.sensorValue > {v}',
        },
        below: {
            temperature:'device.temperature < {v}',
            temphum:    'device.temperature < {v}',
            humidity:   'device.humidity < {v}',
            percentage: 'device.percentage < {v}',
            power:      'device.usage < {v}',
            co2:        'device.co2 < {v}',
            lux:        'device.lux < {v}',
            voltage:    'device.voltage < {v}',
            custom:     'device.sensorValue < {v}',
        },
        temp_above: 'device.temperature > {v}',
        temp_below: 'device.temperature < {v}',
        hum_above:  'device.humidity > {v}',
        hum_below:  'device.humidity < {v}',
    };

    function buildConditionLine(tc, indent) {
        var c   = tc.condition;
        var cat = tc.deviceCategory || 'switch';
        var v   = tc.conditionValue != null ? tc.conditionValue : 0;
        if (!c || c === 'any') return null;

        var expr = _COND_EXPR[c];
        if (typeof expr === 'object') expr = expr[cat]; // 'above'/'below' are cat-keyed
        if (!expr) return null;
        return indent + 'if (' + expr.replace('{v}', v) + ') then';
    }

    /* ── Code generation ────────────────────────────────────────────── */
    function luaEsc(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

    function generateCode() {
        var i4 = '    ', i8 = '        ', i12 = '            ';
        var t = st.triggerType, tc = st.triggerConfig;
        var L = [];

        L.push('return {');
        L.push(i4 + 'active = true,');
        L.push(i4 + 'logging = {');
        L.push(i8  + 'level = domoticz.LOG_INFO,');
        L.push(i8  + "marker = '" + luaEsc(st.name || 'MyAutomation') + "'");
        L.push(i4 + '},');
        L.push(i4 + 'on = {');

        if (t === 'device') {
            L.push(i8 + 'devices = {');
            L.push(i12 + "'" + luaEsc(tc.device || 'Your Device') + "'");
            L.push(i8 + '},');
        } else if (t === 'time') {
            var days = tc.days ? ' on ' + tc.days : '';
            L.push(i8 + 'timer = {');
            L.push(i12 + "'at " + (tc.time || '07:00') + days + "'");
            L.push(i8 + '},');
        } else if (t === 'sun') {
            var ev  = tc.event || 'sunrise';
            var off = parseInt(tc.offset) || 0;
            var sun = off === 0 ? 'at ' + ev
                    : Math.abs(off) + ' minutes ' + (off < 0 ? 'before' : 'after') + ' ' + ev;
            L.push(i8 + 'timer = {');
            L.push(i12 + "'" + sun + "'");
            L.push(i8 + '},');
        } else if (t === 'interval') {
            var n = parseInt(tc.value) || 5, unit = tc.unit || 'minutes';
            var iv = (n === 1 && unit === 'hours') ? 'every hour' : 'every ' + n + ' ' + unit;
            L.push(i8 + 'timer = {');
            L.push(i12 + "'" + iv + "'");
            L.push(i8 + '},');
        } else if (t === 'security') {
            L.push(i8 + 'security = {');
            L.push(i12 + 'domoticz.' + (tc.state || 'SECURITY_ARMED_AWAY'));
            L.push(i8 + '},');
        } else if (t === 'variable') {
            L.push(i8 + 'variables = {');
            L.push(i12 + "'" + luaEsc(tc.varName || 'YourVariable') + "'");
            L.push(i8 + '},');
        }

        L.push(i4 + '},');

        var param = t === 'device' ? 'device'
                  : t === 'variable' ? 'variable'
                  : t === 'security' ? 'security' : 'timer';
        L.push(i4 + 'execute = function(domoticz, ' + param + ')');

        var bi = i8;
        var condLine = t === 'device' ? buildConditionLine(tc, i8) : null;
        if (condLine) { L.push(condLine); bi = i12; }

        if (!st.actions.length) {
            L.push(bi + '-- Add your actions here');
        } else {
            st.actions.forEach(function (a) {
                var c = a.config || {};
                if (a.type === 'switch') {
                    var act = c.action || 'switchOn';
                    if (act === 'dim') {
                        L.push(bi + "domoticz.devices('" + luaEsc(c.device || 'Device') + "').dimTo(" + (parseInt(c.level) || 50) + ")");
                    } else {
                        L.push(bi + "domoticz.devices('" + luaEsc(c.device || 'Device') + "')." + act + "()");
                    }
                } else if (a.type === 'notify') {
                    L.push(bi + "domoticz.notify('" + luaEsc(c.title || 'Alert') + "', '" + luaEsc(c.message || '') + "', domoticz.PRIORITY_NORMAL)");
                } else if (a.type === 'scene') {
                    var sa = c.action === 'off' ? 'deActivate' : 'activate';
                    L.push(bi + "domoticz.scenes('" + luaEsc(c.scene || 'Scene') + "')." + sa + "()");
                } else if (a.type === 'variable') {
                    var vv = (c.value !== undefined && c.value !== '') ? c.value : '0';
                    var vvs = isNaN(Number(vv)) ? "'" + luaEsc(String(vv)) + "'" : vv;
                    L.push(bi + "domoticz.variables('" + luaEsc(c.varName || 'MyVar') + "').set(" + vvs + ")");
                } else if (a.type === 'http') {
                    L.push(bi + 'domoticz.openURL({');
                    L.push(bi + i4 + "url = '" + luaEsc(c.url || 'https://example.com/webhook') + "',");
                    L.push(bi + i4 + "method = '" + (c.method || 'GET') + "'");
                    L.push(bi + '})');
                } else if (a.type === 'custom') {
                    (c.code || '-- your code here').split('\n').forEach(function (l) { L.push(bi + l); });
                }
            });
        }

        if (condLine) L.push(i8 + 'end');
        L.push(i4 + 'end');
        L.push('}');
        return L.join('\n');
    }

    /* ── Syntax highlighting ────────────────────────────────────────── */
    function escH(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function highlightLua(code) {
        return code.split('\n').map(function (line) {
            var h = escH(line);
            if (/^\s*--/.test(line)) return '<span class="nwc-cmt">' + h + '</span>';
            h = h.replace(/( --[^\n]*)$/, '<span class="nwc-cmt">$1</span>');
            h = h.replace(/\b(return|function|end|if|then|else|elseif|local|and|or|not|nil|true|false)\b/g,
                '<span class="nwc-kw">$1</span>');
            h = h.replace(/\bdomoticz\b/g, '<span class="nwc-obj">domoticz</span>');
            h = h.replace(/'([^']*)'/g, "<span class=\"nwc-str\">'$1'</span>");
            h = h.replace(/\b(\d+)\b/g, '<span class="nwc-num">$1</span>');
            return h;
        }).join('\n');
    }

    /* ── DOM helpers ────────────────────────────────────────────────── */
    function mk(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls)  e.className = cls;
        if (html !== undefined) e.innerHTML = html;
        return e;
    }

    function opt(val, label, cur) {
        return '<option value="' + escH(val) + '"' + (val === cur ? ' selected' : '') + '>' + escH(label) + '</option>';
    }

    function cardHTML(item, sel) {
        return '<div class="ng-wiz-card' + (sel ? ' wiz-selected' : '') + '" data-id="' + item.id + '">' +
            '<div class="ng-wiz-card-icon"><i class="fa-solid ' + item.icon + '"></i></div>' +
            '<div class="ng-wiz-card-text"><h5>' + item.label + '</h5><p>' + item.desc + '</p></div></div>';
    }

    /* ── Step renderers ─────────────────────────────────────────────── */

    function renderStep1(body) {
        var html = '<div class="ng-wiz-step-heading"><h4>What triggers this automation?</h4>' +
            '<p>Choose the type of event that will start this automation.</p></div>' +
            '<div class="ng-wiz-grid">';
        TRIGGERS.forEach(function (t) { html += cardHTML(t, st.triggerType === t.id); });
        html += '</div>';
        body.innerHTML = html;

        body.querySelectorAll('.ng-wiz-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var id = this.getAttribute('data-id');
                if (st.triggerType !== id) { st.triggerType = id; st.triggerConfig = {}; }
                body.querySelectorAll('.ng-wiz-card').forEach(function (c) { c.classList.remove('wiz-selected'); });
                this.classList.add('wiz-selected');
                updateFooter();
            });
        });
    }

    function renderStep2(body) {
        var t  = st.triggerType;
        var tc = st.triggerConfig;
        var def = TRIGGERS.find(function (x) { return x.id === t; }) || { label: '' };

        var html = '<div class="ng-wiz-step-heading"><h4>Configure the trigger</h4>' +
            '<p>Set the details for your <strong>' + def.label + '</strong> trigger.</p></div>';

        if (t === 'device') {
            html += '<div class="ng-wiz-form">' +
                '<div class="ng-wiz-field"><label>Device</label>' +
                '<div id="nwf-device-picker"></div></div>' +
                '<div class="ng-wiz-field"><label>Condition</label>' +
                '<select id="nwf-condition">' + opt('any', 'Any change', 'any') + '</select></div>' +
                '<div class="ng-wiz-field ng-wiz-row" id="nwf-condval-wrap" style="display:none">' +
                '<div class="ng-wiz-field" style="flex:1"><label id="nwf-condval-label">Value</label>' +
                '<input type="number" id="nwf-condval" step="0.1" value="' + (tc.conditionValue != null ? tc.conditionValue : '') + '">' +
                '</div></div></div>';
        } else if (t === 'time') {
            html += '<div class="ng-wiz-form"><div class="ng-wiz-row">' +
                '<div class="ng-wiz-field"><label>Time</label>' +
                '<input type="time" id="nwf-time" value="' + escH(tc.time || '07:00') + '"></div>' +
                '<div class="ng-wiz-field"><label>Days</label><select id="nwf-days">' +
                opt('',                    'Every day', tc.days) +
                opt('mon,tue,wed,thu,fri', 'Weekdays',  tc.days) +
                opt('sat,sun',             'Weekend',   tc.days) +
                opt('mon', 'Monday', tc.days) + opt('tue', 'Tuesday',   tc.days) +
                opt('wed', 'Wednesday', tc.days) + opt('thu', 'Thursday', tc.days) +
                opt('fri', 'Friday',  tc.days) + opt('sat', 'Saturday', tc.days) +
                opt('sun', 'Sunday',  tc.days) +
                '</select></div></div></div>';
        } else if (t === 'sun') {
            html += '<div class="ng-wiz-form"><div class="ng-wiz-row">' +
                '<div class="ng-wiz-field"><label>Event</label><select id="nwf-sunevent">' +
                opt('sunrise', 'Sunrise', tc.event || 'sunrise') +
                opt('sunset',  'Sunset',  tc.event) + '</select></div>' +
                '<div class="ng-wiz-field"><label>Offset (minutes, negative = before)</label>' +
                '<input type="number" id="nwf-sunoffset" value="' + (tc.offset || 0) + '" min="-120" max="120">' +
                '</div></div></div>';
        } else if (t === 'interval') {
            html += '<div class="ng-wiz-form"><div class="ng-wiz-row">' +
                '<div class="ng-wiz-field"><label>Every</label>' +
                '<input type="number" id="nwf-ivval" value="' + (tc.value || 5) + '" min="1" max="1440"></div>' +
                '<div class="ng-wiz-field"><label>Unit</label><select id="nwf-ivunit">' +
                opt('minutes', 'Minutes', tc.unit || 'minutes') +
                opt('hours',   'Hours',   tc.unit) + '</select></div></div></div>';
        } else if (t === 'security') {
            html += '<div class="ng-wiz-form"><div class="ng-wiz-field"><label>Security state</label>' +
                '<select id="nwf-secstate">' +
                opt('SECURITY_ARMED_AWAY', 'Armed Away', tc.state || 'SECURITY_ARMED_AWAY') +
                opt('SECURITY_ARMED_HOME', 'Armed Home', tc.state) +
                opt('SECURITY_DISARMED',   'Disarmed',   tc.state) + '</select></div></div>';
        } else if (t === 'variable') {
            html += '<div class="ng-wiz-form"><div class="ng-wiz-field"><label>Variable name</label>' +
                '<input type="text" id="nwf-varname" value="' + escH(tc.varName || '') + '" placeholder="e.g. MyVar">' +
                '</div></div>';
        }

        body.innerHTML = html;

        // Pre-populate state defaults so code gen always has them
        if (t === 'time'     && !tc.time)          tc.time      = '07:00';
        if (t === 'sun'      && !tc.event)          tc.event     = 'sunrise';
        if (t === 'sun'      && tc.offset == null)  tc.offset    = 0;
        if (t === 'interval' && !tc.value)          tc.value     = 5;
        if (t === 'interval' && !tc.unit)           tc.unit      = 'minutes';
        if (t === 'security' && !tc.state)          tc.state     = 'SECURITY_ARMED_AWAY';
        if (t === 'device'   && !tc.condition)      tc.condition = 'any';

        function bnd(id, key) {
            var el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', function () { tc[key] = this.value; updateFooter(); });
            el.addEventListener('input',  function () { tc[key] = this.value; updateFooter(); });
        }

        if (t === 'device') {
            // Restore condition options if device category is already known
            if (tc.deviceCategory) updateDeviceCondition({ _cat: tc.deviceCategory }, tc);
            buildDevicePicker('nwf-device-picker', tc.device, function (name, dev) {
                tc.device = name;
                updateDeviceCondition(dev, tc);
                updateFooter();
            });
        }
        bnd('nwf-time',      'time');
        bnd('nwf-days',      'days');
        bnd('nwf-sunevent',  'event');
        bnd('nwf-sunoffset', 'offset');
        bnd('nwf-ivval',     'value');
        bnd('nwf-ivunit',    'unit');
        bnd('nwf-secstate',  'state');
        bnd('nwf-varname',   'varName');
    }

    function renderStep3(body) {
        body.innerHTML =
            '<div class="ng-wiz-step-heading"><h4>What should happen?</h4>' +
            '<p>Add one or more actions. They run in order when the trigger fires.</p></div>' +
            '<div class="ng-wiz-actions-list" id="nw-act-list"></div>' +
            '<button class="ng-wiz-add-action-btn" id="nw-add-act">' +
            '<i class="fa-solid fa-plus"></i> Add Action</button>';

        renderActionList();
        document.getElementById('nw-add-act').addEventListener('click', openActionPicker);
    }

    function renderActionList() {
        var list = document.getElementById('nw-act-list');
        if (!list) return;
        list.innerHTML = '';

        if (!st.actions.length) {
            list.innerHTML =
                '<div class="ng-wiz-empty-hint"><i class="fa-solid fa-wand-magic-sparkles"></i>' +
                'No actions yet — click "Add Action" below.</div>';
            return;
        }

        st.actions.forEach(function (a, idx) {
            var def = ACTIONS.find(function (x) { return x.id === a.type; }) || { icon: 'fa-bolt', label: a.type };
            var item = mk('div', 'ng-wiz-action-item');
            item.innerHTML =
                '<div class="ng-wiz-action-header">' +
                '<div class="ng-wiz-action-icon"><i class="fa-solid ' + def.icon + '"></i></div>' +
                '<div class="ng-wiz-action-label">' + def.label + '</div>' +
                '<div class="ng-wiz-action-summary">' + actionSummary(a) + '</div>' +
                '<button class="ng-wiz-action-remove" data-idx="' + idx + '" title="Remove">' +
                '<i class="fa-solid fa-xmark"></i></button></div>' +
                '<div class="ng-wiz-action-body">' + actionFormHTML(a, idx) + '</div>';
            list.appendChild(item);
        });

        list.querySelectorAll('.ng-wiz-action-remove').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                st.actions.splice(parseInt(this.getAttribute('data-idx')), 1);
                renderActionList();
            });
        });

        st.actions.forEach(function (a, idx) { wireActionForm(a, idx); });
    }

    function actionSummary(a) {
        var c = a.config || {};
        if (a.type === 'switch')   return escH((c.device  || '') + (c.action ? ' · ' + c.action : ''));
        if (a.type === 'notify')   return escH(c.title    || 'Notification');
        if (a.type === 'scene')    return escH(c.scene    || 'Scene');
        if (a.type === 'variable') return 'Set ' + escH(c.varName || 'variable');
        if (a.type === 'http')     return escH((c.url || '').replace(/^https?:\/\//, '').substring(0, 28));
        if (a.type === 'custom')   return 'Lua snippet';
        return '';
    }

    function actionFormHTML(a, idx) {
        var c = a.config || {}, p = 'nwa' + idx;
        if (a.type === 'switch') {
            return '<div class="ng-wiz-form"><div class="ng-wiz-row">' +
                '<div class="ng-wiz-field"><label>Device</label>' +
                '<div id="' + p + '-dev-picker"></div></div>' +
                '<div class="ng-wiz-field"><label>Action</label><select id="' + p + '-act">' +
                opt('switchOn',     'Turn On',  c.action || 'switchOn') +
                opt('switchOff',    'Turn Off', c.action) +
                opt('toggleSwitch', 'Toggle',   c.action) +
                opt('dim',          'Dim to %', c.action) +
                '</select></div></div>' +
                '<div class="ng-wiz-field" id="' + p + '-dw" style="' + (c.action === 'dim' ? '' : 'display:none') + '">' +
                '<label>Dim level (%)</label>' +
                '<input type="number" id="' + p + '-lv" value="' + (c.level || 50) + '" min="0" max="100">' +
                '</div></div>';
        } else if (a.type === 'notify') {
            return '<div class="ng-wiz-form">' +
                '<div class="ng-wiz-field"><label>Title</label>' +
                '<input type="text" id="' + p + '-ttl" value="' + escH(c.title || '') + '" placeholder="Alert title"></div>' +
                '<div class="ng-wiz-field"><label>Message</label>' +
                '<input type="text" id="' + p + '-msg" value="' + escH(c.message || '') + '" placeholder="Something happened!"></div></div>';
        } else if (a.type === 'scene') {
            return '<div class="ng-wiz-form"><div class="ng-wiz-row">' +
                '<div class="ng-wiz-field"><label>Scene</label>' +
                '<select id="' + p + '-sc"><option value="">Loading…</option></select></div>' +
                '<div class="ng-wiz-field"><label>Action</label><select id="' + p + '-sa">' +
                opt('on',  'Activate',   c.action || 'on') +
                opt('off', 'Deactivate', c.action) + '</select></div></div></div>';
        } else if (a.type === 'variable') {
            return '<div class="ng-wiz-form"><div class="ng-wiz-row">' +
                '<div class="ng-wiz-field"><label>Variable name</label>' +
                '<input type="text" id="' + p + '-vn" value="' + escH(c.varName || '') + '" placeholder="MyVar"></div>' +
                '<div class="ng-wiz-field"><label>New value</label>' +
                '<input type="text" id="' + p + '-vv" value="' + escH(c.value !== undefined ? String(c.value) : '') + '" placeholder="42"></div>' +
                '</div></div>';
        } else if (a.type === 'http') {
            return '<div class="ng-wiz-form"><div class="ng-wiz-row">' +
                '<div class="ng-wiz-field" style="flex:3"><label>URL</label>' +
                '<input type="url" id="' + p + '-url" value="' + escH(c.url || '') + '" placeholder="https://…"></div>' +
                '<div class="ng-wiz-field" style="flex:1"><label>Method</label><select id="' + p + '-meth">' +
                opt('GET',  'GET',  c.method || 'GET') +
                opt('POST', 'POST', c.method) + '</select></div></div></div>';
        } else if (a.type === 'custom') {
            return '<div class="ng-wiz-form"><div class="ng-wiz-field"><label>Lua snippet</label>' +
                '<textarea id="' + p + '-code" spellcheck="false">' + escH(c.code || '') + '</textarea></div></div>';
        }
        return '';
    }

    /* ── Dynamic condition field ────────────────────────────────────── */
    function updateDeviceCondition(dev, tc) {
        var cat = dev && dev._cat ? dev._cat : getDeviceCategory(dev);
        tc.deviceCategory = cat;

        var opts = DEVICE_CONDITIONS[cat] || DEVICE_CONDITIONS.switch;
        var valid = opts.some(function (o) { return o.id === tc.condition; });
        if (!valid) { tc.condition = 'any'; tc.conditionValue = undefined; }

        var sel = document.getElementById('nwf-condition');
        if (!sel) return;
        sel.innerHTML = '';
        opts.forEach(function (o) {
            var el = document.createElement('option');
            el.value = o.id; el.textContent = o.label;
            el.selected = o.id === (tc.condition || 'any');
            sel.appendChild(el);
        });

        var curOpt = opts.find(function (o) { return o.id === (tc.condition || 'any'); });
        toggleConditionValue(curOpt, tc);

        sel.onchange = function () {
            tc.condition = this.value;
            var newOpt = opts.find(function (o) { return o.id === this.value; }, this);
            toggleConditionValue(newOpt, tc);
            updateFooter();
        };
    }

    function toggleConditionValue(condOpt, tc) {
        var wrap = document.getElementById('nwf-condval-wrap');
        var inp  = document.getElementById('nwf-condval');
        var lbl  = document.getElementById('nwf-condval-label');
        if (!wrap || !inp) return;
        if (condOpt && condOpt.hasValue) {
            wrap.style.display = '';
            if (lbl) lbl.textContent = 'Value' + (condOpt.unit ? ' (' + condOpt.unit + ')' : '');
            if (tc.conditionValue == null) tc.conditionValue = condOpt.def;
            inp.value = tc.conditionValue;
            inp.onchange = inp.oninput = function () { tc.conditionValue = parseFloat(this.value); };
        } else {
            wrap.style.display = 'none';
            tc.conditionValue = undefined;
        }
    }

    /* ── Searchable device picker ───────────────────────────────────── */
    function buildDevicePicker(containerId, currentValue, onChange) {
        var wrap = document.getElementById(containerId);
        if (!wrap) return;

        var selectedName = currentValue || '';
        wrap.className = 'ng-wiz-dev-picker';
        wrap.innerHTML =
            '<div class="ng-wiz-dp-selected' + (selectedName ? ' ng-wiz-dp-has-sel' : '') + '">' +
            '<i class="fa-solid fa-plug"></i>' +
            '<span class="ng-wiz-dp-sel-name">' + (selectedName ? escH(selectedName) : 'Select a device…') + '</span>' +
            '</div>' +
            '<input class="ng-wiz-dp-search" type="text" placeholder="Search devices…" autocomplete="off">' +
            '<div class="ng-wiz-dp-list"><div class="ng-wiz-dp-loading">Loading devices…</div></div>';

        var searchEl = wrap.querySelector('.ng-wiz-dp-search');
        var listEl   = wrap.querySelector('.ng-wiz-dp-list');
        var selWrap  = wrap.querySelector('.ng-wiz-dp-selected');
        var selEl    = wrap.querySelector('.ng-wiz-dp-sel-name');
        var allDevs  = [];

        function renderList(q) {
            q = (q || '').toLowerCase().trim();
            var hits = q ? allDevs.filter(function (d) { return d.Name.toLowerCase().indexOf(q) !== -1; }) : allDevs;
            if (!hits.length) {
                listEl.innerHTML = '<div class="ng-wiz-dp-empty">No devices found.</div>';
                return;
            }
            listEl.innerHTML = '';
            hits.slice(0, 60).forEach(function (d) {
                var row = mk('div', 'ng-wiz-dp-row' + (d.Name === selectedName ? ' ng-wiz-dp-row--sel' : ''));
                row.innerHTML =
                    '<span class="ng-wiz-dp-row-name">' + escH(d.Name) + '</span>' +
                    '<span class="ng-wiz-dp-row-type">' + escH(d.Type || '') + '</span>';
                row.addEventListener('click', function () {
                    selectedName = d.Name;
                    selEl.textContent = d.Name;
                    selWrap.classList.add('ng-wiz-dp-has-sel');
                    listEl.querySelectorAll('.ng-wiz-dp-row--sel').forEach(function (r) { r.classList.remove('ng-wiz-dp-row--sel'); });
                    row.classList.add('ng-wiz-dp-row--sel');
                    onChange(d.Name, d);
                });
                listEl.appendChild(row);
            });
        }

        loadDevs(function (devs) { allDevs = devs; renderList(''); });
        searchEl.addEventListener('input', function () { renderList(this.value); });
    }

    function wireActionForm(a, idx) {
        var c = a.config = a.config || {}, p = 'nwa' + idx;

        function bnd(id, key) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', function () { c[key] = this.value; });
        }

        if (a.type === 'switch') {
            buildDevicePicker(p + '-dev-picker', c.device, function (name) { c.device = name; });
            var actEl  = document.getElementById(p + '-act');
            var dimWrp = document.getElementById(p + '-dw');
            if (actEl) actEl.addEventListener('change', function () {
                c.action = this.value;
                if (dimWrp) dimWrp.style.display = this.value === 'dim' ? '' : 'none';
            });
            bnd(p + '-lv', 'level');
        } else if (a.type === 'notify') {
            bnd(p + '-ttl', 'title');
            bnd(p + '-msg', 'message');
        } else if (a.type === 'scene') {
            loadScenes(function (scs) {
                var sel = document.getElementById(p + '-sc');
                if (!sel) return;
                sel.innerHTML = '<option value="">— Select —</option>';
                scs.forEach(function (sc) {
                    var o = document.createElement('option');
                    o.value = sc.Name; o.textContent = sc.Name;
                    if (sc.Name === c.scene) o.selected = true;
                    sel.appendChild(o);
                });
                sel.addEventListener('change', function () { c.scene = this.value; });
            });
            var saEl = document.getElementById(p + '-sa');
            if (saEl) saEl.addEventListener('change', function () { c.action = this.value; });
        } else if (a.type === 'variable') {
            bnd(p + '-vn', 'varName');
            bnd(p + '-vv', 'value');
        } else if (a.type === 'http') {
            bnd(p + '-url', 'url');
            var methEl = document.getElementById(p + '-meth');
            if (methEl) methEl.addEventListener('change', function () { c.method = this.value; });
        } else if (a.type === 'custom') {
            bnd(p + '-code', 'code');
        }
    }

    function renderStep4(body) {
        // Destroy any leftover Ace instance from a previous visit to this step
        if (_wizAce) { try { _wizAce.destroy(); } catch (e) {} _wizAce = null; }

        var code = generateCode();
        body.innerHTML =
            '<div class="ng-wiz-step-heading"><h4>Name &amp; review</h4>' +
            '<p>Give your automation a name and optionally tweak the code before creating it.</p></div>' +
            '<div class="ng-wiz-review-layout">' +
            '<div class="ng-wiz-form" style="max-width:100%">' +
            '<div class="ng-wiz-field"><label>Automation name</label>' +
            '<input type="text" id="nwf-aname" value="' + escH(st.name || '') + '" ' +
            'placeholder="e.g. Evening lights on" style="font-size:15px!important;font-weight:600;padding:9px 12px!important">' +
            '</div></div>' +
            '<div class="ng-wiz-code-preview">' +
            '<div class="ng-wiz-code-bar">' +
            '<span class="ng-wiz-code-lang"><i class="fa-solid fa-code"></i> dzVents — Lua</span>' +
            '<button class="ng-wiz-copy-btn" id="nwf-copy"><i class="fa-solid fa-copy"></i> Copy</button>' +
            '</div>' +
            '<div id="nwf-codeblk" class="ng-wiz-ace-preview"></div>' +
            '</div></div>';

        // Try to mount a real Ace editor; fall back to <pre> if Ace isn't loaded yet
        if (typeof ace !== 'undefined') {
            try {
                var ed = ace.edit('nwf-codeblk');
                ed.setTheme(localStorage.getItem('dz-ace-theme') || 'ace/theme/tomorrow_night');
                ed.session.setMode('ace/mode/lua');
                ed.setValue(code, -1);
                ed.setOptions({
                    fontSize: '13px',
                    showPrintMargin: false,
                    tabSize: 4,
                    useSoftTabs: true,
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true,
                });
                _wizAce = ed;
            } catch (e) { _fallbackPre(code); }
        } else {
            _fallbackPre(code);
        }

        function _fallbackPre(c) {
            var blk = document.getElementById('nwf-codeblk');
            if (blk) blk.innerHTML = '<pre class="ng-wiz-code-block" style="border:none;border-radius:0;max-height:300px">' + highlightLua(c) + '</pre>';
        }

        var nameInp = document.getElementById('nwf-aname');
        if (nameInp) {
            nameInp.addEventListener('input', function () {
                st.name = this.value;
                var nc = generateCode();
                if (_wizAce) {
                    _wizAce.setValue(nc, -1);
                } else {
                    var blk = document.getElementById('nwf-codeblk');
                    if (blk) blk.innerHTML = highlightLua(nc);
                }
            });
        }

        var copyBtn = document.getElementById('nwf-copy');
        if (copyBtn && navigator.clipboard) {
            copyBtn.addEventListener('click', function () {
                var txt = _wizAce ? _wizAce.getValue() : generateCode();
                navigator.clipboard.writeText(txt).then(function () {
                    copyBtn.classList.add('wiz-copied');
                    copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                    setTimeout(function () {
                        copyBtn.classList.remove('wiz-copied');
                        copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy';
                    }, 2200);
                });
            });
        }
    }

    /* ── Action type picker ─────────────────────────────────────────── */
    function openActionPicker() {
        var picker = document.getElementById('ng-wiz-action-picker');
        if (!picker) {
            picker = mk('div', '');
            picker.id = 'ng-wiz-action-picker';
            picker.innerHTML =
                '<div class="ng-wiz-picker-modal">' +
                '<div class="ng-wiz-picker-head">' +
                '<h4><i class="fa-solid fa-plus" style="margin-right:7px;color:var(--dz-accent)"></i>Choose an action type</h4>' +
                '<button class="ng-wiz-close" id="nw-picker-x" style="width:28px;height:28px;font-size:16px">&times;</button>' +
                '</div><div class="ng-wiz-picker-grid"></div></div>';
            document.body.appendChild(picker);
            picker.addEventListener('click', function (e) { if (e.target === picker) closeActionPicker(); });
            document.getElementById('nw-picker-x').addEventListener('click', closeActionPicker);
        }
        var grid = picker.querySelector('.ng-wiz-picker-grid');
        grid.innerHTML = '';
        ACTIONS.forEach(function (a) {
            var wrap = mk('div', '', cardHTML(a, false));
            wrap.querySelector('.ng-wiz-card').addEventListener('click', function () {
                st.actions.push({ type: a.id, config: {} });
                closeActionPicker();
                renderActionList();
            });
            grid.appendChild(wrap);
        });
        setTimeout(function () { picker.classList.add('wiz-open'); }, 10);
    }

    function closeActionPicker() {
        var picker = document.getElementById('ng-wiz-action-picker');
        if (picker) picker.classList.remove('wiz-open');
    }

    /* ── Wizard open / close ────────────────────────────────────────── */
    function openWizard() {
        if (!document.getElementById('ng-automation-wizard')) buildDOM();
        st.step = 1; st.triggerType = null; st.triggerConfig = {}; st.actions = []; st.name = '';
        render(); updateSteps(); updateFooter();
        setTimeout(function () {
            document.getElementById('ng-automation-wizard').classList.add('ng-wiz-open');
        }, 10);
    }

    function closeWizard() {
        if (_wizAce) { try { _wizAce.destroy(); } catch (e) {} _wizAce = null; }
        var ov = document.getElementById('ng-automation-wizard');
        if (ov) ov.classList.remove('ng-wiz-open');
        closeActionPicker();
    }

    function buildDOM() {
        var stepsHTML = STEP_LABELS.map(function (label, i) {
            return (i > 0 ? '<div class="ng-wiz-step-line"></div>' : '') +
                '<div class="ng-wiz-step-node" data-step="' + (i + 1) + '" title="' + label + '">' +
                '<div class="ng-wiz-step-circle">' + (i + 1) + '</div></div>';
        }).join('');

        var ov = mk('div', '');
        ov.id = 'ng-automation-wizard';
        ov.innerHTML =
            '<div class="ng-wiz-modal">' +
            '<div class="ng-wiz-header">' +
            '<div class="ng-wiz-steps">' + stepsHTML + '</div>' +
            '<div class="ng-wiz-header-title">' +
            '<h3><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--dz-accent);margin-right:8px"></i>Automation Wizard</h3>' +
            '<p>Build a new dzVents automation — no code required</p>' +
            '</div>' +
            '<button class="ng-wiz-close" id="nw-x" title="Close">&times;</button>' +
            '</div>' +
            '<div class="ng-wiz-body" id="nw-body"></div>' +
            '<div class="ng-wiz-footer">' +
            '<div class="ng-wiz-footer-left">' +
            '<button class="ng-wiz-btn ng-wiz-btn-ghost" id="nw-back" style="display:none">' +
            '<i class="fa-solid fa-arrow-left"></i> Back</button>' +
            '</div>' +
            '<div class="ng-wiz-footer-right">' +
            '<button class="ng-wiz-btn ng-wiz-btn-ghost" id="nw-cancel">Cancel</button>' +
            '<button class="ng-wiz-btn ng-wiz-btn-primary" id="nw-next">Next <i class="fa-solid fa-arrow-right"></i></button>' +
            '</div></div></div>';

        document.body.appendChild(ov);
        ov.addEventListener('click', function (e) { if (e.target === ov) closeWizard(); });
        document.getElementById('nw-x').addEventListener('click',      closeWizard);
        document.getElementById('nw-cancel').addEventListener('click', closeWizard);
        document.getElementById('nw-back').addEventListener('click',   goBack);
        document.getElementById('nw-next').addEventListener('click',   goNext);
    }

    function goBack() {
        if (st.step > 1) { st.step--; render(); updateSteps(); updateFooter(); }
    }

    function goNext() {
        var btn = document.getElementById('nw-next');
        if (btn && btn.dataset.final === '1') { createAutomation(); return; }
        if (!validateStep()) return;
        st.step++; render(); updateSteps(); updateFooter();
    }

    function validateStep() {
        if (st.step === 1 && !st.triggerType) {
            var body = document.getElementById('nw-body');
            if (body) { body.style.animation = 'none'; void body.offsetWidth; body.style.animation = 'ngWizShake 0.35s ease'; }
            return false;
        }
        if (st.step === 2 && st.triggerType === 'device' && !st.triggerConfig.device) {
            var devSel = document.getElementById('nwf-device');
            if (devSel) {
                devSel.style.borderColor = 'var(--dz-danger,#e05555)';
                setTimeout(function () { devSel.style.borderColor = ''; }, 1500);
            }
            return false;
        }
        return true;
    }

    function render() {
        var body = document.getElementById('nw-body');
        if (!body) return;
        body.style.cssText = 'opacity:0;transform:translateX(12px);transition:opacity 0.14s,transform 0.14s';
        setTimeout(function () {
            if      (st.step === 1) renderStep1(body);
            else if (st.step === 2) renderStep2(body);
            else if (st.step === 3) renderStep3(body);
            else if (st.step === 4) renderStep4(body);
            body.style.cssText = 'opacity:1;transform:translateX(0);transition:opacity 0.14s,transform 0.14s';
        }, 110);
    }

    function updateSteps() {
        document.querySelectorAll('#ng-automation-wizard .ng-wiz-step-node').forEach(function (node) {
            var s = parseInt(node.getAttribute('data-step'));
            node.classList.remove('wiz-active', 'wiz-done');
            if (s === st.step) node.classList.add('wiz-active');
            if (s <  st.step)  node.classList.add('wiz-done');
        });
    }

    function updateFooter() {
        var back = document.getElementById('nw-back');
        var next = document.getElementById('nw-next');
        if (!back || !next) return;

        back.style.display = st.step === 1 ? 'none' : '';

        if (st.step === 4) {
            next.className     = 'ng-wiz-btn ng-wiz-btn-success';
            next.innerHTML     = '<i class="fa-solid fa-wand-magic-sparkles"></i> Create Automation';
            next.dataset.final = '1';
        } else {
            next.className     = 'ng-wiz-btn ng-wiz-btn-primary';
            next.innerHTML     = 'Next <i class="fa-solid fa-arrow-right"></i>';
            next.dataset.final = '';
        }

        var dis = (st.step === 1 && !st.triggerType) ||
                  (st.step === 2 && st.triggerType === 'device' && !st.triggerConfig.device);
        next.disabled      = dis;
        next.style.opacity = dis ? '0.42' : '';
    }

    /* ── Create automation ──────────────────────────────────────────── */
    function createAutomation() {
        var code = _wizAce ? _wizAce.getValue() : generateCode();
        var name = st.name || 'MyAutomation';
        closeWizard();

        var opened = tryOpenViaAngular(code, name);
        if (!opened) {
            // Fallback: copy to clipboard
            if (navigator.clipboard) navigator.clipboard.writeText(code).catch(function () {});
            showToast(
                '<i class="fa-solid fa-circle-check" style="color:var(--dz-success,#4caf7d);margin-right:8px"></i>' +
                'Code copied to clipboard! Create a new dzVents event and paste it in the editor.'
            );
        }
    }

    /* Open a new unsaved dzVents tab directly via Angular controller */
    function tryOpenViaAngular(code, name) {
        try {
            var editorEl = document.querySelector('.events-editor');
            if (!editorEl) return false;
            var scope = angular.element(editorEl).scope();
            if (!scope || !scope.$ctrl || typeof scope.$ctrl.openEvent !== 'function') return false;

            var event = {
                id:           name,
                eventstatus:  '1',
                name:         name,
                interpreter:  'dzVents',
                type:         'All',
                xmlstatement: code,
                logicarray:   '',
                isChanged:    true,
                isNew:        true
            };

            scope.$apply(function () { scope.$ctrl.openEvent(event); });

            // Back-fill Ace in case xmlstatement isn't picked up on first render
            setTimeout(function () { injectIntoAce(code, name); }, 600);
            setTimeout(function () { injectIntoAce(code, name); }, 1400);
            return true;
        } catch (e) {
            return false;
        }
    }

    function injectIntoAce(code, name) {
        try {
            var aces = document.querySelectorAll('.ace_editor');
            if (!aces.length || typeof ace === 'undefined') return;
            var ed = ace.edit(aces[aces.length - 1]);
            if (ed.getValue() === code) return; // already set
            ed.setValue(code, -1);
            ed.focus();

            var nameField = document.querySelector('.events-editor-file__name');
            if (nameField && nameField.value !== name) {
                nameField.value = name;
                nameField.dispatchEvent(new Event('input',  { bubbles: true }));
                nameField.dispatchEvent(new Event('change', { bubbles: true }));
            }

            showToast(
                '<i class="fa-solid fa-check-circle" style="color:var(--dz-success,#4caf7d);margin-right:8px"></i>' +
                '<strong>' + escH(name) + '</strong> is ready in the editor — hit Save to activate!'
            );
        } catch (e) {}
    }

    function showToast(html) {
        var t = mk('div', '');
        t.style.cssText =
            'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);' +
            'background:var(--dz-surface);border:1px solid var(--dz-border-b);border-radius:10px;' +
            'padding:12px 22px;font-size:13px;color:var(--dz-text);' +
            'box-shadow:0 8px 28px rgba(0,0,0,0.45);z-index:10100;white-space:nowrap;' +
            'animation:ngWizToastIn 0.3s ease both;';
        t.innerHTML = html;
        document.body.appendChild(t);
        setTimeout(function () {
            t.style.transition = 'opacity 0.4s';
            t.style.opacity    = '0';
            setTimeout(function () { t.remove(); }, 500);
        }, 5000);
    }

    /* ── Inject wizard button into file-list nav ─────────────────────── */
    function addWizardButton() {
        if (document.getElementById('ng-wizard-trigger')) return;
        var statesLink = document.querySelector(
            'nav.events-editor__file-list a[ng-click*="setActiveEventId(\'states\')"]'
        );
        if (!statesLink) return;

        var btn = mk('a', 'events-editor__file');
        btn.id        = 'ng-wizard-trigger';
        btn.href      = 'javascript:void(0)';
        btn.title     = 'Create a new automation with the step-by-step wizard';
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
        btn.addEventListener('click', openWizard);
        statesLink.insertAdjacentElement('afterend', btn);
    }

    /* ── Init ───────────────────────────────────────────────────────── */
    function initWizard() {
        [700, 1500, 2800].forEach(function (d) { setTimeout(addWizardButton, d); });

        try {
            var $root = angular.element(document.body).injector().get('$rootScope');
            $root.$on('$routeChangeSuccess', function () { setTimeout(addWizardButton, 900); });
        } catch (e) {}

        var mo = new MutationObserver(function (muts) {
            if (muts.some(function (m) { return m.addedNodes.length > 0; }) &&
                document.querySelector('nav.events-editor__file-list a[ng-click*="setActiveEventId(\'states\')"]') &&
                !document.getElementById('ng-wizard-trigger')) {
                setTimeout(addWizardButton, 250);
            }
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWizard);
    } else {
        initWizard();
    }
})();
