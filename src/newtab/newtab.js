import browser from "webextension-polyfill";
import { initializeTodoUI } from "./todo-ui.js";
import { initializeQuickTodoUI } from "./quick-todo-ui.js";

let customExamName = "Custom Exam";
let customExamDate = null;

async function loadCustomExamData() {
	if (!browser.storage || !browser.storage.sync) return;

	try {
		const data = await browser.storage.sync.get(["customExamName", "customExamDate"]);
		if (data.customExamName) {
			customExamName = data.customExamName;
		}

		if (data.customExamDate) {
			customExamDate = new Date(data.customExamDate);
		}
	} catch (error) {
		console.error("Error loading custom exam data:", error);
	}
}

function saveCustomExamData(name, date) {
	if (!browser.storage || !browser.storage.sync) return false;

	customExamName = name || "Custom Exam";
	customExamDate = date;

	let dateValueToStore = null;
    if (customExamDate && !isNaN(customExamDate.getTime())) {
        dateValueToStore = customExamDate.toISOString(); 
    }

	try {
		browser.storage.sync.set({
			customExamName: customExamName,
			customExamDate: dateValueToStore,
		});
		return true;
	} catch (error) {
		console.error("Error saving custom exam data:", error);
		return false;
	}
}

function getCustomExamData() {
	return {
		name: customExamName,
		date: customExamDate,
	};
}

function hasValidCustomExam() {
	return customExamDate && !isNaN(customExamDate.getTime());
}

function getTimeRemaining(endDate, showSeconds = true) {
	const total = endDate - new Date();

	const month = Math.floor(total / (1000 * 60 * 60 * 24 * 30));
	const days = Math.floor((total % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24));
	const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));

	let result = { total, month, days, hours, minutes };

	if (showSeconds) {
		const seconds = Math.floor((total % (1000 * 60)) / 1000);
		result.seconds = seconds;
	}

	return result;
}

const backgrounds = ["https://www.ghibli.jp/gallery/kimitachi016.jpg", "https://www.ghibli.jp/gallery/redturtle024.jpg", "https://www.ghibli.jp/gallery/marnie022.jpg", "https://www.ghibli.jp/gallery/kazetachinu050.jpg"];

let wallpapersList = [];
let customWallpaper = "";
let backgroundBrightness = 0.4;
let currentWallpaperIndex = -1;
let wallpaperRotationPaused = false;

let currentExam = "jeeAdv";

async function setDefaultExam() {
	try {
		const examInfo = await browser.storage.sync.get("exams");

		if (Array.isArray(examInfo.exams)) {
			let defaultExamFound = false;

			examInfo.exams.forEach((exam) => {
				console.log(exam);

				if (exam.default === true) {
					currentExam = exam.name;
					defaultExamFound = true;
				}
			});

			if (!defaultExamFound) {
				console.warn("No Defaut Exam Found! Using Fallback :", currentExam);
			}
		} else {
			console.error("Exams Data Is Not An Array : ", examInfo.exams);
		}
	} catch (error) {
		console.error("Error Retriving Exam Info : ", error);
	}
}

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

function updateDateTime() {
	const now = new Date();

	const currentDateElement = document.getElementById("current-date");
	const currentTimeElement = document.getElementById("current-time");

	const dateOptions = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
	const timeOptions = { hour: "2-digit", minute: "2-digit", hour12: true };

	const formattedTime = now.toLocaleTimeString("en-US", timeOptions);
	const formattedDate = now.toLocaleDateString("en-US", dateOptions);

	currentTimeElement.textContent = formattedTime;
	currentDateElement.textContent = formattedDate;
}

async function displayRandomQuote() {
	const quoteTextElement = document.getElementById("quote-text");
	const quoteAuthorElement = document.getElementById("quote-author");

	quoteTextElement.style.opacity = 0;
	quoteAuthorElement.style.opacity = 0;

	try {
		const response = await fetch("https://api.quotable.io/quotes/random?tags=inspirational|motivational|productivity|education|wisdom|success|work");
		const data = await response.json();

		const quote = {
			content: data[0].content,
			author: data[0].author,
		};
		displayQuote(quote);
	} catch (error) {
		const fallbackIndex = Math.floor(Math.random() * fallbackMotivationalQuotes.length);
		const fallbackQuote = fallbackMotivationalQuotes[fallbackIndex];
		displayQuote(fallbackQuote);
	}

	function displayQuote(q) {
		setTimeout(() => {
			quoteTextElement.textContent = `"${q.content}"`;
			quoteAuthorElement.textContent = `— ${q.author}`;
			quoteTextElement.style.opacity = 1;
			quoteAuthorElement.style.opacity = 1;
		}, 300);
	}
}

// Weather Functions
async function fetchWeather() {
	// JUSTIFICATION: Geolocation is necessary to fetch accurate weather data for the user's current location.
	// This feature is opt-in (disabled by default) and requires explicit user permission.
	// The geolocation permission is declared in manifest.json and user consent is obtained at runtime.
	
	try {
		let latitude, longitude, cityName;
		let locationFound = false;
		
	// Check storage for user preferences
	if (browser && browser.storage) {
		const { useAutoLocation, useCustomLocation, customWeatherLocation } = await browser.storage.sync.get([
			'useAutoLocation', 
			'useCustomLocation', 
			'customWeatherLocation'
		]);
		
		console.log("Weather fetch - useAutoLocation:", useAutoLocation);
		console.log("Weather fetch - useCustomLocation:", useCustomLocation);
		console.log("Weather fetch - customWeatherLocation:", customWeatherLocation);
		
		// Priority 1: Custom location (if enabled)
		if (useCustomLocation && customWeatherLocation && customWeatherLocation.city) {
			console.log("Using custom location (user preference):", customWeatherLocation.city);
			cityName = customWeatherLocation.city;
			
			// Geocode the city name
			try {
				const geoResp = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(customWeatherLocation.city)}&count=1`);
				if (geoResp.ok) {
					const geoData = await geoResp.json();
					console.log("Geocoding API response:", geoData);
					if (geoData.results && geoData.results[0]) {
						latitude = geoData.results[0].latitude;
						longitude = geoData.results[0].longitude;
						console.log("Geocoded custom location to:", latitude, longitude);
						locationFound = true;
					} else {
						console.warn("No geocoding results found for:", customWeatherLocation.city);
					}
				}
			} catch (e) {
				console.error("City geocoding failed:", e);
			}
		} 
		// Priority 2: Auto-detect location (if enabled and custom not used)
		else if (useAutoLocation) {
			console.log("Using auto-detect location (geolocation)");
			try {
				const position = await new Promise((resolve, reject) => {
					navigator.geolocation.getCurrentPosition(resolve, reject, {
						timeout: 10000,
						enableHighAccuracy: false
					});
				});
				
				latitude = position.coords.latitude;
				longitude = position.coords.longitude;
				console.log("Got coordinates from geolocation:", latitude, longitude);
				
				// Fetch city name using BigDataCloud
				cityName = 'My Location';
				try {
					const geocodeResponse = await fetch(
						`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
					);
					if (geocodeResponse.ok) {
						const geocodeData = await geocodeResponse.json();
						cityName = geocodeData.city || geocodeData.locality || geocodeData.principalSubdivision || 'My Location';
					}
				} catch (geocodeError) {
					console.warn("Reverse geocoding failed:", geocodeError);
				}
				locationFound = true;
			} catch (geoError) {
				console.error("Geolocation failed:", geoError);
			}
		} else {
			console.log("Neither auto-detect nor custom location is enabled");
		}
	}
	
	// If no location found, return null
	if (!locationFound) {
		console.log("No location available - user must enable auto-detect or custom location");
		return null;
	}
		
		if (latitude == null || longitude == null) {
			console.warn("No valid coordinates available for weather");
			return null;
		}
		
		// Fetch weather data from Open-Meteo (free, no API key required)
		const weatherResponse = await fetch(
			`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`
		);
		
		if (!weatherResponse.ok) {
			throw new Error(`Weather API error: ${weatherResponse.status}`);
		}
		
		const weatherData = await weatherResponse.json();
		
		return {
			name: cityName || 'My Location',
			main: {
				temp: weatherData.current.temperature_2m
			},
			weather: [{
				description: getWeatherDescription(weatherData.current.weather_code),
				icon: getWeatherIcon(weatherData.current.weather_code)
			}],
			coords: { latitude, longitude }
		};
	} catch (error) {
		console.error("Weather: Error fetching weather data:", error);
		return null;
	}
}// Convert WMO weather codes to descriptions
function getWeatherDescription(code) {
	const weatherCodes = {
		0: 'clear sky',
		1: 'mainly clear',
		2: 'partly cloudy',
		3: 'overcast',
		45: 'foggy',
		48: 'depositing rime fog',
		51: 'light drizzle',
		53: 'moderate drizzle',
		55: 'dense drizzle',
		61: 'slight rain',
		63: 'moderate rain',
		65: 'heavy rain',
		71: 'slight snow',
		73: 'moderate snow',
		75: 'heavy snow',
		77: 'snow grains',
		80: 'slight rain showers',
		81: 'moderate rain showers',
		82: 'violent rain showers',
		85: 'slight snow showers',
		86: 'heavy snow showers',
		95: 'thunderstorm',
		96: 'thunderstorm with slight hail',
		99: 'thunderstorm with heavy hail'
	};
	return weatherCodes[code] || 'unknown';
}

// Convert WMO weather codes to icon codes (similar to OpenWeatherMap format)
function getWeatherIcon(code) {
	const iconMap = {
		0: '01d', // clear sky
		1: '02d', // mainly clear
		2: '03d', // partly cloudy
		3: '04d', // overcast
		45: '50d', // fog
		48: '50d', // fog
		51: '09d', // drizzle
		53: '09d', // drizzle
		55: '09d', // drizzle
		61: '10d', // rain
		63: '10d', // rain
		65: '10d', // rain
		71: '13d', // snow
		73: '13d', // snow
		75: '13d', // snow
		77: '13d', // snow
		80: '09d', // showers
		81: '09d', // showers
		82: '09d', // showers
		85: '13d', // snow showers
		86: '13d', // snow showers
		95: '11d', // thunderstorm
		96: '11d', // thunderstorm
		99: '11d'  // thunderstorm
	};
	return iconMap[code] || '01d';
}

function displayWeather(weatherData) {
	if (!weatherData) {
		const weatherWidget = document.getElementById("weather-widget");
		if (weatherWidget) weatherWidget.style.display = "none";
		return;
	}

	const cityElement = document.getElementById("weather-city");
	const tempElement = document.getElementById("weather-temp");
	const iconElement = document.getElementById("weather-icon");
	const descElement = document.getElementById("weather-description");
	const weatherWidget = document.getElementById("weather-widget");

	if (!cityElement || !tempElement || !iconElement || !descElement) return;

	// Display weather information
	cityElement.textContent = weatherData.name;
	tempElement.textContent = `${Math.round(weatherData.main.temp)}°C`;
	descElement.textContent = weatherData.weather[0].description;

	// Set weather icon (using OpenWeatherMap icon format for compatibility)
	const iconCode = weatherData.weather[0].icon;
	const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
	iconElement.src = iconUrl;
	iconElement.style.display = "block";

	weatherWidget.style.display = "block";
}

async function updateWeather() {
	const weatherData = await fetchWeather();
	displayWeather(weatherData);
}

async function setBackground() {
	const backgroundElement = document.querySelector(".background");
	if (!backgroundElement) return;

	backgroundElement.style.opacity = 0;
	document.documentElement.style.setProperty("--bg-brightness", backgroundBrightness);

	if (!browser) {
		return handleDefaultBackground();
	}

	try {
		const { wallpaperIndex, wallpaperRotationPaused: paused } = await browser.storage.sync.get(["wallpaperIndex", "wallpaperRotationPaused"]);

		if (paused !== undefined) {
			wallpaperRotationPaused = paused;
			updatePauseButtonIcon();
		}

		if (customWallpaper) {
			return preloadAndSetBackground(customWallpaper);
		}

		await loadWallpapers();

		if (wallpaperRotationPaused && wallpaperIndex !== undefined && wallpapersList[wallpaperIndex]) {
			currentWallpaperIndex = wallpaperIndex;
			preloadAndSetBackground(wallpapersList[currentWallpaperIndex]);
		} else {
			changeWallpaper("random");
		}
	} catch (err) {
		console.warn("Failed to restore wallpaper state:", err);
		handleDefaultBackground();
	}
}

async function handleDefaultBackground() {
	if (customWallpaper) {
		preloadAndSetBackground(customWallpaper);
		return;
	}

	await loadWallpapers();
	changeWallpaper("random");
}

function preloadAndSetBackground(url) {
	const backgroundElement = document.querySelector(".background");
	const img = new Image();

	let currentWallpaperUrl = "";

	img.src = url;
	img.onload = () => {
		setTimeout(() => {
			backgroundElement.style.backgroundImage = `url(${url})`;
			backgroundElement.style.opacity = 1;

			currentWallpaperUrl = url;
			updateWallpaperInfoButton(url);
		}, 500);
	};

	img.onerror = () => {
		console.error("Failed To Preload Image :", url);
	};
}

async function loadWallpapers() {
	if (Array.isArray(wallpapersList) && wallpapersList.length > 0) {
		return;
	}

	if (!browser.storage || !browser.storage.sync) {
		return;
	}

	try {
		const storedData = await browser.storage.sync.get("wallpapers");
		const images = storedData.wallpapers || [];

		if (Array.isArray(images) && images.length > 0) {
			wallpapersList = images;
		} else {
			console.warn("No Images Found In Data Using Fallback");
			wallpapersList = backgrounds;
		}
	} catch (error) {
		console.warn("Failed To Load Backgrounds. Using Fallback.", error);
		wallpapersList = backgrounds;
	}
}

function changeWallpaper(direction) {
	if (wallpapersList.length === 0) return;

	const backgroundElement = document.querySelector(".background");
	if (!backgroundElement) return;

	backgroundElement.style.opacity = 0;

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

	if (browser && wallpaperRotationPaused) {
		browser.storage.sync.set({ wallpaperIndex: currentWallpaperIndex });
	}

	const url = wallpapersList[currentWallpaperIndex];
	preloadAndSetBackground(url);
}

async function loadExamDates() {
	const { countdowns } = await browser.storage.sync.get("countdowns");

	if (!countdowns) throw new Error("Countdowns not found in storage.");

	window.jeeExamDate = new Date(countdowns.jee.date);
	window.neetExamDate = new Date(countdowns.neet.date);
	window.jeeAdvExamDate = new Date(countdowns.jeeAdv.date);
}

async function updateCountdown() {
	const countdownDaysElement = document.getElementById("countdown-days");
	const countdownHoursElement = document.getElementById("countdown-hours");
	const countdownMonthsElement = document.getElementById("countdown-months");
	const countdownMinutesElement = document.getElementById("countdown-minutes");
	const countdownSecondsElement = document.getElementById("countdown-seconds");
	const countdownLabelElement = document.getElementById("countdown-label");
	const examBadgeElement = document.getElementById("exam-badge");
	const toggleSeconds = document.getElementById("toggle-seconds");
	const showSeconds = toggleSeconds ? toggleSeconds.checked : true;

	let timeRemaining;
	let examName;

	const storedData = await browser.storage.sync.get(["countdowns"]);

	let jeeExamDate = new Date(2026, 0, 29); // default fallback
	let neetExamDate = new Date(2026, 4, 4);
	let jeeAdvExamDate = new Date(2026, 4, 18);

	if (storedData.countdowns) {
		if (storedData.countdowns.jee?.date) {
			jeeExamDate = new Date(storedData.countdowns.jee.date);
		}
		if (storedData.countdowns.neet?.date) {
			neetExamDate = new Date(storedData.countdowns.neet.date);
		}
		if (storedData.countdowns.jeeAdv?.date) {
			jeeAdvExamDate = new Date(storedData.countdowns.jeeAdv.date);
		}
	}

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
				const customExam = getCustomExamData();
				timeRemaining = getTimeRemaining(customExam.date, showSeconds);
				examName = customExam.name;
			} else {
				timeRemaining = { total: 0, month: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
				examName = "Custom Exam";
			}
			break;
	}

	if (examBadgeElement) {
		examBadgeElement.textContent = examName;
	}

	if (timeRemaining.total <= 0) {
		countdownMonthsElement.style = "--value:0";
		countdownDaysElement.style = "--value:0";
		countdownHoursElement.style = "--value:0";
		countdownMinutesElement.style = "--value:0";
		countdownSecondsElement.style = "--value:0";
		countdownLabelElement.textContent = `${examName} Exam Day Has Arrived!`;
	} else {
		countdownMonthsElement.style = `--value:${timeRemaining.month}`;
		countdownDaysElement.style = `--value:${timeRemaining.days}`;
		countdownHoursElement.style = `--value:${timeRemaining.hours}`;
		countdownMinutesElement.style = `--value:${timeRemaining.minutes}`;
		countdownSecondsElement.style = `--value:${timeRemaining.seconds}`;
		countdownLabelElement.textContent = "";
	}
}

function updateWallpaperInfoButton(wallpaperUrl) {
	const infoButton = document.getElementById("wallpaper-info-btn");
	let sourceUrl = "";

	if (!infoButton) return;

	try {
		sourceUrl = new URL(wallpaperUrl);
		console.log(sourceUrl);
	} catch (e) {
		console.error("Invalid wallpaper URL:", e);
		sourceUrl = "https://novatra.in";
	}

	infoButton.href = sourceUrl;
}

async function updateExamDropdownLabels({ customExam }) {
	const examSelector = document.getElementById("exam-selector");
	const format = (date) =>
		date.toLocaleDateString("en-US", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});

	const { countdowns } = await browser.storage.sync.get("countdowns");

	const jeeExamDate = countdowns?.jee?.date ? new Date(countdowns.jee.date) : new Date(2026, 0, 29);
	const neetExamDate = countdowns?.neet?.date ? new Date(countdowns.neet.date) : new Date(2026, 4, 4);
	const jeeAdvExamDate = countdowns?.jeeAdv?.date ? new Date(countdowns.jeeAdv.date) : new Date(2026, 4, 18);

	const labelMap = {
		neet: `NEET (${format(neetExamDate)})`,
		jee: `JEE Main (${format(jeeExamDate)})`,
		jeeAdv: `JEE Advanced (${format(jeeAdvExamDate)})`,
		custom: customExam && customExam.name && customExam.date instanceof Date ? `${customExam.name} (${format(customExam.date)})` : "Custom Exam",
	};

	for (const option of examSelector.options) {
		const value = option.value;
		if (labelMap[value]) {
			option.textContent = labelMap[value];
		}
	}
}

function setupEventListeners() {
	const optionsLink = document.getElementById("options-link");
	const themeToggle = document.getElementById("theme-toggle");
	const musicBtn = document.getElementById("music-btn");

	const optionsModal = document.getElementById("options-modal");
	const preferencesForm = document.getElementById("preferences-form");
	
	console.log("🔍 Setup Event Listeners - Form element found:", !!preferencesForm);
	if (preferencesForm) {
		console.log("   Form ID:", preferencesForm.id);
		console.log("   Form tag:", preferencesForm.tagName);
	}

	const examSelector = document.getElementById("exam-selector");
	const customExam = getCustomExamData();

	const customExamSection = document.getElementById("custom-exam-section");
	const customExamNameInput = document.getElementById("custom-exam-name");
	const customExamDateInput = document.getElementById("custom-exam-date");

	const customWallpaperInput = document.getElementById("custom-wallpaper");
	const brightnessSlider = document.getElementById("brightness-slider");

	const toggleDateTime = document.getElementById("toggle-datetime");
	const toggleCountdown = document.getElementById("toggle-countdown");
	const toggleQuote = document.getElementById("toggle-quote");
	const toggleSeconds = document.getElementById("toggle-seconds");
	const toggleTodos = document.getElementById("toggle-todos");
	const toggleBrand = document.getElementById("toggle-brand");
	const toggleWeather = document.getElementById("toggle-weather");

	const saveMessage = document.getElementById("save-message");
	// Weather location fields
	const useAutoLocationToggle = document.getElementById("use-auto-location");
	const customWeatherCityInput = document.getElementById("custom-weather-city");
	const useCustomLocationToggle = document.getElementById("use-custom-location");
	
	const nextWallpaperBtn = document.getElementById("next-wallpaper");
	const prevWallpaperBtn = document.getElementById("prev-wallpaper");
	const pauseWallpaperBtn = document.getElementById("pause-wallpaper");

	function formatDateToLocalInputString(date) {
	    if (!date || isNaN(date.getTime())) return "";

	    const pad = (num) => num.toString().padStart(2, '0');

	    const year = date.getFullYear();
	    const month = pad(date.getMonth() + 1); // getMonth() is 0-indexed
	    const day = pad(date.getDate());
	    const hours = pad(date.getHours());
	    const minutes = pad(date.getMinutes());

	    return `${year}-${month}-${day}T${hours}:${minutes}`;
	}

	function getCurrentLocalDatetimeString() {
		const now = new Date();
		
		const pad = (num) => num.toString().padStart(2, '0');

		const year = now.getFullYear();
		const month = pad(now.getMonth() + 1); // getMonth() is 0-indexed
		const day = pad(now.getDate());
		const hours = pad(now.getHours());
		const minutes = pad(now.getMinutes());

		return `${year}-${month}-${day}T${hours}:${minutes}`;
	}

	const showOptionsModal = function () {
		browser.storage.sync.get().then((data) => {
			const activeExam = data.activeExam || "jeeAdv";

			examSelector.value = activeExam;

			if (data.customWallpaper) {
				customWallpaperInput.value = data.customWallpaper;
			} else {
				customWallpaperInput.value = "";
			}

		if (data.backgroundBrightness !== undefined) {
			brightnessSlider.value = data.backgroundBrightness;
		} else {
			brightnessSlider.value = 0.4;
		}
		
		// Load custom weather location if it exists
		if (data.customWeatherLocation) {
			console.log("Loading custom weather location:", data.customWeatherLocation);
			if (customWeatherCityInput) {
				customWeatherCityInput.value = data.customWeatherLocation.city || "";
			}
		} else {
			console.log("No custom weather location saved");
			if (customWeatherCityInput) customWeatherCityInput.value = "";
		}
		
		// Load auto-location toggle
		if (useAutoLocationToggle) {
			useAutoLocationToggle.checked = data.useAutoLocation || false;
		}
		
		// Load custom location toggle
		if (useCustomLocationToggle) {
			useCustomLocationToggle.checked = data.useCustomLocation || false;
		}
		
		const customExam = getCustomExamData();
		const minTime = getCurrentLocalDatetimeString();
		customExamDateInput.min = minTime;			if (customExam.name) {
				customExamNameInput.value = customExam.name;
			} else {
				customExamNameInput.value = "";
			}

			if (hasValidCustomExam()) {
				customExamDateInput.value = formatDateToLocalInputString(customExam.date);

				const customExamStat = document.getElementById("custom-exam-stat");
				const customExamStatTitle = document.getElementById("custom-exam-stat-title");
				const customExamStatDate = document.getElementById("custom-exam-stat-date");

				if (customExamStat && customExamStatTitle && customExamStatDate) {
					customExamStat.classList.remove("hidden");
					customExamStatTitle.textContent = customExam.name;
					customExamStatDate.textContent = customExam.date.toLocaleDateString("en-US", { 
						year: "numeric", 
						month: "long", 
						day: "numeric",
						hour: "numeric",   
						minute: "2-digit"  
					});
				}
			} else {
				customExamDateInput.value = "";

				const customExamStat = document.getElementById("custom-exam-stat");
				if (customExamStat) {
					customExamStat.classList.add("hidden");
				}
			}

			if (activeExam === "custom") {
				customExamSection.classList.remove("hidden");
			} else {
				customExamSection.classList.add("hidden");
			}

			updateExamDropdownLabels({
				customExam,
			});

			optionsModal.showModal();
		});
	};

	if (examSelector) {
		examSelector.addEventListener("change", function () {
			if (this.value === "custom") {
				customExamSection.classList.remove("hidden");
			} else {
				customExamSection.classList.add("hidden");
			}
		});
	}

	if (optionsLink) {
		optionsLink.addEventListener("click", showOptionsModal);
	}
	if (themeToggle) {
		themeToggle.addEventListener("click", function () {
			document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";

			browser.storage.sync.set({ theme: document.documentElement.dataset.theme });
		});
	}

	if (nextWallpaperBtn) {
		nextWallpaperBtn.addEventListener("click", function () {
			changeWallpaper("next");
		});
	}

	if (prevWallpaperBtn) {
		prevWallpaperBtn.addEventListener("click", function () {
			changeWallpaper("prev");
		});
	}
	if (pauseWallpaperBtn) {
		pauseWallpaperBtn.addEventListener("click", function () {
			wallpaperRotationPaused = !wallpaperRotationPaused;
			updatePauseButtonIcon();

			if (browser) {
				if (wallpaperRotationPaused) {
					browser.storage.sync.set({
						wallpaperRotationPaused,
						wallpaperIndex: currentWallpaperIndex,
					});
				} else {
					browser.storage.sync.set({ wallpaperRotationPaused });
				}
			}
		});
	}

	if (musicBtn) {
		const musicModal = document.getElementById("music-modal");
		const youtubeForm = document.getElementById("youtube-form");
		const youtubeUrlInput = document.getElementById("youtube-url");
		const youtubeEmbed = document.getElementById("youtube-embed");

		const defaultYoutubeUrl = "https://www.youtube.com/watch?v=n61ULEU7CO0";
		musicBtn.addEventListener("click", function () {
			musicModal.showModal();

			if (browser) {
				browser.storage.sync.get(["youtubeUrl"]).then((data) => {
					if (data.youtubeUrl) {
						youtubeUrlInput.value = data.youtubeUrl;
						if (youtubeEmbed.innerHTML === "") {
							loadMusicEmbed(data.youtubeUrl);
						}
					} else {
						youtubeUrlInput.value = defaultYoutubeUrl;
						if (youtubeEmbed.innerHTML === "") {
							loadMusicEmbed(defaultYoutubeUrl);
						}
					}
				});
			} else {
				youtubeUrlInput.value = defaultYoutubeUrl;
				if (youtubeEmbed.innerHTML === "") {
					loadMusicEmbed(defaultYoutubeUrl);
				}
			}
		});
		if (youtubeForm) {
			youtubeForm.addEventListener("submit", function (event) {
				event.preventDefault();
				const musicUrl = youtubeUrlInput.value.trim();
				if (musicUrl) {
					if (browser.storage) {
						browser.storage.sync.set({ youtubeUrl: musicUrl });
					}
					loadMusicEmbed(musicUrl);
				}
			});
		}

		function loadMusicEmbed(url) {
			const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
			const youtubeMatch = url.match(youtubeRegex);

			if (youtubeMatch && youtubeMatch[1]) {
				youtubeEmbed.classList.remove("hidden");

				const videoId = youtubeMatch[1];
				const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?si=Y_vXpY6wIItrmI9x`;

				while (youtubeEmbed.firstChild) {
					youtubeEmbed.removeChild(youtubeEmbed.firstChild);
				}
				const iframe = document.createElement("iframe");
				iframe.width = "100%";
				iframe.height = "100%";
				iframe.src = embedUrl;
				iframe.title = "YouTube video player";
				iframe.style.border = "none";
				iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope");
				iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
				youtubeEmbed.appendChild(iframe);
			} else {
				youtubeEmbed.classList.remove("hidden");

				while (youtubeEmbed.firstChild) {
					youtubeEmbed.removeChild(youtubeEmbed.firstChild);
				}
				const errorParagraph = document.createElement("p");
				errorParagraph.className = "text-center py-4";
				errorParagraph.textContent = "Invalid YouTube URL";
				youtubeEmbed.appendChild(errorParagraph);
			}
		}
	}
	if (preferencesForm) {
		   console.log("Preferences form found, attaching event listener");
		   preferencesForm.addEventListener("submit", function (event) {
			   console.log("🚀 FORM SUBMIT EVENT TRIGGERED");
			   event.preventDefault();
   
   console.log("DEBUG - Form submitted! Elements:", {
   customWeatherCityInput: customWeatherCityInput,
   useCustomLocationToggle: useCustomLocationToggle,
   cityValue: customWeatherCityInput?.value,
   toggleValue: useCustomLocationToggle?.checked
   });

			   let activeExam = examSelector.value;
			   let wallpaperUrl = customWallpaperInput.value.trim();
			   let brightness = parseFloat(brightnessSlider.value);

		   let showDateTime = toggleDateTime ? toggleDateTime.checked : true;
		   let showCountdown = toggleCountdown ? toggleCountdown.checked : true;
		   let showQuote = toggleQuote ? toggleQuote.checked : true;
		   let showSeconds = toggleSeconds ? toggleSeconds.checked : true;
		   let showTodos = toggleTodos ? toggleTodos.checked : true;
		   let showBrand = toggleBrand ? toggleBrand.checked : true;
		   let showWeather = toggleWeather ? toggleWeather.checked : false;			   let customName = "";
			   let customDate = null;

		   // Weather location settings
		   let customWeatherCity = customWeatherCityInput ? customWeatherCityInput.value.trim() : "";
		   let useAutoLocation = useAutoLocationToggle ? useAutoLocationToggle.checked : false;
		   let useCustomLocation = useCustomLocationToggle ? useCustomLocationToggle.checked : false;

		   // Auto-enable weather widget if either location method is enabled
		   if ((useAutoLocation || (useCustomLocation && customWeatherCity)) && !showWeather) {
			   showWeather = true;
			   if (toggleWeather) {
				   toggleWeather.checked = true;
			   }
			   console.log("Auto-enabled weather widget because location is set");
		   }

		   // Auto-disable weather widget if both location methods are turned off
		   if (!useAutoLocation && !useCustomLocation && showWeather) {
			   showWeather = false;
			   if (toggleWeather) {
				   toggleWeather.checked = false;
			   }
			   console.log("Auto-disabled weather widget because no location method is enabled");
		   }

		   console.log("Saving weather location settings:", {
			   useAutoLocation: useAutoLocation,
			   useCustomLocation: useCustomLocation,
			   customCity: customWeatherCity,
			   weatherWidgetEnabled: showWeather
		   });			   if (activeExam === "custom") {
				   customName = customExamNameInput.value.trim();

				   if (!customName) {
					   customName = "Custom Exam";
				   }

				   if (customExamDateInput.value) {
					   customDate = new Date(customExamDateInput.value);
				   }

				   if (!customDate || isNaN(customDate.getTime())) {
					   saveMessage.textContent = "Please enter a valid date for your custom exam";
					   saveMessage.style.color = "red";
					   setTimeout(function () {
						   saveMessage.textContent = "";
						   saveMessage.style.color = "";
					   }, 3000);
					   return;
				   }
			   }
			   if (activeExam === "custom" && customDate) {
				   saveCustomExamData(customName, customDate);
			   }
			   const dataToSave = {
				   activeExam: activeExam,
				   customWallpaper: wallpaperUrl,
				   backgroundBrightness: brightness,
				   widgetVisibility: {
					   dateTime: showDateTime,
					   countdown: showCountdown,
					   quote: showQuote,
					   seconds: showSeconds,
					   todos: showTodos,
					   brand: showBrand,
					   weather: showWeather,
				   },
			   wallpaperIndex: currentWallpaperIndex,
			   wallpaperRotationPaused: wallpaperRotationPaused,
			   useAutoLocation: useAutoLocation,
			   customWeatherLocation: {
				   city: customWeatherCity,
			   },
			   useCustomLocation: useCustomLocation
		   };
		   
		   console.log("Data being saved to storage:", dataToSave);
		   
		   browser.storage.sync
				   .set(dataToSave)
				   .then(() => {
					   console.log("✅ Save successful!");
					   saveMessage.textContent = "Preferences Saved!";
					   saveMessage.style.color = "";

					   setActiveExam(activeExam);

				   customWallpaper = wallpaperUrl;
				   backgroundBrightness = brightness;
				   setBackground();

				   updateWidgetVisibility(showDateTime, showCountdown, showQuote, showSeconds, showTodos, showBrand, showWeather);				   // Update weather if it's enabled
				   if (showWeather) {
					   console.log("Weather is enabled, calling updateWeather()");
					   updateWeather();
				   } else {
					   console.log("Weather widget is disabled, skipping update");
				   }					   setTimeout(function () {
						   saveMessage.textContent = "";
					   }, 3000);
					   optionsModal.close();
				   })
				   .catch((error) => {
					   console.error("Failed to save preferences:", error);
					   saveMessage.textContent = "Failed to save preferences";
					   saveMessage.style.color = "red";

					   setTimeout(function () {
						   saveMessage.textContent = "";
					   }, 3000);
				   });
		   });
	}

	if (brightnessSlider) {
		brightnessSlider.addEventListener("input", function () {
			document.documentElement.style.setProperty("--bg-brightness", this.value);
		});
	}

	if (customExamSection) {
		customExamSection.classList.add("hidden");
	}
}

async function updateNovatraLink(exam) {
	const novatraLink = document.getElementById("novatra-link");
	if (!novatraLink) return;

	try {
		const examData = await browser.storage.sync.get("exams");

		if (Array.isArray(examData.exams)) {
			const examInfo = examData.exams.find((e) => e.name === exam);

			novatraLink.href = examInfo ? examInfo.link : "https://novatra.in/";
		} else {
			console.error("Exams Data Is Not An Array : ", examData.exams);
			novatraLink.href = "https://novatra.in/";
		}
	} catch (error) {
		console.error("Error Retrieving Exam Info : ", error);
		novatraLink.href = "https://novatra.in/";
	}
}

function setActiveExam(exam) {
	currentExam = exam;
	updateCountdown();
	updateNovatraLink(exam);

	if (browser.storage) {
		browser.storage.sync.set({ activeExam: exam });
	}
}

function updateWidgetVisibility(showDateTime, showCountdown, showQuote, showSeconds, showTodos, showBrand, showWeather) {
	const dateTimeElement = document.getElementById("clock-class");
	const countdownElement = document.getElementById("countdown-class");
	const quoteElement = document.getElementById("quote-class");
	const secondsElement = document.getElementById("seconds-container");
	const todosElement = document.getElementById("quick-todo-section");
	const brandElement = document.getElementById("brand-class");
	const weatherElement = document.getElementById("weather-widget");

	if (dateTimeElement) {
		dateTimeElement.style.display = showDateTime ? "" : "none";
	}

	if (countdownElement) {
		countdownElement.style.display = showCountdown ? "" : "none";
	}

	if (quoteElement) {
		quoteElement.style.display = showQuote ? "" : "none";
	}

	if (secondsElement) {
		secondsElement.style.display = showSeconds ? "" : "none";
	}

	if (todosElement) {
		todosElement.style.display = showTodos ? "" : "none";
	}

	if (brandElement) {
		brandElement.style.display = showBrand ? "" : "none";
	}

	if (weatherElement) {
		weatherElement.style.display = showWeather ? "" : "none";
		console.log("Weather widget visibility updated:", showWeather ? "visible" : "hidden");
	}
}

function loadUserPreferences() {
	// Get references to toggle elements for this function's scope
	const toggleDateTime = document.getElementById("toggle-datetime");
	const toggleCountdown = document.getElementById("toggle-countdown");
	const toggleQuote = document.getElementById("toggle-quote");
	const toggleSeconds = document.getElementById("toggle-seconds");
	const toggleTodos = document.getElementById("toggle-todos");
	const toggleBrand = document.getElementById("toggle-brand");
	const toggleWeather = document.getElementById("toggle-weather");
	
	browser.storage.sync.get().then((data) => {
		if (data.theme) {
			document.documentElement.dataset.theme = data.theme;
		}

		if (data.activeExam) {
			setActiveExam(data.activeExam);
		} else {
			// If no exam is selected, at least update the link
			updateNovatraLink(currentExam);
		}

		if (data.customWallpaper) {
			customWallpaper = data.customWallpaper;
		}

		if (data.backgroundBrightness !== undefined) {
			backgroundBrightness = data.backgroundBrightness;
		}

		// Restore wallpaper rotation state
		if (data.wallpaperRotationPaused !== undefined) {
			wallpaperRotationPaused = data.wallpaperRotationPaused;
			// We'll update the icon after the DOM is fully loaded
		}

		if (data.widgetVisibility) {
			// Update toggle inputs
			if (toggleDateTime) toggleDateTime.checked = data.widgetVisibility.dateTime;
			if (toggleCountdown) toggleCountdown.checked = data.widgetVisibility.countdown;
			if (toggleQuote) toggleQuote.checked = data.widgetVisibility.quote;
			if (toggleSeconds) toggleSeconds.checked = data.widgetVisibility.seconds;
			if (toggleTodos) toggleTodos.checked = data.widgetVisibility.todos !== false;
			if (toggleBrand) toggleBrand.checked = data.widgetVisibility.brand;
			if (toggleWeather) toggleWeather.checked = data.widgetVisibility.weather === true;

			// Apply visibility settings
			updateWidgetVisibility(
				data.widgetVisibility.dateTime, 
				data.widgetVisibility.countdown, 
				data.widgetVisibility.quote, 
				data.widgetVisibility.seconds, 
				data.widgetVisibility.todos !== false,
				data.widgetVisibility.brand,
				data.widgetVisibility.weather === true
			);

			// Update weather if enabled
			if (data.widgetVisibility.weather === true) {
				console.log("Weather widget is enabled on page load, fetching weather...");
				updateWeather();
			} else {
				console.log("Weather widget is disabled on page load, weather status:", data.widgetVisibility?.weather);
			}
		}		console.log(currentExam);

		updateNovatraLink(currentExam);
		setBackground();
	});
}

async function refetchData() {
	try {
		browser.runtime
			.sendMessage({ action: "fetchExamDates" })
			.then((response) => {
				console.log(response.status);
			})
			.catch(console.error);

		browser.runtime
			.sendMessage({ action: "fetchWallpapers" })
			.then((response) => {
				console.log(response.status);
			})
			.catch(console.error);

		alert("Successfully Refetched Data!");
	} catch (error) {
		console.error("Error Refetching Data :", error);
		alert("Failed To Refetch Data. Check The Console For More Details");
	}
}

function initializePage() {
	updateDateTime();
	setDefaultExam();
	updateCountdown();
	loadCustomExamData();
	displayRandomQuote();
	setupEventListeners();
	loadUserPreferences();
	updatePauseButtonIcon();

	setInterval(updateDateTime, 1000);
	setInterval(updateCountdown, 1000);
	setInterval(displayRandomQuote, 3600000);
	setInterval(updateWeather, 1800000); // Update weather every 30 minutes

	setInterval(() => {
		if (!wallpaperRotationPaused) {
			changeWallpaper("next");
		}
	}, 5 * 60 * 1000);
}

document.addEventListener("DOMContentLoaded", () => {
	initializePage();
	initializeTodoUI(); // Initialize todo functionality
	initializeQuickTodoUI(); // Initialize quick todo in top-right
	const refetchBtn = document.getElementById("refetch-data-btn").addEventListener("click", refetchData);
});

function updatePauseButtonIcon() {
	const pauseButton = document.getElementById("pause-wallpaper");
	if (!pauseButton) return;

	if (wallpaperRotationPaused) {
		pauseButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="w-5 h-5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
            </svg>
        `;
		pauseButton.title = "Resume Wallpaper Rotation";
	} else {
		pauseButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="w-5 h-5" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
        `;
		pauseButton.title = "Pause Wallpaper Rotation";
	}
}

export { getTimeRemaining, getCustomExamData, hasValidCustomExam, loadCustomExamData };










