(function () {
    'use strict';

    var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                        'Jul','Aug','Sep','Oct','Nov','Dec'];

    function fmtLastUpdate(raw) {
        var m = String(raw || '').match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
        var d = m ? new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]) : new Date();
        var now  = new Date();
        var h    = d.getHours(), min = ('0' + d.getMinutes()).slice(-2);
        var ampm = h >= 12 ? 'pm' : 'am';
        var h12  = (h % 12) || 12;
        var time = h12 + ':' + min + '\u202f' + ampm;
        var sameDay = d.getFullYear() === now.getFullYear() &&
                      d.getMonth()    === now.getMonth()    &&
                      d.getDate()     === now.getDate();
        if (sameDay) return 'today\u202f' + time;
        return MONTHS_SHORT[d.getMonth()] + '\u202f' + d.getDate() + ',\u202f' + time;
    }

    function findCard(idx) {
        var tbl = document.getElementById('itemtable' + idx);
        if (!tbl) return null;
        var el = tbl.parentElement;
        while (el && el !== document.body) {
            if (el.classList.contains('itemBlock')) return el;
            if (el.classList.contains('item') && el.parentElement &&
                el.parentElement.classList.contains('itemBlock')) return el;
            el = el.parentElement;
        }
        return null;
    }

    function onDeviceUpdate(device) {
        var idx = String(device.idx || device.ID || '');
        if (!idx) return;

        var card = findCard(idx);
        if (!card) {
            window.ngLog('[RT]', 'device_update idx:', idx, '— card not in DOM, skipping');
            return;
        }

        // Instantly update the card-footer timestamp (.dz-time is injected by
        // us, so Angular's data-binding will not overwrite it).
        var luSpan = card.querySelector('.dz-card-footer .dz-time');
        if (luSpan) {
            var formatted = fmtLastUpdate(device.LastUpdate);
            if (luSpan.textContent !== formatted) {
                window.ngLog('[RT]', 'timestamp update idx:', idx, '?', formatted);
                luSpan.textContent = formatted;
            }
        }

        window.ngLog('[RT]', 'device_update idx:', idx, 'name:', device.Name,
            'status:', device.Status || device.Data || '(no status)');

        // Schedule an icon-replacement burst so on/off state changes rendered
        // by Angular in the same digest cycle are caught immediately.
        if (window._dzScheduleBurst) window._dzScheduleBurst();
    }

    function attachHooks() {
        if (!window.angular) { setTimeout(attachHooks, 600); return; }
        var bodyEl = angular.element(document.body);
        if (!bodyEl || !bodyEl.injector || !bodyEl.injector()) { setTimeout(attachHooks, 400); return; }
        try {
            var $rootScope = bodyEl.injector().get('$rootScope');
            window.ngLog('[RT]', 'Angular hooks attached');
            $rootScope.$on('device_update', function (evt, device) { onDeviceUpdate(device); });
        } catch (e) {
            setTimeout(attachHooks, 600);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachHooks);
    } else {
        attachHooks();
    }
})();
