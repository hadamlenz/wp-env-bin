import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import { scaffoldE2eFiles } from "../../commands/e2e.js";

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const SCAFFOLD_DIR = path.join(__dirname, "../../scaffold/e2e");

let tmpDir;

before(() => {
	tmpDir = mkdtempSync(path.join(os.tmpdir(), "wp-env-bin-e2e-scaffold-test-"));
});

after(() => {
	rmSync(tmpDir, { recursive: true });
});

function destDir() {
	return path.join(tmpDir, "wp-env-bin", "e2e");
}

function scaffold(options) {
	scaffoldE2eFiles(destDir(), SCAFFOLD_DIR, options);
}

const PLUGIN_OPTIONS = {
	projectType: "plugin",
	slug: "my-plugin",
	testTheme: "twentytwentyfive",
	wpVersion: "6.9.4",
	phpVersion: "8.3",
	port: "8886",
};

const THEME_OPTIONS = {
	projectType: "theme",
	slug: "my-theme",
	testTheme: "",
	wpVersion: "6.9.4",
	phpVersion: "8.3",
	port: "8886",
};

// --- Directory creation ---

test("creates required subdirectories for plugin project", () => {
	scaffold(PLUGIN_OPTIONS);
	const dest = destDir();
	assert.ok(existsSync(path.join(dest, "specs/.auth")));
	assert.ok(existsSync(path.join(dest, "specs/editor")));
	assert.ok(existsSync(path.join(dest, "specs/frontend")));
	assert.ok(existsSync(path.join(dest, "plugins")));
	assert.ok(existsSync(path.join(dest, "themes")));
});

// --- Static file copying ---

test("copies static scaffold files", () => {
	const dest = destDir();
	assert.ok(existsSync(path.join(dest, "playwright.config.ts")));
	assert.ok(existsSync(path.join(dest, "tsconfig.json")));
	assert.ok(existsSync(path.join(dest, "specs/global.setup.ts")));
	assert.ok(existsSync(path.join(dest, ".gitignore")));
});

test("creates .auth/.gitkeep placeholder", () => {
	assert.ok(existsSync(path.join(destDir(), "specs/.auth/.gitkeep")));
});

// --- .wp-env.json ---

test("plugin project: .wp-env.json uses plugins key with ['..']", () => {
	const wpEnv = JSON.parse(readFileSync(path.join(destDir(), ".wp-env.json"), "utf8"));
	assert.deepEqual(wpEnv.plugins, [".."]);
	assert.ok(!wpEnv.themes);
});

test("plugin project: afterStart activates plugin and theme", () => {
	const wpEnv = JSON.parse(readFileSync(path.join(destDir(), ".wp-env.json"), "utf8"));
	assert.ok(wpEnv.lifecycleScripts.afterStart.includes("wp plugin activate my-plugin"));
	assert.ok(wpEnv.lifecycleScripts.afterStart.includes("wp theme activate twentytwentyfive"));
});

test("plugin project: .wp-env.json has correct WordPress and PHP versions", () => {
	const wpEnv = JSON.parse(readFileSync(path.join(destDir(), ".wp-env.json"), "utf8"));
	assert.equal(wpEnv.core, "WordPress/WordPress#6.9.4");
	assert.equal(wpEnv.phpVersion, "8.3");
});

test("plugin project: test port is devPort + 1", () => {
	const wpEnv = JSON.parse(readFileSync(path.join(destDir(), ".wp-env.json"), "utf8"));
	assert.equal(wpEnv.env.development.port, 8886);
	assert.equal(wpEnv.env.tests.port, 8887);
});

// --- .env ---

test("plugin project: .env contains WP_BASE_URL with dev port", () => {
	const env = readFileSync(path.join(destDir(), ".env"), "utf8");
	assert.ok(env.includes("WP_BASE_URL=http://localhost:8886"));
});

// --- Theme project ---

test("theme project: .wp-env.json uses themes key with ['..']", () => {
	// Need a fresh dest for theme
	const themeDir = path.join(tmpDir, "theme-project", "wp-env-bin", "e2e");
	scaffoldE2eFiles(themeDir, SCAFFOLD_DIR, THEME_OPTIONS);
	const wpEnv = JSON.parse(readFileSync(path.join(themeDir, ".wp-env.json"), "utf8"));
	assert.deepEqual(wpEnv.themes, [".."]);
	assert.ok(!wpEnv.plugins);
});

test("theme project: afterStart activates theme only", () => {
	const themeDir = path.join(tmpDir, "theme-project", "wp-env-bin", "e2e");
	const wpEnv = JSON.parse(readFileSync(path.join(themeDir, ".wp-env.json"), "utf8"));
	assert.ok(wpEnv.lifecycleScripts.afterStart.includes("wp theme activate my-theme"));
	assert.ok(!wpEnv.lifecycleScripts.afterStart.includes("wp plugin activate"));
});

// --- Custom mysqlPort, testMysqlPort, and wpConstants ---

test("custom mysqlPort, testMysqlPort, and wpConstants are written to .wp-env.json", () => {
	const customDir = path.join(tmpDir, "custom-ports", "wp-env-bin", "e2e");
	scaffoldE2eFiles(customDir, SCAFFOLD_DIR, {
		...PLUGIN_OPTIONS,
		mysqlPort: 52000,
		testMysqlPort: 52001,
		wpConstants: { WP_DEBUG: true, DISABLE_WP_CRON: false },
	});
	const wpEnv = JSON.parse(readFileSync(path.join(customDir, ".wp-env.json"), "utf8"));
	assert.equal(wpEnv.env.development.mysqlPort, 52000);
	assert.equal(wpEnv.env.tests.mysqlPort, 52001);
	assert.equal(wpEnv.config.WP_DEBUG, true);
	assert.equal(wpEnv.config.DISABLE_WP_CRON, false);
});

// --- Idempotency ---

test("running scaffold twice does not overwrite existing files", () => {
	const dest = destDir();
	const wpEnvPath = path.join(dest, ".wp-env.json");
	const originalContent = readFileSync(wpEnvPath, "utf8");

	// Re-run with different values
	scaffold({ ...PLUGIN_OPTIONS, wpVersion: "9.9.9", slug: "different-plugin" });

	const afterContent = readFileSync(wpEnvPath, "utf8");
	assert.equal(originalContent, afterContent);
});
