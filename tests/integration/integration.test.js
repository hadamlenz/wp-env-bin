import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, rmSync } from "fs";
import path from "path";
import {
	WP_ENV_BIN_DIR,
	ASSETS_DIR,
	writeTestConfig,
	cleanAssets,
	startEnv,
	seedTestsEnv,
	resetDevDb,
	withEnvDir,
} from "./helpers/env.js";
import { wpCliDev } from "./helpers/wpcli.js";

// ─── Global setup ─────────────────────────────────────────────────────────────

before(() => {
	writeTestConfig();
	cleanAssets();
	startEnv();
	seedTestsEnv();
});

after(() => {
	// Docker is left running. Stop manually with:
	//   npx wp-env stop  (from tests/integration/env/wp-env-bin/)
	cleanAssets();
});

// ─── db get ──────────────────────────────────────────────────────────────────

describe("db get", () => {
	before(() => {
		cleanAssets();
	});

	test("exports database.sql to wp-env-bin/assets/", async () => {
		await withEnvDir(async () => {
			const { getRemoteDb } = await import("../../commands/db.js");
			await getRemoteDb({ action: "redownload" });
		});
		assert.ok(
			existsSync(path.join(ASSETS_DIR, "database.sql")),
			"database.sql should exist after db get"
		);
	});

	test("exported SQL is a valid mysqldump", () => {
		const content = readFileSync(path.join(ASSETS_DIR, "database.sql"), "utf8");
		const isValid =
			content.includes("-- MySQL dump") || content.includes("-- MariaDB dump");
		assert.ok(isValid, "database.sql should start with a mysqldump header");
	});

	test("exported SQL contains the test marker option key", () => {
		const content = readFileSync(path.join(ASSETS_DIR, "database.sql"), "utf8");
		assert.ok(
			content.includes("wp_env_bin_test_marker"),
			"SQL should contain the wp_env_bin_test_marker option key"
		);
	});

	test("exported SQL contains the test marker option value", () => {
		const content = readFileSync(path.join(ASSETS_DIR, "database.sql"), "utf8");
		assert.ok(
			content.includes("integration-test-v1"),
			"SQL should contain the integration-test-v1 value"
		);
	});
});

// ─── db process ──────────────────────────────────────────────────────────────

describe("db process", () => {
	before(async () => {
		cleanAssets();
		await withEnvDir(async () => {
			const { getRemoteDb } = await import("../../commands/db.js");
			await getRemoteDb({ action: "redownload" });
		});
		resetDevDb();
	});

	test("imports the database into the development environment", async () => {
		await withEnvDir(async () => {
			const { processDb } = await import("../../commands/db.js");
			await processDb({ createAdmin: false });
		});
		const marker = wpCliDev("option get wp_env_bin_test_marker").trim();
		assert.equal(
			marker,
			"integration-test-v1",
			"marker option should survive the export → import round-trip"
		);
	});

	test("replaces the live URL with localhost in the development database", () => {
		const siteurl = wpCliDev("option get siteurl").trim();
		assert.ok(
			siteurl.includes("localhost:8897"),
			`siteurl should point to localhost:8897 after search-replace, got: ${siteurl}`
		);
	});

	test("test plugin remains active after import", () => {
		const status = wpCliDev("plugin status wp-env-bin-test-plugin").trim();
		assert.ok(
			/active/i.test(status),
			"test plugin should be active in the development environment after import"
		);
	});
});

// ─── htaccess make ───────────────────────────────────────────────────────────

describe("htaccess make", () => {
	before(() => {
		cleanAssets();
	});

	test("generates .htaccess in wp-env-bin/assets/", async () => {
		await withEnvDir(async () => {
			const { makeHtaccess } = await import("../../commands/htaccess.js");
			makeHtaccess({ action: "regenerate" });
		});
		assert.ok(
			existsSync(path.join(ASSETS_DIR, ".htaccess")),
			".htaccess should exist after htaccess make"
		);
	});

	test(".htaccess contains WordPress rewrite block", () => {
		const content = readFileSync(path.join(ASSETS_DIR, ".htaccess"), "utf8");
		assert.ok(
			content.includes("# BEGIN WordPress"),
			".htaccess should contain WordPress rewrite block"
		);
	});

	test(".htaccess contains reverse proxy block", () => {
		const content = readFileSync(path.join(ASSETS_DIR, ".htaccess"), "utf8");
		assert.ok(
			content.includes("# BEGIN Reverse proxy"),
			".htaccess should contain reverse proxy block"
		);
	});

	test(".htaccess proxies to the live (tests) environment URL", () => {
		const content = readFileSync(path.join(ASSETS_DIR, ".htaccess"), "utf8");
		assert.ok(
			content.includes("localhost:8898"),
			".htaccess should reference the tests environment URL (localhost:8898)"
		);
	});
});

// ─── env sync (full pipeline) ────────────────────────────────────────────────

describe("env sync (full pipeline)", () => {
	before(() => {
		cleanAssets();
		seedTestsEnv();
		resetDevDb();
	});

	test("db get → db process → htaccess make: marker option survives round-trip", async () => {
		await withEnvDir(async () => {
			const { getRemoteDb, processDb } = await import("../../commands/db.js");
			const { makeHtaccess } = await import("../../commands/htaccess.js");
			await getRemoteDb({ action: "redownload" });
			await processDb({ createAdmin: false });
			makeHtaccess({ action: "regenerate" });
		});
		const marker = wpCliDev("option get wp_env_bin_test_marker").trim();
		assert.equal(marker, "integration-test-v1", "marker should survive the full sync pipeline");
	});

	test("full pipeline: siteurl is replaced to development localhost", () => {
		const siteurl = wpCliDev("option get siteurl").trim();
		assert.ok(
			siteurl.startsWith("http://localhost:8897"),
			`siteurl should point to http://localhost:8897, got: ${siteurl}`
		);
	});

	test("full pipeline: .htaccess is generated", () => {
		assert.ok(
			existsSync(path.join(ASSETS_DIR, ".htaccess")),
			".htaccess should exist after full sync"
		);
	});

	test("full pipeline: development site responds HTTP 200", async () => {
		const { execSync } = await import("child_process");
		const status = execSync(
			'curl -s -o /dev/null -w "%{http_code}" http://localhost:8897',
			{ encoding: "utf8" }
		).trim();
		assert.equal(status, "200", "development site should return HTTP 200 after full sync");
	});
});

// ─── plugin activation ───────────────────────────────────────────────────────

describe("plugin activation", () => {
	before(async () => {
		// Write a composer.json that lists the test plugin so getInactivePlugins
		// has something to check against.
		writeFileSync(
			path.join(WP_ENV_BIN_DIR, "composer.json"),
			JSON.stringify(
				{ require: { "test/wp-env-bin-test-plugin": "*" } },
				null,
				2
			),
			"utf8"
		);
		// Import a known state so the test plugin is present and active in dev env
		cleanAssets();
		await withEnvDir(async () => {
			const { getRemoteDb, processDb } = await import("../../commands/db.js");
			await getRemoteDb({ action: "redownload" });
			await processDb({ createAdmin: false });
		});
	});

	after(() => {
		// Remove the test composer.json so it doesn't affect other test runs
		const composerPath = path.join(WP_ENV_BIN_DIR, "composer.json");
		try { rmSync(composerPath); } catch { /* already gone */ }
	});

	test("getInactivePlugins returns empty array when all plugins are active", async () => {
		let inactive;
		await withEnvDir(async () => {
			const { getInactivePlugins } = await import("../../commands/plugins.js");
			inactive = getInactivePlugins();
		});
		assert.ok(Array.isArray(inactive), "getInactivePlugins should return an array");
		assert.equal(inactive.length, 0, "no inactive plugins expected when test plugin is active");
	});

	test("activateComposerPlugins re-activates a deactivated plugin", async () => {
		wpCliDev("plugin deactivate wp-env-bin-test-plugin");

		await withEnvDir(async () => {
			const { getInactivePlugins, activateComposerPlugins } = await import("../../commands/plugins.js");
			const inactive = getInactivePlugins();
			if (inactive.length > 0) {
				activateComposerPlugins(inactive);
			}
		});

		const status = wpCliDev("plugin status wp-env-bin-test-plugin").trim();
		assert.ok(
			/active/i.test(status),
			"test plugin should be re-activated by activateComposerPlugins"
		);
	});
});
