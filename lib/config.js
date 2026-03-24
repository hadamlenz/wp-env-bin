const { mkdirSync, existsSync, copyFileSync, writeFileSync } = require("fs");
const path = require("path");
const { logger } = require("./utils/log");

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
 * Prompt the user to save the current config (and optionally composer.json) as a
 * named profile in wp-env-bin/site-configs/.
 *
 * @param {string} dest - Absolute path to the wp-env-bin/ directory
 * @param {object} config - The config object that was just written to wp-env-bin.config.json
 * @returns {Promise<void>}
 */
async function saveNamedProfile(dest, config) {
	const { confirm, input } = await import("@inquirer/prompts");

	const shouldSave = await confirm({
		message: "Save this as a named profile in site-configs/?",
		default: true,
	});

	if (!shouldSave) return;

	const profileName = await input({
		message: "Profile name (used as filename prefix)",
		default: config.url || "",
	});

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

	const composerSrc = path.join(dest, "composer.json");
	if (existsSync(composerSrc)) {
		const saveComposer = await confirm({
			message: "Also save composer.json as site-configs/" + profileName + ".composer.json?",
			default: true,
		});
		if (saveComposer) {
			copyFileSync(composerSrc, path.join(siteConfigsDir, profileName + ".composer.json"));
			logger("> saved site-configs/" + profileName + ".composer.json");

			const lockSrc = path.join(dest, "composer.lock");
			if (existsSync(lockSrc)) {
				copyFileSync(lockSrc, path.join(siteConfigsDir, profileName + ".composer.lock"));
				logger("> saved site-configs/" + profileName + ".composer.lock");
			}
		}
	}
}

module.exports = { applyProjectType, saveNamedProfile };
