import {
  getTimeRemaining,
  getCustomExamData,
  hasValidCustomExam,
  loadCustomExamData,
} from "../newtab/newtab.js";
import { initializePopupTodoUI } from "./popup-todo-ui.js";
import browser from "webextension-polyfill";

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

  // JEE Main countdown
  const jeeTime = getTimeRemaining(jeeExamDate);
  if (jeeTime.total <= 0) {
    document.getElementById("jee-timer").innerHTML =
      "<p class='font-medium text-success'>Exam day has arrived!</p>";
  } else {
    document.getElementById("jee-months").style = `--value:${jeeTime.month}`;
    document.getElementById("jee-days").style = `--value:${jeeTime.days}`;
    document.getElementById("jee-hours").style = `--value:${jeeTime.hours}`;
    document.getElementById("jee-minutes").style = `--value:${jeeTime.minutes}`;
    document.getElementById("jee-seconds").style = `--value:${jeeTime.seconds}`;
  }

  // JEE Advanced countdown
  const jeeAdvTime = getTimeRemaining(jeeAdvExamDate);
  if (jeeAdvTime.total <= 0) {
    document.getElementById("jee-adv-timer").innerHTML =
      "<p class='font-medium text-success'>Exam day has arrived!</p>";
  } else {
    document.getElementById(
      "jee-adv-months"
    ).style = `--value:${jeeAdvTime.month}`;
    document.getElementById(
      "jee-adv-days"
    ).style = `--value:${jeeAdvTime.days}`;
    document.getElementById(
      "jee-adv-hours"
    ).style = `--value:${jeeAdvTime.hours}`;
    document.getElementById(
      "jee-adv-minutes"
    ).style = `--value:${jeeAdvTime.minutes}`;
    document.getElementById(
      "jee-adv-seconds"
    ).style = `--value:${jeeAdvTime.seconds}`;
  }

  // NEET countdown
  const neetTime = getTimeRemaining(neetExamDate);
  if (neetTime.total <= 0) {
    document.getElementById("neet-timer").innerHTML =
      "<p class='font-medium text-success'>Exam day has arrived!</p>";
  } else {
    document.getElementById("neet-months").style = `--value:${neetTime.month}`;
    document.getElementById("neet-days").style = `--value:${neetTime.days}`;
    document.getElementById("neet-hours").style = `--value:${neetTime.hours}`;
    document.getElementById(
      "neet-minutes"
    ).style = `--value:${neetTime.minutes}`;
    document.getElementById(
      "neet-seconds"
    ).style = `--value:${neetTime.seconds}`;
  }

  // Custom exam countdown
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

    const customExamTime = getTimeRemaining(customExam.date);
    if (customExamTime.total <= 0) {
      document.getElementById("custom-exam-timer").innerHTML =
        "<p class='font-medium text-success'>Exam day has arrived!</p>";
    } else {
      document.getElementById(
        "custom-exam-months"
      ).style = `--value:${customExamTime.month}`;
      document.getElementById(
        "custom-exam-days"
      ).style = `--value:${customExamTime.days}`;
      document.getElementById(
        "custom-exam-hours"
      ).style = `--value:${customExamTime.hours}`;
      document.getElementById(
        "custom-exam-minutes"
      ).style = `--value:${customExamTime.minutes}`;
      document.getElementById(
        "custom-exam-seconds"
      ).style = `--value:${customExamTime.seconds}`;
    }
  } else {
    const customExamSection = document.getElementById("custom-exam-section");

    if (customExamSection) {
      customExamSection.classList.add("hidden");
    }
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

  if (browser.storage) {
    browser.storage.sync.set({ theme: newTheme }).catch(function (error) {
      console.error("Error saving theme preference:", error);
    });
  }
}

function openFullCountdown() {
  browser.tabs.create({ url: browser.runtime.getURL("newtab/newtab.html") });
}

function initializeTabs() {
  const examTab = document.getElementById("exam-tab");
  const todoTab = document.getElementById("todo-tab");
  const examContent = document.getElementById("exam-content");
  const todoContent = document.getElementById("todo-content");

  if (examTab && todoTab && examContent && todoContent) {
    examTab.addEventListener("click", () => {
      // Switch to exam tab
      examTab.classList.add("tab-active");
      todoTab.classList.remove("tab-active");
      examContent.classList.remove("hidden");
      todoContent.classList.add("hidden");
    });

    todoTab.addEventListener("click", () => {
      // Switch to todo tab
      todoTab.classList.add("tab-active");
      examTab.classList.remove("tab-active");
      todoContent.classList.remove("hidden");
      examContent.classList.add("hidden");
    });
  }
}

document.addEventListener("DOMContentLoaded", function () {
  updateCountdown();
  loadThemePreference();
  initializeTabs(); // Initialize tab functionality
  initializePopupTodoUI(); // Initialize popup todo UI
  setInterval(updateCountdown, 1000);

  const themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }
});
