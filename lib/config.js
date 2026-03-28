import { mkdirSync, existsSync, copyFileSync } from "fs";
import path from "path";
import { logger } from "./utils/log.js";

/**
 * Apply project type to a parsed .wp-env.json object.
 * Sets `themes: [".."]` for theme projects, `plugins: [".."]` for plugin projects,
 * and removes the opposing key if present.
 *
 * @param {object} wpEnvObj - Parsed .wp-env.json contents
 * @param {'theme'|'plugin'} projectType
 * @returns {object} Updated copy of wpEnvObj
 */
function applyProjectType(wpEnvObj, projectType) {
	const out = { ...wpEnvObj };
	if (projectType === "theme") {
		delete out.plugins;
		out.themes = [".."];
	} else {
		delete out.themes;
		out.plugins = [".."];
	}
	return out;
}

/**
 * Save the current config (and optionally composer.json) as a named profile
 * in wp-env-bin/site-configs/. All decisions are passed in as parameters —
 * no interactive prompts are used here.
 *
 * @param {string} dest - Absolute path to the wp-env-bin/ directory
 * @param {object} config - The config object that was just written to wp-env-bin.config.json
 * @param {object} options
 * @param {boolean} options.shouldSave    - Whether to save a profile at all
 * @param {string}  options.profileName   - Name prefix for the saved profile files
 * @param {boolean} [options.saveComposer] - Whether to also copy composer.json/.lock
 * @returns {void}
 */
function saveNamedProfile(dest, config, { shouldSave, profileName, saveComposer = false } = {}) {
	if (!shouldSave) return;

	if (!profileName) {
		logger("> Skipped profile save (no name provided)");
		return;
	}

	const siteConfigsDir = path.join(dest, "site-configs");
	mkdirSync(siteConfigsDir, { recursive: true });

	const configDest = path.join(siteConfigsDir, profileName + ".wp-env-bin.config.json");
	const activeConfig = path.join(dest, "wp-env-bin.config.json");
	copyFileSync(activeConfig, configDest);
	logger("> saved site-configs/" + profileName + ".wp-env-bin.config.json");

	if (saveComposer) {
		const composerSrc = path.join(dest, "composer.json");
		if (existsSync(composerSrc)) {
			copyFileSync(composerSrc, path.join(siteConfigsDir, profileName + ".composer.json"));
			logger("> saved site-configs/" + profileName + ".composer.json");
		}
	}
}

export { applyProjectType, saveNamedProfile };
