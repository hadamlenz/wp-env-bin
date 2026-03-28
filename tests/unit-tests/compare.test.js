import { test } from "node:test";
import assert from "assert/strict";
import path from "path";
import { readFileSync } from "fs";
import { parseArgs, buildLocalUrl, slugify, classify } from "../../lib/compare.js";

// Read live domain from config if available, fall back to generic placeholder
function getLiveDomain() {
	try {
		const config = JSON.parse(
			readFileSync(path.join(process.cwd(), "wp-env-bin/wp-env-bin.config.json"), "utf8")
		);
		return config.url || "example.com";
	} catch {
		return "example.com";
	}
}

// --- parseArgs ---

test("parseArgs: defaults when no flags", () => {
	const args = parseArgs([]);
	assert.equal(args.url, null);
	assert.equal(args.limit, 10);
	assert.equal(args.threshold, 1);
});

test("parseArgs: --url as separate arg", () => {
	const args = parseArgs(["--url", "/about/"]);
	assert.equal(args.url, "/about/");
});

test("parseArgs: --url= inline form", () => {
	const args = parseArgs(["--url=/contact/"]);
	assert.equal(args.url, "/contact/");
});

test("parseArgs: --limit as separate arg", () => {
	const args = parseArgs(["--limit", "5"]);
	assert.equal(args.limit, 5);
});

test("parseArgs: --limit= inline form", () => {
	const args = parseArgs(["--limit=25"]);
	assert.equal(args.limit, 25);
});

test("parseArgs: --threshold as separate arg", () => {
	const args = parseArgs(["--threshold", "2.5"]);
	assert.equal(args.threshold, 2.5);
});

test("parseArgs: all flags together", () => {
	const args = parseArgs(["--url", "/", "--limit", "3", "--threshold", "0.5"]);
	assert.equal(args.url, "/");
	assert.equal(args.limit, 3);
	assert.equal(args.threshold, 0.5);
});

// --- buildLocalUrl ---

test("buildLocalUrl: converts full live URL to localhost path", () => {
	const domain = getLiveDomain();
	const result = buildLocalUrl(domain, "https://" + domain + "/about/", 8889);
	assert.equal(result, "http://localhost:8889/about/");
});

test("buildLocalUrl: bare path with leading slash", () => {
	const domain = getLiveDomain();
	const result = buildLocalUrl(domain, "/contact/", 8889);
	assert.equal(result, "http://localhost:8889/contact/");
});

test("buildLocalUrl: bare path without leading slash", () => {
	const domain = getLiveDomain();
	const result = buildLocalUrl(domain, "research", 8889);
	assert.equal(result, "http://localhost:8889/research");
});

test("buildLocalUrl: root path", () => {
	const domain = getLiveDomain();
	const result = buildLocalUrl(domain, "/", 8889);
	assert.equal(result, "http://localhost:8889/");
});

test("buildLocalUrl: custom port", () => {
	const domain = getLiveDomain();
	const result = buildLocalUrl(domain, "/page/", 4000);
	assert.equal(result, "http://localhost:4000/page/");
});

// --- slugify ---

test("slugify: root becomes 'home'", () => {
	assert.equal(slugify("/"), "home");
});

test("slugify: single segment", () => {
	assert.equal(slugify("/about/"), "about");
});

test("slugify: nested path", () => {
	assert.equal(slugify("/research/labs/"), "research-labs");
});

test("slugify: full URL extracts path", () => {
	const domain = getLiveDomain();
	assert.equal(slugify("https://" + domain + "/giving/"), "giving");
});

test("slugify: no trailing slash", () => {
	assert.equal(slugify("/faculty"), "faculty");
});

// --- classify ---

test("classify: below threshold is pass", () => {
	assert.equal(classify(0.5, 1), "pass");
});

test("classify: exactly at threshold is warn", () => {
	assert.equal(classify(1, 1), "warn");
});

test("classify: between threshold and 5x is warn", () => {
	assert.equal(classify(3, 1), "warn");
});

test("classify: at 5x threshold is fail", () => {
	assert.equal(classify(5, 1), "fail");
});

test("classify: above 5x threshold is fail", () => {
	assert.equal(classify(12, 1), "fail");
});

test("classify: custom threshold respected", () => {
	assert.equal(classify(1.5, 2), "pass");
	assert.equal(classify(3, 2), "warn");
	assert.equal(classify(11, 2), "fail");
});
