/*
 *  Nightglass — first-run tour
 *
 *  Most of what this theme adds is visible the moment you load it: the
 *  cards, the icons, the charts. The rest is invisible until somebody
 *  points at it — a gesture, four keyboard systems, two panels buried in
 *  Setup. Those are the parts people email about, and the parts a README
 *  never reaches, because nobody reads a README for a theme.
 *
 *  So the tour shows rather than tells. Every stage below is built out of
 *  the theme's own components and animates the thing it is describing:
 *  the hold-to-switch stage really runs the hold fill, the sparkline
 *  stage really draws a sparkline. No screenshots — a screenshot would
 *  go stale the first time a colour token changed.
 *
 *  The rail along the bottom is eleven icon frames, the same component a
 *  device card uses for its icon. They start dark and light as you go,
 *  so finishing the tour leaves a row of lights on.
 */

(function () {
    'use strict';

    /* ── Debug ────────────────────────────────────────────────────────
       While the tour is being built it opens on every load. Set this to
       false and the gate at the bottom takes over: once per user, on the
       first authenticated page load, remembered in the synced settings
       blob. Either way window.dzTour.start() opens it on demand and
       window.dzTour.reset() forgets it was ever seen.               */
    var ALWAYS_SHOW = true;

    var SEEN_KEY = 'tourSeen';

    /* Hues are RGB triples so CSS can build its own alphas from them.
       All six already appear on device icons in this theme, so a tour
       chapter never introduces a colour the dashboard doesn't use. */
    var BLUE   = '78, 154, 241';
    var GREEN  = '76, 175, 125';
    var AMBER  = '240, 168, 50';
    var VIOLET = '200, 160, 255';
    var CYAN   = '41, 182, 246';
    var RED    = '224, 85, 85';

    /* ── Small DOM helpers ───────────────────────────────────────── */

    function el(tag, cls, html) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
    }

    /* Every stage animates, and every stage has to stop dead when the
       chapter changes — a timer still running behind chapter 7 would
       animate a card that is no longer on screen. Each stage gets one of
       these and the shell calls stop() on the way out. */
    function clock() {
        var ids = [];
        return {
            after: function (ms, fn) { ids.push(setTimeout(fn, ms)); },
            every: function (ms, fn) { ids.push(setInterval(fn, ms)); },
            /* Browsers share one id space between the two, so clearing
               both against every id is safe and saves tracking which is
               which. */
            stop: function () {
                ids.forEach(function (id) { clearTimeout(id); clearInterval(id); });
                ids = [];
            }
        };
    }

    /* A miniature of the theme's device card. Not the real markup — that
       is a table keyed to Domoticz's own ids — but the same surfaces,
       radii and icon frame, so what the tour shows and what the
       dashboard behind it shows are recognisably one component. */
    function card(o) {
        o = o || {};
        var c = el('div', 'dzt-card' + (o.cls ? ' ' + o.cls : ''));
        if (o.tint) c.style.setProperty('--dzt-tint', o.tint);
        c.innerHTML =
            '<div class="dzt-card-name">' + (o.name || 'Living room') + '</div>' +
            '<div class="dzt-card-row">' +
                '<div class="dzt-frame' + (o.on ? ' dzt-frame--lit' : '') + '">' +
                    '<i class="' + (o.icon || 'fa-solid fa-lightbulb') + '"></i>' +
                '</div>' +
                '<div class="dzt-card-value">' + (o.value || 'On') + '</div>' +
            '</div>' +
            (o.foot === false ? '' :
                '<div class="dzt-card-foot">' + (o.foot || 'today 7:12 pm') + '</div>');
        return c;
    }

    function setLit(cardEl, lit) {
        var f = cardEl.querySelector('.dzt-frame');
        if (f) f.classList.toggle('dzt-frame--lit', !!lit);
    }

    function setValue(cardEl, text) {
        var v = cardEl.querySelector('.dzt-card-value');
        if (v) v.textContent = text;
    }

    /* An SVG area sparkline over a fixed series, drawn the way
       sparklines.js draws the real ones: a stroked path with a faded
       fill under it. Returned undrawn — the stage animates the stroke
       in, which is the whole point of the chapter. */
    function sparkline(series, w, h) {
        var min = Math.min.apply(null, series);
        var max = Math.max.apply(null, series);
        var span = (max - min) || 1;
        var pts = series.map(function (v, i) {
            return [
                (i / (series.length - 1)) * w,
                h - ((v - min) / span) * (h - 4) - 2
            ];
        });
        var line = pts.map(function (p, i) {
            return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
        }).join(' ');

        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
        svg.setAttribute('class', 'dzt-spark');
        svg.innerHTML =
            '<path class="dzt-spark-fill" d="' + line + ' L' + w + ' ' + h + ' L0 ' + h + ' Z"/>' +
            '<path class="dzt-spark-line" d="' + line + '"/>';
        return svg;
    }

    /* ── Chapters ─────────────────────────────────────────────────────
       Each is { id, icon, hue, title, body, stage }. stage(host, clk)
       fills the stage element and may schedule work on clk; the shell
       handles teardown.                                              */

    var CHAPTERS = [
    {
        id: 'welcome',
        icon: 'fa-solid fa-moon',
        hue: BLUE,
        title: 'Nightglass',
        body: 'Every card, icon, chart and dialog in Domoticz has been rebuilt, and a ' +
              'few things have been added that you would never find on your own. ' +
              'Here is the short version — about a minute.',
        stage: function (host, clk) {
            var grid = el('div', 'dzt-grid dzt-grid--3');
            var specs = [
                { name: 'Kitchen',   icon: 'fa-solid fa-lightbulb',   tint: AMBER, value: 'On' },
                { name: 'Hallway',   icon: 'fa-solid fa-lightbulb',   tint: BLUE,  value: 'On' },
                { name: 'Back door', icon: 'fa-solid fa-door-closed', tint: GREEN, value: 'Closed' }
            ];
            var cards = specs.map(function (s) {
                var c = card({ name: s.name, icon: s.icon, tint: s.tint, value: s.value, foot: false });
                grid.appendChild(c);
                return c;
            });
            host.appendChild(grid);

            /* The one unprompted animation in the tour: the house waking
               up. It runs once, on the chapter people see first. */
            cards.forEach(function (c, i) {
                clk.after(260 + i * 220, function () { setLit(c, true); });
            });
        }
    },
    {
        id: 'hold',
        icon: 'fa-solid fa-hand-pointer',
        hue: BLUE,
        title: 'Hold a card icon to switch it',
        body: 'Press and hold the icon on a card for about half a second and the device ' +
              'switches. Colour lights too, where a tap opens the picker instead. ' +
              'Devices with no plain on and off — blinds, selectors, door locks — ignore the hold.',
        stage: function (host, clk) {
            var wrap = el('div', 'dzt-hold-stage');
            var c = card({ name: 'Living room', icon: 'fa-solid fa-lightbulb',
                           tint: AMBER, value: 'Off' });
            var hand = el('div', 'dzt-hand', '<i class="fa-solid fa-hand-pointer"></i>');
            wrap.appendChild(c);
            wrap.appendChild(hand);
            host.appendChild(wrap);

            var frame = c.querySelector('.dzt-frame');
            var on = false;

            function cycle() {
                hand.classList.add('dzt-hand--down');
                frame.classList.add('dzt-frame--holding');
                clk.after(560, function () {
                    frame.classList.remove('dzt-frame--holding');
                    frame.classList.add('dzt-frame--fired');
                    on = !on;
                    setLit(c, on);
                    setValue(c, on ? 'On' : 'Off');
                    c.classList.add('dzt-card--flash');
                });
                clk.after(1000, function () {
                    hand.classList.remove('dzt-hand--down');
                    frame.classList.remove('dzt-frame--fired');
                    c.classList.remove('dzt-card--flash');
                });
            }

            clk.after(500, cycle);
            clk.every(2600, cycle);
        }
    },
    {
        id: 'glance',
        icon: 'fa-solid fa-eye',
        hue: GREEN,
        title: 'Cards answer before you read them',
        body: 'The icon frame carries the device\'s own colour while it is on. Sensor cards ' +
              'take a top edge tinted to the reading. A device that has stopped reporting ' +
              'grows a slow red dot, and anything that changes flashes once.',
        stage: function (host, clk) {
            var grid = el('div', 'dzt-grid dzt-grid--2');

            var lit = card({ name: 'Desk lamp', icon: 'fa-solid fa-lightbulb',
                             tint: AMBER, value: 'On', on: true, foot: false });
            var warm = card({ name: 'Conservatory', icon: 'fa-solid fa-temperature-half',
                              tint: RED, value: '28.4 °C', foot: false, cls: 'dzt-card--accent' });
            warm.style.setProperty('--dzt-accent-edge', 'rgb(' + RED + ')');
            var stale = card({ name: 'Shed sensor', icon: 'fa-solid fa-temperature-half',
                               tint: CYAN, value: '4.1 °C', foot: false, cls: 'dzt-card--stale' });
            var flash = card({ name: 'Front door', icon: 'fa-solid fa-door-open',
                               tint: GREEN, value: 'Open', on: true, foot: false });

            [[lit,   'Lit while it is on'],
             [warm,  'Edge follows the reading'],
             [stale, 'Stopped reporting'],
             [flash, 'Flashes on a change']].forEach(function (pair) {
                var cell = el('div', 'dzt-annotated');
                cell.appendChild(pair[0]);
                cell.appendChild(el('div', 'dzt-annotation', pair[1]));
                grid.appendChild(cell);
            });
            host.appendChild(grid);

            /* Only the card whose caption says "flashes" flashes. A stage
               where everything moved would say nothing about any of it. */
            clk.every(2200, function () {
                flash.classList.add('dzt-card--flash');
                clk.after(700, function () { flash.classList.remove('dzt-card--flash'); });
            });
        }
    },
    {
        id: 'sparklines',
        icon: 'fa-solid fa-chart-area',
        hue: CYAN,
        title: 'The last 24 hours, behind the card',
        body: 'Sensors that keep history — temperature, humidity, rain, wind, counters, UV — ' +
              'get their day drawn across the whole card as a watermark, well under the ' +
              'reading rather than competing with it. Hovering lifts it.',
        stage: function (host, clk) {
            var c = card({ name: 'Outside', icon: 'fa-solid fa-temperature-half',
                           tint: CYAN, value: '11.6 °C', foot: 'today 7:12 pm',
                           cls: 'dzt-card--wide' });
            var series = [7.2, 6.9, 6.4, 6.1, 6.3, 7.8, 9.4, 11.2, 12.9, 14.1, 14.8, 14.2,
                          13.1, 12.4, 11.9, 11.6];

            /* The real wrapper and the real generator, so this is the
               sparkline the dashboard draws — accent-coloured, stretched
               across the card, five per cent opacity — rather than a chart
               that merely resembles one. */
            var wrap = el('div', 'dz-sparkline-wrap');
            if (typeof window._dzSparklineSVG === 'function') {
                wrap.innerHTML = window._dzSparklineSVG(series, 'tour');
            }
            c.insertBefore(wrap, c.firstChild);
            host.appendChild(c);

            var note = el('div', 'dzt-annotation', 'resting');
            host.appendChild(note);

            /* Both states, because five per cent is easy to miss and the
               hover lift is how most people notice it at all. */
            clk.every(2400, function () {
                var up = c.classList.toggle('dzt-card--hovered');
                note.textContent = up ? 'on hover' : 'resting';
            });
        }
    },
    {
        id: 'palette',
        icon: 'fa-solid fa-terminal',
        hue: VIOLET,
        title: 'Ctrl K reaches every device',
        body: 'From any page. Search is fuzzy, so lvng lght finds the living room light. ' +
              'Enter switches it, Shift Enter jumps to its page, and a dimmer opens a ' +
              'brightness slider in the row.',
        stage: function (host, clk) {
            /* Every class below is the palette's own. The shell selectors
               are ids in the real thing (#dz-cmd-box and friends), so
               pages.css names these classes alongside them — one set of
               declarations, no copy to fall out of date. */
            var DEVICES = [
                { name: 'Living room light', meta: 'Dimmer · 4 min ago',
                  icon: 'fa-solid fa-lightbulb', dim: true },
                { name: 'Landing light',     meta: 'On/Off · 2 h ago',
                  icon: 'fa-solid fa-lightbulb' },
                { name: 'Garage door',       meta: 'Door Contact · 20 min ago',
                  icon: 'fa-solid fa-warehouse', state: 'Closed' },
                { name: 'Loft humidity',     meta: 'Humidity · 1 min ago',
                  icon: 'fa-solid fa-droplet', state: '54%' }
            ];

            var box = el('div', 'dzt-cmd-box');
            box.innerHTML =
                '<div class="dzt-cmd-header">' +
                    '<i class="fa-solid fa-magnifying-glass"></i>' +
                    '<input class="dzt-cmd-input" readonly tabindex="-1" ' +
                        'placeholder="Search devices…">' +
                    '<span class="dz-cmd-esc">Esc</span>' +
                '</div>' +
                '<div class="dzt-cmd-list">' +
                    '<div class="dz-cmd-section">Favourites</div>' +
                '</div>';

            var list = box.querySelector('.dzt-cmd-list');
            var rows = DEVICES.map(function (d) {
                var row = el('div', 'dz-cmd-item');
                row.dataset.match = d.name.toLowerCase();
                row.innerHTML =
                    '<div class="dz-cmd-icon"><i class="' + d.icon + '"></i></div>' +
                    '<div class="dz-cmd-body">' +
                        '<div class="dz-cmd-name">' + d.name + '</div>' +
                        '<div class="dz-cmd-meta">' + d.meta + '</div>' +
                    '</div>' +
                    '<div class="dz-cmd-controls">' +
                        (d.state
                            ? '<span class="dz-cmd-state">' + d.state + '</span>'
                            : '<span class="dz-cmd-toggle-pill">Off</span>') +
                    '</div>' +
                    (d.dim
                        ? '<div class="dz-cmd-slider-row">' +
                              '<button class="dz-cmd-slider-off" tabindex="-1">' +
                                  '<i class="fa-solid fa-power-off"></i></button>' +
                              '<input type="range" class="dz-cmd-slider" min="0" max="100" ' +
                                  'step="5" value="60" tabindex="-1">' +
                              '<span class="dz-cmd-slider-val">60%</span>' +
                          '</div>'
                        : '');
                list.appendChild(row);
                return row;
            });
            host.appendChild(box);

            var input = box.querySelector('.dzt-cmd-input');
            var first = rows[0];
            var pill  = first.querySelector('.dz-cmd-toggle-pill');
            var icon  = first.querySelector('.dz-cmd-icon');
            var slide = first.querySelector('.dz-cmd-slider-row');
            var name  = first.querySelector('.dz-cmd-name');

            /* The palette's own subsequence match: the typed letters have
               to appear in order, not next to each other. */
            function fuzzy(hay, needle) {
                var i = 0;
                for (var n = 0; n < needle.length; n++) {
                    if (needle[n] === ' ') continue;
                    i = hay.indexOf(needle[n], i);
                    if (i < 0) return false;
                    i++;
                }
                return true;
            }

            /* And its <mark> highlight, so the matched letters read the
               same way here as they do in the real list. */
            function highlight(text, needle) {
                var out = '', i = 0;
                for (var c = 0; c < text.length; c++) {
                    var ch = text[c];
                    if (i < needle.length && needle[i] !== ' ' &&
                        ch.toLowerCase() === needle[i]) {
                        out += '<mark class="dz-cmd-mark">' + ch + '</mark>';
                        i++;
                    } else {
                        if (i < needle.length && needle[i] === ' ') i++;
                        out += ch;
                    }
                }
                return out;
            }

            function reset() {
                input.value = '';
                name.textContent = DEVICES[0].name;
                rows.forEach(function (r) { r.classList.remove('dz-cmd-item--gone'); });
                first.classList.remove('dz-cmd-item--active');
                slide.classList.remove('dz-cmd-slider-row--visible');
                pill.classList.remove('dz-cmd-toggle-pill--on');
                pill.textContent = 'Off';
                icon.classList.remove('dz-cmd-icon--on');
            }

            function run() {
                var typed = 'lvng lg';
                reset();

                for (var i = 1; i <= typed.length; i++) {
                    (function (n) {
                        clk.after(450 + n * 110, function () {
                            var q = typed.slice(0, n);
                            input.value = q;
                            name.innerHTML = highlight(DEVICES[0].name, q.toLowerCase());
                            rows.forEach(function (r) {
                                r.classList.toggle('dz-cmd-item--gone',
                                    !fuzzy(r.dataset.match, q.toLowerCase()));
                            });
                        });
                    }(i));
                }
                clk.after(1650, function () { first.classList.add('dz-cmd-item--active'); });
                clk.after(2150, function () {
                    pill.classList.add('dz-cmd-toggle-pill--on');
                    pill.textContent = 'On';
                    icon.classList.add('dz-cmd-icon--on');
                });
                /* A dimmer's row opens a brightness slider — worth showing,
                   because nothing on screen advertises that it is there. */
                clk.after(2900, function () {
                    slide.classList.add('dz-cmd-slider-row--visible');
                });
            }

            run();
            clk.every(6000, run);
        }
    },
    {
        id: 'keys',
        icon: 'fa-solid fa-keyboard',
        hue: AMBER,
        title: 'Keys instead of clicks',
        body: 'The number keys jump between sections. Slash filters the page you are already ' +
              'on, down to one device. N opens the notification history. All of them stand ' +
              'down while you are typing in a field.',
        stage: function (host, clk) {
            var keys = [
                { k: '1', label: 'Dashboard' },
                { k: '2', label: 'Switches' },
                { k: '3', label: 'Scenes' },
                { k: '4', label: 'Temperature' },
                { k: '5', label: 'Weather' },
                { k: '6', label: 'Utility' },
                { k: '7', label: 'Cameras' },
                { k: '8', label: 'Log' },
                { k: '9', label: 'Setup' },
                { k: '/', label: 'Filter this page', split: true },
                { k: 'N', label: 'Notifications' }
            ];
            var board = el('div', 'dzt-keys');
            var caption = el('div', 'dzt-keys-caption', '&nbsp;');
            keys.forEach(function (spec, i) {
                var cap = el('button', 'dzt-key' + (spec.split ? ' dzt-key--split' : ''), spec.k);
                cap.type = 'button';
                cap.dataset.label = spec.label;
                cap.dataset.i = i;
                board.appendChild(cap);
            });
            host.appendChild(board);
            host.appendChild(caption);

            var caps = Array.prototype.slice.call(board.querySelectorAll('.dzt-key'));
            var at = -1;
            var held = false;      /* the pointer wins over the cycle */

            function show(i) {
                caps.forEach(function (c, n) { c.classList.toggle('dzt-key--on', n === i); });
                caption.textContent = i < 0 ? '' : keys[i].label;
            }

            board.addEventListener('mouseover', function (e) {
                var cap = e.target.closest('.dzt-key');
                if (!cap) return;
                held = true;
                show(+cap.dataset.i);
            });
            board.addEventListener('mouseleave', function () { held = false; });

            clk.after(400, function () { if (!held) { at = 0; show(at); } });
            clk.every(1100, function () {
                if (held) return;
                at = (at + 1) % keys.length;
                show(at);
            });
        }
    },
    {
        id: 'live',
        icon: 'fa-solid fa-bolt',
        hue: GREEN,
        title: 'Nothing waits for a refresh',
        body: 'Cards follow Domoticz\'s live feed, so values and icons change as they happen. ' +
              'Changes worth knowing about raise a toast in the corner, and the bell keeps ' +
              'the last fifty so you can catch up on what you missed.',
        stage: function (host, clk) {
            var scene = el('div', 'dzt-live');
            var bell  = el('div', 'dzt-bell',
                '<i class="fa-solid fa-bell"></i><span class="dzt-badge">3</span>');
            var c = card({ name: 'Porch light', icon: 'fa-solid fa-lightbulb',
                           tint: AMBER, value: 'Off', foot: 'just now' });
            var toast = el('div', 'dzt-toast',
                '<i class="fa-solid fa-lightbulb"></i>' +
                '<span><strong>Porch light</strong><em>On</em></span>');
            scene.appendChild(bell);
            scene.appendChild(c);
            scene.appendChild(toast);
            host.appendChild(scene);

            var badge = bell.querySelector('.dzt-badge');
            var n = 3;

            function beat() {
                setLit(c, true);
                setValue(c, 'On');
                c.classList.add('dzt-card--flash');
                toast.classList.add('dzt-toast--in');
                clk.after(500, function () {
                    n++;
                    badge.textContent = n;
                    bell.classList.add('dzt-bell--ring');
                });
                clk.after(1100, function () { c.classList.remove('dzt-card--flash'); });
                clk.after(1400, function () { bell.classList.remove('dzt-bell--ring'); });
                clk.after(2600, function () {
                    toast.classList.remove('dzt-toast--in');
                    setLit(c, false);
                    setValue(c, 'Off');
                });
            }

            clk.after(500, beat);
            clk.every(4200, beat);
        }
    },
    {
        id: 'rooms',
        icon: 'fa-solid fa-filter',
        hue: BLUE,
        title: 'Filter down to the room you are in',
        body: 'Every device page gets a filter bar where the room dropdown used to be. ' +
              'Rooms, device type, on or off, favourites — combine them and the grid narrows ' +
              'as you press, with no page reload.',
        stage: function (host, clk) {
            var bar = el('div', 'dzt-pills');
            ['All', 'Kitchen', 'Lounge', 'Upstairs', 'Garden'].forEach(function (name, i) {
                var p = el('button', 'dzt-pill' + (i === 0 ? ' dzt-pill--on' : ''), name);
                p.type = 'button';
                p.dataset.room = name;
                bar.appendChild(p);
            });
            var grid = el('div', 'dzt-grid dzt-grid--4');
            var items = [
                { name: 'Worktop',   room: 'Kitchen',     icon: 'fa-solid fa-lightbulb', tint: AMBER },
                { name: 'Standing',  room: 'Lounge',      icon: 'fa-solid fa-lightbulb', tint: AMBER },
                { name: 'Bedside',   room: 'Upstairs',    icon: 'fa-solid fa-lightbulb', tint: VIOLET },
                { name: 'Path',      room: 'Garden',      icon: 'fa-solid fa-lightbulb', tint: GREEN }
            ];
            var cards = items.map(function (it) {
                var c = card({ name: it.name, icon: it.icon, tint: it.tint,
                               value: it.room, on: true, foot: false, cls: 'dzt-card--mini' });
                c.dataset.room = it.room;
                grid.appendChild(c);
                return c;
            });
            host.appendChild(bar);
            host.appendChild(grid);

            var pills = Array.prototype.slice.call(bar.querySelectorAll('.dzt-pill'));
            var held = false;

            function pick(room) {
                pills.forEach(function (p) {
                    p.classList.toggle('dzt-pill--on', p.dataset.room === room);
                });
                cards.forEach(function (c) {
                    c.classList.toggle('dzt-card--filtered',
                        room !== 'All' && c.dataset.room !== room);
                });
            }

            bar.addEventListener('click', function (e) {
                var p = e.target.closest('.dzt-pill');
                if (!p) return;
                held = true;
                pick(p.dataset.room);
            });

            var order = ['Kitchen', 'All', 'Garden', 'All'];
            var at = 0;
            clk.every(1900, function () {
                if (held) return;
                pick(order[at % order.length]);
                at++;
            });
        }
    },
    {
        id: 'dialogs',
        icon: 'fa-solid fa-palette',
        hue: VIOLET,
        title: 'Every control dialog, rebuilt',
        body: 'Setpoints get an arc you can drag instead of a number box. Colour lights get a ' +
              'wheel, a brightness row and presets. Tunable whites get a warmth bar that takes ' +
              'a value in kelvin — which Domoticz\'s own 0–255 axis has no way to express. ' +
              'Fans, blinds and thermostats get the same treatment.',
        stage: function (host, clk) {
            /* Not drawings of the dialogs — the dialogs. popups.js builds
               these from the same markup and paints the canvases with the
               same functions the live popups use, then strips the ids and
               the onclick handlers so a sample can neither be pressed nor
               command anything. */
            var LABELS = ['Setpoint', 'Colour', 'White'];

            function build() {
                var made = [];
                if (typeof window._dzSetpointSample === 'function') {
                    made.push(window._dzSetpointSample(21.5, '19.8 °C'));
                }
                if (typeof window._dzColourSample === 'function') {
                    made.push(window._dzColourSample('colour'));
                    made.push(window._dzColourSample('white'));
                }
                if (!made.length) return false;

                host.innerHTML = '';
                var rail = el('div', 'dzt-dialogs');
                var caps = el('div', 'dzt-dialog-caps');
                made.forEach(function (d, i) {
                    var slot = el('div', 'dzt-dialog-slot');
                    slot.appendChild(d);
                    rail.appendChild(slot);
                    caps.appendChild(el('div', 'dzt-annotation', LABELS[i] || ''));
                });
                host.appendChild(rail);
                host.appendChild(caps);
                return made.length === 3;
            }

            /* popups.js publishes these builders from its DOMContentLoaded
               init, and the colour one only once its own pass has run. The
               tour normally opens long after both, but jumping straight to
               this chapter on a cold load can beat them, so try again for
               a couple of seconds rather than showing a gap. */
            if (!build()) {
                var tries = 0;
                var again = function () {
                    if (build() || ++tries > 10) return;
                    clk.after(200, again);
                };
                clk.after(200, again);
            }
        }
    },
    {
        id: 'icons',
        icon: 'fa-solid fa-wand-magic-sparkles',
        hue: AMBER,
        title: 'Every icon is yours to change',
        body: 'Ninety-odd device types arrive already mapped to an icon and a colour. In the ' +
              'Icon Studio, on a device\'s own page, any one can take a different icon, its ' +
              'own on and off colours, or one of nine animations. Shapes come from Font ' +
              'Awesome and any icon library installed on your Domoticz, including sets you ' +
              'upload yourself.',
        stage: function (host, clk) {
            var wrap = el('div', 'dzt-studio');
            var big  = el('div', 'dzt-frame dzt-frame--xl dzt-frame--lit',
                          '<i class="fa-solid fa-lightbulb"></i>');
            wrap.appendChild(big);

            var caption = el('div', 'dzt-annotation dzt-studio-caption', '');
            var strip   = el('div', 'dzt-strip');
            wrap.appendChild(caption);
            wrap.appendChild(strip);
            host.appendChild(wrap);

            /* Every anim id below is a real .dz-anim-* class from
               animations.css, applied to the icon exactly as the Studio
               applies it — so this is the motion the device would get,
               not an impression of it. */
            var looks = [
                { icon: 'fa-solid fa-fan',              hue: CYAN,   anim: 'spin',    label: 'Spin' },
                { icon: 'fa-solid fa-lightbulb',        hue: AMBER,  anim: 'glow',    label: 'Glow' },
                { icon: 'fa-solid fa-fire',             hue: RED,    anim: 'flicker', label: 'Flicker' },
                { icon: 'fa-solid fa-bell',             hue: VIOLET, anim: 'ring',    label: 'Ring' },
                { icon: 'fa-solid fa-heart-pulse',      hue: GREEN,  anim: 'breathe', label: 'Breathe' },
                { icon: 'fa-solid fa-door-open',        hue: BLUE,   anim: 'swing',   label: 'Swing' },
                { icon: 'fa-solid fa-arrow-up',         hue: CYAN,   anim: 'drift',   label: 'Drift' },
                { icon: 'fa-solid fa-plug-circle-bolt', hue: AMBER,  anim: 'blink',   label: 'Blink' },
                { icon: 'fa-solid fa-bullhorn',         hue: RED,    anim: 'bounce',  label: 'Bounce' }
            ];

            var chips = looks.map(function (look, i) {
                var chip = el('button', 'dzt-chip-icon', '<i class="' + look.icon + '"></i>');
                chip.type = 'button';
                chip.dataset.i = i;
                chip.title = look.label;
                chip.style.setProperty('--dzt-tint', look.hue);
                strip.appendChild(chip);
                return chip;
            });

            var at = 0;
            var held = false;

            function apply(i) {
                var look = looks[i];
                big.style.setProperty('--dzt-tint', look.hue);
                big.innerHTML = '<i class="' + look.icon + ' dz-anim-' + look.anim + '"></i>';
                big.classList.remove('dzt-frame--swap');
                void big.offsetWidth;
                big.classList.add('dzt-frame--swap');
                caption.textContent = look.label;
                chips.forEach(function (c, n) { c.classList.toggle('dzt-chip-icon--on', n === i); });
            }

            strip.addEventListener('click', function (e) {
                var chip = e.target.closest('.dzt-chip-icon');
                if (!chip) return;
                held = true;
                apply(+chip.dataset.i);
            });

            apply(0);
            /* Slower than the other strips: an animation needs a beat or
               two of its own cycle before you can tell what it does. */
            clk.every(2400, function () {
                if (held) return;
                at = (at + 1) % looks.length;
                apply(at);
            });
        }
    },
    {
        id: 'settings',
        icon: 'fa-solid fa-sliders',
        hue: BLUE,
        title: 'Make it yours',
        body: 'Setup → Settings has a Nightglass panel: accent and surface colours, ready-made ' +
              'presets, dark or light or follow the system, and a switch for every effect in ' +
              'this tour. It is stored against your Domoticz account, so it follows you to any ' +
              'browser you sign in from.',
        stage: function (host, clk) {
            var panel = el('div', 'dzt-panel');
            panel.innerHTML =
                '<div class="dzt-panel-row"><span>Hold to switch</span>' +
                    '<span class="dzt-switch dzt-switch--on"></span></div>' +
                '<div class="dzt-panel-row"><span>Sparkline charts</span>' +
                    '<span class="dzt-switch dzt-switch--on"></span></div>' +
                '<div class="dzt-panel-row"><span>Live toasts</span>' +
                    '<span class="dzt-switch"></span></div>' +
                '<div class="dzt-presets"></div>';
            host.appendChild(panel);

            var presets = panel.querySelector('.dzt-presets');
            var themes = ['78, 154, 241', '76, 175, 125', '200, 160, 255',
                          '240, 168, 50', '224, 85, 85'];
            themes.forEach(function (hue, i) {
                var s = el('button', 'dzt-preset' + (i === 0 ? ' dzt-preset--on' : ''));
                s.type = 'button';
                s.style.setProperty('--dzt-tint', hue);
                s.dataset.hue = hue;
                presets.appendChild(s);
            });

            var swatches = Array.prototype.slice.call(presets.querySelectorAll('.dzt-preset'));
            var held = false;

            /* Recolouring the mock panel is the demonstration: the accent
               you pick in Settings is the one every control takes. */
            function pick(i) {
                var hue = themes[i];
                panel.style.setProperty('--dzt-tint', hue);
                swatches.forEach(function (s, n) { s.classList.toggle('dzt-preset--on', n === i); });
            }

            presets.addEventListener('click', function (e) {
                var s = e.target.closest('.dzt-preset');
                if (!s) return;
                held = true;
                pick(swatches.indexOf(s));
            });
            panel.addEventListener('click', function (e) {
                var sw = e.target.closest('.dzt-switch');
                if (sw) sw.classList.toggle('dzt-switch--on');
            });

            pick(0);
            var at = 0;
            clk.every(1700, function () {
                if (held) return;
                at = (at + 1) % themes.length;
                pick(at);
            });
        }
    }
    ];

    /* ── Shell ───────────────────────────────────────────────────── */

    var root = null;     /* the overlay, or null when closed */
    var stageClk = null; /* the running chapter's timers */
    var index = 0;
    var restoreFocus = null;

    function build() {
        root = el('div', 'dzt-root');
        root.id = 'dz-tour';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-labelledby', 'dzt-title');

        root.innerHTML =
            '<div class="dzt-panel-shell" role="document">' +
                '<button type="button" class="dzt-skip">Skip tour</button>' +
                '<div class="dzt-stage"></div>' +
                '<div class="dzt-copy">' +
                    '<h2 class="dzt-title" id="dzt-title"></h2>' +
                    '<p class="dzt-body"></p>' +
                '</div>' +
                '<div class="dzt-foot">' +
                    '<div class="dzt-rail" role="tablist" aria-label="Tour chapters"></div>' +
                    '<div class="dzt-nav">' +
                        '<button type="button" class="dzt-btn dzt-btn--quiet dzt-prev">Back</button>' +
                        '<button type="button" class="dzt-btn dzt-next">Next</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        var rail = root.querySelector('.dzt-rail');
        CHAPTERS.forEach(function (ch, i) {
            var b = el('button', 'dzt-stop', '<i class="' + ch.icon + '"></i>');
            b.type = 'button';
            b.dataset.i = i;
            b.style.setProperty('--dzt-tint', ch.hue);
            b.setAttribute('role', 'tab');
            b.setAttribute('aria-label', ch.title);
            b.title = ch.title;
            rail.appendChild(b);
        });

        rail.addEventListener('click', function (e) {
            var stop = e.target.closest('.dzt-stop');
            if (stop) go(+stop.dataset.i);
        });
        root.querySelector('.dzt-skip').addEventListener('click', close);
        root.querySelector('.dzt-prev').addEventListener('click', function () { go(index - 1); });
        /* Next is wired in go(), not here: what it does changes on the last
           chapter. Binding it in both places would fire both handlers and
           skip a chapter on every press. */

        /* Clicking the backdrop leaves; clicking the panel must not. */
        root.addEventListener('mousedown', function (e) {
            if (e.target === root) close();
        });

        document.body.appendChild(root);
        return root;
    }

    function go(i) {
        if (!root) return;
        i = Math.max(0, Math.min(CHAPTERS.length - 1, i));
        index = i;
        var ch = CHAPTERS[i];

        if (stageClk) stageClk.stop();
        stageClk = clock();

        var shell = root.querySelector('.dzt-panel-shell');
        shell.style.setProperty('--dzt-hue', ch.hue);

        var stage = root.querySelector('.dzt-stage');
        stage.innerHTML = '';
        /* Restart the entrance every chapter — the stage swapping is the
           feedback that the press did something. */
        stage.classList.remove('dzt-stage--in');
        void stage.offsetWidth;
        stage.classList.add('dzt-stage--in');
        ch.stage(stage, stageClk);

        root.querySelector('.dzt-title').textContent = ch.title;
        root.querySelector('.dzt-body').textContent  = ch.body;

        Array.prototype.forEach.call(root.querySelectorAll('.dzt-stop'), function (s, n) {
            s.classList.toggle('dzt-stop--lit', n <= i);
            s.classList.toggle('dzt-stop--here', n === i);
            s.setAttribute('aria-selected', n === i ? 'true' : 'false');
        });

        root.querySelector('.dzt-prev').disabled = (i === 0);

        var next = root.querySelector('.dzt-next');
        var last = (i === CHAPTERS.length - 1);
        next.textContent = last ? 'Done' : 'Next';
        next.classList.toggle('dzt-btn--final', last);
        next.onclick = last ? close : function () { go(index + 1); };
    }

    function onKey(e) {
        if (!root) return;

        /* The tour is modal, and the theme's own shortcuts are not: the
           number keys route the page, / opens the filter, N the history,
           Ctrl K the palette. All of those listen on document in the
           bubble phase, so swallowing the event here — in capture, before
           it ever reaches a target — is what stops a press meant for the
           tour from also navigating the dashboard behind it. Propagation
           only; the browser's own shortcuts are left alone. */
        e.stopPropagation();

        if (e.key === 'Escape')      { e.preventDefault(); close(); return; }
        if (e.key === 'ArrowRight')  { e.preventDefault(); go(index + 1); return; }
        if (e.key === 'ArrowLeft')   { e.preventDefault(); go(index - 1); return; }
        if (e.key !== 'Tab') return;

        /* Keep Tab inside the overlay: behind it is a whole dashboard of
           controls that must not take focus while this is up. */
        var stops = root.querySelectorAll(
            'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!stops.length) return;
        var first = stops[0];
        var last  = stops[stops.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
    }

    function open() {
        if (root) return;
        restoreFocus = document.activeElement;
        build();
        document.body.classList.add('dz-tour-open');
        document.addEventListener('keydown', onKey, true);
        go(0);
        /* Focus the primary action, not the panel: a screen reader should
           land on the thing that advances. */
        var next = root.querySelector('.dzt-next');
        if (next) next.focus();
    }

    function close() {
        if (!root) return;
        if (stageClk) { stageClk.stop(); stageClk = null; }
        document.removeEventListener('keydown', onKey, true);
        document.body.classList.remove('dz-tour-open');

        var dying = root;
        root = null;
        dying.classList.add('dzt-root--out');
        setTimeout(function () {
            if (dying.parentNode) dying.parentNode.removeChild(dying);
        }, 200);

        remember();
        if (restoreFocus && restoreFocus.focus) {
            try { restoreFocus.focus(); } catch (e) { /* gone with the route */ }
        }
        restoreFocus = null;
    }

    /* Written on close rather than on open: a tour you never got to the
       end of because the page reloaded is a tour you have not seen. */
    function remember() {
        var s = window.dzNightglassSettings;
        if (s && typeof s.setAndPersist === 'function') s.setAndPersist(SEEN_KEY, true);
        else if (s) s.set(SEEN_KEY, true);
    }

    /* ── Gate ─────────────────────────────────────────────────────────
       Three things have to be true before the tour opens by itself: the
       session is authenticated (userrights lands at -1 for a visitor who
       has not signed in, and my_config does not exist at all until the
       permissions service has answered), we are not sitting on the login
       or wizard route, and the app has actually painted a navbar. The
       last one keeps the overlay from arriving over a blank frame.  */

    function authenticated() {
        var c = window.my_config;
        return !!(c && typeof c.userrights !== 'undefined' && +c.userrights >= 0);
    }

    function onAppRoute() {
        var h = (window.location.hash || '').toLowerCase();
        return h.indexOf('login') < 0 && h.indexOf('wizard') < 0;
    }

    function ready() {
        return authenticated() && onAppRoute() && !!document.querySelector('.navbar, #navbar');
    }

    function seen() {
        var s = window.dzNightglassSettings;
        return !!(s && s.get(SEEN_KEY));
    }

    function maybeOpen() {
        if (root) return;
        if (!ALWAYS_SHOW && seen()) return;
        open();
    }

    function watch() {
        var tries = 0;
        var poll = setInterval(function () {
            if (ready()) {
                clearInterval(poll);
                /* One beat after the app is up, so the tour lands on a
                   finished dashboard rather than mid-render. */
                setTimeout(waitForSettings, 600);
            } else if (++tries > 60) {
                clearInterval(poll);   /* login screen, or never came up */
            }
        }, 500);
    }

    /* The stored blob arrives a moment after load. Asking get() before it
       does would read the default — false — and show the tour to somebody
       who has already dismissed it. */
    function waitForSettings() {
        var s = window.dzNightglassSettings;
        if (ALWAYS_SHOW || !s || typeof s.whenReady !== 'function') { maybeOpen(); return; }
        s.whenReady(maybeOpen);
    }

    window.dzTour = {
        start: open,
        close: close,
        go: go,
        reset: function () {
            var s = window.dzNightglassSettings;
            if (s && typeof s.setAndPersist === 'function') s.setAndPersist(SEEN_KEY, false);
            else if (s) s.set(SEEN_KEY, false);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watch);
    } else {
        watch();
    }
})();
