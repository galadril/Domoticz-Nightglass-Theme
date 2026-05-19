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
            (opts.onClick ? '<i class="fa-solid fa-arrow-right ng-toast-nav-arrow"></i>' : '') +
            '<button class="ng-toast-close" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ng-toast-progress"></div>';

        el.querySelector('.ng-toast-close').addEventListener('click', function () { removeToast(el); });

        if (opts.onClick) {
            el.classList.add('ng-toast--clickable');
            el.addEventListener('click', function (e) {
                if (e.target.closest('.ng-toast-close')) return;
                removeToast(el);
                opts.onClick();
            });
        }

        stack.appendChild(el);

        window.ngLog('[Toast]', 'show', title, '|', body, '| duration:', duration, 'ms');

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
            if (!duration) return;
            clearTimeout(timerId);
            remaining = Math.max(0, remaining - (Date.now() - startedAt));
            progress.style.transition = 'none';
            progress.style.width = ((remaining / duration) * 100).toFixed(1) + '%';
        });
        el.addEventListener('mouseleave', function () {
            if (!duration) return;
            startedAt = Date.now();
            startDrain(remaining);
        });

        if (duration > 0) startDrain(duration);
        // duration === 0 → persistent: no progress bar, no auto-dismiss
        return el;
    }
    window.ngShowToast = ngShowToast;
    window.ngRemoveToast = removeToast;

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
        if (filter === 'meaningful' && !isMeaningful(device)) {
            window.ngLog('[Toast]', 'skip (not meaningful):', device.Name, '|', device.Type);
            return;
        }

        // Per-device debounce
        var idx = String(device.idx || device.ID || '');

        // Blacklist check
        try {
            var bl = JSON.parse(window.dzNightglassSettings.get('toastBlacklist') || '[]');
            if (bl.indexOf(idx) !== -1) {
                window.ngLog('[Toast]', 'skip (blacklisted):', device.Name, 'idx:', idx);
                return;
            }
        } catch (e) {}
        var now = Date.now();
        if (idx && _lastShown[idx] && (now - _lastShown[idx]) < DEBOUNCE_MS) {
            window.ngLog('[Toast]', 'skip (debounce', DEBOUNCE_MS, 'ms):', device.Name, 'idx:', idx);
            return;
        }

        // Only show a toast if the device has a card on the current page
        if (!isDeviceVisible(idx)) {
            window.ngLog('[Toast]', 'skip (not visible on page):', device.Name, 'idx:', idx);
            return;
        }

        if (idx) _lastShown[idx] = now;

        ngShowToast({
            icon:    iconFor(device),
            color:   colorFor(device),
            title:   device.Name || ('Device ' + idx),
            body:    device.Status || device.Data || '',
            type:    'device',
            onClick: function () {
                if (window.ngNavigateToDevice) window.ngNavigateToDevice(device);
            }
        });
    }

    /* ── Angular $rootScope hooks ────────────────────────────────── */

    function attachAngularHooks() {
        if (!window.angular) { setTimeout(attachAngularHooks, 600); return; }
        var bodyEl = angular.element(document.body);
        if (!bodyEl || !bodyEl.injector || !bodyEl.injector()) { setTimeout(attachAngularHooks, 400); return; }
        try {
            var $rootScope = bodyEl.injector().get('$rootScope');
            window.ngLog('[Toast]', 'Angular hooks attached');
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
        window.ngLog('[Toast]', 'hooked ShowNotify');
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
        window.ngLog('[Toast]', 'hooked generate_noty');
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
        window.ngLog('[Toast]', 'hooked ShowUpdateNotification');
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
