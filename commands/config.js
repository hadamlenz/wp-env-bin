const { existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync, writeFileSync, readFileSync } = require("fs");
const path = require("path");
const { logger } = require("../lib/utils/log");
const { applyProjectType, saveNamedProfile } = require("../lib/config");
const { install } = require("./install");

/**
 * Scaffold and configure wp-env-bin for the first time, then save as a named
 * profile if requested. All interactive decisions are passed in as parameters.
 *
 * @param {object} installOptions - Passed through to install()
 * @param {object} profileOptions - Passed through to saveNamedProfile()
 * @returns {void}
 */
function configInstall(installOptions, profileOptions) {
	install(installOptions);
	const dest = path.join(process.cwd(), "wp-env-bin");
	if (installOptions.action === "configure" && installOptions.config) {
		saveNamedProfile(dest, installOptions.config, profileOptions);
	}
}

/**
 * Re-run configuration using the supplied config values as the new active
 * config. Does not re-scaffold template files. Saves as a named profile if
 * requested. All interactive decisions are passed in as parameters.
 *
 * @param {object} config - New config values to write to wp-env-bin.config.json
 * @param {object} profileOptions - Passed through to saveNamedProfile()
 * @returns {void}
 */
function configUpdate(config, profileOptions) {
	const dest = path.join(process.cwd(), "wp-env-bin");
	const configPath = path.join(dest, "wp-env-bin.config.json");

	if (!existsSync(configPath)) {
		logger("No wp-env-bin.config.json found. Run `wp-env-bin config install` first.");
		process.exit(1);
	}

	writeFileSync(configPath, JSON.stringify(config, null, "\t"), "utf8");
	logger("> updated wp-env-bin/wp-env-bin.config.json");

	const wpEnvPath = path.join(dest, ".wp-env.json");
	try {
		const wpEnv = JSON.parse(readFileSync(wpEnvPath, "utf8"));
		const updatedWpEnv = applyProjectType(wpEnv, config.projectType);
		writeFileSync(wpEnvPath, JSON.stringify(updatedWpEnv, null, 4), "utf8");
		logger("> updated wp-env-bin/.wp-env.json (" + config.projectType + ")");
	} catch {
		// .wp-env.json missing or malformed — leave it as-is
	}

	saveNamedProfile(dest, config, profileOptions);
}

/**
 * Return the list of named profile names found in wp-env-bin/site-configs/,
 * or null if the directory does not exist. Used by the bin to build the
 * profile-selection prompt.
 *
 * @returns {string[]|null}
 */
function getProfileList() {
	const dest = path.join(process.cwd(), "wp-env-bin");
	const siteConfigsDir = path.join(dest, "site-configs");

	if (!existsSync(siteConfigsDir)) return null;

	const files = readdirSync(siteConfigsDir);
	return files
		.filter(f => f.endsWith(".wp-env-bin.config.json"))
		.map(f => f.replace(".wp-env-bin.config.json", ""));
}

/**
 * Activate a named profile by copying its config (and optionally composer
 * files) to the active wp-env-bin/ files. The chosen profile name is passed
 * in — no interactive prompts are used here.
 *
 * @param {string} chosen - The profile name to activate
 * @returns {void}
 */
function configSwitch(chosen) {
	const dest = path.join(process.cwd(), "wp-env-bin");
	const siteConfigsDir = path.join(dest, "site-configs");

	copyFileSync(
		path.join(siteConfigsDir, chosen + ".wp-env-bin.config.json"),
		path.join(dest, "wp-env-bin.config.json")
	);
	logger("> copied site-configs/" + chosen + ".wp-env-bin.config.json → wp-env-bin.config.json");

	const composerSrc = path.join(siteConfigsDir, chosen + ".composer.json");
	if (existsSync(composerSrc)) {
		copyFileSync(composerSrc, path.join(dest, "composer.json"));
		logger("> copied site-configs/" + chosen + ".composer.json → composer.json");
	}

	const lockSrc = path.join(siteConfigsDir, chosen + ".composer.lock");
	if (existsSync(lockSrc)) {
		copyFileSync(lockSrc, path.join(dest, "composer.lock"));
		logger("> copied site-configs/" + chosen + ".composer.lock → composer.lock");
	}

	logger("\nSwitched to " + chosen);

	try {
		return JSON.parse(readFileSync(path.join(dest, "wp-env-bin.config.json"), "utf8"));
	} catch {
		return {};
	}
}

/**
 * Save a new named profile to site-configs/ without touching the active
 * wp-env-bin.config.json. All interactive decisions are made by the caller.
 *
 * @param {object} config      - Config values to save
 * @param {string} profileName - Filename prefix (e.g. "example.com")
 * @returns {string} The profileName that was saved
 */
function configCreate(config, profileName) {
	const dest = path.join(process.cwd(), "wp-env-bin");
	const siteConfigsDir = path.join(dest, "site-configs");

	mkdirSync(siteConfigsDir, { recursive: true });

	const filePath = path.join(siteConfigsDir, profileName + ".wp-env-bin.config.json");
	writeFileSync(filePath, JSON.stringify(config, null, "\t"), "utf8");
	logger("> saved site-configs/" + profileName + ".wp-env-bin.config.json");

	return profileName;
}

/**
 * Delete a named profile and any companion composer files from site-configs/.
 * The caller is responsible for confirming before invoking this function.
 *
 * @param {string} profileName - The profile to remove
 * @returns {void}
 */
function configDelete(profileName) {
	const dest = path.join(process.cwd(), "wp-env-bin");
	const siteConfigsDir = path.join(dest, "site-configs");

	const companions = [
		profileName + ".wp-env-bin.config.json",
		profileName + ".composer.json",
		profileName + ".composer.lock",
	];

	for (const file of companions) {
		const filePath = path.join(siteConfigsDir, file);
		if (existsSync(filePath)) {
			unlinkSync(filePath);
			logger("> deleted site-configs/" + file);
		}
	}
}

module.exports = { configInstall, configUpdate, configSwitch, getProfileList, configCreate, configDelete };
