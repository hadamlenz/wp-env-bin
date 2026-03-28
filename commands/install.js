import { existsSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import { logger } from "../lib/utils/log.js";
import { applyProjectType } from "../lib/config.js";
import { scaffoldFiles } from "./scaffold.js";

/**
 * Return the current install-time filesystem context so the caller (bin) can
 * decide which prompts to show before calling install().
 *
 * @returns {{ dest: string, configPath: string, configExists: boolean, existingConfig: object|null, projectName: string }}
 */
function getInstallContext() {
	const dest = path.join(process.cwd(), "wp-env-bin");
	const configPath = path.join(dest, "wp-env-bin.config.json");
	const configExists = existsSync(configPath);

	let existingConfig = null;
	if (configExists) {
		try {
			existingConfig = JSON.parse(readFileSync(configPath, "utf8"));
		} catch {
			// malformed config, treat as missing
		}
	}

	let projectName = "";
	try {
		const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
		projectName = pkg.name || "";
	} catch {
		// no package.json in consuming project
	}

	return { dest, configPath, configExists, existingConfig, projectName };
}

/**
 * Scaffold the wp-env-bin/ config folder in the consuming project and,
 * when action is "configure", write wp-env-bin.config.json using the
 * supplied config values. All interactive decisions must be made by the
 * caller before invoking this function.
 *
 * @param {object} options
 * @param {"useIt"|"configure"|"skip"} options.action
 *   - "useIt"     — keep the existing config, just print next steps
 *   - "configure" — write a fresh config from options.config
 *   - "skip"      — scaffold files but skip config; print manual steps
 * @param {object} [options.config] - Config values (required when action === "configure")
 * @returns {void}
 */
function install({ action, config } = {}) {
	const dest = path.join(process.cwd(), "wp-env-bin");

	scaffoldFiles(dest);

	if (action === "useIt") {
		logger("> using existing wp-env-bin/wp-env-bin.config.json", true, "info");
		logger("\nNext steps:");
		if (!existsSync(path.join(dest, "composer.json"))) {
			logger("  cp wp-env-bin/composer.json.example wp-env-bin/composer.json");
			logger("  # Edit composer.json to add your plugin and theme dependencies");
		}
		logger("  wp-env-bin env setup");
		return;
	}

	if (action === "skip") {
		logger("\nNext steps:");
		logger("  cp wp-env-bin/wp-env-bin.config.json.example wp-env-bin/wp-env-bin.config.json");
		logger("  # Edit wp-env-bin.config.json with your env, url, oldPrefix, siteId");
		if (!existsSync(path.join(dest, "composer.json"))) {
			logger("  cp wp-env-bin/composer.json.example wp-env-bin/composer.json");
			logger("  # Edit composer.json to add your plugin and theme dependencies");
		}
		logger("  wp-env-bin env setup");
		return;
	}

	// action === "configure"
	const configPath = path.join(dest, "wp-env-bin.config.json");
	writeFileSync(configPath, JSON.stringify(config, null, "\t"), "utf8");
	logger("> created wp-env-bin/wp-env-bin.config.json", true, "success");

	const wpEnvPath = path.join(dest, ".wp-env.json");
	try {
		const wpEnv = JSON.parse(readFileSync(wpEnvPath, "utf8"));
		const updatedWpEnv = applyProjectType(wpEnv, config.projectType);
		writeFileSync(wpEnvPath, JSON.stringify(updatedWpEnv, null, 4), "utf8");
		logger("> updated wp-env-bin/.wp-env.json (" + config.projectType + ")", true, "success");
	} catch {
		// .wp-env.json missing or malformed — leave it as-is
	}

	logger("\nNext steps:");
	if (!existsSync(path.join(dest, "composer.json"))) {
		logger("  cp wp-env-bin/composer.json.example wp-env-bin/composer.json");
		logger("  # Edit composer.json to add your plugin and theme dependencies");
	}
	logger("  wp-env-bin env setup");
}

export { install, getInstallContext };
