import browser from "webextension-polyfill";
import { fetchExamDates, getTimeRemaining, saveCustomExamData, getCustomExamData, hasValidCustomExam } from "../common/countdown-data.js";

const backgrounds = ["https://www.ghibli.jp/gallery/kimitachi016.jpg", "https://www.ghibli.jp/gallery/redturtle024.jpg", "https://www.ghibli.jp/gallery/marnie022.jpg", "https://www.ghibli.jp/gallery/kazetachinu050.jpg"];

let currentExam = "jeeAdv";
let wallpapersList = [];
let customWallpaper = "";
let currentWallpaperUrl = "";
let backgroundBrightness = 0.4;
let currentWallpaperIndex = -1;
let wallpaperRotationPaused = false;
let jeeExamDate, neetExamDate, jeeAdvExamDate;

(async () => {
    const examDates = await fetchExamDates();
    jeeExamDate = examDates.jeeExamDate;
    neetExamDate = examDates.neetExamDate;
    jeeAdvExamDate = examDates.jeeAdvExamDate;

    updateCountdown();
})();

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
    const formattedDate = now.toLocaleDateString("en-US", dateOptions);
    currentDateElement.textContent = formattedDate;

    const timeOptions = { hour: "2-digit", minute: "2-digit", hour12: true };
    const formattedTime = now.toLocaleTimeString("en-US", timeOptions);
    currentTimeElement.textContent = formattedTime;
}

function displayRandomQuote() {
    const quoteTextElement = document.getElementById("quote-text");
    const quoteAuthorElement = document.getElementById("quote-author");

    quoteTextElement.style.opacity = 0;
    quoteAuthorElement.style.opacity = 0;

    let fallbackIndex = Math.floor(Math.random() * fallbackMotivationalQuotes.length);
    let fallbackQuote = fallbackMotivationalQuotes[fallbackIndex];

    fetch("http://api.quotable.io/quotes/random?tags=inspirational|motivational|productivity|education|wisdom|success|work")
        .then((res) => res.json())
        .then((data) => {
            const quote = {
                content: data[0].content,
                author: data[0].author,
            };
            displayQuote(quote);
        })
        .catch(() => {
            displayQuote(fallbackQuote);
        });

    function displayQuote(q) {
        setTimeout(() => {
            quoteTextElement.textContent = `"${q.content}"`;
            quoteAuthorElement.textContent = `— ${q.author}`;

            quoteTextElement.style.opacity = 1;
            quoteAuthorElement.style.opacity = 1;
        }, 300);
    }
}

function setBackground() {
    const backgroundElement = document.querySelector(".background");
    if (!backgroundElement) return;

    backgroundElement.style.opacity = 0;
    document.documentElement.style.setProperty("--bg-brightness", backgroundBrightness);

    if (browser) {
        browser.storage.sync
            .get(["wallpaperIndex", "wallpaperRotationPaused"])
            .then((data) => {
                if (data.wallpaperRotationPaused !== undefined) {
                    wallpaperRotationPaused = data.wallpaperRotationPaused;
                    updatePauseButtonIcon();
                }

                if (customWallpaper) {
                    preloadAndSetBackground(customWallpaper);
                    return;
                }
                loadWallpapers().then(() => {
                    if (wallpaperRotationPaused && data.wallpaperIndex !== undefined && wallpapersList[data.wallpaperIndex]) {
                        currentWallpaperIndex = data.wallpaperIndex;
                        preloadAndSetBackground(wallpapersList[currentWallpaperIndex]);
                    } else {
                        changeWallpaper("random");
                    }
                });
            })
            .catch((err) => {
                console.warn("Failed To Restore Wallpaper State :", err);

                if (customWallpaper) {
                    preloadAndSetBackground(customWallpaper);
                    return;
                }

                loadWallpapers().then(() => {
                    changeWallpaper("random");
                });
            });
    } else {
        if (customWallpaper) {
            preloadAndSetBackground(customWallpaper);
            return;
        }

        loadWallpapers().then(() => {
            changeWallpaper("random");
        });
    }

    function preloadAndSetBackground(url) {
        const img = new Image();
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
}

async function loadWallpapers() {
    if (wallpapersList.length > 0) {
        return;
    }

    try {
        const response = await fetch("https://cdn.jsdelivr.net/gh/NovatraX/exam-countdown-extension@refs/heads/main/assets/wallpapers.json");
        const data = await response.json();

        if (Array.isArray(data.images) && data.images.length) {
            wallpapersList = data.images;
        } else {
            wallpapersList = backgrounds;
        }
    } catch (err) {
        console.warn("Failed To Load Backgrounds, Using Fallback.", err);
        wallpapersList = backgrounds;
    }
}

function changeWallpaper(direction) {
    if (wallpapersList.length === 0) {
        return;
    }

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
    const img = new Image();
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

function updateCountdown() {
    const countdownDaysElement = document.getElementById("countdown-days");
    const countdownHoursElement = document.getElementById("countdown-hours");
    const countdownMonthsElement = document.getElementById("countdown-months");
    const countdownMinutesElement = document.getElementById("countdown-minutes");
    const countdownSecondsElement = document.getElementById("countdown-seconds");
    const countdownLabelElement = document.getElementById("countdown-label");
    const examBadgeElement = document.getElementById("exam-badge");
    let timeRemaining;
    let examName;
    const toggleSeconds = document.getElementById("toggle-seconds");
    let showSeconds = toggleSeconds ? toggleSeconds.checked : true;
    const secondsContainer = document.getElementById('seconds-container');   

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
    if (!infoButton) return;

    let sourceUrl = "";
    try {
        sourceUrl = new URL(wallpaperUrl);

        console.log(sourceUrl);
    } catch (e) {
        console.error("Invalid wallpaper URL:", e);
        sourceUrl = "https://novatra.in";
    }

    infoButton.href = sourceUrl;
}

function setupEventListeners() {
    const customWallpaperInput = document.getElementById("custom-wallpaper");
    const brightnessSlider = document.getElementById("brightness-slider");
    const preferencesForm = document.getElementById("preferences-form");

    const optionsModal = document.getElementById("options-modal");
    const examSelector = document.getElementById("exam-selector");
    const saveMessage = document.getElementById("save-message");

    const customExamSection = document.getElementById("custom-exam-section");
    const customExamNameInput = document.getElementById("custom-exam-name");
    const customExamDateInput = document.getElementById("custom-exam-date");

    const toggleDateTime = document.getElementById("toggle-datetime");
    const toggleCountdown = document.getElementById("toggle-countdown");
    const toggleQuote = document.getElementById("toggle-quote");
    const toggleSeconds = document.getElementById("toggle-seconds");
    const toggleBrand = document.getElementById("toggle-brand");

    const themeToggle = document.getElementById("theme-toggle");

    const jeeDate = document.getElementById("jee-date");
    const neetDate = document.getElementById("neet-date");
    const jeeAdvDate = document.getElementById("jeeadv-date");

    const musicBtn = document.getElementById("music-btn");
    const optionsLink = document.getElementById("options-link");

    const nextWallpaperBtn = document.getElementById("next-wallpaper");
    const prevWallpaperBtn = document.getElementById("prev-wallpaper");
    const pauseWallpaperBtn = document.getElementById("pause-wallpaper");

    const dateOptions = { year: "numeric", month: "long", day: "numeric" };
    if (jeeDate) jeeDate.textContent = jeeExamDate.toLocaleDateString("en-US", dateOptions);
    if (neetDate) neetDate.textContent = neetExamDate.toLocaleDateString("en-US", dateOptions);
    if (jeeAdvDate) jeeAdvDate.textContent = jeeAdvExamDate.toLocaleDateString("en-US", dateOptions);
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
                iframe.frameBorder = "0";
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

                    updateWidgetVisibility(showDateTime, showCountdown, showQuote, showSeconds, showBrand);

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

    if (examSelector) {
        examSelector.addEventListener("change", function () {
            const selectedExam = this.value;

            if (selectedExam === "custom") {
                customExamSection.classList.remove("hidden");
            } else {
                customExamSection.classList.add("hidden");
            }
        });
    }

    if (customExamSection) {
        customExamSection.classList.add("hidden");
    }
}

function updateNovatraLink(exam) {
    const novatraLink = document.getElementById("novatra-link");
    if (!novatraLink) return;

    switch (exam) {
        case "jee":
            novatraLink.href = "https://novatra.in/exams/jee-main/";
            break;
        case "jeeAdv":
            novatraLink.href = "https://novatra.in/exams/jee-advanced/";
            break;
        case "neet":
            novatraLink.href = "https://novatra.in/exams/neet/";
            break;
        case "custom":
            novatraLink.href = "https://novatra.in/";
            break;
        default:
            novatraLink.href = "https://novatra.in/";
            break;
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

function updateWidgetVisibility(showDateTime, showCountdown, showQuote, showSeconds, showBrand) {
    const dateTimeElement = document.getElementById("clock-class");
    const countdownElement = document.getElementById("countdown-class");
    const quoteElement = document.getElementById("quote-class");
    const secondsElement = document.getElementById("seconds-container");
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
        const toggleBrand = document.getElementById("toggle-brand");

        if (data.widgetVisibility) {
            // Update toggle inputs
            if (toggleDateTime) toggleDateTime.checked = data.widgetVisibility.dateTime;
            if (toggleCountdown) toggleCountdown.checked = data.widgetVisibility.countdown;
            if (toggleQuote) toggleQuote.checked = data.widgetVisibility.quote;
            if (toggleSeconds) toggleSeconds.checked = data.widgetVisibility.seconds;
            if (toggleBrand) toggleBrand.checked = data.widgetVisibility.brand;

            // Apply visibility settings
            updateWidgetVisibility(data.widgetVisibility.dateTime, data.widgetVisibility.countdown, data.widgetVisibility.quote, data.widgetVisibility.seconds, data.widgetVisibility.brand);
        }

        console.log(currentExam);

        updateNovatraLink(currentExam);
        setBackground();
    });
}

function initializePage() {
    updateDateTime();
    updateCountdown();
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

document.addEventListener("DOMContentLoaded", initializePage);

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
