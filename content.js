"use strict";

// Replaces every profile picture on WhatsApp Web with a generated avatar:
// the contact's initials on a colour derived from the name when the name can
// be found nearby, otherwise a generic grey silhouette.
//
// WhatsApp draws profile pictures as SVG <image xlink:href="…"> elements
// (masked into a rounded square), loaded from *.cdn.whatsapp.net with the
// path type /t61.24694-24/. Older builds used <img src="pps.whatsapp.net/…">.
// Both are handled. A plain <img> is also treated as an avatar when it is a
// small square clipped into a circle (covers blob:/cached URLs).
//
// Every image stays hidden (content.css) until it has been checked, so real
// photos never flash on screen.

(() => {
  const DEBUG = false;
  const XLINK = "http://www.w3.org/1999/xlink";
  const root = document.documentElement;
  root.classList.add("wbpi-on");

  const PROFILE_URL = /pps\.whatsapp\.net|\/t61\.24694-24\//;
  const MIN_SIZE = 16;
  const MAX_SIZE = 260;

  const COLORS = [
    "#e57373", "#f06292", "#ba68c8", "#9575cd", "#7986cb", "#64b5f6",
    "#4fc3f7", "#4dd0e1", "#4db6ac", "#81c784", "#aed581", "#ffb74d",
    "#ff8a65", "#a1887f", "#90a4ae",
  ];

  const GENERIC = svgUrl(
    '<rect width="100" height="100" fill="#8696a0"/>' +
      '<circle cx="50" cy="38" r="18" fill="#dfe5e7"/>' +
      '<path d="M16 92c4-20 18-30 34-30s30 10 34 30z" fill="#dfe5e7"/>'
  );

  const cache = new Map();
  let observer = null;
  let swapped = 0;

  function log(...args) {
    if (DEBUG) console.info("[WhatsBlock]", ...args);
  }

  function svgUrl(body) {
    return (
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' + body + "</svg>"
      )
    );
  }

  function escapeXml(s) {
    return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function initialsOf(name) {
    // Phone numbers or names without letters: no initials.
    const words = name
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => /\p{L}/u.test(w));
    if (!words.length) return "";
    const first = [...words[0]][0];
    const last = words.length > 1 ? [...words[words.length - 1]][0] : "";
    return (first + last).toUpperCase();
  }

  function avatarFor(name) {
    if (!name) return GENERIC;
    if (cache.has(name)) return cache.get(name);
    const ini = initialsOf(name);
    const url = ini
      ? svgUrl(
          `<rect width="100" height="100" fill="${COLORS[hash(name) % COLORS.length]}"/>` +
            `<text x="50" y="50" dy=".35em" text-anchor="middle" fill="#fff" ` +
            `font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="${ini.length > 1 ? 40 : 46}" ` +
            `font-weight="500">${escapeXml(ini)}</text>`
        )
      : GENERIC;
    cache.set(name, url);
    return url;
  }

  // The contact name is only read where it is reliable: the chat-list row,
  // whose title cell holds the name. Elsewhere (conversation header, contact
  // info panel…) the first [title] is often something else ("Cuenta
  // empresa", "Haz clic para…"), so there the name is looked up by photo:
  // the same picture id seen in the chat list maps to the same name.
  // Unknown → generic silhouette.
  const namesByPhoto = new Map();

  function photoKey(src) {
    const m = /\/t61\.24694-24\/([^/?#]+)/.exec(src);
    return m ? m[1] : "";
  }

  function nameFromChatList(el) {
    const row = el.closest('[role="row"], [role="listitem"]');
    const span = row && row.querySelector('[data-testid="cell-frame-title"] span[title]');
    const title = span && span.getAttribute("title").trim();
    return title && title.length < 80 ? title : "";
  }

  function findName(el, src) {
    const key = photoKey(src);
    const name = nameFromChatList(el);
    if (name) {
      if (key) namesByPhoto.set(key, name);
      return name;
    }
    return (key && namesByPhoto.get(key)) || "";
  }

  // --- element-type specific source access -------------------------------

  const isSvgImage = (el) => el.localName === "image" && el instanceof SVGElement;

  function getSrc(el) {
    if (isSvgImage(el)) return el.getAttribute("href") || el.getAttributeNS(XLINK, "href") || "";
    return el.getAttribute("src") || "";
  }

  function setSrc(el, url) {
    if (isSvgImage(el)) {
      el.setAttributeNS(XLINK, "xlink:href", url);
      if (el.hasAttribute("href")) el.setAttribute("href", url);
    } else {
      el.removeAttribute("srcset");
      el.setAttribute("src", url);
    }
  }

  // --- detection ---------------------------------------------------------

  function isRound(el, width) {
    // The image itself or one of its close ancestors clips it into a circle.
    for (let i = 0; el && i < 5; i++, el = el.parentElement) {
      const r = getComputedStyle(el).borderTopLeftRadius;
      if (!r || r === "0px") continue;
      if (r.endsWith("%") ? parseFloat(r) >= 40 : parseFloat(r) >= width * 0.4) return true;
    }
    return false;
  }

  function looksLikeAvatarImg(img) {
    const src = img.currentSrc || img.getAttribute("src") || "";
    if (PROFILE_URL.test(src)) return true;
    if (src.startsWith("data:image/svg")) return false; // ours / WhatsApp's own icons
    const rect = img.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w < MIN_SIZE || w > MAX_SIZE || Math.abs(w - h) > 2) return false;
    return isRound(img, w);
  }

  function replace(el) {
    const url = avatarFor(findName(el, getSrc(el)));
    el.dataset.wbpi = "swapped";
    el.dataset.wbpiSrc = url;
    setSrc(el, url);
    swapped++;
    log("swapped", swapped);
  }

  function check(el) {
    const src = getSrc(el);
    if (!src) return; // nothing to show yet; stays hidden
    if (el.dataset.wbpi === "swapped" && src === el.dataset.wbpiSrc) return;
    // A previously swapped element whose source was reset by WhatsApp (React
    // re-render or a recycled list row) is checked again from scratch.
    delete el.dataset.wbpi;

    if (PROFILE_URL.test(src)) return replace(el);
    if (isSvgImage(el)) {
      el.dataset.wbpi = "ok";
      return;
    }

    // <img> with an unknown URL: decide by shape once it has a layout.
    const run = () => {
      if (getSrc(el) !== src) return; // changed meanwhile
      if (looksLikeAvatarImg(el)) replace(el);
      else el.dataset.wbpi = "ok";
    };
    if (el.complete) run();
    else {
      el.addEventListener("load", run, { once: true });
      el.addEventListener("error", run, { once: true });
    }
  }

  const SELECTOR = "img, image";

  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.matches(SELECTOR)) check(node);
    node.querySelectorAll(SELECTOR).forEach(check);
  }

  function start() {
    scan(root);
    // No attributeFilter: it can't match namespaced attributes (xlink:href).
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes") {
          const a = m.attributeName;
          if ((a === "src" || a === "href") && m.target.matches(SELECTOR)) check(m.target);
        } else m.addedNodes.forEach(scan);
      }
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true });
    log("started");
  }

  start();

  browser.storage.local.get({ enabled: true }).then((s) => {
    if (!s.enabled) {
      observer.disconnect();
      root.classList.remove("wbpi-on");
    }
  });
})();
