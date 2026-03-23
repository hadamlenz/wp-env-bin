"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("fs");
const path = require("path");
const os = require("os");
const { readLocalConfig, readWpEnvJson, readE2eConfig } = require("../lib/env/config");

let tmpDir;
let savedCwd;

before(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "wp-env-bin-config-test-"));
	savedCwd = process.cwd();
	process.chdir(tmpDir);
});

after(() => {
	process.chdir(savedCwd);
	rmSync(tmpDir, { recursive: true });
});

function writeConfig(obj) {
	mkdirSync(path.join(tmpDir, "wp-env-bin"), { recursive: true });
	writeFileSync(
		path.join(tmpDir, "wp-env-bin/wp-env-bin.config.json"),
		JSON.stringify(obj),
		"utf8"
	);
}

function removeConfig() {
	try {
		rmSync(path.join(tmpDir, "wp-env-bin/wp-env-bin.config.json"));
	} catch { /* already absent */ }
}

// --- readLocalConfig ---

test("readLocalConfig throws when config file is absent", () => {
	removeConfig();
	assert.throws(() => readLocalConfig(), /wp-env-bin\.config\.json not found/);
});

test("readLocalConfig throws listing missing fields for singlesite", () => {
	writeConfig({});
	assert.throws(() => readLocalConfig(), /missing required fields.*url/);
});

test("readLocalConfig throws listing all required fields for multisite", () => {
	writeConfig({ siteType: "multisite" });
	assert.throws(() => readLocalConfig(), /url.*oldPrefix.*siteId/);
});

test("readLocalConfig throws only absent fields when multisite has url but not oldPrefix or siteId", () => {
	writeConfig({ siteType: "multisite", url: "http://example.com" });
	assert.throws(
		() => readLocalConfig(),
		(err) => {
			assert.match(err.message, /oldPrefix/);
			assert.match(err.message, /siteId/);
			assert.doesNotMatch(err.message, /\burl\b/);
			return true;
		}
	);
});

test("readLocalConfig succeeds when siteType is absent (defaults to singlesite validation)", () => {
	// siteType defaults to "singlesite" for validation, but it is NOT written back
	// to the returned config object — the original parsed object is returned as-is.
	writeConfig({ url: "http://example.com" });
	const config = readLocalConfig();
	assert.equal(config.url, "http://example.com");
	assert.ok(!config.siteType || config.siteType === "singlesite");
});

test("readLocalConfig succeeds and returns parsed config for valid singlesite", () => {
	writeConfig({ url: "http://example.com", pluginName: "my-plugin" });
	const config = readLocalConfig();
	assert.equal(config.url, "http://example.com");
	assert.equal(config.pluginName, "my-plugin");
});

test("readLocalConfig succeeds for valid multisite config", () => {
	writeConfig({ siteType: "multisite", url: "http://example.com", oldPrefix: "wp_", siteId: "1" });
	const config = readLocalConfig();
	assert.equal(config.siteType, "multisite");
	assert.equal(config.siteId, "1");
});

// --- readWpEnvJson ---

function removeWpEnvFiles() {
	for (const p of [
		path.join(tmpDir, "wp-env-bin/.wp-env.json"),
		path.join(tmpDir, "wp-env-bin/.wp-env.override.json"),
		path.join(tmpDir, ".wp-env.json"),
	]) {
		try { rmSync(p); } catch { /* absent */ }
	}
}

test("readWpEnvJson throws when no wp-env config file exists", () => {
	removeWpEnvFiles();
	assert.throws(() => readWpEnvJson(), /No wp-env config file found/);
});

test("readWpEnvJson returns parsed object from wp-env-bin/.wp-env.json (first candidate)", () => {
	removeWpEnvFiles();
	mkdirSync(path.join(tmpDir, "wp-env-bin"), { recursive: true });
	writeFileSync(path.join(tmpDir, "wp-env-bin/.wp-env.json"), JSON.stringify({ core: "WordPress/WordPress#6.5" }), "utf8");
	const config = readWpEnvJson();
	assert.equal(config.core, "WordPress/WordPress#6.5");
});

test("readWpEnvJson falls back to .wp-env.override.json when .wp-env.json absent", () => {
	removeWpEnvFiles();
	mkdirSync(path.join(tmpDir, "wp-env-bin"), { recursive: true });
	writeFileSync(path.join(tmpDir, "wp-env-bin/.wp-env.override.json"), JSON.stringify({ core: "override" }), "utf8");
	const config = readWpEnvJson();
	assert.equal(config.core, "override");
});

test("readWpEnvJson falls back to root .wp-env.json", () => {
	removeWpEnvFiles();
	writeFileSync(path.join(tmpDir, ".wp-env.json"), JSON.stringify({ core: "root" }), "utf8");
	const config = readWpEnvJson();
	assert.equal(config.core, "root");
});

// --- readE2eConfig ---

function writeE2eConfig(obj) {
	mkdirSync(path.join(tmpDir, "wp-env-bin", "e2e"), { recursive: true });
	writeFileSync(
		path.join(tmpDir, "wp-env-bin/e2e/wp-env-bin.e2e.config.json"),
		JSON.stringify(obj),
		"utf8"
	);
}

function removeE2eConfig() {
	try {
		rmSync(path.join(tmpDir, "wp-env-bin/e2e/wp-env-bin.e2e.config.json"));
	} catch { /* already absent */ }
}

test("readE2eConfig returns all defaults when file is absent", () => {
	removeE2eConfig();
	const config = readE2eConfig();
	assert.equal(config.wpVersion, "6.9.4");
	assert.equal(config.phpVersion, "8.3");
	assert.equal(config.testTheme, "twentytwentyfive");
	assert.equal(config.port, "8886");
	assert.equal(config.mysqlPort, 51606);
	assert.equal(config.testMysqlPort, 51607);
	assert.deepEqual(config.editor, []);
	assert.deepEqual(config.frontend, []);
	assert.equal(config.wpConstants.DISABLE_WP_CRON, true);
	assert.equal(config.wpConstants.WP_DEBUG, false);
});

test("readE2eConfig merges partial overrides over defaults", () => {
	writeE2eConfig({ wpVersion: "6.8.0", editor: ["blocks/my-block"] });
	const config = readE2eConfig();
	assert.equal(config.wpVersion, "6.8.0");
	assert.deepEqual(config.editor, ["blocks/my-block"]);
	// unspecified fields keep defaults
	assert.equal(config.phpVersion, "8.3");
	assert.equal(config.testTheme, "twentytwentyfive");
});

test("readE2eConfig returns configured wpConstants when provided", () => {
	writeE2eConfig({ wpConstants: { WP_DEBUG: true, WP_DEBUG_LOG: true, DISABLE_WP_CRON: false } });
	const config = readE2eConfig();
	assert.equal(config.wpConstants.WP_DEBUG, true);
	assert.equal(config.wpConstants.WP_DEBUG_LOG, true);
	assert.equal(config.wpConstants.DISABLE_WP_CRON, false);
});
