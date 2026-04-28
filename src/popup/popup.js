import browser from "../lib/browser-api.js";
import {getTimeRemaining, getCustomExamData, hasValidCustomExam, loadCustomExamData} from "../lib/countdown.js";

const UNHOOK_STORAGE_KEY = "youtubeUnhookSettings";

const defaultUnhookSettings = {
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

const unhookOptions = [
	{type: "heading", label: "Master"},
	{key: "enabled", label: "Enable Unhook YT"},
	{type: "heading", label: "Home"},
	{key: "hideHomeFeed", label: "Hide home feed"},
	{key: "hideHomeHeader", label: "Hide home header and chips"},
	{key: "hideRecommendationShelves", label: "Hide recommendation shelves"},
	{key: "hideChips", label: "Hide topic chips"},
	{type: "heading", label: "Watch page"},
	{key: "hideVideoSidebar", label: "Hide video sidebar"},
	{key: "expandVideoPlayer", label: "Expand player width", nested: true},
	{key: "hideRecommended", label: "Hide recommended videos", nested: true},
	{key: "hideLiveChat", label: "Hide live chat", nested: true},
	{key: "hidePlaylist", label: "Hide playlists", nested: true},
	{key: "hideAutoplay", label: "Hide autoplay", nested: true},
	{key: "hideVideoInfo", label: "Hide video info", nested: true},
	{key: "hideComments", label: "Hide comments"},
	{type: "heading", label: "Suggestions"},
	{key: "hideEndScreenFeed", label: "Hide end screen suggestions"},
	{key: "hideEndScreenCards", label: "Hide end screen cards"},
	{key: "hideShorts", label: "Hide Shorts"},
	{key: "hideMixes", label: "Hide mixes"},
	{key: "hideRelatedSearches", label: "Hide related searches"},
	{type: "heading", label: "Navigation and promos"},
	{key: "hideExplore", label: "Hide Explore links"},
	{key: "hideExploreFeed", label: "Hide Explore and Trending feeds"},
	{key: "hideSubscriptions", label: "Hide subscriptions"},
	{key: "hideNotifications", label: "Hide notifications"},
	{key: "hideFundraiser", label: "Hide fundraisers"},
	{key: "hideMerch", label: "Hide merch, tickets, offers"},
	{key: "hideAds", label: "Hide ads and promos"},
];

async function updateCountdown() {
	const storedData = await browser.storage.sync.get("countdowns");
	const countdowns = storedData.countdowns || {};

	const jeeExamDate = countdowns.jee?.date ? new Date(countdowns.jee.date) : new Date(2026, 0, 29);
	const neetExamDate = countdowns.neet?.date ? new Date(countdowns.neet.date) : new Date(2026, 4, 4);
	const jeeAdvExamDate = countdowns.jeeAdv?.date ? new Date(countdowns.jeeAdv.date) : new Date(2027, 4, 18);

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
		timerElement.innerHTML = "<p class=\"font-medium text-success\">Exam day has arrived!</p>";
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
	browser.storage.sync.set({theme: newTheme}).catch((error) => {
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
	return {...defaultUnhookSettings, ...(stored[UNHOOK_STORAGE_KEY] || {})};
}

async function saveUnhookSettings(settings) {
	await browser.storage.sync.set({[UNHOOK_STORAGE_KEY]: settings});
}

function createToggleRow(option, settings) {
	if (option.type === "heading") {
		const heading = document.createElement("div");
		heading.className = "pt-3 pb-1 text-xs font-semibold uppercase tracking-wide opacity-60 first:pt-0";
		heading.textContent = option.label;
		return heading;
	}

	const label = document.createElement("label");
	label.className = "flex items-center justify-between gap-3 rounded-field px-2 py-2 cursor-pointer hover:bg-base-200" + (option.nested ? " ml-4 border-l border-base-300 pl-3" : "");

	const text = document.createElement("span");
	text.textContent = option.label;

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
	list.replaceChildren(...unhookOptions.map((option) => createToggleRow(option, settings)));
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
	});
}

function setupUnhookReset() {
	const resetButton = document.getElementById("reset-unhook-settings");
	if (!resetButton) {
		return;
	}

	resetButton.addEventListener("click", async () => {
		await saveUnhookSettings({...defaultUnhookSettings});
		await renderUnhookSettings();
	});
}

document.addEventListener("DOMContentLoaded", function () {
	updateCountdown();
	loadThemePreference();
	setupTabs();
	setupUnhookSettingsList();
	renderUnhookSettings();
	setupUnhookReset();
	setInterval(updateCountdown, 1000);

	const themeToggle = document.getElementById("theme-toggle");
	if (themeToggle) {
		themeToggle.addEventListener("click", toggleTheme);
	}
});
