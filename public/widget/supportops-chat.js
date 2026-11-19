/**
 * SupportOps AI Live Chat Widget
 * Embeddable launcher for the authenticated customer support portal.
 *
 * Usage:
 * <script src="https://support.example.com/widget/supportops-chat.js"
 *   data-server="https://support.example.com"
 *   data-color="#304A61"
 *   data-position="right"
 *   data-greeting="Hi! How can we help you today?"
 * ></script>
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var config = {
    server: script.getAttribute("data-server") || window.location.origin,
    color: script.getAttribute("data-color") || "#304A61",
    position: script.getAttribute("data-position") === "left" ? "left" : "right",
    greeting: script.getAttribute("data-greeting") || "Hi! How can we help you today?",
    title: script.getAttribute("data-title") || "NovaCart Support",
  };

  var isOpen = false;

  function createStyles() {
    var style = document.createElement("style");
    style.textContent = "\n\
      #supportops-widget-container{position:fixed;bottom:20px;" + config.position + ":20px;z-index:999999;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}\n\
      #supportops-widget-btn{width:56px;height:56px;border-radius:50%;background:" + config.color + ";border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.15);transition:transform .2s}\n\
      #supportops-widget-btn:hover{transform:scale(1.05)}\n\
      #supportops-widget-btn svg{width:24px;height:24px;fill:#fff}\n\
      #supportops-widget-panel{display:none;width:min(370px,calc(100vw - 40px));background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.12);margin-bottom:12px;overflow:hidden;flex-direction:column}\n\
      #supportops-widget-panel.open{display:flex}\n\
      #supportops-widget-header{background:" + config.color + ";color:#fff;padding:16px;display:flex;align-items:center;justify-content:space-between}\n\
      #supportops-widget-header h3{margin:0;font-size:15px;font-weight:600}\n\
      #supportops-widget-close{background:none;border:none;color:#fff;cursor:pointer;font-size:20px;padding:0;line-height:1}\n\
      #supportops-widget-content{padding:16px;color:#1e293b;font-size:14px;line-height:1.5}\n\
      #supportops-widget-greeting{margin:0 0 12px}\n\
      #supportops-widget-link{display:inline-block;background:" + config.color + ";color:#fff;text-decoration:none;border-radius:8px;padding:10px 16px}\n\
    ";
    document.head.appendChild(style);
  }

  function createWidget() {
    var container = document.createElement("div");
    container.id = "supportops-widget-container";
    container.innerHTML = '\
      <div id="supportops-widget-panel">\
        <div id="supportops-widget-header">\
          <h3 id="supportops-widget-title"></h3>\
          <button type="button" id="supportops-widget-close" aria-label="Close support">&times;</button>\
        </div>\
        <div id="supportops-widget-content">\
          <p id="supportops-widget-greeting"></p>\
          <a id="supportops-widget-link" target="_blank" rel="noopener">Open support chat</a>\
        </div>\
      </div>\
      <button type="button" id="supportops-widget-btn" aria-label="Customer support" aria-controls="supportops-widget-panel" aria-expanded="false">\
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>\
      </button>\
    ';
    document.body.appendChild(container);

    document.getElementById("supportops-widget-title").textContent = config.title;
    document.getElementById("supportops-widget-greeting").textContent = config.greeting;
    var link = document.getElementById("supportops-widget-link");
    link.href = "/support";
    try {
      var server = new URL(config.server, window.location.href);
      if (server.protocol === "https:" || server.protocol === "http:") {
        link.href = new URL("/support", server).href;
      }
    } catch {
      // An invalid embed URL falls back to the host page's origin.
    }
    document.getElementById("supportops-widget-btn").onclick = toggleWidget;
    document.getElementById("supportops-widget-close").onclick = toggleWidget;
  }

  function toggleWidget() {
    isOpen = !isOpen;
    var panel = document.getElementById("supportops-widget-panel");
    panel.classList.toggle("open", isOpen);
    document.getElementById("supportops-widget-btn").setAttribute("aria-expanded", String(isOpen));
  }

  // Initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      createStyles();
      createWidget();
    });
  } else {
    createStyles();
    createWidget();
  }
})();
