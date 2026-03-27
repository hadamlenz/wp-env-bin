const { writeFileSync, mkdirSync } = require("fs");
const { execSync } = require("child_process");
const path = require("path");
const { logger } = require("../lib/utils/log");
const { readLocalConfig, getConfigValue } = require("../lib/env/config");
const { parseArgs, buildLocalUrl, slugify, diffScreenshots, classify, writeReport } = require("../lib/compare");

// ─── Local helpers ────────────────────────────────────────────────────────────

/**
 * Read the local wp-env port from .wp-env.json.
 * Falls back to 8889 if the file is missing or the port is not set.
 *
 * @returns {number}
 */
function readPort() {
	return getConfigValue("wp-env.env.development.port") || 8889;
}

// ─── Sitemap fetch ────────────────────────────────────────────────────────────

/**
 * Extract all `<loc>` URLs from a sitemap XML string.
 * If the XML is a sitemap index, recursively fetches and parses the first child sitemap.
 *
 * @param {string} xml - Raw sitemap XML content
 * @returns {Promise<string[]>}
 */
async function fetchSitemapUrls(xml) {
	const isSitemapIndex = /<sitemap>/i.test(xml);
	if (isSitemapIndex) {
		// fetch the first child sitemap
		const childMatch = xml.match(/<loc>(https?:\/\/[^<]+)<\/loc>/i);
		if (!childMatch) return [];
		const childXml = await fetch(childMatch[1].trim()).then((r) => r.text());
		return fetchSitemapUrls(childXml);
	}
	const locs = [];
	const locRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
	let match;
	while ((match = locRegex.exec(xml)) !== null) {
		locs.push(match[1].trim());
	}
	return locs;
}

/**
 * Fetch the sitemap from the live site and return all page URLs.
 * Handles both regular sitemaps and sitemap index files.
 *
 * @param {string} liveDomain - Live site domain (e.g. `example.com`)
 * @returns {Promise<string[]>}
 */
async function fetchSitemap(liveDomain) {
	const sitemapUrl = "https://" + liveDomain + "/sitemap.xml";
	const res = await fetch(sitemapUrl);
	if (!res.ok) {
		throw new Error("Could not fetch sitemap at " + sitemapUrl + " (HTTP " + res.status + ")");
	}
	const xml = await res.text();
	return fetchSitemapUrls(xml);
}

// ─── Screenshot ───────────────────────────────────────────────────────────────

/**
 * Navigate a Playwright page to a URL and capture a full-page screenshot.
 *
 * @param {import('playwright').Page} page - Playwright page instance
 * @param {string} url - URL to navigate to
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function takeScreenshot(page, url) {
	await page.goto(url, { waitUntil: "load", timeout: 30000 });
	// Hide common consent/cookie banners before screenshotting
	await page.addStyleTag({
		content: `
			/* OneTrust */
			#onetrust-banner-sdk, #onetrust-consent-sdk,
			/* Cookiebot */
			#CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay,
			/* Generic patterns */
			[id*="cookie-banner"], [id*="cookie-consent"], [id*="cookie-notice"],
			[class*="cookie-banner"], [class*="cookie-consent"], [class*="cookie-notice"],
			[id*="gdpr"], [class*="gdpr"],
			[id*="consent-banner"], [class*="consent-banner"],
			/* Popup overlays */
			.pum-overlay, .pum-container
			{ display: none !important; }
			body { overflow: auto !important; }
		`,
	});
	await page.waitForTimeout(500); // let animations/lazy rendering settle
	await page.waitForLoadState('networkidle');
	await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));//scroll the page to make lazy images load
	return page.screenshot({ fullPage: true });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Main entry point for the compare command.
 * Discovers URLs (from --url flag or sitemap), screenshots each on live and local,
 * runs pixel diffs, saves PNGs, and writes an HTML report.
 * Returns result metadata so the caller can prompt and handle process.exit.
 *
 * @param {string[]} argv - Raw CLI arguments after `wp-env-bin visual compare`
 * @returns {Promise<{ reportPath: string, failCount: number, errorCount: number }>}
 */
async function compare(argv) {
	const { url: urlFlag, limit, threshold, testPaths } = parseArgs(argv);

	// Read local config for the live domain, and the local wp-env port from .wp-env.json
	const config = readLocalConfig();
	const liveDomain = config.url;
	const port = readPort();

	// Build a timestamped folder name for this run's report (e.g. example.com-20260325-14:30)
	const now = new Date();
	const pad = (n) => String(n).padStart(2, "0");
	// Build a timestamp string in YYYYMMDD-HH:MM format (e.g. 20260325-14:30)
	const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}:${pad(now.getMinutes())}`;
	//the folder is names after the domain and the timestamp, e.g. example.com-20260325-14:30
	const reportFolderName = liveDomain + "-" + timestamp;
	const reportDir = path.join(process.cwd(), "wp-env-bin/compare-reports", reportFolderName);

	logger("wp-env-bin visual compare — live: " + liveDomain + " → local: localhost:" + port + "\n");

	// ── Discover URLs ─────────────────────────────────────────────────────────
	// Three sources in priority order:
	//   1. --test-paths  → read the "test-paths" array from config
	//   2. --url <path>  → single page (path or full URL)
	//   3. (default)     → fetch the live sitemap and use the first <limit> URLs
	let urls;
	if (testPaths) {
		const paths = config["test-paths"];
		if (!Array.isArray(paths) || paths.length === 0) {
			throw new Error(
				'wp-env-bin.config.json is missing a "test-paths" array. ' +
				'Add one or omit --test-paths.'
			);
		}
		urls = paths.map((p) => "https://" + liveDomain + (p.startsWith("/") ? p : "/" + p));
		process.stdout.write("Using " + urls.length + " path" + (urls.length !== 1 ? "s" : "") + " from test-paths config.\n\n");
	} else if (urlFlag) {
		// Accept either a bare path (/about/) or a full URL; normalize to full URL
		let fullUrl;
		try {
			new URL(urlFlag);
			fullUrl = urlFlag;
		} catch {
			fullUrl = "https://" + liveDomain + (urlFlag.startsWith("/") ? urlFlag : "/" + urlFlag);
		}
		urls = [fullUrl];
	} else {
		process.stdout.write("Fetching sitemap...");
		const allSitemapUrls = await fetchSitemap(liveDomain);
		const urlsToTest = allSitemapUrls.slice(0, limit);
		process.stdout.write(" " + allSitemapUrls.length + " URLs found. Testing first " + urlsToTest.length + ".\n\n");
		urls = urlsToTest;
	}

	// ── Launch Playwright ─────────────────────────────────────────────────────
	// Resolve from the project's local node_modules so this works whether
	// wp-env-bin is installed globally or as a dev dependency.
	let chromium;
	try {
		const playwrightPath = require.resolve("playwright", { paths: [process.cwd()] });
		({ chromium } = require(playwrightPath));
	} catch {
		throw new Error(
			"Playwright is not installed. Run: npm install\n" +
			"Then install the browser once: npx playwright install chromium"
		);
	}

	let browser;
	try {
		browser = await chromium.launch();
	} catch {
		throw new Error(
			"Playwright browser not found. Run: npx playwright install chromium"
		);
	}

	// ── Screenshot + diff each URL ────────────────────────────────────────────
	const results = [];

	for (const liveUrl of urls) {
		const urlPath = new URL(liveUrl).pathname;
		const localUrl = buildLocalUrl(liveDomain, urlPath, port);
		const slug = slugify(urlPath);

		process.stdout.write("  " + urlPath.padEnd(40));

		// Each page gets its own subdirectory: pages/<slug>/live.png, local.png, diff.png
		const pageDir = path.join(reportDir, "pages", slug);
		mkdirSync(pageDir, { recursive: true });

		let livePng, localPng;
		const page = await browser.newPage({ viewport: { width: 1980, height: 900 } });
		try {
			//take live screen shot first
			livePng = await takeScreenshot(page, liveUrl);
			await page.goto("about:blank"); // clear state between screenshots
			//take the local screen shot
			localPng = await takeScreenshot(page, localUrl);
		} catch (err) {
			// Screenshot failed (timeout, DNS error, etc.) — record as error and move on
			const msg = err.message.split("\n")[0];
			process.stdout.write("E  " + msg + "\n");
			results.push({ path: urlPath, slug, diffPercent: null, status: "error", error: msg });
			continue;
		} finally {
			await page.close();
		}

		// Pixel-diff the two screenshots and classify the result
		const { diffPercent, diffPng } = diffScreenshots(livePng, localPng, threshold);
		const status = classify(diffPercent, threshold);

		writeFileSync(path.join(pageDir, "live.png"), livePng);
		writeFileSync(path.join(pageDir, "local.png"), localPng);
		writeFileSync(path.join(pageDir, "diff.png"), diffPng);

		const icon = status === "pass" ? "✓" : status === "warn" ? "!" : "✗";
		process.stdout.write(icon + " " + diffPercent.toFixed(2) + "% diff\n");

		results.push({ path: urlPath, slug, diffPercent, status });
	}

	await browser.close();

	// ── Write report and print summary ────────────────────────────────────────
	mkdirSync(reportDir, { recursive: true });
	writeReport(reportDir, results);

	// Pages where the pixel diff is below the threshold — visually identical
	const passCount = results.filter((r) => r.status === "pass").length;
	// Pages where the diff is between 1× and 5× the threshold — minor visual differences worth reviewing
	const warnCount = results.filter((r) => r.status === "warn").length;
	// Pages where the diff is at or above 5× the threshold — significant visual regression
	const failCount = results.filter((r) => r.status === "fail").length;
	// Pages that could not be screenshotted (timeout, DNS failure, etc.)
	const errorCount = results.filter((r) => r.status === "error").length;

	logger(
		"\n" + "─".repeat(52) + "\n" +
		"Results: " + passCount + " passed, " + warnCount + " warning" + (warnCount !== 1 ? "s" : "") +
		", " + failCount + " failed, " + errorCount + " error" + (errorCount !== 1 ? "s" : "") +
		" (" + results.length + " tested)"
	);
	logger("Report:  wp-env-bin/compare-reports/" + reportFolderName + "/index.html");

	const reportPath = path.join(reportDir, "index.html");
	return { reportPath, failCount, errorCount };
}

module.exports = { compare };
