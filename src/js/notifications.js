/* ── Feature 13: Notification History Panel ─────────────────────────
   Bell icon in the navbar accumulates every device_update event into
   a persistent history panel.  Toasts are ephemeral — this panel is
   the record of what happened.

   Keyboard shortcut: N  (toggle open / close)
   Mobile:           slides up from bottom (full-width sheet)
   Desktop:          slides in from the right (340 px panel)
──────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    var MAX_EVENTS = 50;
    var _events    = [];   // circular buffer, oldest first
    var _unread    = 0;
    var _panel     = null;
    var _badge     = null;
    var _open      = false;

    /* ── Icon / color helpers (same palette as toasts.js) ─────── */

    var ICON_MAP = [
        ['Light',      'fa-lightbulb'],
        ['Switch',     'fa-toggle-on'],
        ['Dimmer',     'fa-lightbulb'],
        ['Scene',      'fa-layer-group'],
        ['Group',      'fa-layer-group'],
        ['Thermostat', 'fa-thermometer-half'],
        ['Setpoint',   'fa-thermometer-half'],
        ['Temp',       'fa-temperature-half'],
        ['Humidity',   'fa-droplet'],
        ['Motion',     'fa-person-running'],
        ['Door',       'fa-door-open'],
        ['Contact',    'fa-door-open'],
        ['Window',     'fa-window-maximize'],
        ['Smoke',      'fa-triangle-exclamation'],
        ['Alarm',      'fa-bell'],
        ['Fan',        'fa-fan'],
        ['Blind',      'fa-table-columns'],
        ['Curtain',    'fa-table-columns'],
        ['Lock',       'fa-lock'],
        ['Energy',     'fa-bolt'],
        ['Power',      'fa-bolt'],
        ['P1',         'fa-bolt'],
        ['Meter',      'fa-gauge'],
        ['Wind',       'fa-wind'],
        ['Rain',       'fa-cloud-rain'],
        ['UV',         'fa-sun'],
        ['Air',        'fa-leaf'],
        ['Security',   'fa-shield-halved'],
    ];

    function iconFor(device) {
        var t = ((device.Type || '') + ' ' + (device.SubType || '')).toLowerCase();
        for (var i = 0; i < ICON_MAP.length; i++) {
            if (t.indexOf(ICON_MAP[i][0].toLowerCase()) !== -1) return ICON_MAP[i][1];
        }
        return 'fa-circle-dot';
    }

    function colorFor(status) {
        var s = (status || '').toLowerCase();
        if (/\bon\b|open|motion|active|alert|alarm|detected|locked/.test(s)) return 'var(--dz-accent)';
        if (/\boff\b|closed|no motion|normal|unlocked/.test(s))              return 'var(--dz-text-muted)';
        return 'var(--dz-text-soft)';
    }

    var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function fmtTime(ts) {
        var d   = new Date(ts);
        var now = new Date();
        var h   = d.getHours();
        var m   = ('0' + d.getMinutes()).slice(-2);
        var ap  = h >= 12 ? 'pm' : 'am';
        var h12 = (h % 12) || 12;
        var t   = h12 + ':' + m + '\u202f' + ap;
        if (d.toDateString() === now.toDateString()) return t;
        return MON[d.getMonth()] + '\u202f' + d.getDate() + ', ' + t;
    }

    function escHtml(s) {
        return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    /* ── Panel DOM ─────────────────────────────────────────────── */

    function buildPanel() {
        if (_panel) return _panel;
        _panel = document.createElement('div');
        _panel.id = 'ng-notif-panel';
        _panel.setAttribute('role', 'dialog');
        _panel.setAttribute('aria-modal', 'true');
        _panel.setAttribute('aria-label', 'Notification history');
        _panel.innerHTML =
            '<div class="ng-notif-hdr">' +
                '<span class="ng-notif-title">' +
                    '<i class="fa-solid fa-bell"></i> Recent Events' +
                '</span>' +
                '<button class="ng-notif-clr-btn" title="Clear all">' +
                    '<i class="fa-solid fa-trash-can"></i>' +
                '</button>' +
                '<button class="ng-notif-x-btn" aria-label="Close panel">' +
                    '<i class="fa-solid fa-xmark"></i>' +
                '</button>' +
            '</div>' +
            '<div class="ng-notif-list" id="ng-notif-list"></div>' +
            '<div class="ng-notif-empty" id="ng-notif-empty">' +
                '<i class="fa-regular fa-bell-slash"></i>' +
                '<span>No recent events</span>' +
            '</div>';

        _panel.querySelector('.ng-notif-x-btn').addEventListener('click', closePanel);
        _panel.querySelector('.ng-notif-clr-btn').addEventListener('click', clearAll);
        document.body.appendChild(_panel);
        return _panel;
    }

    function renderList() {
        var list  = document.getElementById('ng-notif-list');
        var empty = document.getElementById('ng-notif-empty');
        if (!list) return;
        if (!_events.length) {
            list.innerHTML = '';
            if (empty) empty.style.display = 'flex';
            return;
        }
        if (empty) empty.style.display = 'none';
        var html = '';
        for (var i = _events.length - 1; i >= 0; i--) {
            var ev = _events[i];
            html +=
                '<div class="ng-notif-item' + (ev.unread ? ' ng-notif-item--unread' : '') + '">' +
                    '<i class="fa-solid ' + ev.icon + ' ng-notif-icon" style="color:' + ev.color + '"></i>' +
                    '<div class="ng-notif-body">' +
                        '<div class="ng-notif-name">' + escHtml(ev.name) + '</div>' +
                        '<div class="ng-notif-status">' + escHtml(ev.status) + '</div>' +
                    '</div>' +
                    '<time class="ng-notif-time">' + ev.time + '</time>' +
                '</div>';
        }
        list.innerHTML = html;
    }

    function updateBadge() {
        if (!_badge) _badge = document.querySelector('#ng-notif-btn .ng-notif-badge');
        if (!_badge) return;
        if (_unread > 0) {
            _badge.textContent = _unread > 99 ? '99+' : String(_unread);
            _badge.style.display = '';
        } else {
            _badge.style.display = 'none';
        }
    }

    function openPanel() {
        buildPanel();
        /* Mark all as read when opening */
        for (var i = 0; i < _events.length; i++) _events[i].unread = false;
        _unread = 0;
        updateBadge();
        renderList();
        _panel.classList.add('ng-notif-panel--open');
        _open = true;
        document.addEventListener('keydown', _escHandler);
    }

    function closePanel() {
        if (_panel) _panel.classList.remove('ng-notif-panel--open');
        _open = false;
        document.removeEventListener('keydown', _escHandler);
    }

    function _escHandler(e) { if (e.key === 'Escape') closePanel(); }

    function togglePanel() { _open ? closePanel() : openPanel(); }

    function clearAll() {
        _events = [];
        _unread = 0;
        updateBadge();
        renderList();
    }

    /* Close on outside click */
    document.addEventListener('click', function (e) {
        if (!_open) return;
        var btn = document.getElementById('ng-notif-btn');
        if (_panel && !_panel.contains(e.target) &&
            e.target !== btn && !(btn && btn.contains(e.target))) {
            closePanel();
        }
    }, true);

    /* ── Event recording ───────────────────────────────────────── */

    function recordEvent(device) {
        var status = device.Status || device.Data || '';
        _events.push({
            icon:   iconFor(device),
            color:  colorFor(status),
            name:   device.Name || ('Device ' + (device.idx || '')),
            status: status,
            time:   fmtTime(Date.now()),
            unread: true
        });
        if (_events.length > MAX_EVENTS) _events.shift();

        if (_open) {
            renderList();
        } else {
            _unread++;
            updateBadge();
        }
    }

    /* Expose for demo pages and external modules */
    window.ngNotifRecord = recordEvent;

    /* ── Navbar button injection ───────────────────────────────── */

    function injectButton() {
        if (document.getElementById('ng-notif-btn')) return;
        /* Wait for core.js dark/light toggle to be present first */
        var themeNav = document.getElementById('dz-theme-style-nav');
        if (!themeNav) { setTimeout(injectButton, 150); return; }

        var btn = document.createElement('a');
        btn.id   = 'ng-notif-btn';
        btn.href = 'javascript:void(0)';
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', 'Notification history (N)');
        btn.title = 'Notification history  [N]';
        btn.innerHTML =
            '<i class="fa-solid fa-bell"></i>' +
            '<span class="ng-notif-badge" style="display:none"></span>';
        btn.addEventListener('click', function (e) { e.stopPropagation(); togglePanel(); });

        var li = document.createElement('li');
        li.id  = 'ng-notif-li';
        li.appendChild(btn);
        /* Insert BEFORE the dark/light toggle */
        themeNav.parentNode.insertBefore(li, themeNav);
        _badge = btn.querySelector('.ng-notif-badge');
    }

    /* ── Angular hooks ─────────────────────────────────────────── */

    function attachAngularHooks() {
        if (!window.angular) { setTimeout(attachAngularHooks, 600); return; }
        var bodyEl = angular.element(document.body);
        if (!bodyEl || !bodyEl.injector || !bodyEl.injector()) {
            setTimeout(attachAngularHooks, 400);
            return;
        }
        try {
            var $rs = bodyEl.injector().get('$rootScope');
            $rs.$on('device_update', function (evt, device) { recordEvent(device); });
        } catch (e) {
            setTimeout(attachAngularHooks, 600);
        }
    }

    /* ── Keyboard shortcut: N ──────────────────────────────────── */

    document.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' ||
            e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'n' || e.key === 'N') togglePanel();
    });

    /* ── Init ──────────────────────────────────────────────────── */

    function init() {
        injectButton();
        attachAngularHooks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
