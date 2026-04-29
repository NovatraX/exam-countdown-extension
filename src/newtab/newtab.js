import browser from "../lib/browser-api.js";
import {
  getTimeRemaining,
  getCustomExamData,
  hasValidCustomExam,
  loadCustomExamData,
  saveCustomExamData,
} from "../lib/countdown.js";

const backgrounds = [
  "https://www.ghibli.jp/gallery/kazetachinu050.jpg",
  "https://www.ghibli.jp/gallery/kimitachi016.jpg",
  "https://www.ghibli.jp/gallery/redturtle024.jpg",
  "https://www.ghibli.jp/gallery/marnie022.jpg",
];

const LOCAL_WALLPAPER_DB_NAME = "novatra-wallpapers";
const LOCAL_WALLPAPER_STORE_NAME = "wallpapers";
const LOCAL_WALLPAPER_KEY = "active-wallpaper";
const MAX_LOCAL_WALLPAPER_HEIGHT = 1080;
const MAX_LOCAL_WALLPAPER_WIDTH = 1920;
const LOCAL_WALLPAPER_DB_VERSION = 1;
const LOCAL_WALLPAPER_QUALITY = 0.85;

let wallpapersList = [];
let customWallpaper = "";
let backgroundBrightness = 0.4;
let currentWallpaperIndex = -1;
let hasUploadedWallpaper = false;
let wallpaperRotationPaused = false;
let uploadedWallpaperObjectUrl = "";

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

function openWallpaperDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      LOCAL_WALLPAPER_DB_NAME,
      LOCAL_WALLPAPER_DB_VERSION,
    );

    request.onupgradeneeded = function () {
      const db = request.result;

      if (!db.objectStoreNames.contains(LOCAL_WALLPAPER_STORE_NAME)) {
        db.createObjectStore(LOCAL_WALLPAPER_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = function () {
      resolve(request.result);
    };

    request.onerror = function () {
      reject(request.error);
    };
  });
}

async function getUploadedWallpaperRecord() {
  const db = await openWallpaperDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(LOCAL_WALLPAPER_STORE_NAME, "readonly");
    const store = transaction.objectStore(LOCAL_WALLPAPER_STORE_NAME);
    const request = store.get(LOCAL_WALLPAPER_KEY);

    request.onsuccess = function () {
      resolve(request.result || null);
    };

    request.onerror = function () {
      reject(request.error);
    };

    transaction.oncomplete = function () {
      db.close();
    };

    transaction.onerror = function () {
      db.close();
    };
  });
}

async function saveUploadedWallpaperBlob(blob, originalFileName) {
  const db = await openWallpaperDb();
  const record = {
    id: LOCAL_WALLPAPER_KEY,
    blob,
    name: originalFileName || "Uploaded wallpaper",
    type: blob.type,
    size: blob.size,
    updatedAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(LOCAL_WALLPAPER_STORE_NAME, "readwrite");
    const store = transaction.objectStore(LOCAL_WALLPAPER_STORE_NAME);
    const request = store.put(record);

    request.onsuccess = function () {
      resolve(record);
    };

    request.onerror = function () {
      reject(request.error);
    };

    transaction.oncomplete = function () {
      db.close();
    };

    transaction.onerror = function () {
      db.close();
    };
  });
}

async function deleteUploadedWallpaper() {
  const db = await openWallpaperDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(LOCAL_WALLPAPER_STORE_NAME, "readwrite");
    const store = transaction.objectStore(LOCAL_WALLPAPER_STORE_NAME);
    const request = store.delete(LOCAL_WALLPAPER_KEY);

    request.onsuccess = function () {
      resolve();
    };

    request.onerror = function () {
      reject(request.error);
    };

    transaction.oncomplete = function () {
      db.close();
    };

    transaction.onerror = function () {
      db.close();
    };
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = function () {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };

    image.onerror = function () {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Could not load the selected image."));
    };

    image.src = imageUrl;
  });
}

async function compressWallpaperFile(file) {
  if (!file || !file.type || !file.type.startsWith("image/")) {
    throw new Error("Please select a valid image file.");
  }

  const image = await loadImageElement(file);
  const scale = Math.min(
    1,
    MAX_LOCAL_WALLPAPER_WIDTH / image.naturalWidth,
    MAX_LOCAL_WALLPAPER_HEIGHT / image.naturalHeight,
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  let compressedBlob = await canvasToBlob(
    canvas,
    "image/webp",
    LOCAL_WALLPAPER_QUALITY,
  );

  if (!compressedBlob || compressedBlob.type !== "image/webp") {
    compressedBlob = await canvasToBlob(
      canvas,
      "image/jpeg",
      LOCAL_WALLPAPER_QUALITY,
    );
  }

  if (!compressedBlob) {
    throw new Error("Could not process the selected image.");
  }

  return compressedBlob;
}

async function updateUploadedWallpaperStatus(statusElement, removeButton) {
  try {
    const record = await getUploadedWallpaperRecord();
    hasUploadedWallpaper = Boolean(record?.blob);

    if (statusElement) {
      statusElement.textContent = hasUploadedWallpaper
        ? record.name || "Uploaded wallpaper"
        : "No file chosen";
    }

    if (removeButton) {
      removeButton.disabled = !hasUploadedWallpaper;
    }
  } catch (error) {
    console.error("Failed to read uploaded wallpaper status:", error);

    if (statusElement) {
      statusElement.textContent = "Could not load file name";
    }
  }
}

const fallbackMotivationalQuotes = [
  {
    content: "The best way to predict the future is to create it.",
    author: "Abraham Lincoln",
  },
  {
    content: "Believe you can and you're halfway there.",
    author: "Theodore Roosevelt",
  },
  {
    content: "It always seems impossible until it's done.",
    author: "Nelson Mandela",
  },
  {
    content:
      "Education is the most powerful weapon which you can use to change the world.",
    author: "Nelson Mandela",
  },
  {
    content: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
  },
  {
    content: "Don't watch the clock; do what it does. Keep going.",
    author: "Sam Levenson",
  },
  {
    content:
      "The future belongs to those who believe in the beauty of their dreams.",
    author: "Eleanor Roosevelt",
  },
  {
    content:
      "The more that you read, the more things you will know. The more that you learn, the more places you'll go.",
    author: "Dr. Seuss",
  },
  {
    content: "Your time is limited, don't waste it living someone else's life.",
    author: "Steve Jobs",
  },
  {
    content: "Hard work beats talent when talent doesn't work hard.",
    author: "Tim Notke",
  },
  {
    content: "The expert in anything was once a beginner.",
    author: "Helen Hayes",
  },
  {
    content: "The secret of getting ahead is getting started.",
    author: "Mark Twain",
  },
  {
    content: "Learning is never done without errors and defeat.",
    author: "Vladimir Lenin",
  },
  {
    content:
      "The only place where success comes before work is in the dictionary.",
    author: "Vidal Sassoon",
  },
];

function updateDateTime() {
  const now = new Date();

  const currentDateElement = document.getElementById("current-date");
  const currentTimeElement = document.getElementById("current-time");

  const dateOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
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
    const response = await fetch(
      "https://api.quotable.io/quotes/random?tags=inspirational|motivational|productivity|education|wisdom|success|work",
    );
    const data = await response.json();

    const quote = {
      content: data[0].content,
      author: data[0].author,
    };
    displayQuote(quote);
  } catch (error) {
    const fallbackIndex = Math.floor(
      Math.random() * fallbackMotivationalQuotes.length,
    );
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

async function setBackground() {
  const backgroundElement = document.querySelector(".background");
  if (!backgroundElement) return;

  backgroundElement.style.opacity = 0;
  document.documentElement.style.setProperty(
    "--bg-brightness",
    backgroundBrightness,
  );

  if (!browser) {
    return handleDefaultBackground();
  }

  try {
    const uploadedWallpaperRecord = await getUploadedWallpaperRecord();
    hasUploadedWallpaper = Boolean(uploadedWallpaperRecord?.blob);

    if (hasUploadedWallpaper) {
      const localWallpaperUrl = URL.createObjectURL(
        uploadedWallpaperRecord.blob,
      );
      return preloadAndSetBackground(localWallpaperUrl, {
        isLocalWallpaper: true,
        sourceLabel: uploadedWallpaperRecord.name || "Uploaded wallpaper",
      });
    }

    const { wallpaperIndex, wallpaperRotationPaused: paused } =
      await browser.storage.sync.get([
        "wallpaperIndex",
        "wallpaperRotationPaused",
      ]);

    if (paused !== undefined) {
      wallpaperRotationPaused = paused;
      updatePauseButtonIcon();
    }

    if (customWallpaper) {
      return preloadAndSetBackground(customWallpaper);
    }

    await loadWallpapers();

    if (
      wallpaperRotationPaused &&
      wallpaperIndex !== undefined &&
      wallpapersList[wallpaperIndex]
    ) {
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

function preloadAndSetBackground(url, options = {}) {
  const backgroundElement = document.querySelector(".background");
  const img = new Image();
  const isLocalWallpaper = Boolean(options.isLocalWallpaper);
  const previousUploadedWallpaperObjectUrl = uploadedWallpaperObjectUrl;

  img.src = url;
  img.onload = () => {
    setTimeout(() => {
      backgroundElement.style.backgroundImage = `url(${url})`;
      backgroundElement.style.opacity = 1;

      if (isLocalWallpaper) {
        uploadedWallpaperObjectUrl = url;

        if (
          previousUploadedWallpaperObjectUrl &&
          previousUploadedWallpaperObjectUrl !== url
        ) {
          URL.revokeObjectURL(previousUploadedWallpaperObjectUrl);
        }
      } else if (uploadedWallpaperObjectUrl) {
        URL.revokeObjectURL(uploadedWallpaperObjectUrl);
        uploadedWallpaperObjectUrl = "";
      }

      updateWallpaperInfoButton(url, isLocalWallpaper, options.sourceLabel);
    }, 500);
  };

  img.onerror = () => {
    if (isLocalWallpaper) {
      URL.revokeObjectURL(url);
    }

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
  if (hasUploadedWallpaper || wallpapersList.length === 0) return;

  const backgroundElement = document.querySelector(".background");
  if (!backgroundElement) return;

  backgroundElement.style.opacity = 0;

  if (direction === "next") {
    currentWallpaperIndex = (currentWallpaperIndex + 1) % wallpapersList.length;
  } else if (direction === "prev") {
    currentWallpaperIndex =
      (currentWallpaperIndex - 1 + wallpapersList.length) %
      wallpapersList.length;
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
        timeRemaining = {
          total: 0,
          month: 0,
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
        };
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
    countdownSecondsElement.style = `--value:${showSeconds ? timeRemaining.seconds : 0}`;
    countdownLabelElement.textContent = "";
  }
}

function updateWallpaperInfoButton(
  wallpaperUrl,
  isLocalWallpaper = false,
  sourceLabel = "",
) {
  const infoButton = document.getElementById("wallpaper-info-btn");
  let sourceUrl = "";

  if (!infoButton) return;

  if (isLocalWallpaper) {
    infoButton.href = "#";
    infoButton.removeAttribute("target");
    infoButton.title = sourceLabel || "Local uploaded wallpaper";
    return;
  }

  try {
    sourceUrl = new URL(wallpaperUrl);
    infoButton.target = "_blank";
    infoButton.title = "See Source Image";
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

  const jeeExamDate = countdowns?.jee?.date
    ? new Date(countdowns.jee.date)
    : new Date(2026, 0, 29);
  const neetExamDate = countdowns?.neet?.date
    ? new Date(countdowns.neet.date)
    : new Date(2026, 4, 4);
  const jeeAdvExamDate = countdowns?.jeeAdv?.date
    ? new Date(countdowns.jeeAdv.date)
    : new Date(2026, 4, 18);

  const labelMap = {
    neet: `NEET (${format(neetExamDate)})`,
    jee: `JEE Main (${format(jeeExamDate)})`,
    jeeAdv: `JEE Advanced (${format(jeeAdvExamDate)})`,
    custom:
      customExam && customExam.name && customExam.date instanceof Date
        ? `${customExam.name} (${format(customExam.date)})`
        : "Custom Exam",
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
  const localWallpaperUploadInput = document.getElementById(
    "local-wallpaper-upload",
  );
  const uploadedWallpaperStatus = document.getElementById(
    "uploaded-wallpaper-status",
  );
  const removeUploadedWallpaperBtn = document.getElementById(
    "remove-uploaded-wallpaper",
  );
  const brightnessSlider = document.getElementById("brightness-slider");

  const toggleDateTime = document.getElementById("toggle-datetime");
  const toggleCountdown = document.getElementById("toggle-countdown");
  const toggleQuote = document.getElementById("toggle-quote");
  const toggleSeconds = document.getElementById("toggle-seconds");
  const toggleBrand = document.getElementById("toggle-brand");

  const saveMessage = document.getElementById("save-message");

  const nextWallpaperBtn = document.getElementById("next-wallpaper");
  const prevWallpaperBtn = document.getElementById("prev-wallpaper");
  const pauseWallpaperBtn = document.getElementById("pause-wallpaper");

  function formatDateToLocalInputString(date) {
    if (!date || isNaN(date.getTime())) return "";

    const pad = (num) => num.toString().padStart(2, "0");

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1); // getMonth() is 0-indexed
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function getCurrentLocalDatetimeString() {
    const now = new Date();

    const pad = (num) => num.toString().padStart(2, "0");

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

      updateUploadedWallpaperStatus(
        uploadedWallpaperStatus,
        removeUploadedWallpaperBtn,
      );

      const customExam = getCustomExamData();
      const minTime = getCurrentLocalDatetimeString();
      customExamDateInput.min = minTime;

      if (customExam.name) {
        customExamNameInput.value = customExam.name;
      } else {
        customExamNameInput.value = "";
      }

      if (hasValidCustomExam()) {
        customExamDateInput.value = formatDateToLocalInputString(
          customExam.date,
        );

        const customExamStat = document.getElementById("custom-exam-stat");
        const customExamStatTitle = document.getElementById(
          "custom-exam-stat-title",
        );
        const customExamStatDate = document.getElementById(
          "custom-exam-stat-date",
        );

        if (customExamStat && customExamStatTitle && customExamStatDate) {
          customExamStat.classList.remove("hidden");
          customExamStatTitle.textContent = customExam.name;
          customExamStatDate.textContent = customExam.date.toLocaleDateString(
            "en-US",
            {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            },
          );
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
      document.documentElement.dataset.theme =
        document.documentElement.dataset.theme === "dark" ? "light" : "dark";

      browser.storage.sync.set({
        theme: document.documentElement.dataset.theme,
      });
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

  if (localWallpaperUploadInput) {
    localWallpaperUploadInput.addEventListener(
      "change",
      async function (event) {
        const file = event.target.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
          saveMessage.textContent = "Please select a valid image file";
          saveMessage.style.color = "red";
          this.value = "";
          return;
        }

        try {
          saveMessage.textContent = "Processing wallpaper...";
          saveMessage.style.color = "";

          const compressedWallpaper = await compressWallpaperFile(file);
          await saveUploadedWallpaperBlob(compressedWallpaper, file.name);

          hasUploadedWallpaper = true;
          customWallpaper = "";

          if (customWallpaperInput) {
            customWallpaperInput.value = "";
          }

          if (browser?.storage?.sync) {
            await browser.storage.sync.set({ customWallpaper: "" });
          }

          await updateUploadedWallpaperStatus(
            uploadedWallpaperStatus,
            removeUploadedWallpaperBtn,
          );
          await setBackground();

          saveMessage.textContent = "Wallpaper uploaded!";
          saveMessage.style.color = "";

          setTimeout(function () {
            saveMessage.textContent = "";
          }, 3000);
        } catch (error) {
          console.error("Failed to upload wallpaper:", error);
          saveMessage.textContent =
            error.message || "Failed to upload wallpaper";
          saveMessage.style.color = "red";
        } finally {
          this.value = "";
        }
      },
    );
  }

  if (removeUploadedWallpaperBtn) {
    removeUploadedWallpaperBtn.addEventListener("click", async function () {
      try {
        await deleteUploadedWallpaper();

        hasUploadedWallpaper = false;

        if (uploadedWallpaperObjectUrl) {
          URL.revokeObjectURL(uploadedWallpaperObjectUrl);
          uploadedWallpaperObjectUrl = "";
        }

        await updateUploadedWallpaperStatus(
          uploadedWallpaperStatus,
          removeUploadedWallpaperBtn,
        );
        await setBackground();

        saveMessage.textContent = "Uploaded wallpaper removed";
        saveMessage.style.color = "";

        setTimeout(function () {
          saveMessage.textContent = "";
        }, 3000);
      } catch (error) {
        console.error("Failed to remove uploaded wallpaper:", error);
        saveMessage.textContent = "Failed to remove uploaded wallpaper";
        saveMessage.style.color = "red";
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
      const youtubeRegex =
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
      const youtubeMatch = url.match(youtubeRegex);

      if (youtubeMatch && youtubeMatch[1]) {
        youtubeEmbed.classList.remove("hidden");

        const videoId = youtubeMatch[1];
        const embedUrl = `https://novatrax.github.io/yt-embed-proxy/?v=${videoId}`;

        while (youtubeEmbed.firstChild) {
          youtubeEmbed.removeChild(youtubeEmbed.firstChild);
        }
        const iframe = document.createElement("iframe");
        iframe.width = "100%";
        iframe.height = "100%";
        iframe.src = embedUrl;
        iframe.title = "YouTube video player";
        iframe.style.border = "none";
        iframe.setAttribute(
          "allow",
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope",
        );
        iframe.setAttribute(
          "referrerpolicy",
          "strict-origin-when-cross-origin",
        );
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
          saveMessage.textContent =
            "Please enter a valid date for your custom exam";
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

          updateWidgetVisibility(
            showDateTime,
            showCountdown,
            showQuote,
            showSeconds,
            showBrand,
          );

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

function updateWidgetVisibility(
  showDateTime,
  showCountdown,
  showQuote,
  showSeconds,
  showBrand,
) {
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
      if (toggleDateTime)
        toggleDateTime.checked = data.widgetVisibility.dateTime;
      if (toggleCountdown)
        toggleCountdown.checked = data.widgetVisibility.countdown;
      if (toggleQuote) toggleQuote.checked = data.widgetVisibility.quote;
      if (toggleSeconds) toggleSeconds.checked = data.widgetVisibility.seconds;
      if (toggleBrand) toggleBrand.checked = data.widgetVisibility.brand;

      // Apply visibility settings
      updateWidgetVisibility(
        data.widgetVisibility.dateTime,
        data.widgetVisibility.countdown,
        data.widgetVisibility.quote,
        data.widgetVisibility.seconds,
        data.widgetVisibility.brand,
      );
    }

    console.log(currentExam);

    updateNovatraLink(currentExam);
    setBackground();
  });
}

async function refetchData() {
  try {
    const responses = await Promise.all([
      browser.runtime.sendMessage({ action: "fetchExamDates" }),
      browser.runtime.sendMessage({ action: "fetchWallpapers" }),
    ]);

    const failedResponse = responses.find((response) => response?.error);

    if (failedResponse) {
      throw new Error(failedResponse.error);
    }

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

  setInterval(
    () => {
      if (!wallpaperRotationPaused) {
        changeWallpaper("next");
      }
    },
    5 * 60 * 1000,
  );
}

document.addEventListener("DOMContentLoaded", () => {
  initializePage();
  const refetchBtn = document.getElementById("refetch-data-btn");

  if (refetchBtn) {
    refetchBtn.addEventListener("click", refetchData);
  }
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
