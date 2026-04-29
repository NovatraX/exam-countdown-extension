const SITE_BLOCKER_STORAGE_KEY = "siteBlockerSettings";
const SITE_BLOCKER_ALLOWANCES_KEY = "siteBlockerAllowances";

const defaultSiteBlockerSettings = {
	enabled: true,
	sites: [],
	patterns: [],
};

function normalizePatterns(value) {
	if (Array.isArray(value)) {
		return value.map((pattern) => String(pattern).trim()).filter(Boolean);
	}

	if (typeof value === "string") {
		return value.split("\n").map((pattern) => pattern.trim()).filter(Boolean);
	}

	return [];
}

function normalizeSite(value) {
	return String(value)
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/^www\./, "")
		.split(/[/?#]/)[0]
		.replace(/:\d+$/, "");
}

function normalizeSites(value) {
	const seenSites = new Set();

	return normalizePatterns(value)
		.map(normalizeSite)
		.filter(Boolean)
		.filter((site) => {
			if (seenSites.has(site)) {
				return false;
			}

			seenSites.add(site);
			return true;
		});
}

function normalizeSiteBlockerSettings(settings = {}) {
	const sites = normalizeSites(settings.sites || settings.patterns);

	return {
		...defaultSiteBlockerSettings,
		...settings,
		sites,
		patterns: sites.map(createHostnamePattern),
	};
}

function escapeRegex(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createHostnamePattern(hostname) {
	const normalizedHostname = normalizeSite(hostname);
	return `^https?:\\/\\/([^\\/]+\\.)?${escapeRegex(normalizedHostname)}(?::\\d+)?(?:[\\/?#]|$)`;
}

function getUrlHostname(url) {
	try {
		const parsedUrl = new URL(url);
		return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
			? parsedUrl.hostname
			: "";
	} catch {
		return "";
	}
}

function compilePatterns(patterns) {
	return normalizePatterns(patterns).map((pattern) => {
		try {
			return {
				pattern,
				regex: new RegExp(pattern, "i"),
				error: "",
			};
		} catch (error) {
			return {
				pattern,
				regex: null,
				error: error.message,
			};
		}
	});
}

function getInvalidPatterns(patterns) {
	return compilePatterns(patterns)
		.filter((compiledPattern) => compiledPattern.error)
		.map((compiledPattern) => compiledPattern.pattern);
}

function matchesBlockedUrl(url, settings) {
	const normalizedSettings = normalizeSiteBlockerSettings(settings);

	if (!normalizedSettings.enabled) {
		return false;
	}

	return compilePatterns(normalizedSettings.patterns).some((compiledPattern) => {
		if (!compiledPattern.regex) {
			return false;
		}

		return compiledPattern.regex.test(url);
	});
}

function removePatternsMatchingUrl(patterns, url) {
	return compilePatterns(patterns)
		.filter((compiledPattern) => {
			if (!compiledPattern.regex) {
				return true;
			}

			return !compiledPattern.regex.test(url);
		})
		.map((compiledPattern) => compiledPattern.pattern);
}

function removeSiteMatchingUrl(sites, url) {
	return normalizeSites(sites).filter((site) => {
		const regex = new RegExp(createHostnamePattern(site), "i");
		return !regex.test(url);
	});
}

function getTodayKey(now = new Date()) {
	return now.toISOString().slice(0, 10);
}

function normalizeAllowances(value = {}) {
	return value && typeof value === "object" ? value : {};
}

function getAllowanceForHost(allowances, hostname) {
	const normalizedHostname = normalizeSite(hostname);
	return normalizeAllowances(allowances)[normalizedHostname] || {};
}

function hasActiveAllowance(allowances, hostname, now = Date.now()) {
	const allowance = getAllowanceForHost(allowances, hostname);
	return Number(allowance.allowedUntil || 0) > now;
}

function getActiveAllowanceUntil(allowances, hostname, now = Date.now()) {
	const allowance = getAllowanceForHost(allowances, hostname);
	const allowedUntil = Number(allowance.allowedUntil || 0);
	return allowedUntil > now ? allowedUntil : 0;
}

function canUseAllowance(allowances, hostname, minutes, now = new Date()) {
	const allowance = getAllowanceForHost(allowances, hostname);
	const usedDate = allowance.usedByMinutes?.[String(minutes)];
	return usedDate !== getTodayKey(now);
}

function createAllowance(allowances, hostname, minutes, now = new Date()) {
	const normalizedHostname = normalizeSite(hostname);
	const normalizedAllowances = normalizeAllowances(allowances);
	const currentAllowance = normalizedAllowances[normalizedHostname] || {};
	const todayKey = getTodayKey(now);
	const duration = Number(minutes);

	if (!canUseAllowance(normalizedAllowances, normalizedHostname, duration, now)) {
		return normalizedAllowances;
	}

	return {
		...normalizedAllowances,
		[normalizedHostname]: {
			...currentAllowance,
			allowedUntil: now.getTime() + duration * 60 * 1000,
			usedByMinutes: {
				...(currentAllowance.usedByMinutes || {}),
				[String(duration)]: todayKey,
			},
		},
	};
}

export {
	SITE_BLOCKER_STORAGE_KEY,
	SITE_BLOCKER_ALLOWANCES_KEY,
	defaultSiteBlockerSettings,
	normalizePatterns,
	normalizeSites,
	normalizeSite,
	normalizeSiteBlockerSettings,
	createHostnamePattern,
	getUrlHostname,
	getInvalidPatterns,
	matchesBlockedUrl,
	removePatternsMatchingUrl,
	removeSiteMatchingUrl,
	normalizeAllowances,
	hasActiveAllowance,
	getActiveAllowanceUntil,
	canUseAllowance,
	createAllowance,
};
