"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } = require("fs");
const path = require("path");
const os = require("os");
const { configCreate, configDelete } = require("../commands/config");

let tmpDir;
let savedCwd;

before(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "wp-env-bin-commands-config-test-"));
	savedCwd = process.cwd();
	process.chdir(tmpDir);
});

after(() => {
	process.chdir(savedCwd);
	rmSync(tmpDir, { recursive: true });
});

function dest() {
	return path.join(tmpDir, "wp-env-bin");
}

function siteConfigsDir() {
	return path.join(dest(), "site-configs");
}

// ── configCreate ───────────────────────────────────────────────────────────────

test("configCreate: creates site-configs/ directory if absent", () => {
	configCreate({ url: "example.com", siteType: "singlesite" }, "example-com");
	assert.ok(existsSync(siteConfigsDir()));
});

test("configCreate: writes profile to site-configs/{name}.wp-env-bin.config.json", () => {
	const config = { url: "test.org", siteType: "singlesite", pluginName: "my-plugin" };
	configCreate(config, "test-org");
	const filePath = path.join(siteConfigsDir(), "test-org.wp-env-bin.config.json");
	assert.ok(existsSync(filePath));
	const saved = JSON.parse(readFileSync(filePath, "utf8"));
	assert.deepEqual(saved, config);
});

test("configCreate: returns the profileName", () => {
	const result = configCreate({ url: "another.com" }, "another-com");
	assert.equal(result, "another-com");
});

test("configCreate: does NOT write to active wp-env-bin.config.json", () => {
	const activeConfigPath = path.join(dest(), "wp-env-bin.config.json");
	configCreate({ url: "notouch.com" }, "notouch-com");
	assert.equal(existsSync(activeConfigPath), false);
});

// ── configDelete ───────────────────────────────────────────────────────────────

function createProfile(name, companions = []) {
	mkdirSync(siteConfigsDir(), { recursive: true });
	writeFileSync(
		path.join(siteConfigsDir(), name + ".wp-env-bin.config.json"),
		JSON.stringify({ url: name }),
		"utf8"
	);
	for (const ext of companions) {
		writeFileSync(path.join(siteConfigsDir(), name + ext), "{}", "utf8");
	}
}

test("configDelete: removes the config file", () => {
	createProfile("delete-me");
	const filePath = path.join(siteConfigsDir(), "delete-me.wp-env-bin.config.json");
	assert.ok(existsSync(filePath));
	configDelete("delete-me");
	assert.equal(existsSync(filePath), false);
});

test("configDelete: removes companion composer.json and composer.lock when present", () => {
	createProfile("with-companions", [".composer.json", ".composer.lock"]);
	configDelete("with-companions");
	assert.equal(existsSync(path.join(siteConfigsDir(), "with-companions.composer.json")), false);
	assert.equal(existsSync(path.join(siteConfigsDir(), "with-companions.composer.lock")), false);
});

test("configDelete: does not throw when companion files are absent", () => {
	createProfile("no-companions");
	assert.doesNotThrow(() => configDelete("no-companions"));
});

test("configDelete: does NOT remove the active wp-env-bin.config.json", () => {
	createProfile("active-profile");
	// Simulate an active config that happens to have the same name
	mkdirSync(dest(), { recursive: true });
	writeFileSync(path.join(dest(), "wp-env-bin.config.json"), JSON.stringify({ url: "active-profile" }), "utf8");

	configDelete("active-profile");

	assert.ok(existsSync(path.join(dest(), "wp-env-bin.config.json")), "active config must remain untouched");
});
