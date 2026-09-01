/* ══════════════════════════════════════════════════════════════════
   NIGHTGLASS CARD LAYOUT  —  companion to src/css/cards-nightglass.css

   The new card style is CSS grid over Domoticz's own widget table
   (display:contents flattens table/tbody/tr so every <td> becomes a
   grid child).  Grid alone cannot answer three questions, so this
   module answers them by putting classes on the card root:

     .ng-rail-2 / .ng-rail-3   how many icon cells share the rail
                               (blinds up/stop/down, group on/off,
                               media player + remote)
     .ng-card--ctrl-status     td#status holds selector controls, so it
                               belongs in the control row, not the
                               meta line
     .ng-card--stacked         the reading is too long to sit beside
                               the name and wants its own row

   It also publishes the device's on-colour as --ngc-state-rgb and its
   on/off state as data-ng-state, so the rail can light up in the
   device's own colour, and hides status text that merely restates the
   value.

   NOTHING HERE MOVES A NODE.  Everything is an attribute, a class or a
   custom property on elements Angular does not own, so every binding
   and every other Nightglass module keeps working unchanged.

   Entirely inert unless <body> carries .ng-cards-ng, which the
   "Card Style" setting toggles.
   ══════════════════════════════════════════════════════════════════ */

(function () {
    'use strict';

    /* Both card roots Domoticz produces: dashboard / utility / scene
       widgets put .item.itemBlock on one div; temperature and weather
       widgets put .itemBlock on the custom element and .item inside. */
    var CARD_SEL = 'div.item.itemBlock, .itemBlock > div.item';

    var BODY_CLASS = 'ng-cards-ng';

    function active() {
        return document.body &&
               document.body.classList.contains(BODY_CLASS);
    }

    function text(el) {
        return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '';
    }


    /* ── Rail: how many icon cells does this card have? ───────────── */

    /* Every widget template across the Domoticz sources produces one of
       four shapes, and three is the ceiling — dzLightWidget.getTableId()
       emits nothing past *trippleicon:

         0  td#img carrying Angular's .ng-hide  (General/Text with the
            device's "Show icon" switched off — utility_widget.html:20)
         1  td#img            all switches, sensors, temperature, weather,
                              setpoints, evohome, security
            td#img1           a scene
         2  td#img  + #img2   blinds open/close, media player + remote
            td#img1 + #img2   a group's on and off buttons
         3  td#img + #img2 + #img3   blinds with a stop button

       :not(.ng-hide) rather than a visibility measurement — it is the
       exact class Angular toggles, and it costs no layout. */
    var RAIL_SEL = 'td#img:not(.ng-hide), td#img1:not(.ng-hide), ' +
                   'td#img2:not(.ng-hide), td#img3:not(.ng-hide)';

    function applyRail(card) {
        var n = card.querySelectorAll(RAIL_SEL).length;

        /* Cached: the count only changes when Angular adds or removes an
           ng-if'd icon cell, which is rare, and touching classList on
           every burst would dirty the style tree for nothing. */
        if (card.getAttribute('data-ng-rail') === String(n)) return;
        card.setAttribute('data-ng-rail', String(n));

        card.classList.toggle('ng-rail-0', n === 0);
        card.classList.toggle('ng-rail-2', n === 2);
        card.classList.toggle('ng-rail-3', n >= 3);
    }


    /* ── Does td#status hold controls rather than a status line? ──── */

    function applyCtrlStatus(card) {
        var status = card.querySelector('td#status');
        var isCtrl = !!(status && status.querySelector(
            '.btn-group, .selectorlevels, .dz-text-msg'
        ));
        card.classList.toggle('ng-card--ctrl-status', isCtrl);
        return isCtrl;
    }


    /* ── Status text that merely restates the value ───────────────────
       A dimmer renders "78 %" in td#bigtext and "Set Level: 78%" in
       td#status — a whole line of card height spent saying it twice.
       Hide the status only when it ENDS with the value and adds no more
       than a short label in front, so genuinely extra information
       ("0 Watt, Today: 1.234 kWh") is never lost.
       ─────────────────────────────────────────────────────────────── */

    var DUPE_LABEL_MAX = 14;

    function norm(s) {
        return s.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function applyStatusDupe(card, isCtrl) {
        var status = card.querySelector('td#status');
        if (!status) return;

        if (isCtrl) {
            status.classList.remove('ng-status-dupe');
            return;
        }

        var b = norm(text(card.querySelector('td#bigtext')));
        var s = norm(text(status));
        var dupe = !!b && !!s &&
                   s.slice(-b.length) === b &&
                   (s.length - b.length) <= DUPE_LABEL_MAX;

        status.classList.toggle('ng-status-dupe', dupe);
    }


    /* ── Long readings get their own row ──────────────────────────────
       Decided by measurement, but a measurement that does not depend on
       the class it sets. The first version promoted one-way and cached
       the verdict, because once stacked nothing is clipped any more and
       re-measuring flipped it straight back — but a stale cache meant a
       card measured mid-layout stayed stacked forever, and far too many
       of them did.

       Instead: both cells are nowrap in both states, so scrollWidth is
       always the INTRINSIC text width. Compare the pair against the room
       on row 1 and the answer is the same whichever state we are in, so
       it can be recomputed every pass with no memory at all.
       ─────────────────────────────────────────────────────────────── */

    /* Actions sit in the corner over row 1 (see NG-j) and the row has to
       clear them; keep in step with the padding-right in the stylesheet. */
    var ACTIONS_W = 48;
    var PAIR_GAP = 10;
    /* Only unstack once there is real room again, so a card sitting on
       the threshold cannot oscillate between passes. */
    var HYSTERESIS = 8;

    /* Truncating a device name is worse than spending a row, so stack a
       little before the pair actually collides. */
    var STACK_BIAS = 6;

    /* scrollWidth is NOT the text's own width: on a nowrap element it is
       max(clientWidth, intrinsic), so as soon as the container is wider
       than the text it reports the container. Reading it to decide a
       layout that changes the container is therefore self-reinforcing —
       it latched every card into the stacked state.

       A Range over the contents measures the text and nothing else, in
       either state, which is what the comparison needs. */
    var _range = document.createRange();

    function textWidth(el) {
        try {
            _range.selectNodeContents(el);
            return _range.getBoundingClientRect().width;
        } catch (e) {
            return el.scrollWidth;
        }
    }

    function applyStacked(card, padRight) {
        var bt = card.querySelector('td#bigtext');
        var nm = card.querySelector('td#name');
        if (!bt || !nm) return;

        var t = text(bt);

        /* A compound reading ("21.4 C / 63% / 1013 hPa") always takes its
           own row — that is the shape it wants, not a fallback. */
        var want = t.indexOf('/') >= 0;

        if (!want) {
            var stacked = card.classList.contains('ng-card--stacked');
            /* offsetLeft is measured from the card, which is the offset
               parent, so this is the room row 1 has after the icons. */
            /* clientWidth spans the padding box, so the right padding is
               still inside it and has to come off. */
            var avail = card.clientWidth - nm.offsetLeft - padRight -
                        (card.classList.contains('ng-has-opts') ? ACTIONS_W : 0);
            /* td#bigtext and .dz-card-footer sit in the SAME grid column,
               so that column is as wide as the wider of them — often the
               footer, once a colour light adds its power button next to
               the timestamp. Measuring only the reading under-counted it
               and left long names clipped. */
            var foot = card.querySelector('.dz-card-footer');
            var rightCol = Math.max(textWidth(bt),
                                    foot ? foot.offsetWidth : 0);
            var need = textWidth(nm) + rightCol + PAIR_GAP + STACK_BIAS;
            want = stacked ? (need > avail - HYSTERESIS) : (need > avail);
        }

        card.classList.toggle('ng-card--stacked', want);
    }


    /* ── Rail state + the device's own on-colour ──────────────────────
       icons.js writes data-dz-state and an inline colour on the icon it
       replaces; Domoticz's own glyphs carry .dz-icon--on / --off.  Read
       whichever is present rather than parsing localised status text.
       ─────────────────────────────────────────────────────────────── */

    function iconState(icon) {
        var attr = icon.getAttribute('data-dz-state');
        if (attr === 'on' || attr === 'off') return attr;
        if (icon.classList.contains('dz-icon--on')) return 'on';
        if (icon.classList.contains('dz-icon--off')) return 'off';
        return null;
    }

    /* Inline style only — a getComputedStyle() per card per burst is the
       kind of cost that shows up on a Pi with fifty cards on screen. */
    function rgbTriple(colour) {
        if (!colour) return null;

        var hex = colour.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (hex) {
            var h = hex[1];
            if (h.length === 3) {
                h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
            }
            return parseInt(h.slice(0, 2), 16) + ', ' +
                   parseInt(h.slice(2, 4), 16) + ', ' +
                   parseInt(h.slice(4, 6), 16);
        }

        var rgb = colour.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (rgb) return rgb[1] + ', ' + rgb[2] + ', ' + rgb[3];

        return null;
    }

    function applyState(card) {
        var rail = card.querySelector('td#img, td#img1');
        var icon = rail && rail.querySelector('i, img');
        if (!icon) return;

        var state = iconState(icon);
        if (state) {
            if (card.getAttribute('data-ng-state') !== state) {
                card.setAttribute('data-ng-state', state);
            }
        } else if (card.hasAttribute('data-ng-state')) {
            card.removeAttribute('data-ng-state');
        }

        /* Off-state uses the theme accent, not the device's grey — a
           rail tinted with the muted off-colour reads as broken. */
        var triple = state === 'on'
            ? rgbTriple(icon.style && icon.style.color)
            : null;

        if (card.getAttribute('data-ng-rgb') === (triple || '')) return;
        card.setAttribute('data-ng-rgb', triple || '');

        if (triple) {
            card.style.setProperty('--ngc-state-rgb', triple);
        } else {
            card.style.removeProperty('--ngc-state-rgb');
            var btn = card.querySelector('.ng-opts-toggle');
            if (btn) btn.remove();
        }
    }


    /* ── Options overflow menu ────────────────────────────────────────
       On the tab pages td.options carries the favourite star and the
       Log / Edit / Timers / Notifications chips. On a card-width column
       those four chips wrap to two lines, which is the most expensive
       row on the card. Fold them into a popover behind a "…" button in
       the meta line and the row costs nothing until it is opened.

       The cell is not moved — CSS repositions it and this only adds the
       trigger, so Angular's ng-if anchors inside it stay where they are.
       ─────────────────────────────────────────────────────────────── */

    function applyOptions(card) {
        var opts = card.querySelector('td.options');
        if (!opts || !opts.children.length) {
            card.classList.remove('ng-has-opts', 'ng-opts-open');
            return;
        }
        card.classList.add('ng-has-opts');

        var btn = opts.querySelector(':scope > .ng-opts-toggle');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ng-opts-toggle';
            btn.title = 'More';
            btn.setAttribute('aria-haspopup', 'true');
            btn.innerHTML = '<i class="fa-solid fa-ellipsis"></i>';
            btn.addEventListener('click', function (e) {
                /* The card and its icon carry click handlers of their
                   own; opening a menu must not also drive the device. */
                e.preventDefault();
                e.stopPropagation();
                var open = !card.classList.contains('ng-opts-open');
                closeAllMenus();          /* one menu at a time */
                card.classList.toggle('ng-opts-open', open);
                btn.setAttribute('aria-expanded', open ? 'true' : 'false');

            });
            /* Into the cell, not the card: the star and the trigger then
               form one grid item pinned to the corner together, and
               neither can drift over the other. Appending at the end is
               safe — Angular's ng-if children insert before their own
               comment anchors, which are all above this. */
            opts.appendChild(btn);
        }
    }

    function closeAllMenus() {
        var open = document.querySelectorAll('.ng-opts-open');
        for (var i = 0; i < open.length; i++) {
            open[i].classList.remove('ng-opts-open');
            var b = open[i].querySelector('.ng-opts-toggle');
            if (b) b.setAttribute('aria-expanded', 'false');
        }
    }

    /* Everything closes the menu except the trigger, whose own handler
       decides — including a click on one of the menu's links, which
       navigates away and would otherwise leave it hanging open.

       Capture phase, so this runs before the trigger's own listener;
       hence the exemption rather than a plain close-everything. */
    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('.ng-opts-toggle')) return;
        closeAllMenus();
    }, true);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeAllMenus();
    });


    /* ── Pass over every card ─────────────────────────────────────── */

    function processCards() {
        if (!active()) return;

        var cards = document.querySelectorAll(CARD_SEL);
        if (!cards.length) return;

        /* Padding comes from the density tokens, so it is the same on
           every card — read it once rather than per card per burst. */
        var padRight = parseFloat(getComputedStyle(cards[0]).paddingRight) || 0;

        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];

            /* Skip anything that is not a real device card. */
            if (!card.querySelector('table[id^="itemtable"]')) continue;

            applyRail(card);
            /* Before applyStacked: it adds .ng-has-opts, which reserves
               the corner and so changes the room row 1 has. */
            applyOptions(card);
            applyStacked(card, padRight);
            applyState(card);
            applyStatusDupe(card, applyCtrlStatus(card));
        }
    }


    /* ── Undo everything when the style is switched back to Classic ── */

    var ADDED_CLASSES = [
        'ng-rail-0', 'ng-rail-2', 'ng-rail-3',
        'ng-card--stacked', 'ng-card--ctrl-status',
        'ng-has-opts', 'ng-opts-open'
    ];
    var ADDED_ATTRS = [
        'data-ng-rail', 'data-ng-state', 'data-ng-rgb'
    ];

    function cleanUp() {
        var cards = document.querySelectorAll(CARD_SEL);
        for (var i = 0; i < cards.length; i++) {
            var card = cards[i];
            card.classList.remove.apply(card.classList, ADDED_CLASSES);
            for (var a = 0; a < ADDED_ATTRS.length; a++) {
                card.removeAttribute(ADDED_ATTRS[a]);
            }
            card.style.removeProperty('--ngc-state-rgb');
        }
        document.querySelectorAll('td#status.ng-status-dupe')
            .forEach(function (td) { td.classList.remove('ng-status-dupe'); });

    }


    /* ── Wiring ───────────────────────────────────────────────────────
       Same pattern as the other card modules: join the icon-replacement
       burst so all DOM writes land in one batch, plus a debounced
       observer for the renders that happen outside a burst.
       ─────────────────────────────────────────────────────────────── */

    window._dzExtraProcessors = window._dzExtraProcessors || [];
    window._dzExtraProcessors.push(processCards);

    var _timer = null;
    var observer = new MutationObserver(function () {
        clearTimeout(_timer);
        _timer = setTimeout(processCards, 200);
    });

    /* Row 1 gets wider or narrower with the window, so the stacking
       decision has to be retaken; it is stateless, so a plain re-run
       is enough. */
    var _resize = null;
    window.addEventListener('resize', function () {
        clearTimeout(_resize);
        _resize = setTimeout(processCards, 250);
    });

    /* The setting writes body.ng-cards-ng; react to it turning on so the
       switch is live, and to it turning off so Classic is left clean. */
    var wasActive = false;
    var bodyObserver = new MutationObserver(function () {
        var now = active();
        if (now === wasActive) return;
        wasActive = now;
        if (now) {
            processCards();
        } else {
            cleanUp();
        }
    });

    function start() {
        var target = document.getElementById('dashcontent') ||
                     document.getElementById('main-content') ||
                     document.body;
        if (target) {
            observer.observe(target, { childList: true, subtree: true });
        }
        bodyObserver.observe(document.body, {
            attributes: true, attributeFilter: ['class']
        });
        wasActive = active();
        processCards();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
