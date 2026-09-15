/*
 * Nightglass device card, as a dashboard widget.
 *
 * This is the card the tour opens on: a name, an icon in a frame that lights
 * up when the device is on, and the value beside it. The tour draws a mock of
 * it; this renders the real thing against a real device, and toggles it.
 *
 * Contract: docs/custom-widgets.md in the Domoticz source.
 */
define(function () {
    'use strict';

    /* Icon per device kind, so a freshly placed card looks right before anyone
       touches the icon override. */
    var ICON_BY_SWITCHTYPE = {
        'On/Off':            'fa-solid fa-lightbulb',
        'Dimmer':            'fa-solid fa-lightbulb',
        'Push On Button':    'fa-solid fa-circle-play',
        'Push Off Button':   'fa-solid fa-circle-stop',
        'Contact':           'fa-solid fa-door-closed',
        'Door Contact':      'fa-solid fa-door-closed',
        'Door Lock':         'fa-solid fa-lock',
        'Door Lock Inverted':'fa-solid fa-lock',
        'Blinds':            'fa-solid fa-blinds',
        'Venetian Blinds US':'fa-solid fa-blinds',
        'Venetian Blinds EU':'fa-solid fa-blinds',
        'Motion Sensor':     'fa-solid fa-person-running',
        'Smoke Detector':    'fa-solid fa-fire',
        'Media Player':      'fa-solid fa-play',
        'Selector':          'fa-solid fa-sliders'
    };

    function iconFor(device) {
        if (!device) { return 'fa-solid fa-lightbulb'; }
        return ICON_BY_SWITCHTYPE[device.SwitchType] ||
               (device.Type === 'Temp' ? 'fa-solid fa-temperature-half' : 'fa-solid fa-lightbulb');
    }

    /* '#4e9af1' -> '78, 154, 241', the form the frame's rgba() needs. */
    function hexToRgbTriplet(hex) {
        var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec((hex || '').trim());
        if (!m) { return null; }
        return parseInt(m[1], 16) + ', ' + parseInt(m[2], 16) + ', ' + parseInt(m[3], 16);
    }

    /* Domoticz reports state as free text that varies by device kind, so read
       it in that order: the unambiguous words first, then dimmer level. */
    function isOn(device) {
        if (!device) { return false; }
        var status = String(device.Status || device.Data || '');
        if (/^(off|closed|locked|no motion|normal)$/i.test(status)) { return false; }
        if (/^(on|open|unlocked|motion)$/i.test(status))            { return true; }
        if (/^set level/i.test(status) || device.HaveDimmer)        { return (+device.Level || 0) > 0; }
        return status !== '';
    }

    /* Push buttons are momentary: they only ever send their one command. */
    function commandFor(device, currentlyOn) {
        if (!device) { return null; }
        if (device.SwitchType === 'Push On Button')  { return 'On'; }
        if (device.SwitchType === 'Push Off Button') { return 'Off'; }
        return currentlyOn ? 'Off' : 'On';
    }

    return function (ctx) {
        return {
            templateUrl: ctx.templateUrl,

            controller: ['$scope', '$http', '$timeout', function ($scope, $http, $timeout) {
                var ctrl = this;

                ctrl.loading = true;
                ctrl.error   = null;
                ctrl.device  = null;
                ctrl.busy    = false;

                function config() {
                    return (ctrl.widgetDef && ctrl.widgetDef.config) || {};
                }

                function applyConfig() {
                    var cfg = config();
                    ctrl.titleOverride = cfg.title || '';
                    ctrl.iconOverride  = cfg.icon || '';
                    ctrl.showFooter    = cfg.showFooter !== false;
                    ctrl.allowToggle   = cfg.allowToggle !== false;
                    ctrl.tint          = hexToRgbTriplet(cfg.tint) || null;
                }

                function render() {
                    ctrl.name  = ctrl.titleOverride || (ctrl.device && ctrl.device.Name) || '';
                    ctrl.icon  = ctrl.iconOverride || iconFor(ctrl.device);
                    ctrl.value = (ctrl.device && (ctrl.device.Data || ctrl.device.Status)) || '';
                    ctrl.foot  = (ctrl.device && ctrl.device.LastUpdate) || '';
                    ctrl.lit   = isOn(ctrl.device);
                    ctrl.switchable = !!(ctrl.device && ctrl.device.SwitchType);
                }

                function load() {
                    var idx = config().deviceIdx;
                    if (!idx) {
                        ctrl.loading = false;
                        ctrl.error   = 'Pick a device in this widget\'s settings';
                        return;
                    }
                    ctrl.error = null;
                    $http.get('json.htm', { params: { type: 'command', param: 'getdevices', rid: idx } })
                        .then(function (resp) {
                            ctrl.loading = false;
                            var result = (resp.data && resp.data.result) || [];
                            if (!result.length) {
                                ctrl.error = 'Device ' + idx + ' not found';
                                return;
                            }
                            ctrl.device = result[0];
                            render();
                        }, function () {
                            ctrl.loading = false;
                            ctrl.error   = 'Could not read device ' + idx;
                        });
                }

                ctrl.toggle = function () {
                    // Editing the dashboard is dragging and resizing, not switching lights.
                    if (ctrl.editMode || !ctrl.allowToggle || !ctrl.switchable || ctrl.busy || !ctrl.device) {
                        return;
                    }
                    var cmd = commandFor(ctrl.device, ctrl.lit);
                    if (!cmd) { return; }

                    // Light the frame straight away; the device_update that follows
                    // is what actually settles it, and load() re-reads if none comes.
                    ctrl.busy = true;
                    ctrl.lit  = (cmd === 'On');

                    $http.get('json.htm', {
                        params: { type: 'command', param: 'switchlight', idx: ctrl.device.idx, switchcmd: cmd }
                    }).then(function () {
                        $timeout(function () { ctrl.busy = false; load(); }, 900);
                    }, function () {
                        ctrl.busy = false;
                        ctrl.lit  = isOn(ctrl.device);   // put it back
                        ctrl.error = 'Could not switch ' + (ctrl.name || 'device');
                    });
                };

                $scope.$on('device_update', function (event, updated) {
                    if (!ctrl.device || String(updated.idx) !== String(ctrl.device.idx)) { return; }
                    ctrl.device = angular.extend({}, ctrl.device, updated);
                    ctrl.busy = false;
                    render();
                });

                $scope.$on('dd:widget:refresh', load);

                $scope.$watch(function () { return config(); }, function () {
                    var previousIdx = ctrl.$idx;
                    applyConfig();
                    ctrl.$idx = config().deviceIdx;
                    if (ctrl.$idx !== previousIdx) {
                        ctrl.loading = true;
                        ctrl.device  = null;
                        load();
                    } else {
                        render();
                    }
                }, true);

                ctrl.$onInit = function () {
                    applyConfig();
                    ctrl.$idx = config().deviceIdx;
                    load();
                };
            }]
        };
    };
});
