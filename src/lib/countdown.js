import browser from "./browser-api.js";

let customExamName = "Custom Exam";
let customExamDate = null;

async function loadCustomExamData() {
  if (!browser.storage?.sync) {
    return;
  }

  try {
    const data = await browser.storage.sync.get([
      "customExamName",
      "customExamDate",
    ]);

    if (data.customExamName) {
      customExamName = data.customExamName;
    }

    customExamDate = data.customExamDate ? new Date(data.customExamDate) : null;
  } catch (error) {
    console.error("Error loading custom exam data:", error);
  }
}

function saveCustomExamData(name, date) {
  if (!browser.storage?.sync) {
    return false;
  }

  customExamName = name || "Custom Exam";
  customExamDate = date;

  const dateValueToStore =
    customExamDate && !isNaN(customExamDate.getTime())
      ? customExamDate.toISOString()
      : null;

  try {
    browser.storage.sync.set({
      customExamName,
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
  const days = Math.floor(
    (total % (1000 * 60 * 60 * 24 * 30)) / (1000 * 60 * 60 * 24),
  );
  const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60));
  const result = { total, month, days, hours, minutes };

  if (showSeconds) {
    result.seconds = Math.floor((total % (1000 * 60)) / 1000);
  }

  return result;
}

export {
  getTimeRemaining,
  getCustomExamData,
  hasValidCustomExam,
  loadCustomExamData,
  saveCustomExamData,
};
