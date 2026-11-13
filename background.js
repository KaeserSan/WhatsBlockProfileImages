"use strict";

// Profile pictures on WhatsApp Web are served from pps.whatsapp.net (path
// type t61.24694-24). Every such request is redirected to the bundled generic
// avatar, so the real photo never reaches the browser (nor its cache).
// content.js additionally replaces any avatar that still gets through.
const WATCH_URLS = ["*://*.whatsapp.net/*", "*://*.fbcdn.net/*"];
const PROFILE_URL = /pps\.whatsapp\.net|\/t61\.24694-24\//;
const AVATAR_URL = browser.runtime.getURL("avatar.svg");

let enabled = true;

browser.storage.local.get({ enabled: true }).then((s) => {
  enabled = s.enabled;
  updateButton();
});

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!enabled || !PROFILE_URL.test(details.url)) return {};
    return { redirectUrl: AVATAR_URL };
  },
  { urls: WATCH_URLS },
  ["blocking"]
);

browser.browserAction.onClicked.addListener(async () => {
  enabled = !enabled;
  await browser.storage.local.set({ enabled });
  updateButton();
  // Reload open WhatsApp tabs so the change applies to already-loaded images.
  const tabs = await browser.tabs.query({ url: "*://web.whatsapp.com/*" });
  for (const tab of tabs) browser.tabs.reload(tab.id);
});

function updateButton() {
  browser.browserAction.setBadgeText({ text: enabled ? "" : "OFF" });
  browser.browserAction.setBadgeBackgroundColor({ color: "#8696a0" });
  browser.browserAction.setTitle({
    title: enabled
      ? "WhatsBlock: activo (clic para desactivar)"
      : "WhatsBlock: desactivado (clic para activar)",
  });
}
