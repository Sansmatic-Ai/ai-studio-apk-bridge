/*! AI Studio APK Bridge v1.0.0 | Copyright (c) 2026 Tamal Mitra | MIT License (see LICENSE in the repository root) */
// Safety net: if the browser did not run inject.js in the page itself
// ("world": "MAIN" unsupported), load it with a <script> tag instead.
(function () {
  setTimeout(function () {
    try {
      if (document.documentElement.getAttribute('data-apk-bridge')) return;
      var s = document.createElement('script');
      s.src = chrome.runtime.getURL('inject.js');
      s.onload = function () { s.remove(); };
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {
      console.warn('[APK Bridge] loader failed', e);
    }
  }, 800);
})();