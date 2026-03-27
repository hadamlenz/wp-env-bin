"use strict";

const chalk = require("chalk");
const { readRawConfig } = require("../lib/env/config");
const { isWpEnvRunning } = require("../lib/env/check");

/**
 * Print the active site config and wp-env running state.
 *
 * Config is read from wp-env-bin/wp-env-bin.config.json via readRawConfig()
 * (returns null if missing — never throws). Running state is determined by
 * isWpEnvRunning(), which calls `npx wp-env status` and checks the exit code.
 *
 * @returns {void}
 */
function statusCommand() {
	const config = readRawConfig("config");
	if (config) {
		const siteType = config.siteType || "singlesite";
		const label = config.url ? config.url + " (" + siteType + ")" : "(" + siteType + ")";
		console.log(chalk.bold("Config: ") + label);
		if (config.url) console.log("  url: " + config.url);
	} else {
		console.log(chalk.bold("Config: ") + chalk.yellow("not loaded"));
	}

	console.log();

	const running = isWpEnvRunning();
	if (running) {
		console.log(chalk.bold("Environment: ") + chalk.green("running"));
		console.log("  http://localhost:8888");
	} else {
		console.log(chalk.bold("Environment: ") + chalk.yellow("not running"));
	}
}

module.exports = { statusCommand };
