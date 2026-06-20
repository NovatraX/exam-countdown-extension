(() => {
  "use strict";

  const STORAGE_KEY = "youtubeUnhookSettings";
  const STYLE_ID = "novatra-youtube-unhook-style";
  const ROOT_ATTR = "data-novatra-youtube-unhook";

  const HIDDEN_ATTR = "data-novatra-unhook-hidden";
  const ORIGINAL_DISPLAY_ATTR = "data-novatra-unhook-display";
  const ORIGINAL_VISIBILITY_ATTR = "data-novatra-unhook-visibility";
  const CLEANUP_DELAY_MS = 150;
  const MAX_CLEANUP_DELAY_MS = 900;

  const defaultSettings = {
    enabled: true,
    hideShorts: true,
  };

  const shortsSelectors = [
    "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])",
    "ytd-reel-shelf-renderer",
    "ytd-mini-guide-entry-renderer[aria-label='Shorts']",
    "ytd-guide-entry-renderer a[title='Shorts']",
    "ytd-guide-entry-renderer:has(a[title='Shorts'])",
    "ytd-grid-video-renderer:has(a[href^='/shorts/'])",
    "ytd-rich-item-renderer:has(a[href^='/shorts/'])",
    "ytd-video-renderer:has(a[href^='/shorts/'])",
    "ytd-compact-video-renderer:has(a[href^='/shorts/'])",
    "a[title='Shorts']",
    "a[href^='/shorts/']",
    "ytm-reel-shelf-renderer",
  ];

  const cssRuleGroups = [
    {
      key: "hideShorts",
      selectors: shortsSelectors,
    },
  ];

  const domRules = [
    {
      key: "hideShorts",
      roots:
        "ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, ytd-rich-item-renderer, ytd-grid-video-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-rich-section-renderer",
      matches: (element) =>
        hasLink(
          element,
          "a[href^='/shorts/'], a[href*='youtube.com/shorts/']",
        ) ||
        hasExactText(element, "shorts") ||
        (element.matches("ytd-rich-section-renderer") &&
          hasLink(element, "a[href^='/shorts/']")),
    },
  ];

  let currentSettings = { ...defaultSettings };
  let routeObserver = null;
  let cleanupTimer = null;
  let maxCleanupTimer = null;
  let listenersReady = false;
  const hiddenByScript = new Set();

  function getExtensionApi() {
    if (typeof browser !== "undefined") {
      return browser;
    }

    if (typeof chrome !== "undefined") {
      return chrome;
    }

    return null;
  }

  function storageGet(key) {
    const api = getExtensionApi();

    if (!api?.storage?.sync) {
      return Promise.resolve({});
    }

    try {
      const result = api.storage.sync.get(key);

      if (result && typeof result.then === "function") {
        return result.catch(() => ({}));
      }
    } catch {}

    return new Promise((resolve) => {
      api.storage.sync.get(key, (items) => {
        if (api.runtime?.lastError) {
          resolve({});
          return;
        }

        resolve(items || {});
      });
    });
  }

  function normalizeSettings(settings) {
    const normalized = { ...defaultSettings };

    if (!settings || typeof settings !== "object") {
      return normalized;
    }

    Object.keys(defaultSettings).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        normalized[key] = Boolean(settings[key]);
      }
    });

    return normalized;
  }

  function selectorIsSupported(selector) {
    try {
      document.documentElement.matches(selector);
      return true;
    } catch {
      return false;
    }
  }

  function supportedSelectors(selectors) {
    return selectors.filter(selectorIsSupported);
  }

  function createHideRule(selectors) {
    const supported = supportedSelectors(selectors);

    if (!supported.length) {
      return "";
    }

    return `${supported.join(",")}{display:none!important;visibility:hidden!important;pointer-events:none!important;}`;
  }

  function buildStyles(settings) {
    if (!settings.enabled) {
      return "";
    }

    const rules = cssRuleGroups
      .filter(
        (group) =>
          settings[group.key] && (!group.enabled || group.enabled(settings)),
      )
      .map((group) => createHideRule(group.selectors))
      .filter(Boolean);


    return rules.join("\n");
  }

  function applySettings(settings) {
    currentSettings = normalizeSettings(settings);

    let styleElement = document.getElementById(STYLE_ID);

    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = STYLE_ID;
      styleElement.setAttribute("data-owner", "novatra-youtube-unhook");
      (document.head || document.documentElement).appendChild(styleElement);
    }

    styleElement.textContent = buildStyles(currentSettings);
    document.documentElement.setAttribute(
      ROOT_ATTR,
      currentSettings.enabled ? "enabled" : "disabled",
    );
    scheduleCleanup(true);
  }

  function elementText(element) {
    return (element?.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function hasExactText(element, expectedText) {
    return elementText(element) === expectedText;
  }

  function hasLink(element, selector) {
    try {
      return Boolean(element?.querySelector(selector));
    } catch {
      return false;
    }
  }

  function safeQuerySelectorAll(selector) {
    try {
      return Array.from(document.querySelectorAll(selector));
    } catch {
      return [];
    }
  }


  function restoreElement(element) {
    if (!element || element.getAttribute(HIDDEN_ATTR) !== "true") {
      return;
    }

    const originalDisplay = element.getAttribute(ORIGINAL_DISPLAY_ATTR);
    const originalVisibility = element.getAttribute(ORIGINAL_VISIBILITY_ATTR);

    element.removeAttribute(HIDDEN_ATTR);
    element.removeAttribute(ORIGINAL_DISPLAY_ATTR);
    element.removeAttribute(ORIGINAL_VISIBILITY_ATTR);

    if (originalDisplay) {
      element.style.setProperty("display", originalDisplay);
    } else {
      element.style.removeProperty("display");
    }

    if (originalVisibility) {
      element.style.setProperty("visibility", originalVisibility);
    } else {
      element.style.removeProperty("visibility");
    }

    hiddenByScript.delete(element);
  }

  function hideElement(element) {
    if (!element || element.getAttribute(HIDDEN_ATTR) === "true") {
      return;
    }

    element.setAttribute(HIDDEN_ATTR, "true");
    element.setAttribute(ORIGINAL_DISPLAY_ATTR, element.style.display || "");
    element.setAttribute(
      ORIGINAL_VISIBILITY_ATTR,
      element.style.visibility || "",
    );
    element.style.setProperty("display", "none", "important");
    element.style.setProperty("visibility", "hidden", "important");
    hiddenByScript.add(element);
  }

  function pruneDetachedElements() {
    hiddenByScript.forEach((element) => {
      if (!document.documentElement.contains(element)) {
        hiddenByScript.delete(element);
      }
    });
  }

  function activeDomRules() {
    if (!currentSettings.enabled) {
      return [];
    }

    return domRules.filter((rule) => currentSettings[rule.key]);
  }

  function elementStillMatchesActiveRule(element, rules) {
    return rules.some((rule) => {
      try {
        return element.matches(rule.roots) && rule.matches(element);
      } catch {
        return false;
      }
    });
  }

  function cleanupDom() {
    const rules = activeDomRules();

    pruneDetachedElements();

    hiddenByScript.forEach((element) => {
      if (!elementStillMatchesActiveRule(element, rules)) {
        restoreElement(element);
      }
    });

    rules.forEach((rule) => {
      safeQuerySelectorAll(rule.roots).forEach((element) => {
        if (rule.matches(element)) {
          hideElement(element);
        }
      });
    });
  }

  function clearCleanupTimers() {
    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }

    if (maxCleanupTimer) {
      clearTimeout(maxCleanupTimer);
      maxCleanupTimer = null;
    }
  }

  function runCleanup() {
    clearCleanupTimers();
    cleanupDom();
  }

  function scheduleCleanup(immediate = false) {
    if (immediate) {
      runCleanup();
      return;
    }

    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
    }

    cleanupTimer = setTimeout(runCleanup, CLEANUP_DELAY_MS);

    if (!maxCleanupTimer) {
      maxCleanupTimer = setTimeout(runCleanup, MAX_CLEANUP_DELAY_MS);
    }
  }

  async function loadSettings() {
    const stored = await storageGet(STORAGE_KEY);
    applySettings(stored?.[STORAGE_KEY]);
  }

  function watchStorageChanges() {
    const api = getExtensionApi();

    if (!api?.storage?.onChanged) {
      return;
    }

    api.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync" || !changes?.[STORAGE_KEY]) {
        return;
      }

      applySettings(changes[STORAGE_KEY].newValue);
    });
  }

  function watchRuntimeMessages() {
    const api = getExtensionApi();

    if (!api?.runtime?.onMessage) {
      return;
    }

    api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.action !== "youtubeUnhookApplySettings") {
        return false;
      }

      applySettings(message.settings);

      if (typeof sendResponse === "function") {
        sendResponse({ ok: true });
      }

      return false;
    });
  }

  function watchYouTubeNavigation() {
    if (routeObserver) {
      routeObserver.disconnect();
    }

    routeObserver = new MutationObserver(() => {
      scheduleCleanup();
    });

    routeObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    if (listenersReady) {
      return;
    }

    listenersReady = true;
    window.addEventListener("yt-navigate-finish", loadSettings, true);
    window.addEventListener("yt-page-data-updated", loadSettings, true);
    window.addEventListener("yt-navigate-start", () => scheduleCleanup(true), true);
    window.addEventListener("popstate", () => scheduleCleanup(true), true);
    window.addEventListener("pageshow", () => scheduleCleanup(true), true);
  }

  function init() {
    loadSettings();
    watchStorageChanges();
    watchRuntimeMessages();
    watchYouTubeNavigation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
