import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, unlinkSync } from "fs";
import path from "path";
import os from "os";
import { configCreate, configDelete, configSwitch } from "../../commands/config.js";

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

test("configDelete: removes companion composer.json when present", () => {
	createProfile("with-companions", [".composer.json"]);
	configDelete("with-companions");
	assert.equal(existsSync(path.join(siteConfigsDir(), "with-companions.composer.json")), false);
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

// ── configSwitch ───────────────────────────────────────────────────────────────

test("configSwitch: copies config file to active wp-env-bin.config.json", () => {
	createProfile("switch-basic");
	mkdirSync(dest(), { recursive: true });
	configSwitch("switch-basic");
	assert.ok(existsSync(path.join(dest(), "wp-env-bin.config.json")));
	const active = JSON.parse(readFileSync(path.join(dest(), "wp-env-bin.config.json"), "utf8"));
	assert.equal(active.url, "switch-basic");
});

test("configSwitch: copies companion composer.json when present", () => {
	createProfile("switch-with-composer", [".composer.json"]);
	mkdirSync(dest(), { recursive: true });
	configSwitch("switch-with-composer");
	assert.ok(existsSync(path.join(dest(), "composer.json")));
});

test("configSwitch: writes empty composer.json when no companion exists", () => {
	createProfile("switch-no-composer");
	mkdirSync(dest(), { recursive: true });
	configSwitch("switch-no-composer");
	const composerPath = path.join(dest(), "composer.json");
	assert.ok(existsSync(composerPath), "composer.json must be written");
	const composer = JSON.parse(readFileSync(composerPath, "utf8"));
	assert.ok(composer["require-dev"] !== undefined, "must be a valid composer.json");
	assert.deepEqual(composer["require-dev"], {});
});

test("configSwitch: leaves existing composer.lock untouched (lock files are not managed per-profile)", () => {
	createProfile("switch-stale-lock");
	mkdirSync(dest(), { recursive: true });
	writeFileSync(path.join(dest(), "composer.lock"), "{}", "utf8");
	configSwitch("switch-stale-lock");
	assert.ok(existsSync(path.join(dest(), "composer.lock")), "lock must be left in place");
});

test("configSwitch: does NOT copy companion composer.lock even when present (lock files are not managed per-profile)", () => {
	createProfile("switch-with-lock", [".composer.json", ".composer.lock"]);
	mkdirSync(dest(), { recursive: true });
	// Ensure no lock exists from a prior test before asserting this switch doesn't create one
	const lockPath = path.join(dest(), "composer.lock");
	if (existsSync(lockPath)) unlinkSync(lockPath);
	configSwitch("switch-with-lock");
	assert.equal(existsSync(lockPath), false, "lock must not be restored from cache");
});
