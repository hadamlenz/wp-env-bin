const { mkdirSync, writeFileSync } = require("fs");
const path = require("path");
const { readLocalConfig, readWpEnvJson } = require("./get");
const { logger } = require("./log");

// ─── Argument parsing ────────────────────────────────────────────────────────

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

function readPort() {
	try {
		const wpEnv = readWpEnvJson();
		return (wpEnv.env && wpEnv.env.development && wpEnv.env.development.port) || 8889;
	} catch {
		return 8889;
	}
}

function buildLocalUrl(liveDomain, urlPath, port) {
	// urlPath may be a full URL or a bare path like /about/
	let p = urlPath;
	try {
		p = new URL(urlPath).pathname;
	} catch {
		// already a path
	}
	if (!p.startsWith("/")) p = "/" + p;
	return "http://localhost:" + port + p;
}

function slugify(urlPath) {
	let p = urlPath;
	try {
		p = new URL(urlPath).pathname;
	} catch {
		// already a path
	}
	const slug = p.replace(/^\/|\/$/g, "").replace(/\//g, "-") || "home";
	return slug;
}

// ─── Sitemap fetch ────────────────────────────────────────────────────────────

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
	const re = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
	let m;
	while ((m = re.exec(xml)) !== null) {
		locs.push(m[1].trim());
	}
	return locs;
}

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

async function takeScreenshot(page, url) {
	await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
	return page.screenshot({ fullPage: true });
}

function diffScreenshots(livePng, localPng, threshold) {
	const { PNG } = require("pngjs");
	const pixelmatch = require("pixelmatch");

	const liveImg = PNG.sync.read(livePng);
	const localImg = PNG.sync.read(localPng);

	// Match heights: pad the shorter image with white
	const width = Math.max(liveImg.width, localImg.width);
	const height = Math.max(liveImg.height, localImg.height);

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

	const a = padImage(liveImg);
	const b = padImage(localImg);
	const diff = new PNG({ width, height });

	const diffPixels = pixelmatch(a.data, b.data, diff.data, width, height, {
		threshold: 0.1,
	});

	const totalPixels = width * height;
	const diffPercent = (diffPixels / totalPixels) * 100;
	const diffPng = PNG.sync.write(diff);

	return { diffPixels, totalPixels, diffPercent, diffPng };
}

function classify(diffPercent, threshold) {
	if (diffPercent < threshold) return "pass";
	if (diffPercent < threshold * 5) return "warn";
	return "fail";
}

// ─── HTML report ─────────────────────────────────────────────────────────────

function writeReport(reportDir, pages) {
	const rows = pages.map((p) => {
		const icon = p.status === "pass" ? "✓" : p.status === "warn" ? "!" : "✗";
		const color = p.status === "pass" ? "#2d7d46" : p.status === "warn" ? "#9a6700" : "#cf222e";
		const pageDir = "pages/" + p.slug;
		return `
		<tr>
			<td><a href="${pageDir}/index.html">${p.path}</a></td>
			<td style="color:${color};font-weight:bold;text-align:center">${icon}</td>
			<td style="text-align:right">${p.diffPercent.toFixed(2)}%</td>
		</tr>`;
	}).join("\n");

	const passCount = pages.filter((p) => p.status === "pass").length;
	const warnCount = pages.filter((p) => p.status === "warn").length;
	const failCount = pages.filter((p) => p.status === "fail").length;

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>wp-env-bin visual comparison report</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #1f2328; }
  h1 { font-size: 1.4rem; }
  .summary { margin: 1rem 0; font-size: 0.9rem; color: #57606a; }
  table { border-collapse: collapse; width: 100%; max-width: 700px; }
  th, td { padding: 0.5rem 0.75rem; border: 1px solid #d0d7de; text-align: left; }
  th { background: #f6f8fa; }
  tr:hover td { background: #f6f8fa; }
  .pass { color: #2d7d46; } .warn { color: #9a6700; } .fail { color: #cf222e; }
</style>
</head>
<body>
<h1>Visual Comparison Report</h1>
<p class="summary">
  <span class="pass">✓ ${passCount} passed</span> &nbsp;
  <span class="warn">! ${warnCount} warnings</span> &nbsp;
  <span class="fail">✗ ${failCount} failed</span> &nbsp;
  &mdash; ${pages.length} pages tested
</p>
<table>
  <thead><tr><th>Path</th><th>Status</th><th>Diff %</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;

	writeFileSync(path.join(reportDir, "index.html"), html, "utf8");

	// Per-page reports
	for (const p of pages) {
		const pageDir = path.join(reportDir, "pages", p.slug);
		const icon = p.status === "pass" ? "✓" : p.status === "warn" ? "!" : "✗";
		const color = p.status === "pass" ? "#2d7d46" : p.status === "warn" ? "#9a6700" : "#cf222e";
		const pageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${p.path} — comparison</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 1.5rem; color: #1f2328; }
  h1 { font-size: 1.2rem; }
  .status { color: ${color}; font-weight: bold; }
  .grid { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1rem; }
  .col { flex: 1; min-width: 280px; }
  .col h2 { font-size: 0.85rem; text-transform: uppercase; color: #57606a; margin: 0 0 0.4rem; }
  img { width: 100%; border: 1px solid #d0d7de; display: block; }
  a { color: #0969da; font-size: 0.85rem; }
</style>
</head>
<body>
<p><a href="../../index.html">&larr; Back to summary</a></p>
<h1>${p.path}</h1>
<p class="status">${icon} ${p.diffPercent.toFixed(2)}% pixel difference</p>
<div class="grid">
  <div class="col"><h2>Live</h2><img src="live.png" alt="Live screenshot"></div>
  <div class="col"><h2>Local</h2><img src="local.png" alt="Local screenshot"></div>
  <div class="col"><h2>Diff</h2><img src="diff.png" alt="Pixel diff"></div>
</div>
</body>
</html>`;
		writeFileSync(path.join(pageDir, "index.html"), pageHtml, "utf8");
	}
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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
		const all = await fetchSitemap(liveDomain);
		const taken = all.slice(0, limit);
		process.stdout.write(" " + all.length + " URLs found. Testing first " + taken.length + ".\n\n");
		urls = taken;
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
		const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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
