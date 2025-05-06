import browser from "webextension-polyfill";

let customExamName = "Custom Exam";
let customExamDate = null;

function parseDateString(dateStr) {
    if (!dateStr) return null;

    const [day, month, year] = dateStr.split("-").map((num) => parseInt(num, 10));
    return new Date(year, month - 1, day);
}

async function fetchExamDates() {
    let jeeExamDate, neetExamDate, jeeAdvExamDate;

    try {
        const response = await fetch("https://cdn.jsdelivr.net/gh/NovatraX/exam-countdown-extension@main/assets/exam-info.json");
        if (!response.ok) {
            throw new Error(`Failed to fetch exam data: ${response.status}`);
        }

        const examData = await response.json();

        examData.forEach(exam => {
            const parsedDate = parseDateString(exam.date);
            switch (exam.name.toLowerCase()) {
                case "jee main":
                    jeeExamDate = parsedDate;
                    break;
                case "neet":
                    neetExamDate = parsedDate;
                    break;
                case "jee advanced":
                    jeeAdvExamDate = parsedDate;
                    break;
            }
        });

        console.log("Exam Dates Updated From Remote Source");
    } catch (error) {
        console.error("Error Fetching Exam Info", error);
    
        jeeExamDate = new Date(2026, 0, 29);       // 29-01-2026
        neetExamDate = new Date(2026, 4, 4);        // 04-05-2026
        jeeAdvExamDate = new Date(2025, 4, 18);     // 18-05-2025
    }

    return {
        jeeExamDate,
        neetExamDate,
        jeeAdvExamDate
    };
}

async function loadCustomExamData() {
    if (!browser.storage) return;

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
    if (!browser.storage) return false;

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

function formatTime(time) {
    return time < 10 ? `0${time}` : time;
}

fetchExamDates()
    .then(() => loadCustomExamData())
    .catch((error) => console.error("Error during initialization:", error));

export { jeeExamDate, neetExamDate, jeeAdvExamDate, getTimeRemaining, formatTime, saveCustomExamData, getCustomExamData, hasValidCustomExam, fetchExamDates };
