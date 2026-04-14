// Demo loader for custom.js (light/dark theme toggle)
// Loads the main custom.js from the parent directory
// and ensures the theme toggle is available in demo pages.

// Load the main custom.js
var script = document.createElement('script');
script.src = '../custom.js';
document.head.appendChild(script);
