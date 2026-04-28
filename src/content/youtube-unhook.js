(() => {
  "use strict";

  const STORAGE_KEY = "youtubeUnhookSettings";
  const STYLE_ID = "novatra-youtube-unhook-style";

  const defaultSettings = {
    enabled: true,
    hideHomeFeed: false,
    hideHomeHeader: true,
    hideVideoSidebar: true,
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
    hideRelatedSearches: true,
    hideExplore: false,
    hideExploreFeed: true,
    hideSubscriptions: false,
    hideNotifications: false,
    hideAutoplay: true,
    hideChips: false,
    hideAds: true,
  };

  let currentSettings = { ...defaultSettings };
  let routeObserver = null;
  let cleanupTimer = null;

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
        return result;
      }
    } catch {
      console.log("Unable To Get Storage Sync");
    }

    return new Promise((resolve) => {
      api.storage.sync.get(key, (items) => {
        resolve(items || {});
      });
    });
  }

  function createRule(enabled, selector) {
    if (!enabled) {
      return "";
    }

    return `${selector}{display:none!important;visibility:hidden!important;pointer-events:none!important;}`;
  }

  function buildStyles(settings) {
    if (!settings.enabled) {
      return "";
    }

    const rules = [
      createRule(
        settings.hideHomeFeed,
        [
          "ytd-browse[page-subtype='home'] ytd-rich-grid-renderer",
          "ytd-browse[page-subtype='home'] ytd-two-column-browse-results-renderer",
          "ytd-browse[page-subtype='home'] #contents",
          "ytd-browse[page-subtype='home'] ytd-continuation-item-renderer",
          "ytd-browse[page-subtype='home'] ytd-rich-section-list-renderer",
        ].join(","),
      ),

      createRule(
        settings.hideHomeHeader,
        [
          "ytd-browse[page-subtype='home'] #header",
          "ytd-browse[page-subtype='home'] .ytd-browse-chips-wrapper",
          "ytd-browse[page-subtype='home'] ytd-feed-filter-chip-bar-renderer",
          "ytd-browse[page-subtype='home'] #chips-wrapper",
        ].join(","),
      ),

      createRule(
        settings.hideVideoSidebar,
        [
          "ytd-watch-flexy #secondary",
          "ytd-watch-flexy #secondary-inner",
          "ytd-watch-flexy ytd-watch-next-secondary-results-renderer",
          "ytd-watch-flexy #related",
        ].join(","),
      ),

      settings.expandVideoPlayer && settings.hideVideoSidebar
        ? `
					ytd-watch-flexy[flexy][is-two-columns_] #primary.ytd-watch-flexy,
					ytd-watch-flexy[flexy] #primary.ytd-watch-flexy {
						max-width: 100% !important;
						width: 100% !important;
					}

					ytd-watch-flexy[flexy][is-two-columns_] #columns.ytd-watch-flexy {
						max-width: 1280px !important;
					}
				`
        : "",

      createRule(
        settings.hideRecommended && !settings.hideVideoSidebar,
        [
          "ytd-watch-flexy #secondary ytd-compact-video-renderer",
          "ytd-watch-flexy #secondary ytd-compact-movie-renderer",
          "ytd-watch-flexy #secondary ytd-compact-radio-renderer",
          "ytd-watch-flexy #secondary ytd-compact-station-renderer",
          "ytd-watch-flexy #secondary ytd-compact-promoted-video-renderer",
          "ytd-watch-flexy #secondary ytd-compact-video-renderer",
          "ytd-watch-flexy #secondary ytd-reel-shelf-renderer",
        ].join(","),
      ),

      createRule(
        settings.hideRecommendationShelves,
        [
          "ytd-rich-shelf-renderer",
          "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer)",
          "ytd-watch-flexy ytd-item-section-renderer:has(ytd-compact-video-renderer)",
        ].join(","),
      ),

      createRule(
        settings.hideLiveChat,
        [
          "ytd-live-chat-frame",
          "#chat",
          "#chat-container",
          "ytd-watch-flexy[is-two-columns_] #chat-container",
        ].join(","),
      ),

      createRule(
        settings.hidePlaylist,
        [
          "ytd-playlist-panel-renderer",
          "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-playlist']",
          "ytd-watch-flexy ytd-playlist-panel-renderer",
          "ytd-compact-playlist-renderer",
        ].join(","),
      ),

      createRule(
        settings.hideFundraiser,
        [
          "ytd-donation-shelf-renderer",
          "ytd-donation-unavailable-renderer",
          "ytd-compact-video-renderer ytd-thumbnail-overlay-bottom-panel-renderer",
          "ytd-watch-flexy ytd-fundraiser-renderer",
          "ytd-watch-flexy ytd-engagement-panel-section-list-renderer[target-id*='fundraiser']",
        ].join(","),
      ),

      createRule(
        settings.hideEndScreenFeed,
        [
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
        ].join(","),
      ),

      createRule(
        settings.hideEndScreenCards,
        [
          ".ytp-cards-button",
          ".ytp-cards-teaser",
          ".ytp-cards-teaser-box",
          ".ytp-cards-shelf",
          ".ytp-cards-card",
          ".ytp-ce-card",
          ".ytp-ce-card-border",
        ].join(","),
      ),

      createRule(
        settings.hideShorts,
        [
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
        ].join(","),
      ),

      createRule(
        settings.hideComments,
        [
          "ytd-comments",
          "#comments",
          "ytd-item-section-renderer#sections",
          "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-comments-section']",
        ].join(","),
      ),

      createRule(
        settings.hideMixes,
        [
          "ytd-radio-renderer",
          "ytd-compact-radio-renderer",
          "ytd-rich-item-renderer:has(a[href*='start_radio=1'])",
          "ytd-video-renderer:has(a[href*='start_radio=1'])",
          "ytd-compact-video-renderer:has(a[href*='start_radio=1'])",
          "ytd-playlist-renderer:has(a[href*='start_radio=1'])",
        ].join(","),
      ),

      createRule(
        settings.hideMerch,
        [
          "ytd-merch-shelf-renderer",
          "ytd-product-list-renderer",
          "ytd-product-renderer",
          "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-structured-description'] ytd-merch-shelf-renderer",
          "ytd-shopping-renderer",
          "ytd-watch-flexy ytd-action-companion-ad-renderer",
        ].join(","),
      ),

      createRule(
        settings.hideVideoInfo,
        [
          "ytd-watch-metadata",
          "#above-the-fold",
          "#primary-inner > #info",
          "#primary-inner > #meta",
          "ytd-video-primary-info-renderer",
          "ytd-video-secondary-info-renderer",
        ].join(","),
      ),

      createRule(
        settings.hideRelatedSearches,
        [
          "ytd-horizontal-card-list-renderer",
          "ytd-watch-flexy ytd-search-refinement-card-renderer",
          "ytd-search ytd-search-refinement-card-renderer",
          "ytd-feed-filter-chip-bar-renderer",
        ].join(","),
      ),

      createRule(
        settings.hideExplore,
        [
          "ytd-guide-entry-renderer a[title='Explore']",
          "ytd-guide-entry-renderer:has(a[title='Explore'])",
          "ytd-mini-guide-entry-renderer[aria-label='Explore']",
          "ytd-guide-section-renderer:has(a[href='/feed/explore'])",
        ].join(","),
      ),

      createRule(
        settings.hideExploreFeed,
        [
          "ytd-browse[page-subtype='trending'] #contents",
          "ytd-browse[page-subtype='trending'] ytd-section-list-renderer",
          "ytd-browse[page-subtype='explore'] #contents",
          "ytd-browse[page-subtype='explore'] ytd-section-list-renderer",
          "ytd-browse[page-subtype='channels'] #contents",
        ].join(","),
      ),

      createRule(
        settings.hideSubscriptions,
        [
          "ytd-guide-entry-renderer a[title='Subscriptions']",
          "ytd-guide-entry-renderer:has(a[title='Subscriptions'])",
          "ytd-mini-guide-entry-renderer[aria-label='Subscriptions']",
          "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-subscribed])",
        ].join(","),
      ),

      createRule(
        settings.hideNotifications,
        [
          "ytd-notification-topbar-button-renderer",
          "ytm-notification-button-renderer",
          "#notification-button",
        ].join(","),
      ),

      createRule(
        settings.hideAutoplay,
        [
          ".ytp-autonav-toggle-button-container",
          ".ytp-autonav-endscreen-button-container",
          "ytd-compact-autoplay-renderer",
        ].join(","),
      ),

      createRule(
        settings.hideChips,
        [
          "yt-chip-cloud-renderer",
          "ytd-feed-filter-chip-bar-renderer",
          "iron-selector#chips",
          "#chips-wrapper.ytd-feed-filter-chip-bar-renderer",
        ].join(","),
      ),

      createRule(
        settings.hideAds,
        [
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
        ].join(","),
      ),
    ];

    return `
			${rules.join("\n")}

			html[novatra-hide-home-feed='true'] ytd-browse[page-subtype='home'] #primary {
				display: flex;
				align-items: center;
				justify-content: center;
				min-height: 60vh;
			}

			html[novatra-hide-home-feed='true'] ytd-browse[page-subtype='home'] #primary::before {
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

			html[novatra-hide-home-feed='true'] ytd-browse[page-subtype='home'] {
				min-height: 320px !important;
			}
		`;
  }

  function applySettings(settings) {
    currentSettings = { ...defaultSettings, ...(settings || {}) };

    let styleElement = document.getElementById(STYLE_ID);

    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = STYLE_ID;
      styleElement.setAttribute("data-owner", "novatra-youtube-unhook");
      (document.head || document.documentElement).appendChild(styleElement);
    }

    styleElement.textContent = buildStyles(currentSettings);

    document.documentElement.toggleAttribute(
      "novatra-hide-home-feed",
      Boolean(currentSettings.enabled && currentSettings.hideHomeFeed),
    );

    scheduleCleanup();
  }

  function elementText(element) {
    return (element?.textContent || "").trim().toLowerCase();
  }

  function hideElement(element) {
    if (!element || element.dataset.novatraUnhookHidden === "true") {
      return;
    }

    element.dataset.novatraUnhookHidden = "true";
    element.style.setProperty("display", "none", "important");
    element.style.setProperty("visibility", "hidden", "important");
  }

  function cleanupByText() {
    if (!currentSettings.enabled) {
      return;
    }

    if (currentSettings.hideShorts) {
      document
        .querySelectorAll(
          "ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer",
        )
        .forEach((element) => {
          const text = elementText(element);
          const link = element.querySelector("a[href^='/shorts/']");

          if (link || text === "shorts") {
            hideElement(element);
          }
        });
    }

    if (currentSettings.hideMixes) {
      document
        .querySelectorAll(
          "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-playlist-renderer",
        )
        .forEach((element) => {
          const text = elementText(element);
          const radioLink = element.querySelector("a[href*='start_radio=1']");

          if (
            radioLink ||
            text.includes("mix - ") ||
            text.includes("youtube mix")
          ) {
            hideElement(element);
          }
        });
    }

    if (currentSettings.hideFundraiser) {
      document
        .querySelectorAll(
          "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-shelf-renderer",
        )
        .forEach((element) => {
          const text = elementText(element);

          if (text.includes("fundraiser") || text.includes("donate now")) {
            hideElement(element);
          }
        });
    }

    if (currentSettings.hideMerch) {
      document
        .querySelectorAll(
          "ytd-shelf-renderer, ytd-rich-section-renderer, ytd-engagement-panel-section-list-renderer",
        )
        .forEach((element) => {
          const text = elementText(element);

          if (
            text.includes("merch") ||
            text.includes("shop") ||
            text.includes("store")
          ) {
            hideElement(element);
          }
        });
    }
  }

  function scheduleCleanup() {
    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
    }

    cleanupTimer = setTimeout(() => {
      cleanupTimer = null;
      cleanupByText();
    }, 100);
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

    window.addEventListener("yt-navigate-finish", scheduleCleanup, true);
    window.addEventListener("yt-page-data-updated", scheduleCleanup, true);
    window.addEventListener("popstate", scheduleCleanup, true);
  }

  function init() {
    loadSettings();
    watchStorageChanges();
    watchYouTubeNavigation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
