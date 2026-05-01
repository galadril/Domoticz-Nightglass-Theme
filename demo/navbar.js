/**
 * navbar.js — injects the Domoticz-style navbar into every demo page.
 * Call buildNavbar('pageId') from each page's <script>.
 *
 * pageId values: 'dashboard' | 'lights' | 'scenes' | 'temperature' | 'weather' | 'utility' | 'popups'
 */
(function () {
  var PAGES = [
    { id: 'dashboard',   href: 'index.html',       icon: 'fa-gauge',           label: 'Dashboard'   },
    { id: 'lights',      href: 'lights.html',       icon: 'fa-lightbulb',       label: 'Lights'      },
    { id: 'scenes',      href: 'scenes.html',       icon: 'fa-layer-group',     label: 'Scenes'      },
    { id: 'temperature', href: 'temperature.html',  icon: 'fa-temperature-half', label: 'Temperature' },
    { id: 'weather',     href: 'weather.html',      icon: 'fa-cloud-rain',      label: 'Weather'     },
    { id: 'utility',     href: 'utility.html',      icon: 'fa-bolt',            label: 'Utility'     },
    { id: 'popups',      href: 'popups.html',       icon: 'fa-window-restore',  label: 'Popups'      },
    { id: 'notifications', href: 'notifications.html', icon: 'fa-bell',           label: 'Notifications' },
  ];

  var SETUP_ITEMS = [
    { icon: 'fa-gear',               label: 'Settings',         href: 'settings.html' },
    { icon: 'fa-microchip',          label: 'Hardware'          },
    { icon: 'fa-sliders',            label: 'Devices'           },
    { icon: 'fa-charging-station',   label: 'Energy'            },
    { icon: 'fa-users',              label: 'Users'             },
    { icon: 'fa-download',           label: 'Check for updates', href: 'update.html' },
    null,
    { icon: 'fa-code',               label: 'Events'            },
    { icon: 'fa-list',               label: 'User Variables'    },
    { icon: 'fa-bell',               label: 'Notifications'     },
    { icon: 'fa-shield-halved',      label: 'Security'          },
    null,
    { icon: 'fa-terminal',           label: 'Log'               },
    { icon: 'fa-circle-info',        label: 'About'             },
    null,
    { icon: 'fa-rotate-right',       label: 'Restart'           },
    { icon: 'fa-power-off',          label: 'Shutdown'          },
    null,
    { icon: 'fa-right-from-bracket', label: 'Logout'            },
  ];

  window.buildNavbar = function (activePage) {
    // Build nav items
    var navItems = PAGES.map(function (p) {
      var active = p.id === activePage ? ' class="current_page_item"' : '';
      return '<li' + active + '>' +
        '<a href="' + p.href + '">' +
        '<i class="dz-fa-icon fa-solid ' + p.icon + '"></i> ' +
        '<span class="hidden-phone hidden-tablet">' + p.label + '</span>' +
        '</a></li>';
    }).join('\n      ');

    // Build setup dropdown items
    var setupItems = SETUP_ITEMS.map(function (item) {
      if (!item) return '<li class="divider"></li>';
      var link = item.href || '#';
      return '<li><a href="' + link + '"><i class="dz-fa-icon fa-solid ' + item.icon + '"></i> ' + item.label + '</a></li>';
    }).join('\n          ');

    var html =
      '<div class="navbar navbar-inverse navbar-fixed-top" id="navbar">' +
      '<div class="navbar-inner">' +
        '<div class="dz-nav-topline"></div>' +
        '<div class="container">' +
        '<a class="brand hidden-phone" id="version" href="index.html">' +
          '<img src="../images/ic_launcher.png" class="dz-icon-skipped">' +
          '<h1>Domoticz</h1>' +
          '<h2 id="appversion" class="version-tooltip">2026.1 (build 17666)</h2>' +
        '</a>' +
        '<ul class="nav" id="appnavbar">' +
          '<div class="dz-nav-indicator" id="dzNavIndicator"></div>' +
          navItems +
          '<li class="dropdown">' +
            '<a href="#" class="dropdown-toggle">' +
              '<i class="dz-fa-icon fa-solid fa-gear"></i> <span class="hidden-phone hidden-tablet">Setup</span> <b class="caret hidden-phone hidden-tablet"></b>' +
            '</a>' +
            '<ul class="dropdown-menu">' + setupItems + '</ul>' +
          '</li>' +
        '</ul>' +
      '</div></div></div>';

    document.write(html);

    // Position the sliding indicator under the active nav item
    requestAnimationFrame(function () {
      var ind = document.getElementById('dzNavIndicator');
      var active = document.querySelector('#appnavbar .current_page_item > a');
      var nav = document.getElementById('appnavbar');
      if (ind && active && nav) {
        var navRect = nav.getBoundingClientRect();
        var aRect = active.getBoundingClientRect();
        ind.style.width = aRect.width + 'px';
        ind.style.left = (aRect.left - navRect.left) + 'px';
        ind.style.opacity = '1';
      }
    });
  };
})();
