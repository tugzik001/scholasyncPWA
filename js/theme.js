/* ScholaSync — theme.js
 * Light/dark mode. Load in <head> (no defer) so the theme is set before first paint.
 * Saves the choice in localStorage ("ss_theme"); follows the device setting until the user picks one.
 * Any <button data-theme-toggle> on the page becomes the switch.
 */
(function () {
  'use strict';
 
  var KEY = 'ss_theme';
  var COLORS = { light: '#faf9f6', dark: '#14130f' };
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
 
  function stored() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (e) {
      return null;
    }
  }
 
  function systemTheme() {
    return mq && mq.matches ? 'dark' : 'light';
  }
 
  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }
 
  function syncUi(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', COLORS[theme]);
 
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      var dark = theme === 'dark';
      buttons[i].textContent = dark ? '☀' : '☾';
      buttons[i].setAttribute('aria-pressed', String(dark));
      buttons[i].setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }
 
  function apply(theme) {
    root.setAttribute('data-theme', theme);
    syncUi(theme);
  }
 
  apply(stored() || systemTheme());
 
  document.addEventListener('DOMContentLoaded', function () {
    syncUi(current());
    var buttons = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () {
        var next = current() === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(KEY, next); } catch (e) { /* private mode: still switch */ }
        apply(next);
      });
    }
  });
 
  if (mq && mq.addEventListener) {
    mq.addEventListener('change', function () {
      if (!stored()) apply(systemTheme());
    });
  }
})();
 