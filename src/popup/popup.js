import browser from "../lib/browser-api.js";
import {
  getTimeRemaining,
  getCustomExamData,
  hasValidCustomExam,
  loadCustomExamData,
} from "../lib/countdown.js";
import {
  SITE_BLOCKER_STORAGE_KEY,
  getUrlHostname,
  matchesBlockedUrl,
  normalizeSiteBlockerSettings,
  removeSiteMatchingUrl,
} from "../lib/blocker-settings.js";

const UNHOOK_STORAGE_KEY = "youtubeUnhookSettings";
const SIDEBAR_CHILD_SETTING_KEYS = [
  "hideRecommended",
  "hideLiveChat",
  "hidePlaylist",
  "hideAutoplay",
];

const defaultUnhookSettings = {
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

const unhookOptions = [
  { type: "heading", label: "Master" },
  { key: "enabled", label: "Enable Unhook YT" },
  { type: "heading", label: "Home" },
  { key: "hideHomeFeed", label: "Hide Home Feed" },
  { key: "hideHomeHeader", label: "Hide Home Header and Chips" },
  { key: "hideChips", label: "Hide Topic Chips" },
  { type: "heading", label: "Header" },
  { key: "hideTopHeader", label: "Hide Top Header" },
  { key: "hideNotifications", label: "Hide Notification Bell", nested: true },
  { type: "heading", label: "Watch Page" },
  {
    key: "hideVideoSidebar",
    label: "Hide Entire Video Sidebar",
  },
  {
    key: "expandVideoPlayer",
    label: "Expand player width",
    nested: true,
    disabledWhen: "hideVideoSidebarOff",
  },
  {
    key: "hideRecommended",
    label: "Hide Recommended Videos",
    nested: true,
  },
  {
    key: "hideLiveChat",
    label: "Hide Live Chat",
    nested: true,
  },
  {
    key: "hidePlaylist",
    label: "Hide Playlists",
    nested: true,
  },
  {
    key: "hideAutoplay",
    label: "Hide autoplay controls",
    nested: true,
  },
  {
    key: "disableAutoplay",
    label: "Disable autoplay",
    nested: true,
  },
  { key: "hideVideoInfo", label: "Hide video info" },
  {
    key: "hideVideoButtonsBar",
    label: "Hide video buttons bar",
    nested: true,
    disabledWhen: "hideVideoInfoOn",
  },
  {
    key: "hideChannel",
    label: "Hide channel and subscribe button",
    nested: true,
    disabledWhen: "hideVideoInfoOn",
  },
  {
    key: "hideDescription",
    label: "Hide video description",
    nested: true,
    disabledWhen: "hideVideoInfoOn",
  },
  { key: "hideComments", label: "Hide comments" },
  { type: "heading", label: "Suggestions" },
  { key: "hideEndScreenFeed", label: "Hide end screen videowall" },
  { key: "hideEndScreenCards", label: "Hide end screen cards" },
  { key: "hideShorts", label: "Hide Shorts" },
  { key: "hideMixes", label: "Hide Mix radio playlists" },
  { key: "disableAnnotations", label: "Disable annotations" },
  { key: "hideRelatedSearches", label: "Hide irrelevant search results" },
  { type: "heading", label: "Navigation and promos" },
  { key: "hideExplore", label: "Hide Explore links" },
  { key: "hideExploreFeed", label: "Hide and redirect Explore/Trending" },
  { key: "hideSubscriptions", label: "Hide and redirect Subscriptions" },
  { key: "hideFundraiser", label: "Hide fundraisers and donations" },
  { key: "hideMerch", label: "Hide merch, tickets, offers" },
  { key: "hideRecommendationShelves", label: "Hide More from YouTube" },
  { key: "hideAds", label: "Hide ads and promos" },
];

async function updateCountdown() {
  const storedData = await browser.storage.sync.get("countdowns");
  const countdowns = storedData.countdowns || {};

  const jeeExamDate = countdowns.jee?.date
    ? new Date(countdowns.jee.date)
    : new Date(2026, 0, 29);
  const neetExamDate = countdowns.neet?.date
    ? new Date(countdowns.neet.date)
    : new Date(2026, 4, 4);
  const jeeAdvExamDate = countdowns.jeeAdv?.date
    ? new Date(countdowns.jeeAdv.date)
    : new Date(2027, 4, 18);

  await loadCustomExamData();

  updateTimer("jee", getTimeRemaining(jeeExamDate));
  updateTimer("jee-adv", getTimeRemaining(jeeAdvExamDate));
  updateTimer("neet", getTimeRemaining(neetExamDate));

  if (hasValidCustomExam()) {
    const customExamSection = document.getElementById("custom-exam-section");
    if (customExamSection) {
      customExamSection.classList.remove("hidden");
    }

    const customExam = getCustomExamData();
    const customExamBadge = document.getElementById("custom-exam-badge");
    if (customExamBadge) {
      customExamBadge.textContent = customExam.name;
    }

    updateTimer("custom-exam", getTimeRemaining(customExam.date));
  } else {
    const customExamSection = document.getElementById("custom-exam-section");
    if (customExamSection) {
      customExamSection.classList.add("hidden");
    }
  }
}

function updateTimer(prefix, time) {
  const timerElement = document.getElementById(prefix + "-timer");
  if (!timerElement) {
    return;
  }

  if (time.total <= 0) {
    timerElement.innerHTML =
      '<p class="font-medium text-success">Exam day has arrived!</p>';
    return;
  }

  setCountdownValue(prefix + "-months", time.month);
  setCountdownValue(prefix + "-days", time.days);
  setCountdownValue(prefix + "-hours", time.hours);
  setCountdownValue(prefix + "-minutes", time.minutes);
  setCountdownValue(prefix + "-seconds", time.seconds);
}

function setCountdownValue(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) {
    element.style = "--value:" + value;
  }
}

function loadThemePreference() {
  browser.storage.sync.get(["theme"]).then((data) => {
    if (data.theme) {
      document.documentElement.dataset.theme = data.theme;
    }
  });
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme;
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = newTheme;
  browser.storage.sync.set({ theme: newTheme }).catch((error) => {
    console.error("Error saving theme preference:", error);
  });
}

function setActiveTab(tabName) {
  document.querySelectorAll("[data-popup-tab]").forEach((tab) => {
    const isActive = tab.dataset.popupTab === tabName;
    tab.classList.toggle("tab-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  document.querySelectorAll("[data-popup-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.popupPanel !== tabName);
  });
}

function setupTabs() {
  document.querySelectorAll("[data-popup-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab.dataset.popupTab);
    });
  });
}

async function loadUnhookSettings() {
  const stored = await browser.storage.sync.get(UNHOOK_STORAGE_KEY);
  const settings = {
    ...defaultUnhookSettings,
    ...(stored[UNHOOK_STORAGE_KEY] || {}),
  };

  if (
    Object.prototype.hasOwnProperty.call(settings, "hideAutoplay") &&
    !Object.prototype.hasOwnProperty.call(
      stored[UNHOOK_STORAGE_KEY] || {},
      "disableAutoplay",
    )
  ) {
    settings.disableAutoplay = Boolean(settings.hideAutoplay);
  }

  return settings;
}

async function saveUnhookSettings(settings) {
  await browser.storage.sync.set({ [UNHOOK_STORAGE_KEY]: settings });
  await applyUnhookSettingsInActiveTab(settings);
}

function isYouTubeUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "www.youtube.com" || hostname === "m.youtube.com";
  } catch {
    return false;
  }
}

async function applyUnhookSettingsInActiveTab(settings) {
  const tab = await getActiveTab();

  if (!tab?.id || !isYouTubeUrl(tab.url || "")) {
    return;
  }

  try {
    await browser.tabs.sendMessage(tab.id, {
      action: "youtubeUnhookApplySettings",
      settings,
    });
  } catch {}
}

function createToggleRow(option, settings) {
  if (option.type === "heading") {
    const heading = document.createElement("div");
    heading.className =
      "pt-3 pb-1 text-xs font-semibold uppercase tracking-wide opacity-60 first:pt-0";
    heading.textContent = option.label;
    return heading;
  }

  const isDisabled =
    option.disabledWhen === "hideVideoSidebarOff"
      ? !settings.hideVideoSidebar
      : option.disabledWhen === "hideVideoInfoOn"
        ? settings.hideVideoInfo
        : false;

  const label = document.createElement("label");
  label.className =
    "flex items-center justify-between gap-3 rounded-field px-2 py-2 hover:bg-base-200" +
    (option.nested ? " ml-4 border-l border-base-300 pl-3" : "") +
    (isDisabled ? " cursor-not-allowed opacity-45" : " cursor-pointer");

  const text = document.createElement("span");
  text.className = "flex min-w-0 flex-col";

  const title = document.createElement("span");
  title.textContent = option.label;
  text.append(title);

  if (option.description) {
    const description = document.createElement("span");
    description.className = "text-xs leading-tight opacity-60";
    description.textContent = option.description;
    text.append(description);
  }

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "toggle toggle-primary toggle-sm";
  input.dataset.unhookSetting = option.key;
  input.checked = Boolean(settings[option.key]);
  input.disabled = isDisabled;

  label.append(text, input);
  return label;
}

async function renderUnhookSettings() {
  const list = document.getElementById("unhook-settings-list");
  if (!list) {
    return;
  }

  const settings = await loadUnhookSettings();
  list.replaceChildren(
    ...unhookOptions.map((option) => createToggleRow(option, settings)),
  );
}

function setupUnhookSettingsList() {
  const list = document.getElementById("unhook-settings-list");
  if (!list) {
    return;
  }

  list.addEventListener("change", async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.unhookSetting) {
      return;
    }

    const nextSettings = await loadUnhookSettings();
    nextSettings[input.dataset.unhookSetting] = input.checked;

    if (input.dataset.unhookSetting === "hideVideoSidebar") {
      SIDEBAR_CHILD_SETTING_KEYS.forEach((key) => {
        nextSettings[key] = input.checked;
      });
    }

    await saveUnhookSettings(nextSettings);
    await renderUnhookSettings();
  });
}

function setupUnhookReset() {
  const resetButton = document.getElementById("reset-unhook-settings");
  if (!resetButton) {
    return;
  }

  resetButton.addEventListener("click", async () => {
    await saveUnhookSettings({ ...defaultUnhookSettings });
    await renderUnhookSettings();
  });
}

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return Array.isArray(tabs) ? tabs[0] : null;
}

async function loadSiteBlockerSettings() {
  const stored = await browser.storage.sync.get(SITE_BLOCKER_STORAGE_KEY);
  return normalizeSiteBlockerSettings(stored[SITE_BLOCKER_STORAGE_KEY]);
}

async function saveSiteBlockerSettings(settings) {
  await browser.storage.sync.set({
    [SITE_BLOCKER_STORAGE_KEY]: normalizeSiteBlockerSettings(settings),
  });
}

async function recheckSiteBlockerInTab(tabId) {
  if (!Number.isInteger(tabId) || tabId < 0) {
    return;
  }

  try {
    await browser.tabs.sendMessage(tabId, { action: "siteBlockerRecheck" });
  } catch {}
}

async function renderCurrentSiteBlocker() {
  const status = document.getElementById("site-blocker-status");
  const hostnameLabel = document.getElementById("site-blocker-hostname");
  const badge = document.getElementById("site-blocker-badge");
  const countLabel = document.getElementById("site-blocker-count");
  const masterToggle = document.getElementById("site-blocker-master-toggle");
  const toggleButton = document.getElementById("site-blocker-toggle");

  if (
    !status ||
    !hostnameLabel ||
    !badge ||
    !countLabel ||
    !masterToggle ||
    !toggleButton
  ) {
    return;
  }

  const tab = await getActiveTab();
  const url = tab?.url || "";
  const hostname = getUrlHostname(url);
  const settings = await loadSiteBlockerSettings();

  masterToggle.checked = settings.enabled;
  masterToggle.dataset.tabId = String(tab?.id || "");
  countLabel.textContent = formatSiteCount(settings.sites.length);

  if (!hostname) {
    hostnameLabel.textContent = "No website tab";
    status.textContent = "Open a website tab.";
    badge.textContent = "Unavailable";
    badge.className = "badge badge-ghost badge-sm";
    toggleButton.disabled = true;
    toggleButton.checked = false;
    return;
  }

  const isSiteListed = matchesBlockedUrl(url, { ...settings, enabled: true });

  hostnameLabel.textContent = hostname;
  status.textContent = settings.enabled ? "" : "Paused";
  badge.textContent = settings.enabled
    ? isSiteListed
      ? "Blocked"
      : "Allowed"
    : "Off";
  badge.className =
    settings.enabled && isSiteListed
      ? "badge badge-primary badge-sm"
      : "badge badge-ghost badge-sm";
  toggleButton.disabled = false;
  toggleButton.checked = isSiteListed;
  toggleButton.dataset.siteUrl = url;
  toggleButton.dataset.siteHostname = hostname;
  toggleButton.dataset.tabId = String(tab.id || "");
  toggleButton.dataset.siteBlocked = String(isSiteListed);
}

function setupSiteBlockerMasterToggle() {
  const masterToggle = document.getElementById("site-blocker-master-toggle");

  if (!masterToggle) {
    return;
  }

  masterToggle.addEventListener("change", async () => {
    const tabId = Number(masterToggle.dataset.tabId);
    const settings = await loadSiteBlockerSettings();

    await saveSiteBlockerSettings({
      ...settings,
      enabled: masterToggle.checked,
    });

    await recheckSiteBlockerInTab(tabId);
    await renderCurrentSiteBlocker();
  });
}

function setupSiteBlockerToggle() {
  const toggleButton = document.getElementById("site-blocker-toggle");

  if (!toggleButton) {
    return;
  }

  toggleButton.addEventListener("change", async () => {
    const url = toggleButton.dataset.siteUrl;
    const hostname = toggleButton.dataset.siteHostname;
    const tabId = Number(toggleButton.dataset.tabId);

    if (!url || !hostname) {
      return;
    }

    const settings = await loadSiteBlockerSettings();
    const isBlocked = matchesBlockedUrl(url, { ...settings, enabled: true });
    const site = hostname.toLowerCase().replace(/^www\./, "");
    const sites = isBlocked
      ? removeSiteMatchingUrl(settings.sites, url)
      : [...settings.sites, site];

    await saveSiteBlockerSettings({
      ...settings,
      sites,
    });

    await recheckSiteBlockerInTab(tabId);
    await renderCurrentSiteBlocker();
  });
}

function formatSiteCount(count) {
  return `${count} blocked ${count === 1 ? "site" : "sites"}`;
}

document.addEventListener("DOMContentLoaded", function () {
  updateCountdown();
  loadThemePreference();
  setupTabs();
  setupUnhookSettingsList();
  renderUnhookSettings();
  setupUnhookReset();
  setupSiteBlockerMasterToggle();
  setupSiteBlockerToggle();
  renderCurrentSiteBlocker();
  setInterval(updateCountdown, 1000);

  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }
});
