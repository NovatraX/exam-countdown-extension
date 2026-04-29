(() => {
  "use strict";

  const STORAGE_KEY = "youtubeUnhookSettings";
  const STYLE_ID = "novatra-youtube-unhook-style";
  const ROOT_ATTR = "data-novatra-youtube-unhook";
  const HOME_FEED_ATTR = "novatra-hide-home-feed";
  const YOUTUBE_HOME_URL = "https://www.youtube.com/";
  const HIDDEN_ATTR = "data-novatra-unhook-hidden";
  const ORIGINAL_DISPLAY_ATTR = "data-novatra-unhook-display";
  const ORIGINAL_VISIBILITY_ATTR = "data-novatra-unhook-visibility";
  const CLEANUP_DELAY_MS = 150;
  const MAX_CLEANUP_DELAY_MS = 900;
  const CONTROL_RETRY_DELAY_MS = 750;
  const CONTROL_RETRY_LIMIT = 6;

  const defaultSettings = {
    enabled: true,
    hideHomeFeed: false,
    hideHomeHeader: true,
    hideTopHeader: false,
    hideVideoSidebar: false,
    expandVideoPlayer: true,
    hideRecommended: true,
    hideRecommendationShelves: true,
    hideLiveChat: true,
    hidePlaylist: true,
    hideFundraiser: true,
    hideEndScreenFeed: true,
    hideEndScreenCards: true,
    hideShorts: true,
    hideComments: false,
    hideMixes: false,
    hideMerch: true,
    hideVideoInfo: false,
    hideVideoButtonsBar: false,
    hideChannel: false,
    hideDescription: false,
    hideRelatedSearches: true,
    hideExplore: false,
    hideExploreFeed: true,
    hideSubscriptions: false,
    hideNotifications: false,
    hideAutoplay: true,
    disableAutoplay: true,
    disableAnnotations: true,
    hideChips: false,
    hideAds: true,
  };

  const cssRuleGroups = [
    {
      key: "hideHomeFeed",
      selectors: [
        "ytd-browse[page-subtype='home'] ytd-rich-grid-renderer",
        "ytd-browse[page-subtype='home'] ytd-two-column-browse-results-renderer",
        "ytd-browse[page-subtype='home'] #contents",
        "ytd-browse[page-subtype='home'] ytd-continuation-item-renderer",
        "ytd-browse[page-subtype='home'] ytd-rich-section-list-renderer",
      ],
    },
    {
      key: "hideHomeHeader",
      selectors: [
        "ytd-browse[page-subtype='home'] #header",
        "ytd-browse[page-subtype='home'] .ytd-browse-chips-wrapper",
        "ytd-browse[page-subtype='home'] ytd-feed-filter-chip-bar-renderer",
        "ytd-browse[page-subtype='home'] #chips-wrapper",
      ],
    },
    {
      key: "hideTopHeader",
      selectors: [
        "ytd-masthead",
        "#masthead-container",
        "ytm-mobile-topbar-renderer",
        "ytm-pivot-bar-renderer",
      ],
    },
    {
      key: "hideVideoSidebar",
      selectors: [
        "ytd-watch-flexy #secondary",
        "ytd-watch-flexy #secondary-inner",
        "ytd-watch-flexy ytd-watch-next-secondary-results-renderer",
        "ytd-watch-flexy #related",
        "ytm-watch ytm-single-column-watch-next-results-renderer",
      ],
    },
    {
      key: "hideRecommended",
      enabled: (settings) => !settings.hideVideoSidebar,
      selectors: [
        "ytd-watch-flexy #secondary ytd-watch-next-secondary-results-renderer",
        "ytd-watch-flexy #related ytd-watch-next-secondary-results-renderer",
        "ytd-watch-flexy #secondary #items.ytd-watch-next-secondary-results-renderer",
        "ytd-watch-flexy #secondary ytd-item-section-renderer:has(ytd-compact-video-renderer)",
        "ytd-watch-flexy #secondary ytd-continuation-item-renderer",
        "ytd-watch-flexy #secondary ytd-compact-video-renderer",
        "ytd-watch-flexy #secondary ytd-compact-movie-renderer",
        "ytd-watch-flexy #secondary ytd-compact-radio-renderer",
        "ytd-watch-flexy #secondary ytd-compact-station-renderer",
        "ytd-watch-flexy #secondary ytd-compact-promoted-video-renderer",
        "ytd-watch-flexy #secondary ytd-reel-shelf-renderer",
        "ytm-watch ytm-single-column-watch-next-results-renderer ytm-item-section-renderer",
        "ytm-watch ytm-compact-video-renderer",
      ],
    },
    {
      key: "hideRecommendationShelves",
      selectors: [
        "ytd-rich-shelf-renderer",
        "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer)",
        "ytd-watch-flexy ytd-item-section-renderer:has(ytd-compact-video-renderer)",
      ],
    },
    {
      key: "hideLiveChat",
      selectors: [
        "ytd-live-chat-frame",
        "#chat",
        "#chat-container",
        "ytd-watch-flexy[is-two-columns_] #chat-container",
        "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-live-chat']",
      ],
    },
    {
      key: "hidePlaylist",
      selectors: [
        "#playlist",
        "ytd-playlist-panel-renderer",
        "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-playlist']",
        "ytd-watch-flexy ytd-playlist-panel-renderer",
        "ytd-compact-playlist-renderer",
        "ytm-playlist-panel-renderer",
      ],
    },
    {
      key: "hideFundraiser",
      selectors: [
        "ytd-donation-shelf-renderer",
        "ytd-donation-unavailable-renderer",
        "ytd-compact-video-renderer ytd-thumbnail-overlay-bottom-panel-renderer",
        "ytd-watch-flexy ytd-fundraiser-renderer",
        "ytd-watch-flexy ytd-engagement-panel-section-list-renderer[target-id*='fundraiser']",
        "ytm-donation-shelf-renderer",
      ],
    },
    {
      key: "hideEndScreenFeed",
      selectors: [
        ".ytp-ce-element",
        ".ytp-ce-covering-overlay",
        ".ytp-ce-expanding-overlay",
        ".ytp-ce-video",
        ".ytp-ce-playlist",
        ".ytp-ce-channel",
        ".ytp-ce-website",
        ".ytp-endscreen-content",
        ".ytp-suggestion-set",
        ".ytp-ce-element-show",
        ".html5-endscreen",
        ".ytp-videowall-still",
      ],
    },
    {
      key: "hideEndScreenCards",
      selectors: [
        ".ytp-cards-button",
        ".ytp-cards-teaser",
        ".ytp-cards-teaser-box",
        ".ytp-cards-shelf",
        ".ytp-cards-card",
        ".ytp-ce-card",
        ".ytp-ce-card-border",
      ],
    },
    {
      key: "hideShorts",
      selectors: [
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
      ],
    },
    {
      key: "hideComments",
      selectors: [
        "ytd-comments",
        "#comments",
        "ytd-item-section-renderer#sections",
        "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-comments-section']",
        "ytm-comment-section-renderer",
        "ytm-comments-entry-point-header-renderer",
      ],
    },
    {
      key: "hideMixes",
      selectors: [
        "ytd-radio-renderer",
        "ytd-compact-radio-renderer",
        "ytd-rich-item-renderer:has(a[href*='start_radio=1'])",
        "ytd-video-renderer:has(a[href*='start_radio=1'])",
        "ytd-compact-video-renderer:has(a[href*='start_radio=1'])",
        "ytd-playlist-renderer:has(a[href*='start_radio=1'])",
      ],
    },
    {
      key: "hideMerch",
      selectors: [
        "ytd-merch-shelf-renderer",
        "ytd-product-list-renderer",
        "ytd-product-renderer",
        "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-structured-description'] ytd-merch-shelf-renderer",
        "ytd-shopping-renderer",
        "ytd-watch-flexy ytd-action-companion-ad-renderer",
      ],
    },
    {
      key: "hideVideoInfo",
      selectors: [
        "ytd-watch-metadata",
        "#above-the-fold",
        "#primary-inner > #info",
        "#primary-inner > #meta",
        "ytd-video-primary-info-renderer",
        "ytd-video-secondary-info-renderer",
        "ytm-slim-video-metadata-section-renderer",
        "ytm-expandable-video-description-body-renderer",
      ],
    },
    {
      key: "hideVideoButtonsBar",
      enabled: (settings) => !settings.hideVideoInfo,
      selectors: [
        "ytd-watch-metadata #actions",
        "ytd-watch-metadata #top-level-buttons-computed",
        "ytd-watch-metadata segmented-like-dislike-button-view-model",
        "ytd-watch-metadata ytd-menu-renderer",
        "ytd-video-primary-info-renderer #menu",
        "ytm-slim-video-action-bar-renderer",
      ],
    },
    {
      key: "hideChannel",
      enabled: (settings) => !settings.hideVideoInfo,
      selectors: [
        "ytd-watch-metadata #owner",
        "ytd-watch-metadata #owner-container",
        "ytd-video-secondary-info-renderer #top-row",
        "ytd-subscribe-button-renderer",
        "yt-button-shape:has(button[aria-label*='Subscribe'])",
        "ytm-slim-owner-renderer",
      ],
    },
    {
      key: "hideDescription",
      enabled: (settings) => !settings.hideVideoInfo,
      selectors: [
        "ytd-watch-metadata #description",
        "ytd-watch-metadata ytd-text-inline-expander",
        "ytd-video-secondary-info-renderer #description",
        "ytd-structured-description-content-renderer",
        "ytm-expandable-video-description-body-renderer",
      ],
    },
    {
      key: "hideRelatedSearches",
      selectors: [
        "ytd-horizontal-card-list-renderer",
        "ytd-watch-flexy ytd-search-refinement-card-renderer",
        "ytd-search ytd-search-refinement-card-renderer",
        "ytd-search ytd-shelf-renderer",
        "ytd-search ytd-reel-shelf-renderer",
        "ytd-search ytd-rich-shelf-renderer",
        "ytd-search ytd-secondary-search-container-renderer",
        "ytd-search ytd-exploratory-results-renderer",
      ],
    },
    {
      key: "hideExplore",
      selectors: [
        "ytd-guide-entry-renderer a[title='Explore']",
        "ytd-guide-entry-renderer:has(a[title='Explore'])",
        "ytd-mini-guide-entry-renderer[aria-label='Explore']",
        "ytd-guide-section-renderer:has(a[href='/feed/explore'])",
      ],
    },
    {
      key: "hideExploreFeed",
      selectors: [
        "ytd-browse[page-subtype='trending'] #contents",
        "ytd-browse[page-subtype='trending'] ytd-section-list-renderer",
        "ytd-browse[page-subtype='explore'] #contents",
        "ytd-browse[page-subtype='explore'] ytd-section-list-renderer",
        "ytd-browse[page-subtype='channels'] #contents",
      ],
    },
    {
      key: "hideSubscriptions",
      selectors: [
        "ytd-guide-entry-renderer a[title='Subscriptions']",
        "ytd-guide-entry-renderer:has(a[title='Subscriptions'])",
        "ytd-mini-guide-entry-renderer[aria-label='Subscriptions']",
        "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-subscribed])",
      ],
    },
    {
      key: "hideNotifications",
      selectors: [
        "ytd-notification-topbar-button-renderer",
        "ytm-notification-button-renderer",
        "#notification-button",
      ],
    },
    {
      key: "hideAutoplay",
      selectors: [
        ".ytp-autonav-toggle-button-container",
        ".ytp-autonav-endscreen-button-container",
        "ytd-compact-autoplay-renderer",
      ],
    },
    {
      key: "disableAnnotations",
      selectors: [
        ".annotation",
        ".annotator",
        ".ytp-iv-video-content",
        ".ytp-iv-video-content-panel",
        ".ytp-iv-card-content",
        ".ytp-cards-button",
        ".ytp-cards-teaser",
        ".ytp-cards-teaser-box",
      ],
    },
    {
      key: "hideChips",
      selectors: [
        "yt-chip-cloud-renderer",
        "ytd-feed-filter-chip-bar-renderer",
        "iron-selector#chips",
        "#chips-wrapper.ytd-feed-filter-chip-bar-renderer",
      ],
    },
    {
      key: "hideAds",
      selectors: [
        "ytd-ad-slot-renderer",
        "ytd-promoted-sparkles-web-renderer",
        "ytd-promoted-video-renderer",
        "ytd-display-ad-renderer",
        "ytd-in-feed-ad-layout-renderer",
        "ytd-action-companion-ad-renderer",
        "ytd-companion-slot-renderer",
        "ytd-player-legacy-desktop-watch-ads-renderer",
        "ytd-banner-promo-renderer",
        "ytd-statement-banner-renderer",
        ".ytp-ad-module",
        ".video-ads",
        "#masthead-ad",
      ],
    },
  ];

  const domRules = [
    {
      key: "hideRecommended",
      roots:
        "ytd-watch-next-secondary-results-renderer, ytd-item-section-renderer, ytd-compact-video-renderer, ytd-compact-movie-renderer, ytd-compact-radio-renderer, ytd-compact-station-renderer, ytd-compact-promoted-video-renderer, ytd-reel-shelf-renderer, ytm-item-section-renderer, ytm-compact-video-renderer",
      matches: (element) =>
        !currentSettings.hideVideoSidebar &&
        Boolean(element.closest("#secondary, #related, ytm-watch")),
    },
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
    {
      key: "hideMixes",
      roots:
        "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-playlist-renderer, ytd-radio-renderer, ytd-compact-radio-renderer",
      matches: (element) => {
        const text = elementText(element);
        return (
          hasLink(element, "a[href*='start_radio=1']") ||
          text.includes("mix - ") ||
          text.includes("youtube mix")
        );
      },
    },
    {
      key: "hideFundraiser",
      roots:
        "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-shelf-renderer, ytd-rich-section-renderer",
      matches: (element) => {
        const text = elementText(element);
        return text.includes("fundraiser") || text.includes("donate now");
      },
    },
    {
      key: "hideMerch",
      roots:
        "ytd-shelf-renderer, ytd-rich-section-renderer, ytd-engagement-panel-section-list-renderer",
      matches: (element) => {
        const text = elementText(element);
        return (
          text.includes("merch") ||
          text.includes("shop") ||
          text.includes("store")
        );
      },
    },
    {
      key: "hideExplore",
      roots: "ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer",
      matches: (element) =>
        hasLink(element, "a[href='/feed/explore']") ||
        hasExactText(element, "explore"),
    },
    {
      key: "hideSubscriptions",
      roots: "ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer",
      matches: (element) =>
        hasLink(element, "a[href='/feed/subscriptions']") ||
        hasExactText(element, "subscriptions"),
    },
    {
      key: "hideRelatedSearches",
      roots:
        "ytd-shelf-renderer, ytd-rich-shelf-renderer, ytd-reel-shelf-renderer, ytd-horizontal-card-list-renderer, ytd-secondary-search-container-renderer, ytd-exploratory-results-renderer",
      matches: (element) => {
        if (!isSearchPage()) {
          return false;
        }

        const text = elementText(element);
        return [
          "related to your search",
          "latest from",
          "searches related to",
          "people also search for",
          "for you",
          "previously watched",
        ].some((phrase) => text.includes(phrase));
      },
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

    if (
      Object.prototype.hasOwnProperty.call(settings, "hideAutoplay") &&
      !Object.prototype.hasOwnProperty.call(settings, "disableAutoplay")
    ) {
      normalized.disableAutoplay = Boolean(settings.hideAutoplay);
    }

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

    if (settings.expandVideoPlayer && settings.hideVideoSidebar) {
      rules.push(`
        ytd-watch-flexy[flexy][is-two-columns_] #primary.ytd-watch-flexy,
        ytd-watch-flexy[flexy] #primary.ytd-watch-flexy {
          max-width: 100% !important;
          width: 100% !important;
        }

        ytd-watch-flexy[flexy][is-two-columns_] #columns.ytd-watch-flexy {
          max-width: 1280px !important;
        }
      `);
    }

    if (settings.hideHomeFeed) {
      rules.push(`
        html[${HOME_FEED_ATTR}='true'] ytd-browse[page-subtype='home'] #primary {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 60vh;
        }

        html[${HOME_FEED_ATTR}='true'] ytd-browse[page-subtype='home'] #primary::before {
          content: "Focus Mode - Use the search bar";
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 32px auto;
          max-width: 720px;
          min-height: 160px;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 16px;
          color: var(--yt-spec-text-secondary, #aaa);
          background: rgba(255,255,255,.04);
          font: 500 20px "YouTube Sans", Roboto, Arial, sans-serif;
          padding: 0 32px;
          text-align: center;
        }

        html[${HOME_FEED_ATTR}='true'] ytd-browse[page-subtype='home'] {
          min-height: 320px !important;
        }
      `);
    }

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
    if (currentSettings.enabled && currentSettings.hideHomeFeed) {
      document.documentElement.setAttribute(HOME_FEED_ATTR, "true");
    } else {
      document.documentElement.removeAttribute(HOME_FEED_ATTR);
    }

    applyRouteRedirects();
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

  function isSearchPage() {
    return window.location.pathname === "/results";
  }

  function applyRouteRedirects() {
    if (!currentSettings.enabled) {
      return;
    }

    const path = window.location.pathname;
    const shouldRedirectExplore =
      currentSettings.hideExploreFeed &&
      (path === "/feed/trending" || path === "/feed/explore");
    const shouldRedirectSubscriptions =
      currentSettings.hideSubscriptions && path === "/feed/subscriptions";

    if (shouldRedirectExplore || shouldRedirectSubscriptions) {
      window.location.replace(YOUTUBE_HOME_URL);
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

    applyPlayerControls();
  }

  function clickCheckedControl(control) {
    if (!control) {
      return false;
    }

    const isChecked =
      control.getAttribute("aria-checked") === "true" ||
      control.getAttribute("aria-pressed") === "true";

    if (!isChecked) {
      return true;
    }

    control.click();
    return false;
  }

  function disableAutoplayControls(attempt = 0) {
    if (!currentSettings.enabled || !currentSettings.disableAutoplay) {
      return;
    }

    const controls = [
      ...safeQuerySelectorAll(".ytp-autonav-toggle-button"),
      ...safeQuerySelectorAll(".ytm-autonav-toggle-button-container"),
    ];
    const completed = controls.length
      ? controls.every(clickCheckedControl)
      : false;

    if (!completed && attempt < CONTROL_RETRY_LIMIT) {
      setTimeout(
        () => disableAutoplayControls(attempt + 1),
        CONTROL_RETRY_DELAY_MS,
      );
    }
  }

  function disableAnnotationControls(attempt = 0) {
    if (!currentSettings.enabled || !currentSettings.disableAnnotations) {
      return;
    }

    safeQuerySelectorAll(
      ".ytp-cards-teaser, .ytp-cards-button, .ytp-iv-video-content",
    ).forEach(hideElement);

    const settingsButtons = safeQuerySelectorAll(".ytp-settings-button");
    const settingsButton = settingsButtons[settingsButtons.length - 1];

    if (settingsButton) {
      settingsButton.click();
      settingsButton.click();
    }

    const checkboxItems = safeQuerySelectorAll(
      ".ytp-menuitem[role='menuitemcheckbox']",
    );
    const annotationItem = checkboxItems.find((item) => {
      const text = elementText(item);
      return (
        text.includes("annotation") ||
        text.includes("cards") ||
        text.includes("info cards")
      );
    });

    if (annotationItem) {
      clickCheckedControl(annotationItem);
      return;
    }

    if (attempt < CONTROL_RETRY_LIMIT) {
      setTimeout(
        () => disableAnnotationControls(attempt + 1),
        CONTROL_RETRY_DELAY_MS,
      );
    }
  }

  function applyPlayerControls() {
    disableAutoplayControls();
    disableAnnotationControls();
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
    window.addEventListener("yt-navigate-start", applyRouteRedirects, true);
    window.addEventListener(
      "popstate",
      () => {
        applyRouteRedirects();
        scheduleCleanup(true);
      },
      true,
    );
    window.addEventListener(
      "pageshow",
      () => {
        applyRouteRedirects();
        scheduleCleanup(true);
      },
      true,
    );
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
