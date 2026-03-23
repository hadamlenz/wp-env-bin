const { mkdirSync, writeFileSync } = require("fs");
const path = require("path");
const { readLocalConfig, readWpEnvJson } = require("./get");
const { logger } = require("./log");
const { summaryTemplate, pageTemplate } = require("../templates/report.tpl");

// ─── Argument parsing ────────────────────────────────────────────────────────

/**
 * Parse CLI flags from the argv array passed to the compare command.
 * Supports both `--flag value` and `--flag=value` forms.
 *
 * @param {string[]} argv - Arguments after `wp-env-bin compare`
 * @returns {{ url: string|null, limit: number, threshold: number }}
 */
function parseArgs(argv) {
	const args = { url: null, limit: 10, threshold: 1 };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--url" && argv[i + 1]) {
			args.url = argv[++i];
		} else if (argv[i] === "--limit" && argv[i + 1]) {
			args.limit = parseInt(argv[++i], 10);
		} else if (argv[i] === "--threshold" && argv[i + 1]) {
			args.threshold = parseFloat(argv[++i]);
		} else if (argv[i].startsWith("--url=")) {
			args.url = argv[i].slice("--url=".length);
		} else if (argv[i].startsWith("--limit=")) {
			args.limit = parseInt(argv[i].slice("--limit=".length), 10);
		} else if (argv[i].startsWith("--threshold=")) {
			args.threshold = parseFloat(argv[i].slice("--threshold=".length));
		}
	}
	return args;
}

// ─── URL helpers ─────────────────────────────────────────────────────────────

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

/**
 * Convert a live URL or bare path into the equivalent localhost URL.
 * e.g. `https://example.com/about/` → `http://localhost:8889/about/`
 *
 * @param {string} liveDomain - Live site domain (e.g. `example.com`)
 * @param {string} urlPath - Full live URL or bare path (e.g. `/about/`)
 * @param {number} port - Local wp-env port
 * @returns {string}
 */
function buildLocalUrl(liveDomain, urlPath, port) {
	// urlPath may be a full URL or a bare path like /about/
	let pathname = urlPath;
	try {
		pathname = new URL(urlPath).pathname;
	} catch {
		// already a path
	}
	if (!pathname.startsWith("/")) pathname = "/" + pathname;
	return "http://localhost:" + port + pathname;
}

/**
 * Convert a URL path into a filesystem-safe folder name for the report.
 * e.g. `/about/us/` → `about-us`, `/` → `home`
 *
 * @param {string} urlPath - Full URL or bare path
 * @returns {string}
 */
function slugify(urlPath) {
	let pathname = urlPath;
	try {
		pathname = new URL(urlPath).pathname;
	} catch {
		// already a path
	}
	const slug = pathname.replace(/^\/|\/$/g, "").replace(/\//g, "-") || "home";
	return slug;
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

// ─── Screenshot + diff ───────────────────────────────────────────────────────

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

/**
 * Run a pixel-level diff between two PNG screenshots.
 * Images are padded to the same dimensions (white fill) before comparison
 * to handle pages that render at different heights.
 *
 * @param {Buffer} livePng - PNG buffer from the live site
 * @param {Buffer} localPng - PNG buffer from the local environment
 * @param {number} threshold - Passed through to classify(); not used directly by pixelmatch here
 * @returns {{ diffPixels: number, totalPixels: number, diffPercent: number, diffPng: Buffer }}
 */
function diffScreenshots(livePng, localPng, threshold) {
	const { PNG } = require("pngjs");
	const pixelmatch = require("pixelmatch");

	const liveImg = PNG.sync.read(livePng);
	const localImg = PNG.sync.read(localPng);

	// Match heights: pad the shorter image with white
	const width = Math.max(liveImg.width, localImg.width);
	const height = Math.max(liveImg.height, localImg.height);

	/**
	 * Pad a decoded PNG to the target width/height with a white background.
	 *
	 * @param {import('pngjs').PNG} img
	 * @returns {import('pngjs').PNG}
	 */
	function padImage(img) {
		if (img.width === width && img.height === height) return img;
		const out = new PNG({ width, height, filterType: -1 });
		// fill white
		out.data.fill(255);
		// copy existing pixels row by row
		for (let y = 0; y < img.height; y++) {
			for (let x = 0; x < img.width; x++) {
				const src = (y * img.width + x) * 4;
				const dst = (y * width + x) * 4;
				out.data[dst] = img.data[src];
				out.data[dst + 1] = img.data[src + 1];
				out.data[dst + 2] = img.data[src + 2];
				out.data[dst + 3] = img.data[src + 3];
			}
		}
		return out;
	}

	const paddedLiveImg = padImage(liveImg);
	const paddedLocalImg = padImage(localImg);
	const diff = new PNG({ width, height });

	const diffPixels = pixelmatch(paddedLiveImg.data, paddedLocalImg.data, diff.data, width, height, {
		threshold: 0.1,
	});

	const totalPixels = width * height;
	const diffPercent = (diffPixels / totalPixels) * 100;
	const diffPng = PNG.sync.write(diff);

	return { diffPixels, totalPixels, diffPercent, diffPng };
}

/**
 * Classify a diff percentage as pass, warn, or fail relative to a threshold.
 * - pass: below threshold
 * - warn: between threshold and 5× threshold
 * - fail: at or above 5× threshold
 *
 * @param {number} diffPercent - Percentage of pixels that differ
 * @param {number} threshold - Base threshold percentage (e.g. 1 for 1%)
 * @returns {'pass'|'warn'|'fail'}
 */
function classify(diffPercent, threshold) {
	if (diffPercent < threshold) return "pass";
	if (diffPercent < threshold * 5) return "warn";
	return "fail";
}

// ─── HTML report ─────────────────────────────────────────────────────────────

/**
 * Write the HTML comparison report to the report directory.
 * Creates a summary index.html and a per-page index.html with side-by-side screenshots.
 *
 * @param {string} reportDir - Absolute path to wp-env-bin/compare-report/
 * @param {{ path: string, slug: string, diffPercent: number, status: 'pass'|'warn'|'fail' }[]} pages
 */
function writeReport(reportDir, pages) {
	writeFileSync(path.join(reportDir, "index.html"), summaryTemplate(pages), "utf8");

	for (const p of pages) {
		writeFileSync(path.join(reportDir, "pages", p.slug, "index.html"), pageTemplate(p), "utf8");
	}
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

	// Launch Playwright
	let chromium;
	try {
		({ chromium } = require("playwright"));
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

module.exports = { compare, parseArgs, buildLocalUrl, slugify, diffScreenshots, classify };
