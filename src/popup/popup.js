// Exam Dates (make sure they are in the future)
const exams = {
  custom: null, 
  jee: new Date("2025-12-15T09:00:00"),
  jeeAdv: new Date("2025-12-30T09:00:00"),
  neet: new Date("2026-01-05T09:00:00")
};

// Calculate remaining time
function getTimeRemaining(endTime) {
  const total = Date.parse(endTime) - Date.now();
  if (total <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };

  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  const seconds = Math.floor((total / 1000) % 60);

  return { total, days, hours, minutes, seconds };
}

// Update all countdowns
function updateCountdown() {
  for (const exam in exams) {
    const endTime = exams[exam];
    if (!endTime) continue;

    const t = getTimeRemaining(endTime);

    // Show exam day message if passed
    if (t.total <= 0) {
      const sectionId = exam === "custom" ? "custom-exam-section" : `${exam}-timer`;
      const section = document.getElementById(sectionId);
      if (section) section.innerHTML = "<p class='font-medium text-green-400'>Exam day has arrived!</p>";
      continue;
    }

    if (exam === "custom") document.getElementById("custom-exam-section").classList.remove("hidden");

    const ids = exam === "custom"
      ? ["custom-exam-days","custom-exam-hours","custom-exam-minutes","custom-exam-seconds"]
      : [`${exam}-days`,`${exam}-hours`,`${exam}-minutes`,`${exam}-seconds`];

    const values = [t.days, t.hours, t.minutes, t.seconds];

    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      if(el) el.textContent = values[i];
    });
  }
}

// Theme
function loadThemePreference() {
  const theme = localStorage.getItem("theme") || "dark";
  if(theme === "dark") document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
}

function toggleTheme() {
  if(document.documentElement.classList.contains("dark")){
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme","light");
  } else {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme","dark");
  }
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  loadThemePreference();
  updateCountdown();
  setInterval(updateCountdown, 1000);

  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
});
