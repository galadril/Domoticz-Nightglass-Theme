/* Moving a per-device icon SHAPE out of the theme blob and into Domoticz.

   Nightglass used to be the only store for a per-device icon: the shape went
   into deviceIconOverrides alongside the colour, and icons.js drew it. Domoticz
   then grew a DeviceStatus.Icon column of its own, and where that exists the
   server resolves the glyph before the theme ever sees it — so a shape left in
   the blob is simply ignored by the device lists, while the device edit page
   (which reads the Icon column) reports something else. The user's pick stops
   working and the two surfaces disagree about what it even is.

   Nothing moved those shapes when the column arrived, so this does, once,
   automatically: shape to the Icon column, colour and animation left in the
   blob where they are still the only store for them.

   On a Domoticz without the column this module does nothing whatsoever — there
   the blob shape IS the effective icon and moving it would delete the feature.
*/
(function () {
    'use strict';

    var KEY = 'deviceIconOverrides';

    /* The blob keys applyDeviceOverride() in icons.js reads as a shape.
       'icon' is the pre-rename single-icon field; iconOpen / iconClose are the
       blinds Open and Close buttons, which map onto the native on/off pair the
       same way the theme's own fallback chain does. An off equal to on is
       dropped: both stores read `off || on`, so storing it twice says nothing. */
    function shapeOf(ov) {
        var on  = ov.iconOn  || ov.icon      || ov.iconOpen || '';
        var off = ov.iconOff || ov.iconClose || '';
        if (!on) return null;
        return { on: on, off: (off && off !== on) ? off : '' };
    }

    /* Removed from an entry once its shape is stored on the device.
       iconStop is NOT among them and is deliberately not a shape to shapeOf():
       the Icon column is an on/off pair and has nowhere to put a third glyph,
       so the blinds stop icon stays in the blob rather than being thrown away —
       and an entry holding only iconStop has nothing to migrate, so it is never
       picked up and never revisited. */
    var MIGRATED_KEYS = ['icon', 'iconOn', 'iconOff', 'iconOpen', 'iconClose'];

    /* What still earns an entry its place once the shape is gone. 'name' is
       only a label for the settings list, so an entry down to a name is dead
       weight and goes. */
    var KEEP_KEYS = ['on', 'off', 'keepColor', 'anim', 'iconStop'];

    /* NormaliseDeviceIcon() in the server refuses a class outside
       [A-Za-z0-9 _-], a library prefix (the first token) over 32 chars or a
       class over 128, and through write()'s boolean that refusal is
       indistinguishable from "this session may not write". Screen for it here
       so one unstorable entry is skipped rather than read as a permission
       failure — which would stop every entry behind it, on every page load. */
    function storable(cls) {
        if (!/^[A-Za-z0-9 _-]+$/.test(cls) || cls.length > 128) return false;
        return (cls.split(' ')[0] || '').length <= 32;
    }

    function readMap(settings) {
        try {
            var raw = settings.get(KEY) || '{}';
            var m = (typeof raw === 'string') ? JSON.parse(raw) : raw;
            return (m && typeof m === 'object') ? m : {};
        } catch (e) { return {}; }
    }

    function trim(map, idx) {
        var ov = map[idx];
        MIGRATED_KEYS.forEach(function (k) { delete ov[k]; });
        var worthKeeping = KEEP_KEYS.some(function (k) { return ov[k]; });
        if (!worthKeeping) delete map[idx];
    }

    function migrate(store, settings) {
        var map  = readMap(settings);
        var todo = Object.keys(map).filter(function (idx) {
            return /^\d+$/.test(idx) && !!shapeOf(map[idx] || {});
        });
        if (!todo.length) return;

        var moved = [];

        /* One device at a time. Each step is a read plus a setused, and firing
           twenty of those at a page load would compete with the page's own
           startup requests for no gain — there is nothing waiting on this. */
        function step(i) {
            if (i >= todo.length) { finish(); return; }
            var idx = todo[i];
            store.read(idx, function (device) {
                if (!device) {
                    /* Deleted, or just unreadable right now. Leave the entry:
                       it costs a few bytes, and a device that comes back
                       migrates on a later load. */
                    window.ngLog('[IconMigrate]', idx, 'no such device — skipped');
                    step(i + 1);
                    return;
                }
                /* A shape already in the Icon column was picked later and
                   through Domoticz itself, which is exactly the store that now
                   wins — overwriting it with the blob's older shape would undo
                   a choice the user can see taking effect. */
                if (store.parse(device.Icon)) {
                    window.ngLog('[IconMigrate]', idx, 'already has a native icon — skipped');
                    step(i + 1);
                    return;
                }
                /* An uploaded PNG is the same case in a different column: it is
                   what the lists actually draw today, and Icon and CustomImage
                   are alternatives, so writing a glyph clears it. Migrating
                   over one would silently destroy the assignment with nothing
                   left to restore it from. */
                if ((parseInt(device.CustomImage, 10) || 0) > 0) {
                    window.ngLog('[IconMigrate]', idx, 'has a custom image — skipped');
                    step(i + 1);
                    return;
                }

                var shape = shapeOf(map[idx]);
                if (!storable(shape.on) || (shape.off && !storable(shape.off))) {
                    window.ngLog('[IconMigrate]', idx, 'shape the server would refuse — skipped');
                    step(i + 1);
                    return;
                }
                store.write(device, { on: shape.on, off: shape.off }, function (ok) {
                    if (!ok) {
                        /* setused answers 403 to a non-admin session, and there
                           is no admin to become on this page load. Nothing is
                           lost — the entry still holds the shape — so stop here
                           rather than retrying every device into the same wall,
                           and say nothing: the user did not ask for this and
                           cannot act on it. */
                        window.ngLog('[IconMigrate]', idx, 'write refused — stopping');
                        finish();
                        return;
                    }
                    moved.push(idx);
                    step(i + 1);
                });
            });
        }

        function finish() {
            if (!moved.length) return;
            moved.forEach(function (idx) { trim(map, idx); });
            /* Devices first, blob last, never the other way round: until setused
               has stored it, the blob is the only copy of the shape, so trimming
               first and then failing the write would lose it outright. In this
               order a failed save leaves the shape claimed in the blob AND
               present on the device, and the next load reads that device as an
               already-native pick and skips it — the entry keeps a shape that is
               inert on this Domoticz, which is untidy but never wrong, and
               nothing can be clobbered.

               One save for the whole run rather than one per device: each is a
               full blob POST, and a failure costs the same either way — every
               device it covers is already carrying its shape.

               setAndPersist rather than set: this has written DeviceStatus, so
               the trim cannot be left waiting for a "Save to Domoticz" click
               that may never come. It re-applies the settings on the way, which
               is what hands icons.js the trimmed map so the colours keep
               landing on the now-native glyphs. */
            var saving = settings.setAndPersist
                ? settings.setAndPersist(KEY, JSON.stringify(map))
                : Promise.resolve(settings.set(KEY, JSON.stringify(map)) || false);
            Promise.resolve(saving).then(function (saved) {
                if (!saved) window.ngLog('[IconMigrate]', 'trimmed blob was not saved');
            });
            announce(moved.length);
        }

        step(0);
    }

    /* Writing to the user's device data is not something to do behind their
       back, so say it happened — once, with a count, not once per device. */
    function announce(n) {
        window.ngLog('[IconMigrate]', 'moved', n, 'icon(s) into Domoticz');
        if (typeof window.ngShowToast !== 'function') return;
        window.ngShowToast({
            icon:  'fa-right-left',
            color: 'var(--dz-accent, #4e9af1)',
            title: 'Device icons moved to Domoticz',
            body:  'Nightglass used to store the shape of ' + n + ' device icon' +
                   (n === 1 ? '' : 's') + ' itself. Domoticz owns ' +
                   (n === 1 ? 'it' : 'them') + ' now, so the device lists and the ' +
                   'device pages agree again and the choice survives without the ' +
                   'theme. Colours and animations are unchanged.',
            duration: 12000,
            type: 'system'
        });
    }

    var _ran = false;
    function run() {
        if (_ran) return;
        var store    = window.dzDeviceIconStore;
        var settings = window.dzNightglassSettings;
        if (!store || !store.probeNative || !store.read || !store.write) return;
        _ran = true;
        /* isNative() can only answer yes from a route that has already loaded
           dzIconService, and this runs from whatever page the user happened to
           open. probeNative() asks the server for the file instead, which is
           the same question without the routing false negative. */
        store.probeNative(function (native) {
            if (native) migrate(store, settings);
        });
    }

    /* Waits for the settings module to have its stored values: run against a
       blob that has not loaded yet and every entry looks absent. */
    var _tries = 0;
    function init() {
        var s = window.dzNightglassSettings;
        if (s && s.whenReady) { s.whenReady(run); return; }
        if (++_tries < 20) setTimeout(init, 500);
    }
    init();
}());
