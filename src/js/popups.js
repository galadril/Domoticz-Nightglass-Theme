(function () {
    'use strict';

    /* ── Overlay / modal management ────────────────────────────────── */

    var _activePopupId = null;

    /* Closing is the moment a popup's state has settled, which is when a
       colour is worth recording as "recent" — mid-drag it is just a smear of
       near-identical hues. Popups register here rather than each one hooking
       every route out (X button, backdrop click, Escape, another popup
       opening, Domoticz hiding it directly). */
    var _closeHooks = {};

    function onPopupClose(id, fn) { _closeHooks[id] = fn; }

    function getOrCreateOverlay() {
        var ov = document.getElementById('ng-popup-overlay');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'ng-popup-overlay';
            ov.addEventListener('click', function (e) {
                if (e.target === ov) ngCloseActivePopup();
            });
            document.body.appendChild(ov);
        }
        return ov;
    }

    function ngOpenPopup(id) {
        var popup = document.getElementById(id);
        if (!popup) return;
        if (_activePopupId && _activePopupId !== id) ngClosePopup(_activePopupId);
        _activePopupId = id;
        popup.style.display = 'block';
        getOrCreateOverlay().classList.add('ng-popup-overlay--open');
        popup.classList.add('ng-popup--modal');
        if (window.ngSetDialogOpen) window.ngSetDialogOpen('popup', true);
    }

    function ngClosePopup(id) {
        if (id && _closeHooks[id]) {
            try { _closeHooks[id](); } catch (e) { /* never block the close */ }
        }
        var ov = document.getElementById('ng-popup-overlay');
        if (ov) ov.classList.remove('ng-popup-overlay--open');
        var popup = id ? document.getElementById(id) : null;
        if (popup) {
            popup.classList.remove('ng-popup--modal');
            popup.style.display = 'none';
        }
        _activePopupId = null;
        if (window.ngSetDialogOpen) window.ngSetDialogOpen('popup', false);
    }

    function ngCloseActivePopup() {
        ngClosePopup(_activePopupId);
    }

    window.ngOpenPopup        = ngOpenPopup;
    window.ngCloseActivePopup = ngCloseActivePopup;

    /* ── Arc math helpers ──────────────────────────────────────────── */

    // SVG viewport 220×220, dial centre 110,115, radius 80
    // Arc: 150° (8 o'clock, cold) → clockwise 240° → 30° (4 o'clock, hot)
    var CX = 110, CY = 115, R = 80, START = 150, SWEEP = 240;

    function d2r(deg) { return deg * Math.PI / 180; }

    function pt(deg) {
        return {
            x: +(CX + R * Math.cos(d2r(deg))).toFixed(2),
            y: +(CY + R * Math.sin(d2r(deg))).toFixed(2)
        };
    }

    function arcPath(startDeg, sweepDeg) {
        if (sweepDeg <= 0) return '';
        var s = pt(startDeg);
        var e = pt(startDeg + sweepDeg);
        var la = sweepDeg > 180 ? 1 : 0;
        return 'M' + s.x + ' ' + s.y + ' A' + R + ' ' + R + ' 0 ' + la + ' 1 ' + e.x + ' ' + e.y;
    }

    function tempColor(t) {
        var stops = [
            [0.00, [30,  144, 255]],
            [0.35, [0,   200, 210]],
            [0.55, [76,  175, 125]],
            [0.75, [240, 168,  50]],
            [1.00, [224,  85,  85]]
        ];
        for (var i = 0; i < stops.length - 1; i++) {
            var t0 = stops[i][0], t1 = stops[i + 1][0];
            if (t >= t0 && t <= t1) {
                var f  = (t - t0) / (t1 - t0);
                var c  = stops[i][1], d = stops[i + 1][1];
                return 'rgb(' + [0, 1, 2].map(function (j) {
                    return Math.round(c[j] + f * (d[j] - c[j]));
                }).join(',') + ')';
            }
        }
        return t < 0.5 ? 'rgb(30,144,255)' : 'rgb(224,85,85)';
    }

    /* ── Setpoint state ────────────────────────────────────────────── */

    var _spMin = -200, _spMax = 200, _spStep = 0.5, _spUnit = '°';

    function valToT(v)  { return Math.max(0, Math.min(1, (v - _spMin) / (_spMax - _spMin || 1))); }
    function tToVal(t)  {
        var raw = _spMin + t * (_spMax - _spMin);
        raw = Math.round(raw / _spStep) * _spStep;
        return +(Math.max(_spMin, Math.min(_spMax, raw)).toFixed(2));
    }

    /* ── Setpoint SVG template ─────────────────────────────────────── */

    function setpointSVG() {
        var trackPath = arcPath(START, SWEEP);
        var startPt   = pt(START);
        var endPt     = pt(START + SWEEP);
        return '<svg id="ng-sp-svg" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" ' +
               'style="width:100%;display:block;touch-action:none">' +
            '<defs>' +
              '<filter id="ng-sp-glow" x="-60%" y="-60%" width="220%" height="220%">' +
                '<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b"/>' +
                '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
              '</filter>' +
              '<filter id="ng-sp-sh" x="-60%" y="-60%" width="220%" height="220%">' +
                '<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,.45)"/>' +
              '</filter>' +
            '</defs>' +
            '<path class="ng-sp-track" d="' + trackPath + '" fill="none" stroke-width="10" stroke-linecap="round"/>' +
            '<path id="ng-sp-progress" d="" fill="none" stroke-width="10" stroke-linecap="round"/>' +
            '<circle id="ng-sp-thumb" r="11" fill="#fff" filter="url(#ng-sp-sh)" style="cursor:grab"/>' +
            '<circle cx="' + startPt.x + '" cy="' + startPt.y + '" r="5" class="ng-sp-cold-dot"/>' +
            '<circle cx="' + endPt.x + '"   cy="' + endPt.y   + '" r="5" class="ng-sp-hot-dot"/>' +
            '<text id="ng-sp-val-text" x="' + CX + '" y="' + (CY - 5)  + '" ' +
                  'text-anchor="middle" dominant-baseline="middle" class="ng-sp-val-big"></text>' +
            '<text id="ng-sp-unit-text" x="' + CX + '" y="' + (CY + 23) + '" ' +
                  'text-anchor="middle" class="ng-sp-unit">°</text>' +
        '</svg>';
    }

    /* ── Arc rendering ─────────────────────────────────────────────── */

    function updateArc(val) {
        var t        = valToT(val);
        var color    = tempColor(t);
        var sweepDeg = t * SWEEP;

        var progress = document.getElementById('ng-sp-progress');
        if (progress) {
            var d = sweepDeg >= 2 ? arcPath(START, sweepDeg) : '';
            progress.setAttribute('d', d);
            progress.setAttribute('stroke', color);
            if (sweepDeg > 15) {
                progress.setAttribute('filter', 'url(#ng-sp-glow)');
            } else {
                progress.removeAttribute('filter');
            }
        }

        var thumb = document.getElementById('ng-sp-thumb');
        if (thumb) {
            var p = pt(START + sweepDeg);
            thumb.setAttribute('cx', p.x);
            thumb.setAttribute('cy', p.y);
            thumb.setAttribute('fill', color);
        }

        var valText = document.getElementById('ng-sp-val-text');
        if (valText) {
            valText.textContent = (+val).toFixed(1);
            valText.setAttribute('fill', color);
        }

        var readout = document.getElementById('ng-sp-display');
        if (readout) {
            readout.textContent = (+val).toFixed(1);
            readout.style.color = color;
        }
    }

    function applyUnit(unit) {
        if (!unit) return;
        _spUnit = unit;
        var unitText = document.getElementById('ng-sp-unit-text');
        if (unitText) unitText.textContent = _spUnit;
        // Refresh readout to show new unit
        var inp = document.getElementById('popup_setpoint');
        if (inp) updateArc(parseFloat(inp.value) || 0);
    }

    // devIdx is passed directly from the hook so we don't rely on window.$.devIdx
    function syncArcFromInput(devIdx) {
        if (window.$) {
            _spMin  = parseFloat(window.$.setmin)  || -200;
            _spMax  = parseFloat(window.$.setmax)  ||  200;
            _spStep = parseFloat(window.$.setstep) || 0.5;
        }
        // Prefer the idx captured from ShowSetpointPopupInt args; fall back to $.devIdx
        var idx = devIdx || (window.$ && window.$.devIdx);
        if (idx) fetchDeviceUnit(idx);

        var input = document.getElementById('popup_setpoint');
        if (!input) return;
        updateArc(parseFloat(input.value) || 0);

        var actual  = document.getElementById('actual_value');
        var actDisp = document.getElementById('ng-sp-actual');
        if (actDisp && actual) {
            actDisp.textContent = actual.textContent || actual.innerHTML || '—';
        }
    }

    function fetchDeviceUnit(idx) {
        if (!idx) return;
        // Correct Domoticz API: type=command&param=getdevices&rid=<idx>
        fetch('/json.htm?type=command&param=getdevices&rid=' + encodeURIComponent(idx),
              { credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var item = data && data.result && data.result[0];
                if (!item) return;
                // Domoticz exposes the display unit in item.vunit for non-temperature
                // devices (e.g. "€"), or via the global tempsign for temperature devices.
                // Mirror what the Angular controller does:
                //   ctrl.getSetpointUnit = function () {
                //       return item.vunit || ('°' + $scope.tempsign);
                //   };
                var unit = item.vunit ||
                           ('°' + ((window.$ && window.$.myglobals && window.$.myglobals.tempsign) || 'C'));
                applyUnit(unit);
            })
            .catch(function () {});
    }

    /* ── Global step handler (called from onclick) ─────────────────── */

    window.ngSetpointChange = function (dir) {
        if (window.$) {
            _spStep = parseFloat(window.$.setstep) || 0.5;
            _spMin  = parseFloat(window.$.setmin)  !== undefined ? parseFloat(window.$.setmin)  : -200;
            _spMax  = parseFloat(window.$.setmax)  !== undefined ? parseFloat(window.$.setmax)  :  200;
        }
        var input = document.getElementById('popup_setpoint');
        if (!input) return;
        var val = tToVal(valToT(parseFloat(input.value) || 0) + dir * _spStep / (_spMax - _spMin || 1));
        // Use Domoticz's own step functions for clamping precision, fall back to direct edit
        var newVal = +(Math.max(_spMin, Math.min(_spMax,
                        Math.round(((parseFloat(input.value) || 0) + dir * _spStep) * 1000) / 1000
                     )).toFixed(2));
        input.value = newVal;
        if (window.$) $(input).val(newVal);
        updateArc(newVal);
    };

    /* ── Arc drag interaction ──────────────────────────────────────── */

    function attachArcDrag(svg) {
        if (!svg) return;
        var dragging = false;

        function angleFrom(e) {
            var rect = svg.getBoundingClientRect();
            var sx   = 220 / (rect.width  || 220);
            var sy   = 220 / (rect.height || 220);
            var cx   = e.touches ? e.touches[0].clientX : e.clientX;
            var cy   = e.touches ? e.touches[0].clientY : e.clientY;
            var deg  = Math.atan2((cy - rect.top) * sy - CY,
                                  (cx - rect.left) * sx - CX) * 180 / Math.PI;
            return deg < 0 ? deg + 360 : deg;
        }

        function applyAngle(e) {
            var rel = angleFrom(e) - START;
            if (rel < 0) rel += 360;
            if (rel > SWEEP + 60) rel = 0;
            if (rel > SWEEP) rel = SWEEP;
            var val = tToVal(rel / SWEEP);
            var inp = document.getElementById('popup_setpoint');
            if (inp) { inp.value = val; if (window.$) $(inp).val(val); }
            updateArc(val);
        }

        svg.addEventListener('mousedown',  function (e) { dragging = true;  applyAngle(e); });
        document.addEventListener('mousemove',  function (e) { if (dragging) applyAngle(e); });
        document.addEventListener('mouseup',    function ()  { dragging = false; });
        svg.addEventListener('touchstart', function (e) { dragging = true;  applyAngle(e); e.preventDefault(); }, { passive: false });
        document.addEventListener('touchmove',  function (e) { if (dragging) { applyAngle(e); e.preventDefault(); } }, { passive: false });
        document.addEventListener('touchend',   function ()  { dragging = false; });
    }

    /* ── Popup redesigns ───────────────────────────────────────────── */

    function redesignSetpointPopup() {
        var popup = document.getElementById('setpoint_popup');
        if (!popup || popup.dataset.ngDone) return;
        popup.dataset.ngDone = '1';

        popup.innerHTML =
            // Domoticz-required hidden elements
            '<input type="hidden" id="popup_setpoint">' +
            '<span id="actual_value" style="display:none" aria-hidden="true"></span>' +

            '<button class="ng-popup-close" onclick="CloseSetpointPopup(); ngCloseActivePopup();" aria-label="Close">' +
            '  <i class="fa-solid fa-xmark"></i></button>' +

            '<div class="ng-popup-title"><i class="fa-solid fa-thermometer-half"></i> Setpoint</div>' +

            '<div class="ng-sp-actual-row">' +
            '  <span class="ng-sp-actual-label">Current</span>' +
            '  <span id="ng-sp-actual" class="ng-sp-actual-val">—</span>' +
            '</div>' +

            '<div class="ng-sp-arc-wrap">' + setpointSVG() + '</div>' +

            '<div class="ng-sp-controls">' +
            '  <button class="ng-sp-btn" onclick="ngSetpointChange(-1)" aria-label="Decrease">' +
            '    <i class="fa-solid fa-minus"></i></button>' +
            '  <div id="ng-sp-display" class="ng-sp-readout">—</div>' +
            '  <button class="ng-sp-btn" onclick="ngSetpointChange(1)"  aria-label="Increase">' +
            '    <i class="fa-solid fa-plus"></i></button>' +
            '</div>' +

            '<button class="ng-sp-set-btn" onclick="SetSetpoint()">' +
            '  <i class="fa-solid fa-check"></i> Set</button>';

        attachArcDrag(document.getElementById('ng-sp-svg'));

        // Render a neutral default so the arc is never blank on first open
        setTimeout(function () { updateArc(20); }, 0);

        // Mirror actual_value updates to our display
        var actualEl = document.getElementById('actual_value');
        if (actualEl && window.MutationObserver) {
            new MutationObserver(function () {
                var d = document.getElementById('ng-sp-actual');
                if (d) d.textContent = actualEl.textContent || '—';
            }).observe(actualEl, { childList: true, characterData: true, subtree: true });
        }
    }

    function redesignIthoPopup() {
        var p = document.getElementById('itho_popup');
        if (!p || p.dataset.ngDone) return;
        p.dataset.ngDone = '1';
        p.innerHTML =
            '<button class="ng-popup-close" onclick="CloseIthoPopup(); ngCloseActivePopup();" aria-label="Close">' +
            '  <i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ng-popup-title"><i class="fa-solid fa-fan"></i> Ventilation</div>' +
            '<div class="ng-seg-group">' +
            '  <button class="ng-seg-btn" onclick="IthoSendCommand(\'1\')">' +
            '    <i class="fa-solid fa-wind"></i><span>Low</span></button>' +
            '  <button class="ng-seg-btn" onclick="IthoSendCommand(\'2\')">' +
            '    <i class="fa-solid fa-wind"></i><span>Med</span></button>' +
            '  <button class="ng-seg-btn" onclick="IthoSendCommand(\'3\')">' +
            '    <i class="fa-solid fa-wind"></i><span>High</span></button>' +
            '</div>' +
            '<button class="ng-seg-btn ng-seg-btn--full" onclick="IthoSendCommand(\'timer\')">' +
            '  <i class="fa-solid fa-clock"></i> Timer</button>';
    }

    function redesignLucciPopup() {
        var p = document.getElementById('lucci_popup');
        if (!p || p.dataset.ngDone) return;
        p.dataset.ngDone = '1';
        p.innerHTML =
            '<button class="ng-popup-close" onclick="CloseLucciPopup(); ngCloseActivePopup();" aria-label="Close">' +
            '  <i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ng-popup-title"><i class="fa-solid fa-fan"></i> Ceiling Fan</div>' +
            '<div class="ng-seg-group">' +
            '  <button class="ng-seg-btn" onclick="LucciSendCommand(\'lo\')">' +
            '    <i class="fa-solid fa-fan"></i><span>Low</span></button>' +
            '  <button class="ng-seg-btn" onclick="LucciSendCommand(\'med\')">' +
            '    <i class="fa-solid fa-fan"></i><span>Med</span></button>' +
            '  <button class="ng-seg-btn" onclick="LucciSendCommand(\'hi\')">' +
            '    <i class="fa-solid fa-fan"></i><span>High</span></button>' +
            '</div>' +
            '<div class="ng-popup-row-2">' +
            '  <button class="ng-action-btn ng-action-btn--danger" onclick="LucciSendCommand(\'off\')">' +
            '    <i class="fa-solid fa-power-off"></i> Off</button>' +
            '  <button class="ng-action-btn" onclick="LucciSendCommand(\'light\')">' +
            '    <i class="fa-solid fa-lightbulb"></i> Light</button>' +
            '</div>';
    }

    function redesignLucciDCPopup() {
        var p = document.getElementById('lucci_dc_popup');
        if (!p || p.dataset.ngDone) return;
        p.dataset.ngDone = '1';
        p.innerHTML =
            '<button class="ng-popup-close" onclick="CloseLucciPopup(); ngCloseActivePopup();" aria-label="Close">' +
            '  <i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ng-popup-title"><i class="fa-solid fa-fan"></i> DC Fan</div>' +
            '<div class="ng-popup-row-2" style="padding-top:10px">' +
            '  <button class="ng-sp-btn" onclick="LucciSendCommand(\'min\')" aria-label="Slower">' +
            '    <i class="fa-solid fa-minus"></i></button>' +
            '  <button class="ng-action-btn ng-action-btn--danger" onclick="LucciSendCommand(\'pow\')">' +
            '    <i class="fa-solid fa-power-off"></i></button>' +
            '  <button class="ng-sp-btn" onclick="LucciSendCommand(\'plus\')" aria-label="Faster">' +
            '    <i class="fa-solid fa-plus"></i></button>' +
            '</div>' +
            '<button class="ng-seg-btn ng-seg-btn--full" onclick="LucciSendCommand(\'light\')">' +
            '  <i class="fa-solid fa-lightbulb"></i> Light</button>';
    }

    function redesignFalmecPopup() {
        var p = document.getElementById('falmec_popup');
        if (!p || p.dataset.ngDone) return;
        p.dataset.ngDone = '1';
        p.innerHTML =
            '<button class="ng-popup-close" onclick="CloseFalmecPopup(); ngCloseActivePopup();" aria-label="Close">' +
            '  <i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ng-popup-title"><i class="fa-solid fa-wind"></i> Kitchen Fan</div>' +
            '<div class="ng-seg-group">' +
            '  <button class="ng-seg-btn" onclick="FalmecSendCommand(\'1\')"><span class="ng-seg-num">1</span></button>' +
            '  <button class="ng-seg-btn" onclick="FalmecSendCommand(\'2\')"><span class="ng-seg-num">2</span></button>' +
            '  <button class="ng-seg-btn" onclick="FalmecSendCommand(\'3\')"><span class="ng-seg-num">3</span></button>' +
            '  <button class="ng-seg-btn" onclick="FalmecSendCommand(\'4\')"><span class="ng-seg-num">4</span></button>' +
            '</div>' +
            '<div class="ng-popup-row-2">' +
            '  <button class="ng-action-btn ng-action-btn--danger" onclick="FalmecSendCommand(\'poff\')">' +
            '    <i class="fa-solid fa-power-off"></i> Off</button>' +
            '  <button class="ng-action-btn" onclick="FalmecSendCommand(\'lon\')">' +
            '    <i class="fa-solid fa-lightbulb"></i> On</button>' +
            '  <button class="ng-action-btn" onclick="FalmecSendCommand(\'loff\')">' +
            '    <i class="fa-solid fa-lightbulb" style="opacity:.4"></i> Off</button>' +
            '</div>';
    }

    function redesignThermostat3Popup() {
        var p = document.getElementById('thermostat3_popup');
        if (!p || p.dataset.ngDone) return;
        p.dataset.ngDone = '1';
        p.innerHTML =
            // Keep original <a> anchors hidden — Domoticz's ShowTherm3PopupInt
            // attaches jQuery click handlers to them, our buttons delegate here.
            '<a id="popup_therm_on"  style="display:none"></a>' +
            '<a id="popup_therm_off" style="display:none"></a>' +

            '<button class="ng-popup-close" onclick="CloseTherm3Popup(); ngCloseActivePopup();" aria-label="Close">' +
            '  <i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ng-popup-title"><i class="fa-solid fa-sliders"></i> Motor Control</div>' +

            '<div class="ng-motor-grid">' +
            '  <div class="ng-motor-col">' +
            '    <span class="ng-motor-label">Motor 1</span>' +
            '    <button class="ng-motor-btn" id="ng-therm3-on" aria-label="On">' +
            '      <i class="fa-solid fa-power-off"></i></button>' +
            '    <button class="ng-motor-btn" onclick="ThermUp()" aria-label="Up">' +
            '      <i class="fa-solid fa-chevron-up"></i></button>' +
            '    <button class="ng-motor-btn ng-motor-btn--stop" onclick="ThermStop()" aria-label="Stop">' +
            '      <i class="fa-solid fa-stop"></i></button>' +
            '    <button class="ng-motor-btn" onclick="ThermDown()" aria-label="Down">' +
            '      <i class="fa-solid fa-chevron-down"></i></button>' +
            '    <button class="ng-motor-btn ng-motor-btn--off" id="ng-therm3-off" aria-label="Off">' +
            '      <i class="fa-regular fa-circle-xmark"></i></button>' +
            '  </div>' +
            '  <div class="ng-motor-divider"></div>' +
            '  <div class="ng-motor-col">' +
            '    <span class="ng-motor-label">Motor 2</span>' +
            '    <button class="ng-motor-btn" onclick="ThermUp2()" aria-label="Up 2">' +
            '      <i class="fa-solid fa-chevron-up"></i></button>' +
            '    <button class="ng-motor-btn" onclick="ThermDown2()" aria-label="Down 2">' +
            '      <i class="fa-solid fa-chevron-down"></i></button>' +
            '  </div>' +
            '</div>';

        // Delegate our on/off buttons to the hidden Domoticz anchor elements
        document.getElementById('ng-therm3-on').addEventListener('click', function () {
            var a = document.getElementById('popup_therm_on');
            if (a) a.click();
        });
        document.getElementById('ng-therm3-off').addEventListener('click', function () {
            var a = document.getElementById('popup_therm_off');
            if (a) a.click();
        });
    }

    function redesignRGBWPopup() {
        var p = document.getElementById('rgbw_popup');
        if (!p) return;

        /* ── State ──────────────────────────────────────────────────── */
        var _idx     = null;
        var _subType = 'RGB';
        var _mode    = 'color';   // 'color' | 'white'
        var _isRGBW  = false;
        var _h = 0, _s = 1, _v = 1;
        var _bright  = 100;
        var _passcode = '';       // verified once per open, for protected lights
        var SEND_THROTTLE = 120;  // ms; every control applies as you move it
        var _warmth  = 0.5;       // 0 = cool white, 1 = warm white
        var WSIZE    = 200;       // canvas pixel size
        var WR       = WSIZE / 2; // wheel radius

        /* ── Colour math ─────────────────────────────────────────────── */
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
            var h, s=max===0?0:d/max, v=max;
            if (max===min) { h=0; }
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
            // w=0 → cool #E8F4FD, w=1 → warm #FFB347
            return {
                r: Math.round(232 + (255-232)*w),
                g: Math.round(244 + (179-244)*w),
                b: Math.round(253 + (71-253)*w)
            };
        }

        function toHex(n) { return ('0'+n.toString(16)).slice(-2); }

        /* ── Colour temperature ──────────────────────────────────────────
           The warmth axis is a bare 0…255 with no unit, so a white could
           be dragged to but never typed — the gap issue #258 reports for
           WW lights and the White tab. Kelvin is the unit lamps carry, so
           the field takes that; the endpoints are the ones sendRGBW()
           already documents for t (0 = cool 6500K, 255 = warm 2700K).
           Nominal, not per-lamp calibrated: Domoticz defines no such
           calibration, and what reaches the device is unchanged.       */
        var K_WARM = 2700;   // warmth = 1
        var K_COOL = 6500;   // warmth = 0

        /* Rounded to 10 K — one step of the 256-step axis is ~15 K, so
           finer digits would only show round-trip noise. */
        function kelvinFromWarmth(w) {
            return Math.round((K_COOL + (K_WARM - K_COOL) * w) / 10) * 10;
        }

        function warmthFromKelvin(k) {
            return Math.max(0, Math.min(1, (K_COOL - k) / (K_COOL - K_WARM)));
        }

        /* Accepts "3200", "3200K", "3200 k". Out-of-range and half-typed
           numbers return null so streaming input never snaps the lamp. */
        function parseKelvin(v) {
            var m = /^\s*(\d{3,5})\s*k?\s*$/i.exec(String(v == null ? '' : v));
            if (!m) return null;
            var k = parseInt(m[1], 10);
            return (k < K_WARM || k > K_COOL) ? null : k;
        }

        /* Bare number: the unit rides beside the field, not inside it. */
        function kelvinValue(w) { return String(kelvinFromWarmth(w)); }

        /* ── Canvas wheel rendering ──────────────────────────────────── */
        function drawWheel(canvas) {
            var ctx = canvas.getContext('2d');
            var img = ctx.createImageData(WSIZE, WSIZE);
            var d = img.data;
            for (var y=0; y<WSIZE; y++) {
                for (var x=0; x<WSIZE; x++) {
                    var dx=x-WR, dy=y-WR, dist=Math.sqrt(dx*dx+dy*dy);
                    var i4=(y*WSIZE+x)*4;
                    if (dist > WR) { d[i4+3]=0; continue; }
                    var h=((Math.atan2(dy,dx)/(2*Math.PI))+1)%1;
                    var s=dist/WR;
                    var rgb=hsvToRgb(h,s,1);
                    d[i4]=rgb.r; d[i4+1]=rgb.g; d[i4+2]=rgb.b; d[i4+3]=255;
                }
            }
            ctx.putImageData(img, 0, 0);
        }

        function drawWheelCursor(canvas) {
            var ctx = canvas.getContext('2d');
            var angle = _h * 2 * Math.PI;
            var rad   = _s * (WR - 6);
            var cx = WR + rad * Math.cos(angle);
            var cy = WR + rad * Math.sin(angle);
            var rgb = hsvToRgb(_h, _s, 1);
            ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 2*Math.PI);
            ctx.fillStyle = 'rgb('+rgb.r+','+rgb.g+','+rgb.b+')';
            ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, cy, 11, 0, 2*Math.PI);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
        }

        function renderWheel(canvas) {
            drawWheel(canvas);
            drawWheelCursor(canvas);
        }

        /* ── Preview + slider update ─────────────────────────────────── */
        function updatePreview() {
            var swatch = p.querySelector('.ng-rgbw-swatch');
            var hexEl  = p.querySelector('.ng-rgbw-hex');
            var unitEl = p.querySelector('.ng-rgbw-hex-unit');
            var rgb;
            /* The unit belongs beside the field, not inside it, so what is
               typed and what is read back are the same bare number. */
            if (unitEl) unitEl.style.display = _mode === 'white' ? '' : 'none';
            if (_mode === 'color') {
                rgb = hsvToRgb(_h, _s, 1);
                if (swatch) swatch.style.background =
                    'rgb('+rgb.r+','+rgb.g+','+rgb.b+')';
                if (hexEl) {
                    hexEl.readOnly = false;
                    hexEl.title = 'Type or paste a hex colour';
                    hexEl.placeholder = '#rrggbb';
                    /* Leave the field alone while it is being typed into —
                       rewriting it would jump the caret mid-edit. */
                    if (document.activeElement !== hexEl) hexEl.value = currentHex();
                }
            } else {
                rgb = warmthToRgb(_warmth);
                if (swatch) swatch.style.background =
                    'rgb('+rgb.r+','+rgb.g+','+rgb.b+')';
                /* White mode has no hex: the warmth bar is a colour
                   temperature, not an RGB value. It takes kelvin instead —
                   same job as the hex field, right unit. Every path that
                   reaches white mode has a warmth bar (WW/CW popups, and
                   the White tab, which only exists for hasWhite). */
                if (hexEl) {
                    hexEl.readOnly = false;
                    hexEl.title = 'Colour temperature in kelvin (' +
                                  K_WARM + '–' + K_COOL + ')';
                    hexEl.placeholder = String(K_WARM);
                    if (document.activeElement !== hexEl) hexEl.value = kelvinValue(_warmth);
                }
            }
        }

        function currentHex() {
            var rgb = hsvToRgb(_h, _s, 1);
            return '#' + toHex(rgb.r) + toHex(rgb.g) + toHex(rgb.b);
        }

        /* Local rather than borrowed from ngColors so the popup keeps working
           if that module ever fails to load. */
        function parseHex(v) {
            var hex = String(v == null ? '' : v).trim().replace(/^#/, '');
            if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
            if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
            var n = parseInt(hex, 16);
            return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
        }

        /* Load an RGB colour into the wheel without touching the hex field. */
        function applyRgb(rgb) {
            var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
            _h = hsv.h; _s = hsv.s;
            var wc = document.getElementById('ng-rgbw-canvas');
            if (wc) renderWheel(wc);
            updatePreview();
        }

        function setBrightness(pct, skipSlider, skipField) {
            _bright = Math.max(1, Math.min(100, Math.round(pct) || 1));
            var slider = document.getElementById('ng-rgbw-bright');
            var field  = document.getElementById('ng-rgbw-bright-num');
            if (slider && !skipSlider) slider.value = _bright;
            if (field && !skipField)   field.value  = _bright;
            /* Assigning .value raises no input event, so the track fill has
               to be told. Runs even when the slider was skipped: the value
               still moved, via the percentage field. */
            if (slider && window.ngFillRange) window.ngFillRange(slider);
        }

        /* ── Recently used colours ───────────────────────────────────── */
        /* Shared with the settings panel, the icon-override editor and the
           bar-range dialog, so a colour dialled in on one light is one click
           away on the next. The strip lives inside the colour pane: these are
           hues, and they mean nothing on the white-temperature side (which is
           also why WW/CW-only devices never get one). Picking loads the colour
           into the wheel; "Set Colour" still sends it, exactly as dragging the
           wheel does. */
        function mountRecentRow() {
            if (!window.ngColors) return;
            var slot = p.querySelector('.ng-rgbw-recent-slot');
            if (!slot) return;
            slot.appendChild(window.ngColors.buildRow({
                onPick: function (hex) {
                    var n = window.ngColors.normalize(hex);
                    if (!n) return;
                    var hsv = rgbToHsv(parseInt(n.slice(1, 3), 16),
                                       parseInt(n.slice(3, 5), 16),
                                       parseInt(n.slice(5, 7), 16));
                    _h = hsv.h; _s = hsv.s;
                    var wc = document.getElementById('ng-rgbw-canvas');
                    if (wc) renderWheel(wc);
                    updatePreview();
                    commitNow();      /* a swatch click is already a decision */
                }
            }));
        }

        /* ── Recently used whites ────────────────────────────────────── */
        /* The same idea one pane over, kept in its own list: a WW lamp set
           to 3200 K on one device is a click away on the next, which is the
           half of #258 that typing a kelvin only solved for people who
           remember the number. Picking one sends immediately, exactly as
           dragging the warmth bar to it does. */
        function mountRecentKelvinRow() {
            if (!window.ngKelvins) return;
            var slot = p.querySelector('.ng-rgbw-recent-k-slot');
            if (!slot) return;
            slot.appendChild(window.ngKelvins.buildRow({
                onPick: function (k) {
                    _warmth = warmthFromKelvin(k);
                    /* The strip is inside the white pane, which is only on
                       screen in white mode — but sendRGBW branches on _mode,
                       and a kelvin swatch must never go out as a hue. */
                    _mode = 'white';
                    var wc = document.getElementById('ng-rgbw-warmth-canvas');
                    if (wc) drawWarmthBar(wc);
                    updatePreview();
                    commitNow();      /* a swatch click is already a decision */
                }
            }));
        }

        /* ── Warmth bar snippet (reused in both WW-only and RGBW white tab) ── */
        function warmthPaneHTML(canvasId) {
            return '<div class="ng-rgbw-warmth-wrap">' +
                   '  <canvas id="' + canvasId + '" width="240" height="36"' +
                   '    style="display:block;border-radius:18px;touch-action:none;cursor:crosshair"></canvas>' +
                   '</div>' +
                   '<div class="ng-rgbw-warmth-labels">' +
                   '  <span><i class="fa-solid fa-snowflake"></i> Cool</span>' +
                   '  <span>Warm <i class="fa-solid fa-fire"></i></span>' +
                   '</div>' +
                   /* Recent whites belong to this pane for the same reason the
                      colour strip belongs to the wheel's: a kelvin means
                      nothing to the wheel, and a hue means nothing here. */
                   '<div class="ng-rgbw-recent-k-slot"></div>';
        }

        /* Brightness reads and writes two ways, matching what Domoticz's own
           picker gained: drag the slider, or type the percentage. */
        function brightnessRowHTML() {
            return '<div class="ng-rgbw-slider-row">' +
                   '  <i class="fa-solid fa-moon ng-rgbw-icon-dim"></i>' +
                   '  <input type="range" class="ng-rgbw-slider" id="ng-rgbw-bright" min="1" max="100" value="100">' +
                   '  <i class="fa-solid fa-sun ng-rgbw-icon-bright"></i>' +
                   '  <span class="ng-rgbw-bright-field">' +
                   /* size="3": an input with no size defaults to 20 characters,
                      which is enough to eat the row if this rule set is ever
                      outbid by the theme's generic input styling. */
                   '    <input type="text" inputmode="numeric" id="ng-rgbw-bright-num"' +
                   '           class="ng-rgbw-bright-input" size="3" maxlength="3" title="Brightness %">' +
                   '    <span class="ng-rgbw-bright-unit">%</span>' +
                   '  </span>' +
                   '</div>';
        }

        function presetsHTML(includeColourPresets) {
            return '<div class="ng-rgbw-presets">' +
                   '  <button class="ng-rgbw-preset" onclick="ngRgbwPreset(\'on\',this)">' +
                   '    <i class="fa-solid fa-power-off"></i> On</button>' +
                   (includeColourPresets ?
                   '  <button class="ng-rgbw-preset" onclick="ngRgbwPreset(\'full\',this)">' +
                   '    <i class="fa-solid fa-lightbulb"></i> Full</button>' +
                   '  <button class="ng-rgbw-preset" onclick="ngRgbwPreset(\'night\',this)">' +
                   '    <i class="fa-solid fa-moon"></i> Night</button>' : '') +
                   '  <button class="ng-rgbw-preset ng-rgbw-preset--off" onclick="ngRgbwPreset(\'off\',this)">' +
                   '    <i class="fa-regular fa-circle-xmark"></i> Off</button>' +
                   '</div>';
        }

        /* ── Build popup HTML ────────────────────────────────────────── */
        // subType: 'RGB' | 'RGBW' | 'RGBWW' | 'RGBWWZ' | 'WW' | 'CW' | '' (fallback=RGB)
        function buildUI(subType) {
            _subType = subType || 'RGB';
            var isWWOnly  = (_subType === 'WW' || _subType === 'CW');
            var hasWhite  = !isWWOnly && (_subType === 'RGBW' || _subType === 'RGBWW' || _subType === 'RGBWWZ');
            _isRGBW = hasWhite;

            // For WW-only devices start in white mode
            if (isWWOnly) _mode = 'white';

            /* ── WW / CW — white-temperature only popup ── */
            if (isWWOnly) {
                p.innerHTML =
                    '<button class="ng-popup-close" onclick="ngCloseActivePopup();" aria-label="Close">' +
                    '  <i class="fa-solid fa-xmark"></i></button>' +
                    '<div class="ng-popup-title"><i class="fa-solid fa-lightbulb"></i> White Light</div>' +
                    '<div class="ng-rgbw-pane">' + warmthPaneHTML('ng-rgbw-warmth-canvas') + '</div>' +
                    '<div class="ng-rgbw-preview">' +
                    '  <div class="ng-rgbw-swatch"></div>' +
                    '  <input type="text" class="ng-rgbw-hex" maxlength="7" spellcheck="false">' +
                    '  <span class="ng-rgbw-hex-unit">K</span>' +
                    '</div>' +
                    brightnessRowHTML() +
                    presetsHTML(false);

                var wt = document.getElementById('ng-rgbw-warmth-canvas');
                if (wt) { drawWarmthBar(wt); attachWarmthInteraction(wt); }
                mountRecentKelvinRow();

            /* ── RGB / RGBW / RGBWW — colour popup (with optional White tab) ── */
            } else {
                var colorModeActive = (_mode !== 'white');
                p.innerHTML =
                    '<button class="ng-popup-close" onclick="ngCloseActivePopup();" aria-label="Close">' +
                    '  <i class="fa-solid fa-xmark"></i></button>' +
                    '<div class="ng-popup-title"><i class="fa-solid fa-palette"></i> Colour</div>' +

                    // Mode tabs — only shown for devices that have white channels too
                    (hasWhite ?
                    '<div class="ng-rgbw-tabs">' +
                    '  <button class="ng-rgbw-tab' + (colorModeActive ? ' ng-rgbw-tab--active' : '') + '" data-mode="color" onclick="ngRgbwSetMode(\'color\')">' +
                    '    <i class="fa-solid fa-circle-half-stroke"></i> Colour</button>' +
                    '  <button class="ng-rgbw-tab' + (!colorModeActive ? ' ng-rgbw-tab--active' : '') + '" data-mode="white" onclick="ngRgbwSetMode(\'white\')">' +
                    '    <i class="fa-solid fa-sun"></i> White</button>' +
                    '</div>' : '') +

                    // Colour wheel pane — the recent strip belongs in here, not
                    // above both panes: offering a green swatch while the White
                    // tab is showing is a question with no sensible answer.
                    '<div class="ng-rgbw-pane" id="ng-rgbw-pane-color"' + (!colorModeActive ? ' style="display:none"' : '') + '>' +
                    '  <div class="ng-rgbw-wheel-wrap">' +
                    '    <canvas id="ng-rgbw-canvas" width="' + WSIZE + '" height="' + WSIZE + '"' +
                    '      style="border-radius:50%;touch-action:none;cursor:crosshair;display:block"></canvas>' +
                    '  </div>' +
                    '  <div class="ng-rgbw-recent-slot"></div>' +
                    '</div>' +

                    // White temperature pane (only for RGBW/RGBWW)
                    (hasWhite ?
                    '<div class="ng-rgbw-pane" id="ng-rgbw-pane-white"' + (colorModeActive ? ' style="display:none"' : '') + '>' +
                    warmthPaneHTML('ng-rgbw-warmth-canvas') +
                    '</div>' : '') +

                    '<div class="ng-rgbw-preview">' +
                    '  <div class="ng-rgbw-swatch"></div>' +
                    '  <input type="text" class="ng-rgbw-hex" placeholder="#rrggbb" maxlength="7" spellcheck="false">' +
                    '  <span class="ng-rgbw-hex-unit" style="display:none">K</span>' +
                    '</div>' +
                    /* No "Set Colour" button: every control applies as you use
                       it, the way Domoticz's own picker and the Switches-tab
                       device already behave (#237). */
                    brightnessRowHTML() +
                    presetsHTML(true);

                mountRecentRow();

                // Draw colour wheel
                var wc = document.getElementById('ng-rgbw-canvas');
                if (wc) { renderWheel(wc); attachWheelInteraction(wc); }

                // Draw warmth bar if applicable
                if (hasWhite) {
                    var wt2 = document.getElementById('ng-rgbw-warmth-canvas');
                    if (wt2) { drawWarmthBar(wt2); attachWarmthInteraction(wt2); }
                    mountRecentKelvinRow();
                }
            }

            // Bind brightness slider + the percentage field beside it
            var bright = document.getElementById('ng-rgbw-bright');
            if (bright) {
                /* input streams while dragging, change fires on release —
                   the throttle rides the first, the final value rides the
                   second so it always lands. */
                bright.addEventListener('input', function () {
                    setBrightness(parseInt(this.value, 10), true, false);
                    commit();
                });
                bright.addEventListener('change', function () { commitNow(); });
            }
            var brightNum = document.getElementById('ng-rgbw-bright-num');
            if (brightNum) {
                brightNum.addEventListener('input', function () {
                    /* Typing "10" on the way to "100" must not snap the slider
                       away, so an empty or half-typed field is left alone. */
                    if (this.value === '') return;
                    setBrightness(parseInt(this.value.replace(/\D/g, ''), 10), false, true);
                    commit();
                });
                /* Settle the field on the way out: clamp, strip junk, restore
                   a value if it was emptied. */
                brightNum.addEventListener('blur', function () {
                    setBrightness(_bright);
                    commitNow();
                });
                brightNum.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') this.blur();
                });
            }
            setBrightness(_bright);

            // Hex field — type or paste a colour instead of hunting the
            // wheel; in white mode the same field takes a kelvin value so
            // an exact white can be pinned too (#258).
            var hexEl = p.querySelector('.ng-rgbw-hex');
            if (hexEl) {
                hexEl.addEventListener('input', function () {
                    if (this.readOnly) return;
                    if (_mode === 'white') {
                        var k = parseKelvin(this.value);
                        if (k === null) return;
                        _warmth = warmthFromKelvin(k);
                        var wc = document.getElementById('ng-rgbw-warmth-canvas');
                        if (wc) drawWarmthBar(wc);
                        updatePreview(); commit();
                        return;
                    }
                    var rgb = parseHex(this.value);
                    if (rgb) { applyRgb(rgb); commit(); }
                });
                hexEl.addEventListener('blur', function () {
                    if (this.readOnly) return;
                    /* Re-read from state: a half-typed or out-of-range entry
                       never reached it, so this normalises and reverts. */
                    this.value = _mode === 'white' ? kelvinValue(_warmth) : currentHex();
                });
                hexEl.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') this.blur();
                });
            }

            updatePreview();
        }

        /* ── Warmth bar (for white mode) ─────────────────────────────── */
        function drawWarmthBar(canvas) {
            var ctx = canvas.getContext('2d');
            var g = ctx.createLinearGradient(0, 0, canvas.width, 0);
            g.addColorStop(0,   '#E8F4FD'); // cool 6500K
            g.addColorStop(0.5, '#FFF5E0'); // natural 4000K
            g.addColorStop(1,   '#FFB347'); // warm 2700K
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(0,0,canvas.width,canvas.height,16)
                          : ctx.rect(0,0,canvas.width,canvas.height);
            ctx.fill();
            drawWarmthCursor(canvas);
        }

        function drawWarmthCursor(canvas) {
            var ctx = canvas.getContext('2d');
            var x = _warmth * (canvas.width - 1);
            ctx.beginPath();
            ctx.arc(x, canvas.height/2, 12, 0, 2*Math.PI);
            var rgb = warmthToRgb(_warmth);
            ctx.fillStyle = 'rgb('+rgb.r+','+rgb.g+','+rgb.b+')';
            ctx.fill();
            ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();
        }

        function attachWarmthInteraction(canvas) {
            var dragging = false;
            function pick(e) {
                var rect = canvas.getBoundingClientRect();
                var cx = e.touches ? e.touches[0].clientX : e.clientX;
                _warmth = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
                drawWarmthBar(canvas);
                updatePreview();
                commit();
            }
            function release() { if (dragging) { dragging = false; commitNow(); } }
            canvas.addEventListener('mousedown', function(e) { dragging=true; pick(e); });
            document.addEventListener('mousemove', function(e) { if (dragging) pick(e); });
            document.addEventListener('mouseup', release);
            canvas.addEventListener('touchstart', function(e) { dragging=true; pick(e); e.preventDefault(); }, { passive:false });
            document.addEventListener('touchmove', function(e) { if (dragging) { pick(e); e.preventDefault(); } }, { passive:false });
            document.addEventListener('touchend', release);
        }

        /* ── Wheel interaction ───────────────────────────────────────── */
        function attachWheelInteraction(canvas) {
            var dragging = false;
            function pick(e) {
                var rect  = canvas.getBoundingClientRect();
                var scale = WSIZE / (rect.width || WSIZE);
                var cx = e.touches ? e.touches[0].clientX : e.clientX;
                var cy = e.touches ? e.touches[0].clientY : e.clientY;
                var dx = (cx - rect.left)  * scale - WR;
                var dy = (cy - rect.top)   * scale - WR;
                var dist = Math.sqrt(dx*dx + dy*dy);
                _h = ((Math.atan2(dy, dx) / (2*Math.PI)) + 1) % 1;
                _s = Math.min(dist / WR, 1);
                drawWheel(canvas);
                drawWheelCursor(canvas);
                updatePreview();
                commit();
            }
            function release() { if (dragging) { dragging = false; commitNow(); } }
            canvas.addEventListener('mousedown', function(e) { dragging=true; pick(e); });
            document.addEventListener('mousemove', function(e) { if (dragging) pick(e); });
            document.addEventListener('mouseup', release);
            canvas.addEventListener('touchstart', function(e) { dragging=true; pick(e); e.preventDefault(); }, { passive:false });
            document.addEventListener('touchmove', function(e) { if (dragging) { pick(e); e.preventDefault(); } }, { passive:false });
            document.addEventListener('touchend', release);
        }

        /* ── Global functions (bound via onclick) ────────────────────── */
        window.ngRgbwSetMode = function (mode) {
            _mode = mode;
            var tabs = p.querySelectorAll('.ng-rgbw-tab');
            for (var i=0; i<tabs.length; i++) {
                tabs[i].classList.toggle('ng-rgbw-tab--active', tabs[i].dataset.mode === mode);
            }
            var cp = document.getElementById('ng-rgbw-pane-color');
            var wp = document.getElementById('ng-rgbw-pane-white');
            if (cp) cp.style.display = mode === 'color' ? '' : 'none';
            if (wp) wp.style.display = mode === 'white' ? '' : 'none';
            updatePreview();
            /* Deliberately does not send. A tab is navigation — "show me the
               white controls" — not an instruction to make the light white.
               Sending here would also switch an off light on, since
               setcolbrightnessvalue turns one on, so merely looking at the
               other tab would change the light. The mode becomes real the
               moment an actual control is touched, which is how Domoticz's
               own mode icons behave too. */
        };

        function flashBtn(btn, label) {
            if (!btn) return;
            var orig = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> ' + (label || 'Applied!');
            btn.style.opacity = '0.7';
            setTimeout(function () {
                btn.innerHTML = orig;
                btn.style.opacity = '';
            }, 1200);
        }

        /* Protected devices demand a verified passcode; Domoticz's own popup
           collects it through HandleProtection before opening. This popup
           replaced that function wholesale and used to skip the prompt, so a
           protected light opened without asking and then silently refused
           every command. Captured on open, appended to every call. */
        function auth() {
            return _passcode ? '&passcode=' + encodeURIComponent(_passcode) : '';
        }

        function send(url) {
            fetch(url + auth()).catch(function () {});
        }

        function sendRGBW() {
            if (!_idx) return;
            var colorObj;
            var isWWOnly = (_subType === 'WW' || _subType === 'CW');
            if (!isWWOnly && _mode === 'color') {
                // m=3: ColorModeRGB — valid fields: r, g, b
                var rgb = hsvToRgb(_h, _s, 1);
                colorObj = { m:3, t:0, r:rgb.r, g:rgb.g, b:rgb.b, cw:0, ww:0 };
            } else {
                // m=2: ColorModeTemp — valid field: t (0=cool 6500K, 255=warm 2700K)
                var t = Math.round(_warmth * 255);
                colorObj = { m:2, t:t, r:0, g:0, b:0,
                             cw: Math.round((1 - _warmth) * 255),
                             ww: Math.round(_warmth * 255) };
            }
            /* Same call the Switches-tab device makes, so an off light comes on
               by itself rather than needing a separate switchlight. */
            send('/json.htm?type=command&param=setcolbrightnessvalue' +
                 '&idx=' + _idx +
                 '&color=' + encodeURIComponent(JSON.stringify(colorObj)) +
                 '&brightness=' + _bright);
        }

        /* Dragging the wheel or the brightness slider fires continuously, so
           the light follows the finger without a round trip per frame. */
        var _sendTimer = 0, _sendPending = false;

        function commit() {
            if (_sendTimer) { _sendPending = true; return; }
            sendRGBW();
            _sendTimer = setTimeout(function () {
                _sendTimer = 0;
                if (_sendPending) { _sendPending = false; commit(); }
            }, SEND_THROTTLE);
        }

        /* The released value must land whatever the throttle was doing. */
        function commitNow() {
            _sendPending = false;
            sendRGBW();
        }

        /* Recording happens here, not in sendRGBW: under instant apply a single
           drag sends dozens of times and would fill the recent strip with one
           gradient. The popup closing is the point the user has settled.

           Which pane was showing decides which list learns the value — the
           warmth bar produces a temperature, not a hue, so it feeds the
           kelvin strip and leaves the colours alone. */
        function rememberCurrent() {
            var isWWOnly = (_subType === 'WW' || _subType === 'CW');
            if (isWWOnly || _mode !== 'color') {
                /* Guarded on the bar existing: an RGB-only light that reports
                   a white colour mode has no temperature to settle on, and
                   the untouched 0.5 default is not a white anyone picked. */
                if (window.ngKelvins && document.getElementById('ng-rgbw-warmth-canvas')) {
                    window.ngKelvins.remember(kelvinFromWarmth(_warmth));
                }
                return;
            }
            if (window.ngColors) window.ngColors.remember(currentHex());
        }

        window.ngRgbwPreset = function (preset, btn) {
            if (preset === 'on') {
                /* Deliberately does not close. Off has nothing left to adjust,
                   but someone who opened the picker and pressed On is usually
                   about to pick a colour — closing would cost them a reopen. */
                if (_idx) send('/json.htm?type=command&param=switchlight&idx=' + _idx + '&switchcmd=On');
                flashBtn(btn, 'On');
            } else if (preset === 'off') {
                if (_idx) send('/json.htm?type=command&param=switchlight&idx=' + _idx + '&switchcmd=Off');
                ngCloseActivePopup();
            } else if (preset === 'full') {
                // Full brightness — white/neutral for WW, near-white for RGB
                var isWW = (_subType === 'WW' || _subType === 'CW');
                if (isWW || _isRGBW) {
                    _mode = 'white'; _warmth = 0.5;
                    if (_isRGBW) window.ngRgbwSetMode('white');
                    var wtc = document.getElementById('ng-rgbw-warmth-canvas');
                    if (wtc) { drawWarmthBar(wtc); }
                } else {
                    _h = 0.15; _s = 0.05;
                    var wc2 = document.getElementById('ng-rgbw-canvas');
                    if (wc2) renderWheel(wc2);
                }
                setBrightness(100);
                updatePreview();
                commitNow();
                flashBtn(btn, 'Applied');
            } else if (preset === 'night') {
                // Warm amber dim
                _mode = 'color'; _h = 0.08; _s = 0.85;
                var wc3 = document.getElementById('ng-rgbw-canvas');
                if (wc3) renderWheel(wc3);
                setBrightness(15);
                if (_isRGBW) window.ngRgbwSetMode('color');
                updatePreview();
                commitNow();
                flashBtn(btn, 'Applied');
            }
        };

        /* ── Hook ShowRGBWPopup ──────────────────────────────────────── */
        // Actual Domoticz signature (domoticz.js):
        //   ShowRGBWPopup(event, idx, Protected, MaxDimLevel, LevelInt, color, SubType, DimmerType)
        // The first arg is the mouse/touch event — idx is the second arg.
        function hookShowRGBWPopup() {
            if (!window.ShowRGBWPopup) { setTimeout(hookShowRGBWPopup, 300); return; }
            if (window.ShowRGBWPopup._ngHooked) return;
            window.ShowRGBWPopup = function (event, idx, Protected, MaxDimLevel, LevelInt, color, SubType, DimmerType) {
                /* This replaces Domoticz's ShowRGBWPopup rather than wrapping
                   it, which meant its HandleProtection prompt never ran: a
                   protected light opened without asking and then silently
                   refused every command server-side. Ask first, and keep the
                   verified passcode for the commands this popup sends. */
                if (typeof window.HandleProtection === 'function') {
                    window.HandleProtection(Protected, function (passcode) {
                        _passcode = passcode || '';
                        openWith(idx, LevelInt, color, SubType);
                    });
                    return;
                }
                _passcode = '';
                openWith(idx, LevelInt, color, SubType);
            };

            function openWith(idx, LevelInt, color, SubType) {
                _idx = String(idx || '');

                // color is a JSON string from device.Color
                var col = {};
                try {
                    col = typeof color === 'string' ? JSON.parse(color) : (color || {});
                } catch (e) {}

                // ColorMode: 1=white, 2=colour-temperature, 3=RGB, 4=custom(RGB+white)
                _mode = (col.m === 1 || col.m === 2) ? 'white' : 'color';

                // Seed HSV from RGB channels
                if (col.r !== undefined || col.g !== undefined || col.b !== undefined) {
                    var hsv = rgbToHsv(col.r || 0, col.g || 0, col.b || 0);
                    _h = hsv.h; _s = hsv.s; _v = hsv.v;
                    if (_s < 0.05) _s = 0;
                }

                // Warmth from colour-temperature field (0-255 → 0-1)
                _warmth = col.t !== undefined ? col.t / 255 : 0.5;

                // Seed brightness from current device level (LevelInt is 0-100)
                _bright = (LevelInt !== undefined && LevelInt !== null)
                    ? Math.max(1, Math.min(100, parseInt(LevelInt, 10) || 100))
                    : 100;

                // Show popup — MutationObserver in initPopups picks this up and calls ngOpenPopup
                p.style.display = 'block';

                // Pass SubType directly so buildUI can choose the right layout
                buildUI(SubType || 'RGB');
            }

            window.ShowRGBWPopup._ngHooked = true;
        }

        /* One place to settle: whatever the popup was showing when it closed is
           the colour the user chose, however they got there. */
        onPopupClose('rgbw_popup', rememberCurrent);

        hookShowRGBWPopup();
    }

    function redesignRFYPopup() {
        var p = document.getElementById('rfy_popup');
        if (!p || p.dataset.ngDone) return;
        p.dataset.ngDone = '1';
        p.innerHTML =
            '<button class="ng-popup-close" onclick="CloseRFYPopup(); ngCloseActivePopup();" aria-label="Close">' +
            '  <i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ng-popup-title"><i class="fa-solid fa-sun"></i> Sun/Wind Detector</div>' +
            '<button class="ng-rfy-btn ng-rfy-btn--enable" onclick="RFYEnableSunWind(1)">' +
            '  <i class="fa-solid fa-toggle-on"></i> Enable</button>' +
            '<button class="ng-rfy-btn ng-rfy-btn--disable" onclick="RFYEnableSunWind(0)">' +
            '  <i class="fa-solid fa-toggle-off"></i> Disable</button>';
    }

    /* ── Hook ShowSetpointPopupInt to sync arc after Domoticz populates values ── */

    function hookSetpointShow() {
        if (!window.ShowSetpointPopupInt) { setTimeout(hookSetpointShow, 300); return; }
        if (window.ShowSetpointPopupInt._ngHooked) return;
        var orig = window.ShowSetpointPopupInt;
        // ShowSetpointPopupInt(mouseX, mouseY, idx, currentvalue, ismobile, step, min, max)
        // Capture idx (arg[2]) directly so we don't depend on window.$.devIdx being readable.
        window.ShowSetpointPopupInt = function (mouseX, mouseY, idx) {
            orig.apply(this, arguments);
            var capturedIdx = idx;
            setTimeout(function () { syncArcFromInput(capturedIdx); }, 0);
        };
        window.ShowSetpointPopupInt._ngHooked = true;
    }

    /* ── Init ──────────────────────────────────────────────────────── */

    function initPopups() {
        redesignSetpointPopup();
        redesignIthoPopup();
        redesignLucciPopup();
        redesignLucciDCPopup();
        redesignFalmecPopup();
        redesignThermostat3Popup();
        redesignRFYPopup();
        redesignRGBWPopup();
        hookSetpointShow();

        // Watch each popup for Domoticz's native show/hide (jQuery Mobile)
        // so the overlay opens/closes automatically without needing to hook every show function
        var POPUP_IDS = ['setpoint_popup', 'thermostat3_popup', 'itho_popup',
                         'lucci_popup', 'lucci_dc_popup', 'falmec_popup', 'rfy_popup',
                         'rgbw_popup'];
        if (window.MutationObserver) {
            POPUP_IDS.forEach(function (id) {
                var el = document.getElementById(id);
                if (!el) return;
                new MutationObserver(function () {
                    var visible = el.style.display === 'block' ||
                        (el.style.display === '' &&
                         window.getComputedStyle(el).display !== 'none');
                    if (visible && _activePopupId !== id) {
                        ngOpenPopup(id);
                    } else if (!visible && _activePopupId === id) {
                        ngClosePopup(id);
                    }
                }).observe(el, { attributes: true, attributeFilter: ['style'] });
            });
        }
    }

    // Public API — callable from demo pages and Domoticz hooks without knowledge of internals
    window.ngShowSetpointArc = function (val, min, max, step, actualVal, unit) {
        if (min  !== undefined) _spMin  = +min;
        if (max  !== undefined) _spMax  = +max;
        if (step !== undefined) _spStep = +step || 0.5;
        if (unit !== undefined) applyUnit(unit);
        var inp = document.getElementById('popup_setpoint');
        var act = document.getElementById('actual_value');
        var actDisp = document.getElementById('ng-sp-actual');
        if (inp) inp.value = val;
        if (act) act.textContent = (actualVal !== undefined ? actualVal : val);
        if (actDisp) actDisp.textContent = (actualVal !== undefined ? actualVal : val);
        updateArc(+val);
        var disp = document.getElementById('ng-sp-display');
        if (disp) { disp.textContent = (+val).toFixed(1); disp.style.color = tempColor(valToT(+val)); }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPopups);
    } else {
        initPopups();
    }
})();
