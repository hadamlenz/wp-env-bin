"use strict";

const { execSync } = require("child_process");
const { WP_ENV_BIN_DIR } = require("./env");

/**
 * Run a WP-CLI command in the development (local) environment.
 *
 * @param {string} cmd - WP-CLI args (without leading `wp`)
 * @returns {string} stdout
 */
function wpCliDev(cmd) {
	return execSync(`npx wp-env run cli -- wp ${cmd}`, {
		cwd: WP_ENV_BIN_DIR,
		encoding: "utf8",
	});
}

/**
 * Run a WP-CLI command in the tests (live) environment.
 *
 * @param {string} cmd - WP-CLI args (without leading `wp`)
 * @returns {string} stdout
 */
function wpCliTests(cmd) {
	return execSync(`npx wp-env run tests-cli -- wp ${cmd}`, {
		cwd: WP_ENV_BIN_DIR,
		encoding: "utf8",
	});
}

module.exports = { wpCliDev, wpCliTests };
