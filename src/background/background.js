import browser from "../lib/browser-api.js";

function parseDateString(dateStr) {
	if (!dateStr) return null;
	const [day, month, year] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day);
}

async function fetchExamDates() {
	try {
		const response = await fetch("https://cdn.jsdelivr.net/gh/NovatraX/exam-countdown-extension@refs/heads/main/assets/exam-info.json");

		if (!response.ok) {
			throw new Error(`Failed To Fetch Exam Dates : ${response.status}`);
		}

		const exams = await response.json();

		if (!Array.isArray(exams)) {
			throw new Error("Invalid Data Format : 'Exams' Not An Array");
		}

		const countdowns = {
			jee: { date: new Date(2026, 0, 29).toISOString(), isActive: true },
			neet: { date: new Date(2026, 4, 4).toISOString(), isActive: true },
			jeeAdv: { date: new Date(2026, 4, 18).toISOString(), isActive: true },
		};

		function parseDateString(dateString) {
			const [day, month, year] = dateString.split("-").map(Number);
			return new Date(year, month - 1, day);
		}

		exams.forEach((exam) => {
			const parsedDate = parseDateString(exam.date);

			if (parsedDate instanceof Date && !isNaN(parsedDate)) {
				if (exam.name === "jee") {
					countdowns.jee.date = parsedDate.toISOString();
				} else if (exam.name === "jeeAdv") {
					countdowns.jeeAdv.date = parsedDate.toISOString();
				} else if (exam.name.includes("neet")) {
					countdowns.neet.date = parsedDate.toISOString();
				}
			}
		});

		await browser.storage.sync.set({
			exams,
			countdowns,
			showJEE: true,
			showNEET: true,
			showJEEADV: true,
		});

		console.log("Fetched And Stored Exam Details From Remote Source");
		return { exams, countdowns };
	} catch (error) {
		console.error("Error Fetching Exam Dates : ", error);
		throw error;
	}
}

async function fetchWallpapers() {
	try {
		const response = await fetch("https://cdn.jsdelivr.net/gh/NovatraX/exam-countdown-extension@refs/heads/main/assets/wallpapers.json");

		if (!response.ok) {
			throw new Error(`Failed To Fetch Wallpaper List : ${response.status}`);
		}

		const { images = [] } = await response.json();

		if (Array.isArray(images) && images.length > 0) {
			await browser.storage.sync.set({ wallpapers: images });
		}

		console.log("Featched And Stored Wallpapers From Remote Source");
		return { wallpapers: images };
	} catch (error) {
		console.log("Error Fetching Exam Dates : ", error);
		throw error;
	}
}

browser.runtime.onInstalled.addListener(() => {
	console.log("Extension Installed - Fetching Data");
	fetchExamDates().catch((error) => {
		console.error("Install exam-date fetch failed:", error);
	});
	fetchWallpapers().catch((error) => {
		console.error("Install wallpaper fetch failed:", error);
	});
});

browser.runtime.onStartup.addListener(() => {
	console.log("Browser Started - Fetching Data");
	fetchExamDates().catch((error) => {
		console.error("Startup exam-date fetch failed:", error);
	});
	fetchWallpapers().catch((error) => {
		console.error("Startup wallpaper fetch failed:", error);
	});
});

browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
	try {
		if (message.action === "getCountdowns") {
			const data = await browser.storage.sync.get("countdowns");
			sendResponse(data.countdowns);
		} else if (message.action === "fetchExamDates") {
			await fetchExamDates();
			sendResponse({ status: "Exam Dates Fetched Successfully" });
		} else if (message.action === "fetchWallpapers") {
			await fetchWallpapers();
			sendResponse({ status: "Wallpapers Fetched Successfully" });
		} else {
			sendResponse({ error: "Unknown Action" });
		}
	} catch (error) {
		console.error("Error Handling Message :", message.action, error);
		sendResponse({
			error: error.message || "An Error Occured While Processing Requests",
		});
	}
	return true;
});
