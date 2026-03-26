"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const ROOT  = path.join(__dirname, "../..");
const { renamePrefix } = require(path.join(ROOT, "lib/db"));

// --- replacement ---

test("replaces all occurrences of oldPrefix with wp_", () => {
	const content = "CREATE TABLE `wpsites_7_options` (`id` int);\nCREATE TABLE `wpsites_7_posts` (`id` int);";
	const { modified } = renamePrefix(content, "wpsites_7_");
	assert.ok(modified.includes("wp_options"));
	assert.ok(modified.includes("wp_posts"));
	assert.ok(!modified.includes("wpsites_7_"));
});

test("returns original content unchanged when prefix not found", () => {
	const content = "CREATE TABLE `wp_options` (`id` int);";
	const { modified } = renamePrefix(content, "wpsites_7_");
	assert.equal(modified, content);
});

// --- count ---

test("counts replacements correctly", () => {
	const content = "wpsites_7_options wpsites_7_posts wpsites_7_users";
	const { count } = renamePrefix(content, "wpsites_7_");
	assert.equal(count, 3);
});

test("reports zero when prefix not found", () => {
	const { count } = renamePrefix("CREATE TABLE `wp_options`;", "wpsites_7_");
	assert.equal(count, 0);
});

// --- special regex characters in prefix ---

test("handles prefix containing a dot (e.g. wp_1.0_)", () => {
	const content = "CREATE TABLE `wp_1.0_options` (`id` int);";
	const { modified } = renamePrefix(content, "wp_1.0_");
	assert.ok(modified.includes("wp_options"));
	assert.ok(!modified.includes("wp_1.0_"));
});

test("handles prefix containing parentheses", () => {
	const content = "TABLE `wp_(test)_options`";
	const { modified } = renamePrefix(content, "wp_(test)_");
	assert.ok(modified.includes("wp_options"));
	assert.ok(!modified.includes("wp_(test)_"));
});

// --- edge cases ---

test("replaces prefix that appears inside a value string", () => {
	const content = "INSERT INTO `wpsites_7_options` VALUES (1, 'wpsites_7_something');";
	const { count } = renamePrefix(content, "wpsites_7_");
	assert.equal(count, 2);
});

test("empty content returns empty string with zero count", () => {
	const { modified, count } = renamePrefix("", "wpsites_7_");
	assert.equal(modified, "");
	assert.equal(count, 0);
});
