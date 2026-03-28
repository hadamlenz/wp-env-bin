import { test } from "node:test";
import assert from "node:assert/strict";
import htaccessTemplate from "../../templates/htaccess.tpl.js";

// --- singlesite ---

test("singlesite: includes BEGIN Reverse proxy block", () => {
	const out = htaccessTemplate("example.com", null, "singlesite");
	assert.ok(out.includes("# BEGIN Reverse proxy"));
});

test("singlesite: proxies flat /uploads/ path to live url", () => {
	const out = htaccessTemplate("example.com", null, "singlesite");
	assert.ok(out.includes("example.com"));
	assert.ok(out.includes("wp-content\\/uploads\\/(.*)"));
});

test("singlesite: does not include a /sites/ path segment", () => {
	const out = htaccessTemplate("example.com", null, "singlesite");
	assert.ok(!out.includes("sites"));
});

// --- multisite ---

test("multisite: includes site-specific /uploads/sites/{siteId}/ rule", () => {
	const out = htaccessTemplate("example.com", "7", "multisite");
	assert.ok(out.includes("uploads\\/sites\\/7\\/"));
});

test("multisite: includes fallback rule from flat /uploads/ to site uploads", () => {
	const out = htaccessTemplate("example.com", "7", "multisite");
	const rules = out.split("\n").filter((l) => l.startsWith("RewriteRule"));
	// 2 proxy rules + 2 WordPress standard rules = at least 4
	assert.ok(rules.length >= 4);
});

test("multisite: proxies to the correct live url", () => {
	const out = htaccessTemplate("sub.example.com", "42", "multisite");
	assert.ok(out.includes("sub.example.com"));
	assert.ok(out.includes("sites\\/42\\/"));
});

// --- no url ---

test("no url: no reverse proxy block generated", () => {
	const out = htaccessTemplate("", null, "singlesite");
	assert.ok(!out.includes("# BEGIN Reverse proxy"));
});

// --- WordPress standard rules always present ---

test("always includes WordPress standard rewrite block", () => {
	const cases = [
		htaccessTemplate("example.com", null, "singlesite"),
		htaccessTemplate("example.com", "7", "multisite"),
		htaccessTemplate("", null, "singlesite"),
	];
	for (const out of cases) {
		assert.ok(out.includes("# BEGIN WordPress"));
		assert.ok(out.includes("index.php"));
	}
});

// --- proxy routing ---

test("singlesite: routes uploads through proxy.php with file and base params", () => {
	const out = htaccessTemplate("example.com", null, "singlesite");
	assert.ok(out.includes("proxy.php"));
	assert.ok(out.includes("file=$1"));
	assert.ok(out.includes("base=https://example.com/wp-content/uploads"));
	assert.ok(!out.includes("R=302"));
	assert.ok(!out.includes("[P,"));
});

test("multisite: routes uploads through proxy.php with correct base url", () => {
	const out = htaccessTemplate("example.com", "7", "multisite");
	assert.ok(out.includes("proxy.php"));
	assert.ok(out.includes("base=https://example.com/wp-content/uploads"));
	assert.ok(!out.includes("R=302"));
	assert.ok(!out.includes("[P,"));
});

// --- default siteType ---

test("default siteType behaves as singlesite", () => {
	const withDefault = htaccessTemplate("example.com");
	const explicit = htaccessTemplate("example.com", null, "singlesite");
	assert.equal(withDefault, explicit);
});
