/*
 *  Nightglass — in-page colour picker
 *
 *  Domoticz builds its colour control with ShowRGBWPicker(selector, …),
 *  which drops a jQWCP wheel widget into a host table. Four places use it:
 *  the Light/Switch edit page (device-color-settings), the scene and group
 *  level editors, and the timer editor. Only the device-card popup
 *  (#rgbw_popup) ever got a Nightglass rewrite — these hosts were left
 *  wearing Domoticz's widget with our CSS painted over it.
 *
 *  Rather than reimplement mode selection, the colour JSON, the debounce
 *  and each host's change callback, this keeps jQWCP as the engine and
 *  parks it off-screen. Our controls write into it and fire the
 *  'slidermove'/'sliderup' pair Domoticz already listens for, so every
 *  host keeps behaving exactly as Domoticz intends — the timer editor
 *  still stages a value, the device page still commands the light.
 */
(function () {
    'use strict';

    var WSIZE = 200;                 /* wheel canvas, matches the popup   */
    var WR    = WSIZE / 2;
    var COMMIT_THROTTLE = 120;       /* ms; Domoticz debounces 400 on top */

    /* ── Colour maths ─────────────────────────────────────────────── */

    function hsvToRgb(h, s, v) {
        var r, g, b, i = Math.floor(h * 6), f = h * 6 - i;
        var p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
        switch (i % 6) {
            case 0: r=v; g=t; b=p; break; case 1: r=q; g=v; b=p; break;
            case 2: r=p; g=v; b=t; break; case 3: r=p; g=q; b=v; break;
            case 4: r=t; g=p; b=v; break; default: r=v; g=p; b=q;
        }
        return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
    }

    function rgbToHsv(r, g, b) {
        r/=255; g/=255; b/=255;
        var max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
        var h, s = max===0 ? 0 : d/max, v = max;
        if (max === min) { h = 0; }
        else {
            switch (max) {
                case r: h=((g-b)/d+(g<b?6:0))/6; break;
                case g: h=((b-r)/d+2)/6; break;
                default: h=((r-g)/d+4)/6;
            }
        }
        return { h: h, s: s, v: v };
    }

    function warmthToRgb(w) {
        return {
            r: Math.round(232 + (255-232)*w),
            g: Math.round(244 + (179-244)*w),
            b: Math.round(253 + (71-253)*w)
        };
    }

    function toHex(n) { return ('0' + n.toString(16)).slice(-2); }

    function parseHex(v) {
        var hex = String(v == null ? '' : v).trim().replace(/^#/, '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
        var n = parseInt(hex, 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    /* ── State (one host exists at a time — the selector is hardcoded
          to '#rgbw-picker' inside Domoticz's component) ────────────── */

    var _host = null, _engine = null, _panel = null, _sig = '';
    var _modes = [], _mode = 'color';
    var _hasTemp = false, _isRel = false;
    /* _v is the colour's own brightness, separate from _bright (the master
       level). Only Mix uses it: Domoticz forces value to 1 in plain colour
       mode, but in custom mode the RGB it sends carries v, which is how the
       colour is balanced against the white channel. */
    var _h = 0, _s = 1, _v = 1, _warmth = 0.5, _white = 1, _bright = 100;
    var _els = {};
    var _commitTimer = 0, _commitPending = false;

    function $$() { return window.jQuery; }

    /* ── Engine bridge ────────────────────────────────────────────── */

    /* colorPickerMode is private to ShowRGBWPicker, but getJSONColor()
       reports it through the mode field of the JSON it builds. */
    function readMode() {
        var m = null;
        try { m = JSON.parse(_engine.getJSONColor()).m; } catch (e) { /* see below */ }
        if (m === 1) return 'white';
        if (m === 2) return 'temperature';
        if (m === 3) return 'color';
        if (m === 4) return 'custom';
        /* Relative dimmers put Domoticz in a "…_no_master" mode, for which
           getJSONColor returns nothing at all. Keep what we had. */
        return hasMode(_mode) ? _mode : (_modes[0] ? _modes[0].id : 'color');
    }

    function hasMode(id) {
        return _modes.some(function (m) { return m.id === id; });
    }

    function syncFromEngine() {
        var c;
        try { c = $$()(_engine).wheelColorPicker('getColor'); } catch (e) { return; }
        if (!c) return;
        _h = c.h || 0;
        _s = (c.s == null) ? 1 : c.s;
        _v = (c.v == null) ? 1 : c.v;
        _warmth = (c.t == null) ? 0.5 : c.t;
        _white = (c.w == null) ? 1 : c.w;
        _bright = Math.max(1, Math.min(100, Math.round((c.m == null ? 1 : c.m) * 100)));
        _mode = readMode();
    }

    /* Push our state into jQWCP and fire the events Domoticz bound to it.
       Everything downstream — the colour JSON, the 400ms debounce, the
       per-host callback — stays Domoticz's own code. */
    /* settled: the user has finished choosing — a released drag, a typed hex,
       a swatch click. Only those are worth recording as a recent colour; the
       throttled commits during a drag would otherwise fill the strip with one
       gradient. The popup version of this rule keys off the dialog closing,
       which this picker never does — it lives on the page. */
    function commitNow(settled) {
        _commitPending = false;
        try {
            var $inp = $$()(_engine);
            /* Domoticz clamps value to 1 itself before building the colour
               JSON in plain colour mode; in Mix it uses whatever is set, so
               that is the one mode where our own _v has to go across. */
            $inp.wheelColorPicker('setHsv', _h, _s, _mode === 'custom' ? _v : 1);
            if (_hasTemp) $inp.wheelColorPicker('setTemperature', _warmth);
            $inp.wheelColorPicker('setWhite', _white);
            if (!_isRel) $inp.wheelColorPicker('setMaster', _bright / 100);
            $inp.trigger('slidermove');
            $inp.trigger('sliderup');
        } catch (e) {
            if (window.ngLog) window.ngLog('[ng-picker]', 'commit failed', e);
            return;
        }
        if (settled && window.ngColors && (_mode === 'color' || _mode === 'custom')) {
            window.ngColors.remember(currentHex());
        }
    }

    /* Dragging the wheel fires continuously; Domoticz debounces the send
       but still rebuilds the JSON each time, so throttle on our side. */
    function commit() {
        if (_commitTimer) { _commitPending = true; return; }
        commitNow();
        _commitTimer = setTimeout(function () {
            _commitTimer = 0;
            if (_commitPending) commit();
        }, COMMIT_THROTTLE);
    }

    /* ── Drawing ──────────────────────────────────────────────────── */

    function drawWheel(canvas) {
        var ctx = canvas.getContext('2d');
        var img = ctx.createImageData(WSIZE, WSIZE);
        var d = img.data;
        for (var y = 0; y < WSIZE; y++) {
            for (var x = 0; x < WSIZE; x++) {
                var dx = x - WR, dy = y - WR, dist = Math.sqrt(dx*dx + dy*dy);
                var i4 = (y*WSIZE + x) * 4;
                if (dist > WR) { d[i4+3] = 0; continue; }
                var rgb = hsvToRgb(((Math.atan2(dy, dx) / (2*Math.PI)) + 1) % 1, dist / WR, 1);
                d[i4] = rgb.r; d[i4+1] = rgb.g; d[i4+2] = rgb.b; d[i4+3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);

        var angle = _h * 2 * Math.PI, rad = _s * (WR - 6);
        var cx = WR + rad * Math.cos(angle), cy = WR + rad * Math.sin(angle);
        var cur = hsvToRgb(_h, _s, 1);
        ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 2*Math.PI);
        ctx.fillStyle = 'rgb('+cur.r+','+cur.g+','+cur.b+')'; ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 2*Math.PI);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    }

    function drawWarmth(canvas) {
        var ctx = canvas.getContext('2d');
        var g = ctx.createLinearGradient(0, 0, canvas.width, 0);
        g.addColorStop(0,   '#E8F4FD');
        g.addColorStop(0.5, '#FFF5E0');
        g.addColorStop(1,   '#FFB347');
        ctx.fillStyle = g;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(0, 0, canvas.width, canvas.height, 16);
        else ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.fill();

        var x = _warmth * (canvas.width - 1);
        var rgb = warmthToRgb(_warmth);
        ctx.beginPath(); ctx.arc(x, canvas.height/2, 12, 0, 2*Math.PI);
        ctx.fillStyle = 'rgb('+rgb.r+','+rgb.g+','+rgb.b+')'; ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();
    }

    /* The colour actually sent. In Mix that includes _v, so the hex field
       tells the truth about a colour dimmed against the white channel. */
    function currentHex() {
        var rgb = hsvToRgb(_h, _s, _mode === 'custom' ? _v : 1);
        return '#' + toHex(rgb.r) + toHex(rgb.g) + toHex(rgb.b);
    }

    /* ── Painting our controls from state ─────────────────────────── */

    var WHEEL_MODES  = { color: 1, custom: 1 };
    var WARMTH_MODES = { temperature: 1 };

    function showsWheel()  { return !!WHEEL_MODES[_mode]; }
    function showsWarmth() { return !!WARMTH_MODES[_mode] || (_mode === 'custom' && _hasTemp); }

    function render() {
        if (!_panel) return;

        _panel.querySelectorAll('.ng-ip-tab').forEach(function (t) {
            t.classList.toggle('ng-rgbw-tab--active', t.getAttribute('data-mode') === _mode);
        });

        toggle(_els.wheelBlock,  showsWheel());
        toggle(_els.warmthBlock, showsWarmth());
        toggle(_els.valueBlock,  _mode === 'custom');
        toggle(_els.whiteBlock,  _mode === 'custom');
        toggle(_els.whiteNote,   _mode === 'white');
        toggle(_els.recentSlot,  showsWheel());

        if (showsWheel() && _els.wheel)   drawWheel(_els.wheel);
        if (showsWarmth() && _els.warmth) drawWarmth(_els.warmth);
        if (_els.valueRange) _els.valueRange.value = Math.round(_v * 100);
        if (_els.whiteRange) _els.whiteRange.value = Math.round(_white * 100);

        if (_els.brightRange) _els.brightRange.value = _bright;
        if (_els.brightNum && document.activeElement !== _els.brightNum) {
            _els.brightNum.value = _bright;
        }

        /* Assigning .value raises no input event, so the track fill of each
           slider has to be primed by hand. */
        if (window.ngFillRange) {
            [_els.valueRange, _els.whiteRange, _els.brightRange]
                .forEach(function (r) { if (r) window.ngFillRange(r); });
        }

        var rgb = showsWheel()
            ? hsvToRgb(_h, _s, _mode === 'custom' ? _v : 1)
            : warmthToRgb(_warmth);
        if (_els.swatch) _els.swatch.style.background = 'rgb('+rgb.r+','+rgb.g+','+rgb.b+')';

        if (_els.hex) {
            if (showsWheel()) {
                _els.hex.readOnly = false;
                _els.hex.title = 'Type or paste a hex colour';
                if (document.activeElement !== _els.hex) _els.hex.value = currentHex();
            } else {
                /* Colour temperature and plain white have no hex to type. */
                _els.hex.readOnly = true;
                _els.hex.title = _mode === 'white'
                    ? 'This light is in white mode'
                    : 'Colour temperature — use the warmth bar';
                _els.hex.value = _mode === 'white' ? 'White'
                    : (_warmth < 0.3 ? 'Cool white' : _warmth > 0.7 ? 'Warm white' : 'Natural');
            }
        }
    }

    function toggle(el, on) { if (el) el.style.display = on ? '' : 'none'; }

    /* Load a concrete RGB colour (typed hex, recent swatch) into our state.
       In Mix the value axis is a real control, so honour it; elsewhere the
       wheel only carries hue and saturation. */
    function applyRgb(rgb, settled) {
        var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        _h = hsv.h; _s = hsv.s;
        if (_mode === 'custom') _v = hsv.v;
        render();
        /* Typing streams a character at a time; a swatch click is one decision. */
        if (settled) commitNow(true); else commit();
    }

    /* ── Mode switching ───────────────────────────────────────────── */

    /* Domoticz binds the real mode change to its own (now hidden) icon
       row, so click that rather than duplicate UpdateColorPicker. */
    var MODE_TRIGGER = {
        color:       '.pickermodergb',
        white:       '.pickermodewhite',
        temperature: '.pickermodetemp'
    };

    function setMode(id) {
        if (id === _mode) return;
        var sel = MODE_TRIGGER[id] ||
            (_hasTemp ? '.pickermodecustomww' : '.pickermodecustomw');
        var trigger = _host.querySelector(sel);
        if (!trigger) return;
        _mode = id;
        $$()(trigger).trigger('click');
        render();
        /* Deliberately does not send. Clicking a tab means "show me these
           controls", not "apply this mode" — and since the send would turn an
           off light on, browsing to another tab would change the light. The
           click above still runs Domoticz's own UpdateColorPicker, which
           reconfigures the picker without sending either; the mode goes to the
           device as soon as a real control is moved. */
    }

    /* ── Build ────────────────────────────────────────────────────── */

    /* getLEDType does a bare SubType.indexOf, so an absent subtype throws. */
    function ledTypeOf(subType) {
        if (typeof window.getLEDType !== 'function') return null;
        try { return window.getLEDType(String(subType || '')); } catch (e) { return null; }
    }

    function supportedModes(subType, dimmerType) {
        var led = ledTypeOf(subType);
        if (!led) return [{ id: 'color', label: 'Colour', icon: 'fa-circle-half-stroke' }];

        var out = [];
        /* Mirrors the rules in Domoticz's own UpdateColorPicker. */
        if (led.bHasRGB) out.push({ id: 'color', label: 'Colour', icon: 'fa-circle-half-stroke' });
        if (led.bHasWhite && !led.bHasTemperature && dimmerType !== 'rel') {
            out.push({ id: 'white', label: 'White', icon: 'fa-lightbulb' });
        }
        if (led.bHasTemperature && dimmerType !== 'rel') {
            out.push({ id: 'temperature', label: 'Warmth', icon: 'fa-sun' });
        }
        if (led.bHasCustom) out.push({ id: 'custom', label: 'Mix', icon: 'fa-layer-group' });
        return out.length ? out : [{ id: 'color', label: 'Colour', icon: 'fa-circle-half-stroke' }];
    }

    function el(tag, cls, html) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
    }

    function buildPanel() {
        var panel = el('div', 'ng-ip-panel');

        /* Tabs — only worth showing when there is a choice to make */
        if (_modes.length > 1) {
            var tabs = el('div', 'ng-rgbw-tabs');
            _modes.forEach(function (m) {
                var b = el('button', 'ng-rgbw-tab ng-ip-tab',
                    '<i class="fa-solid ' + m.icon + '"></i> ' + m.label);
                b.type = 'button';
                b.setAttribute('data-mode', m.id);
                b.addEventListener('click', function (e) {
                    e.preventDefault();
                    setMode(this.getAttribute('data-mode'));
                });
                tabs.appendChild(b);
            });
            panel.appendChild(tabs);
        }

        /* Wheel */
        _els.wheelBlock = el('div', 'ng-rgbw-pane ng-ip-block');
        var wrap = el('div', 'ng-rgbw-wheel-wrap');
        _els.wheel = document.createElement('canvas');
        _els.wheel.width = WSIZE; _els.wheel.height = WSIZE;
        _els.wheel.className = 'ng-ip-wheel';
        wrap.appendChild(_els.wheel);
        _els.wheelBlock.appendChild(wrap);
        panel.appendChild(_els.wheelBlock);
        attachDrag(_els.wheel, pickWheel);

        /* Recently used colours, shared with every other picker */
        _els.recentSlot = el('div', 'ng-ip-recent-slot');
        if (window.ngColors) {
            _els.recentSlot.appendChild(window.ngColors.buildRow({
                onPick: function (hex) {
                    var rgb = parseHex(hex);
                    if (rgb) applyRgb(rgb, true);
                }
            }));
        }
        panel.appendChild(_els.recentSlot);

        /* Warmth bar */
        _els.warmthBlock = el('div', 'ng-rgbw-pane ng-ip-block');
        var wWrap = el('div', 'ng-rgbw-warmth-wrap');
        _els.warmth = document.createElement('canvas');
        _els.warmth.width = 240; _els.warmth.height = 36;
        _els.warmth.className = 'ng-ip-warmth';
        wWrap.appendChild(_els.warmth);
        _els.warmthBlock.appendChild(wWrap);
        _els.warmthBlock.appendChild(el('div', 'ng-rgbw-warmth-labels',
            '<span><i class="fa-solid fa-snowflake"></i> Cool</span>' +
            '<span>Warm <i class="fa-solid fa-fire"></i></span>'));
        panel.appendChild(_els.warmthBlock);
        attachDrag(_els.warmth, pickWarmth);

        /* Colour intensity — Mix balances the RGB channels against the white
           ones, so it needs the value axis the wheel cannot express (the
           wheel gives hue and saturation only). Domoticz spells this the
           same way: its customw/customww slider sets are 'wvlm' and 'wvklm'. */
        _els.valueBlock = el('div', 'ng-rgbw-slider-row ng-ip-block');
        _els.valueBlock.appendChild(el('i', 'fa-solid fa-circle-half-stroke ng-rgbw-icon-dim'));
        _els.valueRange = document.createElement('input');
        _els.valueRange.type = 'range';
        _els.valueRange.className = 'ng-rgbw-slider';
        _els.valueRange.min = '0'; _els.valueRange.max = '100';
        _els.valueRange.title = 'How strong the colour is against the white';
        /* input streams while dragging, change fires on release: the throttle
           rides the first, the settled value rides the second. */
        _els.valueRange.addEventListener('input', function () {
            _v = parseInt(this.value, 10) / 100;
            render(); commit();
        });
        _els.valueRange.addEventListener('change', function () { commitNow(true); });
        _els.valueBlock.appendChild(_els.valueRange);
        _els.valueBlock.appendChild(el('i', 'fa-solid fa-palette ng-rgbw-icon-bright'));
        panel.appendChild(_els.valueBlock);

        /* White amount — only the custom (colour + white mix) mode uses it */
        _els.whiteBlock = el('div', 'ng-rgbw-slider-row ng-ip-block');
        _els.whiteBlock.appendChild(el('i', 'fa-regular fa-lightbulb ng-rgbw-icon-dim'));
        _els.whiteRange = document.createElement('input');
        _els.whiteRange.type = 'range';
        _els.whiteRange.className = 'ng-rgbw-slider';
        _els.whiteRange.min = '0'; _els.whiteRange.max = '100';
        _els.whiteRange.title = 'White mixed into the colour';
        _els.whiteRange.addEventListener('input', function () {
            _white = parseInt(this.value, 10) / 100;
            render(); commit();
        });
        _els.whiteRange.addEventListener('change', function () { commitNow(true); });
        _els.whiteBlock.appendChild(_els.whiteRange);
        _els.whiteBlock.appendChild(el('i', 'fa-solid fa-lightbulb ng-rgbw-icon-bright'));
        panel.appendChild(_els.whiteBlock);

        /* Plain-white mode has nothing to configure but brightness */
        _els.whiteNote = el('div', 'ng-ip-note',
            '<i class="fa-solid fa-circle-info"></i> ' +
            'This light is set to plain white. Use the brightness below.');
        panel.appendChild(_els.whiteNote);

        /* Preview + hex */
        var preview = el('div', 'ng-rgbw-preview');
        _els.swatch = el('div', 'ng-rgbw-swatch');
        _els.hex = document.createElement('input');
        _els.hex.type = 'text';
        _els.hex.className = 'ng-rgbw-hex';
        _els.hex.maxLength = 7;
        _els.hex.spellcheck = false;
        _els.hex.placeholder = '#rrggbb';
        _els.hex.addEventListener('input', function () {
            if (this.readOnly) return;
            var rgb = parseHex(this.value);
            if (rgb) applyRgb(rgb);
        });
        _els.hex.addEventListener('blur', function () {
            if (this.readOnly) return;
            this.value = currentHex();
            commitNow(true);      /* leaving the field settles what was typed */
        });
        _els.hex.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
        });
        preview.appendChild(_els.swatch);
        preview.appendChild(_els.hex);
        panel.appendChild(preview);

        /* Brightness — slider and a typed percentage, the pair Domoticz's
           own picker gained. Relative dimmers have no absolute level to set. */
        if (!_isRel) {
            var row = el('div', 'ng-rgbw-slider-row');
            row.appendChild(el('i', 'fa-solid fa-moon ng-rgbw-icon-dim'));
            _els.brightRange = document.createElement('input');
            _els.brightRange.type = 'range';
            _els.brightRange.className = 'ng-rgbw-slider';
            _els.brightRange.min = '1'; _els.brightRange.max = '100';
            _els.brightRange.addEventListener('input', function () {
                _bright = parseInt(this.value, 10) || 1;
                if (_els.brightNum) _els.brightNum.value = _bright;
                commit();
            });
            _els.brightRange.addEventListener('change', function () { commitNow(); });
            row.appendChild(_els.brightRange);
            row.appendChild(el('i', 'fa-solid fa-sun ng-rgbw-icon-bright'));

            var field = el('span', 'ng-rgbw-bright-field');
            _els.brightNum = document.createElement('input');
            _els.brightNum.type = 'text';
            _els.brightNum.className = 'ng-rgbw-bright-input';
            _els.brightNum.setAttribute('inputmode', 'numeric');
            /* An input with no size attribute defaults to 20 characters wide.
               If the stylesheet is stale or outbid, that lone default is
               enough to eat the whole row and squash the slider to nothing. */
            _els.brightNum.setAttribute('size', '3');
            _els.brightNum.maxLength = 3;
            _els.brightNum.title = 'Brightness %';
            _els.brightNum.addEventListener('input', function () {
                /* Typing "10" on the way to "100" must not snap anything. */
                if (this.value === '') return;
                var n = parseInt(this.value.replace(/\D/g, ''), 10);
                if (isNaN(n)) return;
                _bright = Math.max(1, Math.min(100, n));
                if (_els.brightRange) _els.brightRange.value = _bright;
                commit();
            });
            _els.brightNum.addEventListener('blur', function () { render(); commitNow(); });
            _els.brightNum.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
            });
            field.appendChild(_els.brightNum);
            field.appendChild(el('span', 'ng-rgbw-bright-unit', '%'));
            row.appendChild(field);
            panel.appendChild(row);
        }

        return panel;
    }

    /* ── Pointer interaction ──────────────────────────────────────── */

    /* The panel is rebuilt whenever Angular re-renders the host, so the
       document-level drag listeners are registered once for the module and
       aimed at whichever canvas is currently being dragged. Per-canvas
       listeners would pile up one set per navigation. */
    var _drag = null;   /* { canvas, pick } while a drag is in progress */

    function pointOf(e) {
        return e.touches && e.touches[0] ? e.touches[0] : e;
    }

    function pickWheel(canvas, e) {
        var rect = canvas.getBoundingClientRect();
        var scale = WSIZE / (rect.width || WSIZE);
        var pt = pointOf(e);
        var dx = (pt.clientX - rect.left) * scale - WR;
        var dy = (pt.clientY - rect.top)  * scale - WR;
        _h = ((Math.atan2(dy, dx) / (2*Math.PI)) + 1) % 1;
        _s = Math.min(Math.sqrt(dx*dx + dy*dy) / WR, 1);
        render(); commit();
    }

    function pickWarmth(canvas, e) {
        var rect = canvas.getBoundingClientRect();
        var pt = pointOf(e);
        _warmth = Math.max(0, Math.min(1, (pt.clientX - rect.left) / rect.width));
        render(); commit();
    }

    function startDrag(canvas, pick, e) {
        _drag = { canvas: canvas, pick: pick };
        pick(canvas, e);
    }

    function endDrag() {
        if (!_drag) return;
        _drag = null;
        /* The released value must land whatever the throttle was doing, and it
           is the one the user settled on. */
        commitNow(true);
    }

    document.addEventListener('mousemove', function (e) {
        if (_drag) _drag.pick(_drag.canvas, e);
    });
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', function (e) {
        if (_drag) { _drag.pick(_drag.canvas, e); e.preventDefault(); }
    }, { passive: false });
    document.addEventListener('touchend', endDrag);
    document.addEventListener('touchcancel', endDrag);

    function attachDrag(canvas, pick) {
        canvas.addEventListener('mousedown', function (e) { startDrag(canvas, pick, e); });
        canvas.addEventListener('touchstart', function (e) {
            e.preventDefault();
            startDrag(canvas, pick, e);
        }, { passive: false });
    }

    /* ── Mount ────────────────────────────────────────────────────── */

    function mount(selector, subType, dimmerType) {
        var host = document.querySelector(selector);
        if (!host) return;
        var engine = host.querySelector('#popup_picker');
        if (!engine || !$$()) return;

        var led = ledTypeOf(subType);
        _hasTemp = !!(led && led.bHasTemperature);
        _isRel = (dimmerType === 'rel');

        var modes = supportedModes(subType, dimmerType);
        /* Which tabs and controls the panel needs. The scenes page keeps one
           #popup_picker and re-points it at whichever device you select, so an
           RGBWW light followed by an RGB one must not keep the Warmth tab. */
        var sig = modes.map(function (m) { return m.id; }).join(',') + '|' + _isRel;

        /* Re-entry: ShowRGBWPicker runs again on every model change. Same
           engine, same shape — just re-read it and repaint. */
        if (engine === _engine && _panel && _panel.parentNode && sig === _sig) {
            _host = host;
            _modes = modes;
            syncFromEngine();
            render();
            return;
        }

        /* The picker markup exists in three shapes: #rgbw-picker is itself the
           table (device edit, timers), the scenes page wraps a table.colorpicker
           in a <tr>, and the popup is a plain div. Anchor on the table that
           actually holds the widget so the panel lands somewhere legal in all
           of them — a <tr> host cannot take another <tr>. */
        var table = engine.closest ? engine.closest('table') : null;
        var anchor = table || engine;
        if (!anchor.parentNode) return;

        if (_panel && _panel.parentNode) _panel.parentNode.removeChild(_panel);

        _host = host;
        _engine = engine;
        _els = {};
        _modes = modes;
        _sig = sig;

        /* Park Domoticz's widget off-screen rather than display:none — it stays
           the engine, and its canvases keep real dimensions.

           The parking itself is done in CSS, keyed on .ng-ip-host, because
           jQWCP fights both alternatives: refreshWidget() re-appends every
           active wheel and slider straight onto .jQWCP-wWidget (so anything
           we move into a wrapper comes straight back out, redrawn below our
           panel), and it opens by resetting the widget's class attribute
           outright (so a marker class we add does not survive a mode change).
           A rule aimed at the widget element outlives both. */
        var widget = engine.closest ? engine.closest('.jQWCP-wWidget') : null;
        var cell = (widget && widget.parentNode) || engine.parentNode;
        if (cell && cell.classList) cell.classList.add('ng-ip-engine-cell');

        (table || host).classList.add('ng-ip-host');

        _panel = buildPanel();
        anchor.parentNode.insertBefore(_panel, anchor);

        syncFromEngine();
        render();
    }

    /* ── Hook ─────────────────────────────────────────────────────── */

    function hook() {
        if (typeof window.ShowRGBWPicker !== 'function') { setTimeout(hook, 300); return; }
        if (window.ShowRGBWPicker._ngHooked) return;

        var orig = window.ShowRGBWPicker;
        window.ShowRGBWPicker = function (selector, idx, Protected, MaxDimLevel,
                                          LevelInt, colorJSON, iSubType, iDimmerType) {
            orig.apply(this, arguments);
            /* The device-card popup has its own full rewrite in popups.js. */
            if (selector === '#rgbw_popup') return;
            try {
                mount(selector, iSubType, iDimmerType);
            } catch (e) {
                if (window.ngLog) window.ngLog('[ng-picker]', 'mount failed', e);
            }
        };
        window.ShowRGBWPicker._ngHooked = true;
    }

    hook();
}());
