import browser from "../lib/browser-api.js";
import blockerMessages from "../lib/blocker-messages.json";
import {
  SITE_BLOCKER_ALLOWANCES_KEY,
  SITE_BLOCKER_STORAGE_KEY,
  canUseAllowance,
  createAllowance,
  createHostnamePattern,
  getActiveAllowanceUntil,
  getUrlHostname,
  matchesBlockedUrl,
  normalizeSiteBlockerSettings,
  removeSiteMatchingUrl,
} from "../lib/blocker-settings.js";

let recheckTimer = null;
let lastCheckedUrl = "";
let overlayHost = null;

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)] || "";
}

function formatMessage(message, values = {}) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    message,
  );
}

function getCopy(key, values = {}) {
  return formatMessage(randomItem(blockerMessages[key] || []), values);
}

function clearRecheckTimer() {
  if (recheckTimer) {
    clearTimeout(recheckTimer);
    recheckTimer = null;
  }
}

function removeOverlay() {
  if (overlayHost) {
    overlayHost.remove();
    overlayHost = null;
  }
}

function setOverlayNote(message) {
  const note = getOverlayRoot()?.querySelector("#novatra-blocker-note");

  if (note) {
    note.textContent = message;
  }
}

function getOverlayRoot() {
  return overlayHost?.shadowRoot || null;
}

function createBlockerStylesheet() {
  const stylesheet = document.createElement("link");
  stylesheet.id = "novatra-blocker-styles";
  stylesheet.rel = "stylesheet";
  stylesheet.href = browser.runtime.getURL("blocker-settings.css");
  return stylesheet;
}

async function getAllowances() {
  const data = await browser.storage.sync.get(SITE_BLOCKER_ALLOWANCES_KEY);
  return data[SITE_BLOCKER_ALLOWANCES_KEY] || {};
}

async function getSettings() {
  const data = await browser.storage.sync.get(SITE_BLOCKER_STORAGE_KEY);
  return normalizeSiteBlockerSettings(data[SITE_BLOCKER_STORAGE_KEY]);
}

async function saveAllowances(allowances) {
  await browser.storage.sync.set({ [SITE_BLOCKER_ALLOWANCES_KEY]: allowances });
}

async function saveSettings(settings) {
  await browser.storage.sync.set({
    [SITE_BLOCKER_STORAGE_KEY]: normalizeSiteBlockerSettings(settings),
  });
}

async function allowFor(minutes, hostname) {
  const allowances = await getAllowances();

  if (!canUseAllowance(allowances, hostname, minutes)) {
    setOverlayNote(getCopy("allowUsed"));
    updateAllowanceButtons(allowances, hostname);
    return;
  }

  const nextAllowances = createAllowance(allowances, hostname, minutes);
  await saveAllowances(nextAllowances);
  removeOverlay();
  scheduleRecheck(getActiveAllowanceUntil(nextAllowances, hostname));
}

async function unblockSite(hostname) {
  const firstConfirm = window.confirm(
    getCopy("confirmFirst", { host: hostname }),
  );

  if (!firstConfirm) {
    setOverlayNote(getCopy("kept"));
    return;
  }

  const secondConfirm = window.confirm(
    getCopy("confirmSecond", { host: hostname }),
  );

  if (!secondConfirm) {
    setOverlayNote(getCopy("kept"));
    return;
  }

  const settings = await getSettings();
  const sites = removeSiteMatchingUrl(settings.sites, window.location.href);
  await saveSettings({
    ...settings,
    sites,
    patterns: sites.map(createHostnamePattern),
  });
  setOverlayNote(getCopy("unblocked", { host: hostname }));
  removeOverlay();
}

function updateAllowanceButtons(allowances, hostname) {
  getOverlayRoot()
    ?.querySelectorAll("[data-allow-minutes]")
    .forEach((button) => {
      const minutes = Number(button.dataset.allowMinutes);
      button.disabled = !canUseAllowance(allowances, hostname, minutes);
    });
}

function createBlockerButton({ className, id, minutes, text }) {
  const button = document.createElement("button");
  button.className = className;
  button.type = "button";
  button.textContent = text;

  if (id) {
    button.id = id;
  }

  if (minutes) {
    button.dataset.allowMinutes = String(minutes);
  }

  return button;
}

function createOverlayCard(hostname) {
  const card = document.createElement("div");
  card.className =
    "card w-full max-w-sm border border-base-300 bg-base-100 text-base-content shadow-xl";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  card.setAttribute("aria-labelledby", "novatra-blocker-title");

  const body = document.createElement("div");
  body.className = "card-body gap-5 p-6 text-center";

  const title = document.createElement("h1");
  title.id = "novatra-blocker-title";
  title.className = "text-xl font-bold";
  title.textContent = "Site Blocked";

  const badge = document.createElement("div");
  badge.className =
    "badge badge-primary mx-auto max-w-full truncate font-semibold";
  badge.textContent = hostname;

  const message = document.createElement("p");
  message.className = "mx-auto max-w-xs text-sm leading-7 text-base-content/70";
  message.textContent = getCopy("messages", { host: hostname });

  const allowanceGrid = document.createElement("div");
  allowanceGrid.className = "grid w-full grid-cols-3 gap-2";
  allowanceGrid.append(
    createBlockerButton({
      className: "btn btn-primary btn-sm",
      minutes: 1,
      text: "1 min",
    }),
    createBlockerButton({
      className: "btn btn-primary btn-sm",
      minutes: 10,
      text: "10 min",
    }),
    createBlockerButton({
      className: "btn btn-primary btn-sm",
      minutes: 20,
      text: "20 min",
    }),
  );

  const divider = document.createElement("div");
  divider.className = "divider my-0 text-xs text-base-content/40";
  divider.textContent = "or";

  const unblockButton = createBlockerButton({
    className: "btn btn-outline btn-error btn-sm",
    id: "novatra-unblock-site",
    text: "Unblock",
  });

  const note = document.createElement("div");
  note.id = "novatra-blocker-note";
  note.className = "min-h-5 text-sm text-base-content/60";
  note.setAttribute("aria-live", "polite");

  body.append(
    title,
    badge,
    message,
    allowanceGrid,
    divider,
    unblockButton,
    note,
  );
  card.append(body);
  return card;
}

function createOverlayFrame(hostname) {
  const frame = document.createElement("div");
  frame.dataset.theme = "dark";
  frame.className =
    "grid min-h-screen place-items-center overflow-y-auto bg-base-200 p-4 text-base-content sm:p-6";
  frame.append(createOverlayCard(hostname));
  return frame;
}

async function showOverlay(hostname) {
  if (!document.documentElement) {
    return;
  }

  if (overlayHost) {
    return;
  }

  const allowances = await getAllowances();
  overlayHost = document.createElement("novatra-site-blocker");
  overlayHost.style.position = "fixed";
  overlayHost.style.inset = "0";
  overlayHost.style.zIndex = "2147483647";
  overlayHost.style.display = "block";
  overlayHost.style.width = "100vw";
  overlayHost.style.height = "100vh";

  const overlayRoot = overlayHost.attachShadow({ mode: "open" });
  overlayRoot.append(createBlockerStylesheet(), createOverlayFrame(hostname));

  document.documentElement.append(overlayHost);
  updateAllowanceButtons(allowances, hostname);

  overlayRoot.querySelectorAll("[data-allow-minutes]").forEach((button) => {
    button.addEventListener("click", () => {
      allowFor(Number(button.dataset.allowMinutes), hostname).catch((error) => {
        console.error("Failed to create site allowance:", error);
        setOverlayNote("Button broke. The block did not. Awkward.");
      });
    });
  });

  overlayRoot
    .querySelector("#novatra-unblock-site")
    ?.addEventListener("click", () => {
      unblockSite(hostname).catch((error) => {
        console.error("Failed to unblock site:", error);
        setOverlayNote("Could not unblock it. Maybe the universe is helping.");
      });
    });
}

function scheduleRecheck(allowedUntil) {
  clearRecheckTimer();

  const delay = Math.max(
    250,
    Math.min(allowedUntil - Date.now() + 250, 2 ** 31 - 1),
  );
  recheckTimer = setTimeout(() => {
    applySiteBlocker().catch((error) => {
      console.error("Site blocker recheck failed:", error);
    });
  }, delay);
}

async function applySiteBlocker() {
  if (!window.location.protocol.startsWith("http")) {
    return;
  }

  const settings = await getSettings();
  const allowances = await getAllowances();
  const hostname = getUrlHostname(window.location.href);
  const isBlocked = matchesBlockedUrl(window.location.href, settings);
  const allowedUntil = getActiveAllowanceUntil(allowances, hostname);

  if (isBlocked && !allowedUntil) {
    await showOverlay(hostname);
    return;
  }

  if (isBlocked && allowedUntil) {
    removeOverlay();
    scheduleRecheck(allowedUntil);
    return;
  }

  removeOverlay();
  clearRecheckTimer();
}

function handleUrlChange() {
  if (window.location.href === lastCheckedUrl) {
    return;
  }

  lastCheckedUrl = window.location.href;
  applySiteBlocker().catch((error) => {
    console.error("Site blocker URL check failed:", error);
  });
}

function watchHistoryChanges() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    queueMicrotask(handleUrlChange);
    return result;
  };

  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    queueMicrotask(handleUrlChange);
    return result;
  };

  window.addEventListener("popstate", handleUrlChange);
  window.addEventListener("hashchange", handleUrlChange);
}

function watchBlockerStorage() {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === "sync" &&
      (changes[SITE_BLOCKER_STORAGE_KEY] ||
        changes[SITE_BLOCKER_ALLOWANCES_KEY])
    ) {
      applySiteBlocker().catch((error) => {
        console.error("Site blocker storage check failed:", error);
      });
    }
  });
}

function watchRuntimeMessages() {
  browser.runtime.onMessage.addListener((message) => {
    if (message?.action === "siteBlockerRecheck") {
      applySiteBlocker().catch((error) => {
        console.error("Site blocker message check failed:", error);
      });
    }
  });
}

applySiteBlocker().catch((error) => {
  console.error("Site blocker failed:", error);
});
watchHistoryChanges();
watchBlockerStorage();
watchRuntimeMessages();
