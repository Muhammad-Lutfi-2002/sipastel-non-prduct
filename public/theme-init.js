// Apply the saved theme (or default to dark) before React mounts and before
// first paint, so there is never a flash of the wrong theme.
// Kept as an external file (not inline) so the Content-Security-Policy can
// forbid inline scripts entirely.
(function () {
  try {
    var saved = localStorage.getItem('sipastel-theme');
    var theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
