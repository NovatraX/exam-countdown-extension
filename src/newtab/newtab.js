import browser from "webextension-polyfill";

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

	try {
		browser.storage.sync.set({
			customExamName: customExamName,
			customExamDate: customExamDate ? customExamDate.getTime() : null,
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

// Weather variables
const WEATHER_API_KEY = "46c79230372920d6e94c39178db24eb6";
let weatherUpdateInterval = null;

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
		const response = await fetch("http://api.quotable.io/quotes/random?tags=inspirational|motivational|productivity|education|wisdom|success|work");
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

// Weather functions
async function fetchWeatherData() {
	try {
		// Get user's geolocation
		const position = await new Promise((resolve, reject) => {
			navigator.geolocation.getCurrentPosition(resolve, reject);
		});

		const { latitude, longitude } = position.coords;

		// Fetch weather from OpenWeatherMap API
		const response = await fetch(
			`https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}&units=metric`
		);

		if (!response.ok) throw new Error('Weather API request failed');

		const data = await response.json();
		return {
			temp: Math.round(data.main.temp),
			location: data.name,
			icon: data.weather[0].icon,
			description: data.weather[0].description
		};
	} catch (error) {
		console.error('Error fetching weather:', error);
		return null;
	}
}

function getWeatherEmoji(iconCode) {
	const iconMap = {
		'01d': '☀️', '01n': '🌙',
		'02d': '⛅', '02n': '☁️',
		'03d': '☁️', '03n': '☁️',
		'04d': '☁️', '04n': '☁️',
		'09d': '🌧️', '09n': '🌧️',
		'10d': '🌦️', '10n': '🌧️',
		'11d': '⛈️', '11n': '⛈️',
		'13d': '❄️', '13n': '❄️',
		'50d': '🌫️', '50n': '🌫️'
	};
	return iconMap[iconCode] || '🌤️';
}

async function updateWeatherWidget() {
	const weatherWidget = document.getElementById('weather-widget');
	const weatherIcon = document.getElementById('weather-icon');
	const weatherTemp = document.getElementById('weather-temp');
	const weatherLocation = document.getElementById('weather-location');

	if (!weatherWidget) return;

	const weatherData = await fetchWeatherData();

	if (weatherData) {
		weatherIcon.textContent = getWeatherEmoji(weatherData.icon);
		weatherTemp.textContent = `${weatherData.temp}°C`;
		weatherLocation.textContent = weatherData.location;
	}
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
	const toggleWeather = document.getElementById("toggle-weather");
	const toggleBrand = document.getElementById("toggle-brand");

	const saveMessage = document.getElementById("save-message");

	const nextWallpaperBtn = document.getElementById("next-wallpaper");
	const prevWallpaperBtn = document.getElementById("prev-wallpaper");
	const pauseWallpaperBtn = document.getElementById("pause-wallpaper");

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
			const customExam = getCustomExamData();

			if (customExam.name) {
				customExamNameInput.value = customExam.name;
			} else {
				customExamNameInput.value = "";
			}

			if (hasValidCustomExam()) {
				customExamDateInput.value = customExam.date.toISOString().split("T")[0];

				const customExamStat = document.getElementById("custom-exam-stat");
				const customExamStatTitle = document.getElementById("custom-exam-stat-title");
				const customExamStatDate = document.getElementById("custom-exam-stat-date");

				if (customExamStat && customExamStatTitle && customExamStatDate) {
					customExamStat.classList.remove("hidden");
					customExamStatTitle.textContent = customExam.name;
					customExamStatDate.textContent = customExam.date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
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
		preferencesForm.addEventListener("submit", function (event) {
			event.preventDefault();

			let activeExam = examSelector.value;
			let wallpaperUrl = customWallpaperInput.value.trim();
			let brightness = parseFloat(brightnessSlider.value);

			let showDateTime = toggleDateTime ? toggleDateTime.checked : true;
			let showCountdown = toggleCountdown ? toggleCountdown.checked : true;
			let showQuote = toggleQuote ? toggleQuote.checked : true;
			let showSeconds = toggleSeconds ? toggleSeconds.checked : true;
			let showWeather = toggleWeather ? toggleWeather.checked : false;
			let showBrand = toggleBrand ? toggleBrand.checked : true;

			let customName = "";
			let customDate = null;

			if (activeExam === "custom") {
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
					weather: showWeather,
					brand: showBrand,
				},
				wallpaperIndex: currentWallpaperIndex,
				wallpaperRotationPaused: wallpaperRotationPaused,
			};

			browser.storage.sync
				.set(dataToSave)
				.then(() => {
					saveMessage.textContent = "Preferences Saved!";
					saveMessage.style.color = "";

					setActiveExam(activeExam);

					customWallpaper = wallpaperUrl;
					backgroundBrightness = brightness;
					setBackground();

					updateWidgetVisibility(showDateTime, showCountdown, showQuote, showSeconds, showWeather, showBrand);

					setTimeout(function () {
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

function updateWidgetVisibility(showDateTime, showCountdown, showQuote, showSeconds, showWeather, showBrand) {
	const dateTimeElement = document.getElementById("clock-class");
	const countdownElement = document.getElementById("countdown-class");
	const quoteElement = document.getElementById("quote-class");
	const secondsElement = document.getElementById("seconds-container");
	const weatherElement = document.getElementById("weather-widget");
	const brandElement = document.getElementById("brand-class");

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

	if (weatherElement) {
		weatherElement.style.display = showWeather ? "block" : "none";
		// Update weather when enabled
		if (showWeather) {
			updateWeatherWidget();
			// Set up auto-update every 10 minutes
			if (weatherUpdateInterval) clearInterval(weatherUpdateInterval);
			weatherUpdateInterval = setInterval(updateWeatherWidget, 10 * 60 * 1000);
		} else {
			// Clear interval when disabled
			if (weatherUpdateInterval) {
				clearInterval(weatherUpdateInterval);
				weatherUpdateInterval = null;
			}
		}
	}

	if (brandElement) {
		brandElement.style.display = showBrand ? "" : "none";
	}
}

function loadUserPreferences() {
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

		const toggleDateTime = document.getElementById("toggle-datetime");
		const toggleCountdown = document.getElementById("toggle-countdown");
		const toggleQuote = document.getElementById("toggle-quote");
		const toggleSeconds = document.getElementById("toggle-seconds");
		const toggleWeather = document.getElementById("toggle-weather");
		const toggleBrand = document.getElementById("toggle-brand");

		if (data.widgetVisibility) {
			// Update toggle inputs
			if (toggleDateTime) toggleDateTime.checked = data.widgetVisibility.dateTime;
			if (toggleCountdown) toggleCountdown.checked = data.widgetVisibility.countdown;
			if (toggleQuote) toggleQuote.checked = data.widgetVisibility.quote;
			if (toggleSeconds) toggleSeconds.checked = data.widgetVisibility.seconds;
			if (toggleWeather) toggleWeather.checked = data.widgetVisibility.weather || false;
			if (toggleBrand) toggleBrand.checked = data.widgetVisibility.brand;

			// Apply visibility settings
			updateWidgetVisibility(
				data.widgetVisibility.dateTime, 
				data.widgetVisibility.countdown, 
				data.widgetVisibility.quote, 
				data.widgetVisibility.seconds,
				data.widgetVisibility.weather || false,
				data.widgetVisibility.brand
			);
		}

		console.log(currentExam);

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

	setInterval(() => {
		if (!wallpaperRotationPaused) {
			changeWallpaper("next");
		}
	}, 5 * 60 * 1000);
}

document.addEventListener("DOMContentLoaded", () => {
	initializePage();
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
