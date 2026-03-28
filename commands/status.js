import chalk from "chalk";
import { readRawConfig, readWpEnvJson } from "../lib/env/config.js";
import { isWpEnvRunning } from "../lib/env/check.js";

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
		let port = 8888;
		try {
			const wpEnv = readWpEnvJson();
			port = wpEnv?.env?.development?.port ?? wpEnv?.port ?? 8888;
		} catch {
			// no .wp-env.json found — use default
		}
		console.log(chalk.bold("Environment: ") + chalk.green("running"));
		console.log("  http://localhost:" + port);
	} else {
		console.log(chalk.bold("Environment: ") + chalk.yellow("not running"));
	}
}

export { statusCommand };
