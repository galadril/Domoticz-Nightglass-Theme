/*
 * Nightglass feature tour, as a dashboard widget.
 *
 * The tour itself lives in the theme (src/js/tour.js) and publishes
 * window.dzTour. This widget is only an index onto it: it lists the chapters
 * and opens the tour at whichever one was clicked.
 *
 * That split is deliberate. The tour is a theme feature and has to keep working
 * without the dashboard; this widget is the dashboard's view of it, and degrades
 * to a clear message when the theme is not the one running.
 *
 * Contract: docs/custom-widgets.md in the Domoticz source.
 */
define(function () {
    'use strict';

    return function (ctx) {
        return {
            templateUrl: ctx.templateUrl,

            controller: ['$scope', function ($scope) {
                var ctrl = this;

                ctrl.chapters = [];
                ctrl.available = false;

                function config() {
                    return (ctrl.widgetDef && ctrl.widgetDef.config) || {};
                }

                function applyConfig() {
                    var cfg = config();
                    ctrl.title     = cfg.title === undefined ? 'Feature Tour' : cfg.title;
                    ctrl.mode      = cfg.mode || 'list';
                    ctrl.showReset = cfg.showReset === true;
                }

                /* The theme's scripts and the dashboard load independently, so
                   dzTour may not be there yet on the first digest. Re-check on
                   each digest until it is; it is a property read, not work. */
                function refreshAvailability() {
                    var tour = window.dzTour;
                    var nowAvailable = !!(tour && typeof tour.start === 'function');
                    if (nowAvailable === ctrl.available) { return; }
                    ctrl.available = nowAvailable;
                    ctrl.chapters = (nowAvailable && typeof tour.chapters === 'function')
                        ? tour.chapters()
                        : [];
                }

                ctrl.start = function (index) {
                    if (!ctrl.available) { return; }
                    window.dzTour.start(typeof index === 'number' ? index : 0);
                };

                ctrl.reset = function () {
                    if (!ctrl.available || typeof window.dzTour.reset !== 'function') { return; }
                    window.dzTour.reset();
                    ctrl.wasReset = true;
                };

                $scope.$watch(refreshAvailability);
                $scope.$watch(function () { return config(); }, applyConfig, true);

                ctrl.$onInit = function () {
                    applyConfig();
                    refreshAvailability();
                };
            }]
        };
    };
});
