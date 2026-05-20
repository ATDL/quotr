(function () {
  if (window.__dartlab_loaded__) return;
  window.__dartlab_loaded__ = true;
  function pixel() {
    fetch("/api/dart/event", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: "{}",
      keepalive: true,
    }).catch(function () {});
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pixel);
  } else {
    pixel();
  }
})();
