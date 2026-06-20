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
const defaultUnhookSettings = {
  enabled: true,
  hideShorts: true,
};

const unhookOptions = [
  { key: "enabled", label: "Enable Shorts Blocker" },
  { key: "hideShorts", label: "Hide Shorts" },
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

function normalizeUnhookSettings(settings = {}) {
  const normalized = { ...defaultUnhookSettings };

  Object.keys(defaultUnhookSettings).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(settings, key)) {
      normalized[key] = Boolean(settings[key]);
    }
  });

  return normalized;
}

async function loadUnhookSettings() {
  const stored = await browser.storage.sync.get(UNHOOK_STORAGE_KEY);
  return normalizeUnhookSettings(stored[UNHOOK_STORAGE_KEY]);
}

async function saveUnhookSettings(settings) {
  const normalized = normalizeUnhookSettings(settings);
  await browser.storage.sync.set({ [UNHOOK_STORAGE_KEY]: normalized });
  await applyUnhookSettingsInActiveTab(normalized);
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

  const label = document.createElement("label");
  label.className =
    "flex cursor-pointer items-center justify-between gap-3 rounded-field px-2 py-2 hover:bg-base-200";

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
