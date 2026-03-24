const { writeFileSync, mkdirSync } = require("fs");
const path = require("path");
const { logger } = require("../lib/utils/log");
const { readLocalConfig, readWpEnvJson } = require("../lib/env/config");
const { parseArgs, buildLocalUrl, slugify, diffScreenshots, classify, writeReport } = require("../lib/compare");

// ─── Local helpers ────────────────────────────────────────────────────────────

/**
 * Read the local wp-env port from .wp-env.json.
 * Falls back to 8889 if the file is missing or the port is not set.
 *
 * @returns {number}
 */
function readPort() {
	try {
		const wpEnv = readWpEnvJson();
		return (wpEnv.env && wpEnv.env.development && wpEnv.env.development.port) || 8889;
	} catch {
		return 8889;
	}
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
	await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
	await page.waitForTimeout(500); // let animations/lazy rendering settle
	return page.screenshot({ fullPage: true });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Main entry point for the compare command.
 * Discovers URLs (from --url flag or sitemap), screenshots each on live and local,
 * runs pixel diffs, saves PNGs, and writes an HTML report.
 * Exits with code 1 if any pages fail.
 *
 * @param {string[]} argv - Raw CLI arguments after `wp-env-bin compare`
 * @returns {Promise<void>}
 */
async function compare(argv) {
	const { url: urlFlag, limit, threshold } = parseArgs(argv);

	const config = readLocalConfig();
	const liveDomain = config.url;
	const port = readPort();
	const reportDir = path.join(process.cwd(), "wp-env-bin/compare-report");

	logger("wp-env-bin compare — live: " + liveDomain + " → local: localhost:" + port + "\n");

	// Discover URLs
	let urls;
	if (urlFlag) {
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

	// Launch Playwright — resolve from the project's local node_modules so this
	// works whether wp-env-bin is installed globally or as a dev dependency.
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

	const results = [];

	for (const liveUrl of urls) {
		const urlPath = new URL(liveUrl).pathname;
		const localUrl = buildLocalUrl(liveDomain, urlPath, port);
		const slug = slugify(urlPath);

		process.stdout.write("  " + urlPath.padEnd(40));

		const pageDir = path.join(reportDir, "pages", slug);
		mkdirSync(pageDir, { recursive: true });

		let livePng, localPng;
		const page = await browser.newPage({ viewport: { width: 1980, height: 900 } });
		try {
			livePng = await takeScreenshot(page, liveUrl);
			await page.goto("about:blank");
			localPng = await takeScreenshot(page, localUrl);
		} finally {
			await page.close();
		}

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

	mkdirSync(reportDir, { recursive: true });
	writeReport(reportDir, results);

	const passCount = results.filter((r) => r.status === "pass").length;
	const warnCount = results.filter((r) => r.status === "warn").length;
	const failCount = results.filter((r) => r.status === "fail").length;

	logger(
		"\n" + "─".repeat(52) + "\n" +
		"Results: " + passCount + " passed, " + warnCount + " warning" + (warnCount !== 1 ? "s" : "") +
		", " + failCount + " failed (" + results.length + " tested)"
	);
	logger("Report:  wp-env-bin/compare-report/index.html");

	if (failCount > 0) {
		process.exit(1);
	}
}

/**
 * Print compare-specific usage to stdout.
 */
function compareHelp() {
	console.log(`
wp-env-bin compare — Visual A/B regression: screenshot live vs local and diff

Usage:
  wp-env-bin compare [flags]

Flags:
  --url <path|url>    Compare a single page. Accepts a path (/about/) or a full URL.
                      Omit to pull all URLs from the live site's sitemap.xml instead.
  --limit <n>         Max number of sitemap URLs to test (default: 10)
  --threshold <n>     Pixel diff % used to classify results (default: 1)

Result classification:
  pass  diff% is below --threshold
  warn  diff% is between --threshold and 5× --threshold
  fail  diff% is at or above 5× --threshold

Output:
  Screenshots and an HTML report are written to:
  wp-env-bin/compare-report/index.html

Examples:
  wp-env-bin compare                          Test first 10 sitemap URLs
  wp-env-bin compare --limit 50               Test first 50 sitemap URLs
  wp-env-bin compare --url /                  Compare the homepage only
  wp-env-bin compare --url /about/ --threshold 0.5
`);
}

module.exports = { compare, compareHelp };
