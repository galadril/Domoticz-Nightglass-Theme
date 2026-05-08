
/*
 /*
 *  Domoticz Dark Theme - custom.js
 *  A clean, modern dark dashboard theme for Domoticz
 *
 *  This file runs after the theme CSS is loaded.
 *  jQuery ($), Highcharts and all Domoticz globals are available.
 */

/* -- Highcharts palette (callable on mode change) ------------------ */
(function() {
    'use strict';
    var ACE_THEME_KEY = 'dz-ace-theme';
    var DEFAULT_ACE_THEME = 'string:ace/theme/tomorrow_night';
    var aceListenerAttached = false;

    // Apply the saved (or default) Ace editor theme on the events page.
    // Respects any theme the user has explicitly chosen via the dropdown.
    function setAceTheme() {
        // Only run on the events page (URL contains /events or #/events)
        if (!/\bevents\b/i.test(window.location.href)) return;
        var applyTheme = localStorage.getItem(ACE_THEME_KEY) || DEFAULT_ACE_THEME;
        // Wait for Angular to render the select
        var trySet = function() {
            var sel = document.querySelector('select[ng-model="$ctrl.aceSettings.theme"]');
            if (sel) {
                if (sel.value !== applyTheme) {
                    sel.value = applyTheme;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
                // Save future user-initiated changes so they persist across navigation
                if (!aceListenerAttached) {
                    aceListenerAttached = true;
                    sel.addEventListener('change', function() {
                        localStorage.setItem(ACE_THEME_KEY, this.value);
                    });
                }
            } else {
                setTimeout(trySet, 200);
            }
        };
        trySet();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setAceTheme);
    } else {
        setAceTheme();
    }
    // Also hook into Angular route changes (SPA navigation)
    window.addEventListener('hashchange', function() {
        aceListenerAttached = false; /* select is re-rendered on route change */
        setAceTheme();
    });
})();

function applyHighchartsTheme(isDark) {
    if (typeof Highcharts === 'undefined') return;
    var c = isDark ? {
        text:     '#e2e4ed',
        textSoft: '#b0b3c6',
        textMuted:'#7c7f93',
        surface:  '#23252f',
        surface2: '#2a2b35',
        surface3: '#33354a',
        border:   '#2e3040',
        borderB:  '#3a3b47',
        accent:   '#4e9af1',
        accentRgb:'78, 154, 241',
        tooltip:  'rgba(35, 37, 47, 0.95)',
        series:   ['#4e9af1','#4caf7d','#f0a832','#e05555','#c8a0ff','#ff7043','#29b6f6','#66bb6a','#ab47bc','#78909c']
    } : {
        text:     '#1a1c24',
        textSoft: '#4a4d5e',
        textMuted:'#6b6e7f',
        surface:  '#ffffff',
        surface2: '#f5f6fa',
        surface3: '#e8eaed',
        border:   '#d0d3dc',
        borderB:  '#c4c7d0',
        accent:   '#2a7de1',
        accentRgb:'42, 125, 225',
        tooltip:  'rgba(255, 255, 255, 0.97)',
        series:   ['#2a7de1','#2e8c58','#c07818','#d63b3b','#9c5fe0','#e05535','#0288d1','#4caf50','#8e24aa','#546e7a']
    };
    Highcharts.setOptions({
        colors: c.series,
        chart: {
            backgroundColor: 'transparent',
            plotBackgroundColor: 'transparent',
            plotBorderColor: c.border,
            style: {
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                color: c.text
            }
        },
        title:    { margin: 20, style: { color: c.text } },
        subtitle: { style: { color: c.textMuted } },
        xAxis: {
            gridLineColor: c.border,
            lineColor: c.borderB,
            tickColor: c.borderB,
            labels: { style: { color: c.textMuted } },
            title:  { style: { color: c.textSoft } }
        },
        yAxis: {
            gridLineColor: c.border,
            lineColor: c.borderB,
            tickColor: c.borderB,
            labels: { style: { color: c.textMuted } },
            title:  { style: { color: c.textSoft } }
        },
        legend: {
            backgroundColor: 'transparent',
            itemStyle:       { color: c.textSoft },
            itemHoverStyle:  { color: c.text },
            itemHiddenStyle: { color: c.borderB }
        },
        tooltip: {
            backgroundColor: c.tooltip,
            borderColor: c.borderB,
            style: { color: c.text }
        },
        plotOptions: {
            series: {
                dataLabels: {
                    color: c.text,
                    style: { textOutline: '2px ' + c.surface }
                },
                marker: { lineColor: c.surface }
            },
            pie: { dataLabels: { color: c.textSoft } }
        },
        drilldown: {
            activeAxisLabelStyle: { color: c.accent },
            activeDataLabelStyle: { color: c.accent }
        },
        credits: { style: { color: c.borderB } },
        navigation: {
            buttonOptions: {
                symbolStroke: c.textSoft,
                theme: {
                    fill: c.surface2,
                    stroke: c.borderB,
                    states: {
                        hover:  { fill: c.surface3, stroke: c.accent },
                        select: { fill: c.surface3, stroke: c.accent }
                    }
                }
            },
            menuStyle: {
                background: c.surface,
                border: '1px solid ' + c.border,
                padding: '4px 0'
            },
            menuItemStyle:      { color: c.textSoft },
            menuItemHoverStyle: { background: 'rgba(' + c.accentRgb + ', 0.12)', color: c.text }
        }
    });
}

/* Highcharts theme is applied after DOM ready (body may be null in <head>) */
function _applyHCThemeOnReady() {
    applyHighchartsTheme(!document.body.classList.contains('dz-light'));
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _applyHCThemeOnReady);
} else {
    _applyHCThemeOnReady();
}


/* -- Replace navbar logo with theme icon --------------------------- */

(function () {
    'use strict';
    function replaceLogo() {
        var img = document.querySelector('.brand > img');
        if (img && img.src.indexOf('ic_launcher') === -1) {
            img.src = 'styles/default/images/ic_launcher.png';
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', replaceLogo);
    } else {
        replaceLogo();
    }
})();


/* -- Dark / Light mode toggle -------------------------------------- */

(function () {
    'use strict';

    var STORAGE_KEY = 'dz-theme-style';
    var LIGHT_CLASS = 'dz-light';
    var _mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

    function systemPrefersLight() {
        return _mql ? _mql.matches : false;
    }

    function resolveTheme(stored) {
        if (stored === 'auto') return systemPrefersLight() ? 'light' : 'dark';
        return stored || 'dark';
    }

    /* Apply saved preference as early as possible — but body may be null if
       the script runs in <head>, so guard with a readyState check. */
    function applyStoredTheme() {
        var stored = localStorage.getItem(STORAGE_KEY) || 'dark';
        var effective = resolveTheme(stored);
        if (effective === 'light') {
            document.body.classList.add(LIGHT_CLASS);
        } else {
            document.body.classList.remove(LIGHT_CLASS);
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyStoredTheme);
    } else {
        applyStoredTheme();
    }

    function updateBtn(stored) {
        var a = document.getElementById('dz-theme-style-btn');
        if (!a) return;
        var icon = a.querySelector('i');
        var isLight = (stored === 'light') || (stored === 'auto' && systemPrefersLight());
        if (isLight) {
            if (icon) icon.className = 'fa-solid fa-moon';
            a.title = 'Switch to dark mode';
            a.setAttribute('aria-pressed', 'true');
            a.setAttribute('aria-label', 'Switch to dark mode');
        } else {
            if (icon) icon.className = 'fa-solid fa-sun';
            a.title = 'Switch to light mode';
            a.setAttribute('aria-pressed', 'false');
            a.setAttribute('aria-label', 'Switch to light mode');
        }
    }

    function applyEffective(stored) {
        var effective = resolveTheme(stored);
        if (effective === 'light') {
            document.body.classList.add(LIGHT_CLASS);
        } else {
            document.body.classList.remove(LIGHT_CLASS);
        }
        applyHighchartsTheme(effective !== 'light');
    }

    function toggle() {
        var stored = localStorage.getItem(STORAGE_KEY) || 'dark';
        // Simple two-state toggle: dark ↔ light
        // Auto mode is only set via the settings panel
        var next = (stored === 'light') ? 'dark' : 'light';
        localStorage.setItem(STORAGE_KEY, next);
        applyEffective(next);
        updateBtn(next);
    }

    /* Listen for OS theme changes when in auto mode */
    if (_mql && _mql.addEventListener) {
        _mql.addEventListener('change', function () {
            var stored = localStorage.getItem(STORAGE_KEY) || 'dark';
            if (stored === 'auto') {
                applyEffective('auto');
            }
        });
    }

    function injectToggle() {
        if (document.getElementById('dz-theme-style-nav')) return;
        var inner = document.querySelector('.navbar-inner');
        if (!inner) return;

        var stored = localStorage.getItem(STORAGE_KEY) || 'dark';
        var a = document.createElement('a');
        a.id = 'dz-theme-style-btn';
        a.href = 'javascript:void(0)';
        a.setAttribute('role', 'button');
        var icon = document.createElement('i');
        a.appendChild(icon);
        a.addEventListener('click', toggle);

        var li = document.createElement('li');
        li.id = 'dz-theme-style-toggle';
        li.appendChild(a);

        var nav = document.createElement('ul');
        nav.id = 'dz-theme-style-nav';
        nav.appendChild(li);
        /* Append to navbar-inner directly; positioned absolutely via CSS
           so it doesn't affect the container's float layout at all. */
        inner.appendChild(nav);
        /* updateBtn must run after the element is in the DOM,
           because it uses getElementById to find the button. */
        updateBtn(stored);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectToggle);
    } else {
        injectToggle();
    }
})();
