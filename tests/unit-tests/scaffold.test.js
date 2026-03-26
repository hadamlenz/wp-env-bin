"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } = require("fs");
const path = require("path");
const ROOT  = path.join(__dirname, "../..");
const os = require("os");
const { scaffoldFiles, scaffoldCommand } = require(path.join(ROOT, "commands/scaffold"));

let tmpDir;
let savedCwd;

before(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "wp-env-bin-scaffold-test-"));
	savedCwd = process.cwd();
	process.chdir(tmpDir);
});

after(() => {
	process.chdir(savedCwd);
	rmSync(tmpDir, { recursive: true });
});

// ── scaffoldFiles ──────────────────────────────────────────────────────────────

test("scaffoldFiles: creates all expected files on empty dest", () => {
	const dest = path.join(tmpDir, "fresh-install");
	const results = scaffoldFiles(dest);

	assert.ok(existsSync(path.join(dest, ".wp-env.json")));
	assert.ok(existsSync(path.join(dest, ".gitignore")));
	assert.ok(existsSync(path.join(dest, "assets/.gitkeep")));
	assert.ok(existsSync(path.join(dest, "plugins/wp-env-bin-plugin/wp-env-bin-plugin.php")));
	assert.ok(existsSync(path.join(dest, "plugins/wp-env-bin-plugin/classes/class-service-worker.php")));
	assert.ok(existsSync(path.join(dest, "wp-env-bin.config.json.example")));
	assert.ok(existsSync(path.join(dest, "composer.json.example")));

	assert.ok(results.every(r => r.created === true), "all files should be newly created");
});

test("scaffoldFiles: skips existing files, creates missing ones", () => {
	const dest = path.join(tmpDir, "existing-install");
	mkdirSync(dest, { recursive: true });
	// Pre-create one file with custom content
	writeFileSync(path.join(dest, ".wp-env.json"), '{"custom":true}', "utf8");

	const results = scaffoldFiles(dest);

	const wpEnvResult = results.find(r => r.file === ".wp-env.json");
	assert.equal(wpEnvResult.created, false, ".wp-env.json should be skipped");

	const gitignoreResult = results.find(r => r.file === ".gitignore");
	assert.equal(gitignoreResult.created, true, ".gitignore should be created");

	// Existing file content must be preserved
	const { readFileSync } = require("fs");
	const content = readFileSync(path.join(dest, ".wp-env.json"), "utf8");
	assert.equal(content, '{"custom":true}');
});

test("scaffoldFiles: returns one result per template file", () => {
	const dest = path.join(tmpDir, "results-count");
	const results = scaffoldFiles(dest);
	assert.equal(results.length, 7);
});

// ── scaffoldCommand ────────────────────────────────────────────────────────────

test("scaffoldCommand: runs without throwing on absent dest", () => {
	const dest = path.join(tmpDir, "cmd-new");
	assert.doesNotThrow(() => scaffoldCommand(dest));
	assert.ok(existsSync(dest));
});

test("scaffoldCommand: runs without throwing on existing dest", () => {
	const dest = path.join(tmpDir, "cmd-existing");
	mkdirSync(dest, { recursive: true });
	assert.doesNotThrow(() => scaffoldCommand(dest));
});
