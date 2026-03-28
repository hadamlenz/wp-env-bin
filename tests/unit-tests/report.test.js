import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from "fs";
import path from "path";
import os from "os";
import { writeReport } from "../../lib/compare.js";

let tmpDir;

before(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "wp-env-bin-report-test-"));
});

after(() => {
	if (tmpDir) rmSync(tmpDir, { recursive: true });
});

function makeReportDir(name) {
	const dir = path.join(tmpDir, name);
	mkdirSync(dir, { recursive: true });
	return dir;
}

// --- index.html is written ---

test("writeReport creates index.html in the report directory", () => {
	const dir = makeReportDir("basic");
	writeReport(dir, []);
	assert.ok(existsSync(path.join(dir, "index.html")));
});

// --- summary counts appear in the HTML ---

test("writeReport summary shows correct pass/warn/fail/error counts", () => {
	const dir = makeReportDir("counts");
	mkdirSync(path.join(dir, "pages", "home"), { recursive: true });
	mkdirSync(path.join(dir, "pages", "about"), { recursive: true });
	mkdirSync(path.join(dir, "pages", "contact"), { recursive: true });
	mkdirSync(path.join(dir, "pages", "missing"), { recursive: true });

	const pages = [
		{ path: "/", slug: "home", diffPercent: 0.2, status: "pass" },
		{ path: "/about/", slug: "about", diffPercent: 2.5, status: "warn" },
		{ path: "/contact/", slug: "contact", diffPercent: 8.0, status: "fail" },
		{ path: "/missing/", slug: "missing", diffPercent: null, status: "error" },
	];

	writeReport(dir, pages);
	const html = readFileSync(path.join(dir, "index.html"), "utf8");

	assert.ok(html.includes("1 passed"));
	assert.ok(html.includes("1 warnings"));
	assert.ok(html.includes("1 failed"));
	assert.ok(html.includes("1 errors"));
});

// --- page paths appear in the HTML ---

test("writeReport summary HTML contains each page path", () => {
	const dir = makeReportDir("paths");
	mkdirSync(path.join(dir, "pages", "about"), { recursive: true });
	mkdirSync(path.join(dir, "pages", "news"), { recursive: true });

	const pages = [
		{ path: "/about/", slug: "about", diffPercent: 0, status: "pass" },
		{ path: "/news/", slug: "news", diffPercent: 0, status: "pass" },
	];

	writeReport(dir, pages);
	const html = readFileSync(path.join(dir, "index.html"), "utf8");

	assert.ok(html.includes("/about/"));
	assert.ok(html.includes("/news/"));
});

// --- per-page HTML files are written ---

test("writeReport creates a per-page index.html for each result", () => {
	const dir = makeReportDir("per-page");
	mkdirSync(path.join(dir, "pages", "home"), { recursive: true });
	mkdirSync(path.join(dir, "pages", "about"), { recursive: true });

	const pages = [
		{ path: "/", slug: "home", diffPercent: 0, status: "pass" },
		{ path: "/about/", slug: "about", diffPercent: 0.5, status: "pass" },
	];

	writeReport(dir, pages);

	assert.ok(existsSync(path.join(dir, "pages", "home", "index.html")));
	assert.ok(existsSync(path.join(dir, "pages", "about", "index.html")));
});

// --- empty results ---

test("writeReport handles an empty results array without throwing", () => {
	const dir = makeReportDir("empty");
	assert.doesNotThrow(() => writeReport(dir, []));
	const html = readFileSync(path.join(dir, "index.html"), "utf8");
	assert.ok(html.includes("0 pages tested"));
});
