const { writeFileSync } = require("fs");
const path = require("path");
const { summaryTemplate, pageTemplate } = require("../templates/report.tpl");

/**
 * Parse CLI flags from the argv array passed to the compare command.
 * Supports both `--flag value` and `--flag=value` forms.
 *
 * @param {string[]} argv - Arguments after `wp-env-bin compare`
 * @returns {{ url: string|null, limit: number, threshold: number }}
 */
function parseArgs(argv) {
	const args = { url: null, limit: 10, threshold: 1, testPaths: false };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--url" && argv[i + 1]) {
			args.url = argv[++i];
		} else if (argv[i] === "--limit" && argv[i + 1]) {
			args.limit = parseInt(argv[++i], 10);
		} else if (argv[i] === "--threshold" && argv[i + 1]) {
			args.threshold = parseFloat(argv[++i]);
		} else if (argv[i] === "--test-paths") {
			args.testPaths = true;
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

module.exports = { parseArgs, buildLocalUrl, slugify, diffScreenshots, classify, writeReport };
