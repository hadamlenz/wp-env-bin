"use strict";

const path = require("path");
const { execSync } = require("child_process");
const { mkdirSync, writeFileSync, rmSync, readdirSync } = require("fs");

const REPO_ROOT = path.resolve(__dirname, "../../..");
const ENV_DIR = path.resolve(__dirname, "../env");
const WP_ENV_BIN_DIR = path.join(ENV_DIR, "wp-env-bin");
const ASSETS_DIR = path.join(WP_ENV_BIN_DIR, "assets");
const SHIMS_DIR = path.resolve(__dirname, "../shims");

const TEST_CONFIG = {
	siteType: "singlesite",
	url: "localhost:8898",
	env: "integration-test.tests",
};

/**
 * Return a PATH-shimmed environment that puts our fake terminus first.
 */
function shimmedEnv() {
	return {
		...process.env,
		PATH: SHIMS_DIR + ":" + process.env.PATH,
	};
}

/**
 * Write the integration test config to wp-env-bin/wp-env-bin.config.json.
 */
function writeTestConfig() {
	writeFileSync(
		path.join(WP_ENV_BIN_DIR, "wp-env-bin.config.json"),
		JSON.stringify(TEST_CONFIG, null, 2),
		"utf8"
	);
}

/**
 * Remove and recreate the assets directory so each test starts clean.
 */
function cleanAssets() {
	mkdirSync(ASSETS_DIR, { recursive: true });
	for (const entry of readdirSync(ASSETS_DIR)) {
		rmSync(path.join(ASSETS_DIR, entry), { recursive: true, force: true });
	}
}

/**
 * Start both wp-env environments (idempotent — safe to call if already running).
 */
function startEnv() {
	execSync("npx wp-env start", { cwd: WP_ENV_BIN_DIR, stdio: "inherit" });
}

/**
 * Stop both wp-env environments.
 */
function stopEnv() {
	execSync("npx wp-env stop", { cwd: WP_ENV_BIN_DIR, stdio: "inherit" });
}

/**
 * Activate the test plugin in the tests (live) environment and set the
 * known marker option so it survives a DB round-trip.
 */
function seedTestsEnv() {
	execSync(
		"npx wp-env run tests-cli -- wp plugin activate wp-env-bin-test-plugin",
		{ cwd: WP_ENV_BIN_DIR, stdio: "inherit" }
	);
	execSync(
		"npx wp-env run tests-cli -- wp option update wp_env_bin_test_marker integration-test-v1",
		{ cwd: WP_ENV_BIN_DIR, stdio: "inherit" }
	);
}

/**
 * Reset the development (local) database to a clean WordPress install.
 * Faster than restarting Docker (~2s vs ~30s).
 */
function resetDevDb() {
	execSync(
		"npx wp-env run cli -- wp db reset --yes",
		{ cwd: WP_ENV_BIN_DIR, stdio: "inherit" }
	);
	execSync(
		[
			"npx wp-env run cli -- wp core install",
			"--url=http://localhost:8897",
			"--title=Test",
			"--admin_user=admin",
			"--admin_password=password",
			"--admin_email=admin@test.local",
			"--skip-email",
		].join(" "),
		{ cwd: WP_ENV_BIN_DIR, stdio: "inherit" }
	);
}

/**
 * Call a module function with process.cwd() set to ENV_DIR so that all
 * path-relative operations (config reads, file writes, wpcli cwd) resolve
 * correctly against the integration test environment directory.
 *
 * Restores the original cwd afterwards, even if the fn throws.
 *
 * @param {Function} fn - Async or sync function to call
 * @returns {Promise<*>} The return value of fn
 */
async function withEnvDir(fn) {
	const savedCwd = process.cwd();
	const savedPath = process.env.PATH;
	process.chdir(ENV_DIR);
	process.env.PATH = SHIMS_DIR + ":" + process.env.PATH;
	try {
		return await fn();
	} finally {
		process.chdir(savedCwd);
		process.env.PATH = savedPath;
	}
}

/**
 * Return the shimmed environment + ENVs needed to resolve npx in the shim.
 * Used when running wp-env-bin as a subprocess.
 */
function getShimmedEnv() {
	return shimmedEnv();
}

module.exports = {
	ENV_DIR,
	WP_ENV_BIN_DIR,
	ASSETS_DIR,
	SHIMS_DIR,
	REPO_ROOT,
	TEST_CONFIG,
	writeTestConfig,
	cleanAssets,
	startEnv,
	stopEnv,
	seedTestsEnv,
	resetDevDb,
	withEnvDir,
	getShimmedEnv,
};
