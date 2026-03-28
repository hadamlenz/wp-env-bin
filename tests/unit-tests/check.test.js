import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { checkDatabase, checkModifiedDatabase, checkHtaccess } from "../../lib/env/check.js";

let tmpDir;
let savedCwd;

before(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "wp-env-bin-check-test-"));
	mkdirSync(path.join(tmpDir, "wp-env-bin/assets"), { recursive: true });
	savedCwd = process.cwd();
	process.chdir(tmpDir);
});

after(() => {
	process.chdir(savedCwd);
	rmSync(tmpDir, { recursive: true });
});

// --- checkDatabase ---

test("checkDatabase returns false when database.sql does not exist", () => {
	assert.equal(checkDatabase(), false);
});

test("checkDatabase returns true when database.sql exists", () => {
	const p = path.join(tmpDir, "wp-env-bin/assets/database.sql");
	writeFileSync(p, "-- stub", "utf8");
	assert.equal(checkDatabase(), true);
	rmSync(p);
});

// --- checkModifiedDatabase ---

test("checkModifiedDatabase returns false when database.modified.sql does not exist", () => {
	assert.equal(checkModifiedDatabase(), false);
});

test("checkModifiedDatabase returns true when database.modified.sql exists", () => {
	const p = path.join(tmpDir, "wp-env-bin/assets/database.modified.sql");
	writeFileSync(p, "-- stub", "utf8");
	assert.equal(checkModifiedDatabase(), true);
	rmSync(p);
});

// --- checkHtaccess ---

test("checkHtaccess returns false when .htaccess does not exist", () => {
	assert.equal(checkHtaccess(), false);
});

test("checkHtaccess returns true when .htaccess exists", () => {
	const p = path.join(tmpDir, "wp-env-bin/assets/.htaccess");
	writeFileSync(p, "# stub", "utf8");
	assert.equal(checkHtaccess(), true);
	rmSync(p);
});
