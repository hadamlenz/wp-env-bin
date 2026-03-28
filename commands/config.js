import { existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import { logger } from "../lib/utils/log.js";
import { applyProjectType, saveNamedProfile } from "../lib/config.js";
import { makeComposerName } from "../lib/remote-composer.js";
import { install } from "./install.js";
import { requireDir, requireFile } from "../lib/env/check.js";

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
		logger("No wp-env-bin.config.json found. Run `wp-env-bin config install` first.", true, "error");
		process.exit(1);
	}

	writeFileSync(configPath, JSON.stringify(config, null, "\t"), "utf8");
	logger("> updated wp-env-bin/wp-env-bin.config.json", true, "success");

	const wpEnvPath = path.join(dest, ".wp-env.json");
	try {
		const wpEnv = JSON.parse(readFileSync(wpEnvPath, "utf8"));
		const updatedWpEnv = applyProjectType(wpEnv, config.projectType);
		writeFileSync(wpEnvPath, JSON.stringify(updatedWpEnv, null, 4), "utf8");
		logger("> updated wp-env-bin/.wp-env.json (" + config.projectType + ")", true, "success");
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
 * Detect which named profile is currently active by comparing the contents of
 * wp-env-bin.config.json with each profile in site-configs/. Returns null if
 * no match is found or if the directory structure is missing.
 *
 * @returns {string|null}
 */
function getActiveProfile() {
	const dest = path.join(process.cwd(), "wp-env-bin");
	const profiles = getProfileList();
	if (!profiles) return null;
	const activeConfigPath = path.join(dest, "wp-env-bin.config.json");
	const siteConfigsDir = path.join(dest, "site-configs");
	try {
		const activeContent = readFileSync(activeConfigPath, "utf8");
		for (const p of profiles) {
			const profileContent = readFileSync(path.join(siteConfigsDir, p + ".wp-env-bin.config.json"), "utf8");
			if (activeContent === profileContent) return p;
		}
	} catch { /* no match */ }
	return null;
}

/**
 * Activate a named profile by copying its config (and optionally composer
 * files) to the active wp-env-bin/ files. The chosen profile name is passed
 * in — no interactive prompts are used here.
 *
 * @param {string} chosen - The profile name to activate
 * @returns {{ config: object, dbCached: boolean }}
 */
function configSwitch(chosen) {
	const dest = path.join(process.cwd(), "wp-env-bin");
	const siteConfigsDir = path.join(dest, "site-configs");

	requireDir(dest, "Run this command from your project root (the directory containing wp-env-bin/).");
	requireFile(path.join(siteConfigsDir, chosen + ".wp-env-bin.config.json"), `Profile "${chosen}" not found in wp-env-bin/site-configs/. Run \`wp-env-bin config install\` to create it.`);

	copyFileSync(
		path.join(siteConfigsDir, chosen + ".wp-env-bin.config.json"),
		path.join(dest, "wp-env-bin.config.json")
	);
	logger("> copied site-configs/" + chosen + ".wp-env-bin.config.json → wp-env-bin.config.json", true, "success");

	const composerSrc = path.join(siteConfigsDir, chosen + ".composer.json");
	if (existsSync(composerSrc)) {
		copyFileSync(composerSrc, path.join(dest, "composer.json"));
		logger("> copied site-configs/" + chosen + ".composer.json → composer.json", true, "success");
	} else {
		const emptyComposer = {
			name: makeComposerName(chosen),
			"require-dev": {},
			repositories: [],
			extra: {
				"installer-paths": {
					"./themes/{$name}/": ["type:wordpress-theme"],
					"./plugins/{$name}": ["type:wordpress-plugin"],
				},
			},
			config: {
				platform: { php: "8.3" },
				"allow-plugins": { "composer/installers": true },
			},
		};
		writeFileSync(path.join(dest, "composer.json"), JSON.stringify(emptyComposer, null, 4), "utf8");
		logger("> wrote empty composer.json (no companion found for " + chosen + ")", true, "info");
	}

	const dbSrc = path.join(siteConfigsDir, chosen + ".database.sql");
	const dbCached = existsSync(dbSrc);
	if (dbCached) {
		copyFileSync(dbSrc, path.join(dest, "assets/database.sql"));
		logger("> copied site-configs/" + chosen + ".database.sql → assets/database.sql", true, "success");
		const modSrc = path.join(siteConfigsDir, chosen + ".database.modified.sql");
		if (existsSync(modSrc)) {
			copyFileSync(modSrc, path.join(dest, "assets/database.modified.sql"));
			logger("> copied site-configs/" + chosen + ".database.modified.sql → assets/database.modified.sql", true, "success");
		}
	}

	logger("\nSwitched to " + chosen, true, "success");

	try {
		return { config: JSON.parse(readFileSync(path.join(dest, "wp-env-bin.config.json"), "utf8")), dbCached };
	} catch {
		return { config: {}, dbCached };
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
	logger("> saved site-configs/" + profileName + ".wp-env-bin.config.json", true, "success");

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
		profileName + ".database.sql",
		profileName + ".database.modified.sql",
	];

	for (const file of companions) {
		const filePath = path.join(siteConfigsDir, file);
		if (existsSync(filePath)) {
			unlinkSync(filePath);
			logger("> deleted site-configs/" + file, true, "muted");
		}
	}
}

export { configInstall, configUpdate, configSwitch, getProfileList, getActiveProfile, configCreate, configDelete };
