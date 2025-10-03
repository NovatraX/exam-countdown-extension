import browser from "webextension-polyfill";

let customExamName = "Custom Exam";
let customExamDate = null;

let wallpapersList = [];
let customWallpaper = "";
let backgroundBrightness = 0.4;
let currentWallpaperIndex = -1;
let wallpaperRotationPaused = false;

let currentExam = "jeeAdv";

const backgrounds = [
	"https://www.ghibli.jp/gallery/kimitachi016.jpg",
	"https://www.ghibli.jp/gallery/redturtle024.jpg",
	"https://www.ghibli.jp/gallery/marnie022.jpg",
	"https://www.ghibli.jp/gallery/kazetachinu050.jpg",
];

const fallbackMotivationalQuotes = [
	{ content: "The best way to predict the future is to create it.", author: "Abraham Lincoln" },
	{ content: "Success is not final, failure is not fatal: It is the courage to continue that counts.", author: "Winston Churchill" },
	{ content: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
	{ content: "It always seems impossible until it's done.", author: "Nelson Mandela" },
	{ content: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
	{ content: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
	{ content: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
	{ content: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
	{ content: "The more that you read, the more things you will know. The more that you learn, the more places you'll go.", author: "Dr. Seuss" },
	{ content: "Your time is limited, don't waste it living someone else's life.", author: "Steve Jobs" },
	{ content: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
	{ content: "The expert in anything was once a beginner.", author: "Helen Hayes" },
	{ content: "The secret of getting ahead is getting started.", author: "Mark Twain" },
	{ content: "Learning is never done without errors and defeat.", author: "Vladimir Lenin" },
	{ content: "The only place where success comes before work is in the dictionary.", author: "Vidal Sassoon" },
];

// ================= Custom Exam =================
async function loadCustomExamData() {
	if (!browser?.storage?.sync) return;

	try {
		const data = await browser.storage.sync.get(["customExamName", "customExamDate"]);
		if (data.customExamName) customExamName = data.customExamName;
		if (data.customExamDate) customExamDate = new Date(data.customExamDate);
	} catch (error) {
		console.error("Error loading custom exam data:", error);
	}
}

function saveCustomExamData(name, date) {
	if (!browser?.storage?.sync) return false;

	customExamName = name || "Custom Exam";
	customExamDate = date;

	try {
		browser.storage.sync.set({
			customExamName,
			customExamDate: customExamDate?.getTime() || null,
		});
		return true;
	} catch (error) {
		console.error("Error saving custom exam data:", error);
		return false;
	}
}

function getCustomExamData() {
	return { name: customExamName, date: customExamDate };
}

function hasValidCustomExam() {
	return customExamDate && !isNaN(customExamDate.getTime());
}

// ================= Countdown Timer =================
function getTimeRemaining(endDate, showSeconds = true) {
	const total = endDate - new Date();

	const month = Math.floor(total / (1000 * 60 * 60 * 24 * 30));
	const days = Math.floor((total % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));
	const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));

	let result = { total, month, days, hours, minutes };

	if (showSeconds) {
		result.seconds = Math.floor((total % (1000 * 60)) / 1000);
	}

	return result;
}

// ================= Wallpapers =================
async function loadWallpapers() {
	if (wallpapersList.length > 0) return;

	if (!browser?.storage?.sync) {
		wallpapersList = backgrounds;
		return;
	}

	try {
		const storedData = await browser.storage.sync.get("wallpapers");
		wallpapersList = Array.isArray(storedData.wallpapers) && storedData.wallpapers.length > 0 ? storedData.wallpapers : backgrounds;
	} catch (error) {
		console.warn("Failed to load wallpapers, using fallback:", error);
		wallpapersList = backgrounds;
	}
}

function preloadAndSetBackground(url) {
	const backgroundElement = document.querySelector(".background");
	if (!backgroundElement) return;

	const img = new Image();
	img.src = url;

	img.onload = () => {
		backgroundElement.style.opacity = 0;
		setTimeout(() => {
			backgroundElement.style.backgroundImage = `url(${url})`;
			backgroundElement.style.opacity = 1;
			document.documentElement.style.setProperty("--bg-brightness", backgroundBrightness);
		}, 300);
	};
}

function changeWallpaper(direction = "random") {
	if (!wallpapersList.length) return;

	const backgroundElement = document.querySelector(".background");
	if (!backgroundElement) return;

	if (direction === "next") {
		currentWallpaperIndex = (currentWallpaperIndex + 1) % wallpapersList.length;
	} else if (direction === "prev") {
		currentWallpaperIndex = (currentWallpaperIndex - 1 + wallpapersList.length) % wallpapersList.length;
	} else {
		let newIndex;
		do {
			newIndex = Math.floor(Math.random() * wallpapersList.length);
		} while (wallpapersList.length > 1 && newIndex === currentWallpaperIndex);
		currentWallpaperIndex = newIndex;
	}

	const url = wallpapersList[currentWallpaperIndex];
	preloadAndSetBackground(url);

	if (browser?.storage?.sync && wallpaperRotationPaused) {
		browser.storage.sync.set({ wallpaperIndex: currentWallpaperIndex });
	}
}

async function setBackground() {
	if (customWallpaper) {
		preloadAndSetBackground(customWallpaper);
		return;
	}

	await loadWallpapers();

	if (wallpaperRotationPaused && currentWallpaperIndex >= 0) {
		preloadAndSetBackground(wallpapersList[currentWallpaperIndex]);
	} else {
		changeWallpaper("random");
	}
}

// ================= Exam Handling =================
async function setDefaultExam() {
	try {
		const data = await browser.storage.sync.get("exams");
		if (Array.isArray(data.exams)) {
			const defaultExam = data.exams.find(e => e.default);
			if (defaultExam) currentExam = defaultExam.name;
		}
	} catch (error) {
		console.error("Error setting default exam:", error);
	}
}

function setActiveExam(exam) {
	currentExam = exam;
	updateCountdown();
	updateNovatraLink(exam);
	browser?.storage?.sync?.set({ activeExam: exam });
}

// ================= Countdown Display =================
async function updateCountdown() {
	const countdownDays = document.getElementById("countdown-days");
	const countdownHours = document.getElementById("countdown-hours");
	const countdownMonths = document.getElementById("countdown-months");
	const countdownMinutes = document.getElementById("countdown-minutes");
	const countdownSeconds = document.getElementById("countdown-seconds");
	const countdownLabel = document.getElementById("countdown-label");
	const examBadge = document.getElementById("exam-badge");
	const toggleSeconds = document.getElementById("toggle-seconds");
	const showSeconds = toggleSeconds?.checked ?? true;

	if (!countdownDays || !countdownHours || !countdownMonths || !countdownMinutes || !countdownSeconds || !countdownLabel) return;

	const storedData = await browser.storage.sync.get("countdowns");

	const defaultDates = {
		jee: new Date(2026, 0, 29),
		neet: new Date(2026, 4, 4),
		jeeAdv: new Date(2026, 4, 18),
	};

	const jeeExamDate = storedData.countdowns?.jee?.date ? new Date(storedData.countdowns.jee.date) : defaultDates.jee;
	const neetExamDate = storedData.countdowns?.neet?.date ? new Date(storedData.countdowns.neet.date) : defaultDates.neet;
	const jeeAdvExamDate = storedData.countdowns?.jeeAdv?.date ? new Date(storedData.countdowns.jeeAdv.date) : defaultDates.jeeAdv;

	let timeRemaining, examName;

	switch (currentExam) {
		case "jee":
			timeRemaining = getTimeRemaining(jeeExamDate, showSeconds);
			examName = "JEE Main";
			break;
		case "neet":
			timeRemaining = getTimeRemaining(neetExamDate, showSeconds);
			examName = "NEET";
			break;
		case "jeeAdv":
			timeRemaining = getTimeRemaining(jeeAdvExamDate, showSeconds);
			examName = "JEE Advanced";
			break;
		case "custom":
			if (hasValidCustomExam()) {
				const custom = getCustomExamData();
				timeRemaining = getTimeRemaining(custom.date, showSeconds);
				examName = custom.name;
			} else {
				timeRemaining = { total: 0, month: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
				examName = "Custom Exam";
			}
			break;
	}

	if (examBadge) examBadge.textContent = examName;

	countdownMonths.style = `--value:${timeRemaining.month}`;
	countdownDays.style = `--value:${timeRemaining.days}`;
	countdownHours.style = `--value:${timeRemaining.hours}`;
	countdownMinutes.style = `--value:${timeRemaining.minutes}`;
	countdownSeconds.style = `--value:${timeRemaining.seconds}`;

	if (timeRemaining.total <= 0) {
		countdownLabel.textContent = `${examName} Exam Day Has Arrived!`;
	} else {
		countdownLabel.textContent = `${examName} Countdown`;
	}
}

// ================= Date/Time =================
function updateDateTime() {
	const now = new Date();
	const dateEl = document.getElementById("current-date");
	const timeEl = document.getElementById("current-time");

	if (!dateEl || !timeEl) return;

	dateEl.textContent = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
	timeEl.textContent = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ================= Initialization =================
function initializePage() {
	loadCustomExamData();
	setDefaultExam();
	setBackground();

	updateDateTime();
	updateCountdown();

	setInterval(updateDateTime, 1000);
	setInterval(updateCountdown, 1000);

	setInterval(() => {
		if (!wallpaperRotationPaused) changeWallpaper("next");
	}, 5 * 60 * 1000);
}

document.addEventListener("DOMContentLoaded", initializePage);

// ================= Export =================
export { getTimeRemaining, getCustomExamData, hasValidCustomExam, loadCustomExamData };
