"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("fs");
const path = require("path");
const ROOT  = path.join(__dirname, "../..");
const os = require("os");
const { readComposerPlugins } = require(path.join(ROOT, "lib/plugins"));

let tmpDir;
let savedCwd;

before(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "wp-env-bin-plugins-test-"));
	mkdirSync(path.join(tmpDir, "wp-env-bin"), { recursive: true });
	savedCwd = process.cwd();
	process.chdir(tmpDir);
});

after(() => {
	process.chdir(savedCwd);
	rmSync(tmpDir, { recursive: true });
});

function writeComposer(obj) {
	writeFileSync(
		path.join(tmpDir, "wp-env-bin/composer.json"),
		JSON.stringify(obj),
		"utf8"
	);
}

function removeComposer() {
	try { rmSync(path.join(tmpDir, "wp-env-bin/composer.json")); } catch { /* absent */ }
}

test("readComposerPlugins returns [] when composer.json is absent", () => {
	removeComposer();
	assert.deepEqual(readComposerPlugins(), []);
});

test("readComposerPlugins returns [] for empty require and require-dev", () => {
	writeComposer({ require: {}, "require-dev": {} });
	assert.deepEqual(readComposerPlugins(), []);
});

test("readComposerPlugins returns slug list from require entries", () => {
	writeComposer({ require: { "vendor/my-plugin": "^1.0", "vendor/another": "*" } });
	const result = readComposerPlugins();
	assert.ok(result.includes("my-plugin"));
	assert.ok(result.includes("another"));
});

test("readComposerPlugins combines require and require-dev", () => {
	writeComposer({
		require: { "vendor/plugin-a": "^1.0" },
		"require-dev": { "vendor/plugin-b": "^2.0" },
	});
	const result = readComposerPlugins();
	assert.ok(result.includes("plugin-a"));
	assert.ok(result.includes("plugin-b"));
});

test("readComposerPlugins skips packages without a slash in the name", () => {
	writeComposer({ require: { "php": ">=8.0", "vendor/real-plugin": "*" } });
	const result = readComposerPlugins();
	assert.ok(!result.includes("php"));
	assert.ok(result.includes("real-plugin"));
});

test("readComposerPlugins strips vendor prefix from slug", () => {
	writeComposer({ require: { "acme/cool-block": "^3.0" } });
	const result = readComposerPlugins();
	assert.deepEqual(result, ["cool-block"]);
});
