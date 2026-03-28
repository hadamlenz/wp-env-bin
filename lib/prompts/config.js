import { existsSync, readFileSync, copyFileSync } from "fs";
import path from "path";
import chalk from "chalk";
import { select, input, confirm } from "@inquirer/prompts";

import { configInstall, configUpdate, configSwitch, getProfileList, getActiveProfile, configCreate, configDelete } from "../../commands/config.js";
import { install, getInstallContext } from "../../commands/install.js";
import { setup } from "../../commands/setup.js";
import { getRemoteDb, processDb } from "../../commands/db.js";
import { makeHtaccess } from "../../commands/htaccess.js";
import { getInactivePlugins, activateComposerPlugins } from "../../commands/plugins.js";
import { runWpEnv } from "../../commands/env.js";
import { getConfigValue } from "../env/config.js";
import { isWpEnvRunning, checkDatabase, checkModifiedDatabase } from "../env/check.js";
import { saveNamedProfile } from "../config.js";

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Prompt for all wp-env-bin.config.json fields and return a config object.
 *
 * @param {object} [defaults={}] - Existing config values to use as defaults
 * @param {string} [projectName=""] - Project name from package.json (used as pluginName default)
 * @returns {Promise<object>}
 */
async function promptForConfig(defaults = {}, projectName = "") {
	const projectType = await select({
		message: "Is this a plugin or a theme?",
		choices: [
			{ name: "Plugin", value: "plugin" },
			{ name: "Theme", value: "theme" },
		],
		default: defaults.projectType || "plugin",
	});

	const siteType = await select({
		message: "Site type?",
		choices: [
			{ name: "Single-site", value: "singlesite" },
			{ name: "Multisite (Pantheon subsite)", value: "multisite" },
		],
		default: defaults.siteType || "singlesite",
	});

	const env = await input({
		message: "Pantheon site.environment (e.g. my-site.live)",
		default: defaults.env || "",
	});

	const url = await input({
		message: "Live site URL (e.g. mysite.org)",
		default: defaults.url || "",
	});

	const pluginName = await input({
		message: "Plugin or theme name (for reference)",
		default: defaults.pluginName || projectName,
	});

	const config = { pluginName, projectType, siteType, env, url };

	if (siteType === "multisite") {
		config.oldPrefix = await input({
			message: "Live DB table prefix (e.g. wp_123_)",
			default: defaults.oldPrefix || "",
		});
		config.siteId = await input({
			message: "Multisite site ID",
			default: defaults.siteId || "",
		});
	}

	return config;
}

/**
 * Prompt to save the current config as a named profile.
 *
 * @param {object} config - The config that was just written
 * @param {string} dest   - Absolute path to wp-env-bin/
 * @returns {Promise<void>}
 */
async function promptAndSaveProfile(config, dest) {
	const shouldSave = await confirm({
		message: "Save this as a named profile in site-configs/?",
		default: true,
	});

	if (!shouldSave) {
		saveNamedProfile(dest, config, { shouldSave: false });
		return;
	}

	const profileName = await input({
		message: "Profile name (used as filename prefix)",
		default: config.url || "",
	});

	let saveComposer = false;
	const composerSrc = path.join(dest, "composer.json");
	if (existsSync(composerSrc)) {
		saveComposer = await confirm({
			message: "Also save composer.json as site-configs/" + profileName + ".composer.json?",
			default: true,
		});
	}

	saveNamedProfile(dest, config, { shouldSave: true, profileName, saveComposer });
}

/**
 * Offer to reinitialize the local environment after a config change.
 *
 * @param {string}  siteType - "singlesite" | "multisite"
 * @param {boolean} dbCached - Whether a cached database was already restored
 * @returns {Promise<void>}
 */
async function promptReinitEnvironment(siteType, dbCached = false) {
	if (siteType === "multisite") {
		const reinit = await confirm({
			message: "Would you like to reinitialize the local environment with the new config? This only works for remote multisite.",
			default: false,
		});
		if (reinit) {
			console.log(chalk.cyan("> Reinitializing environment..."));
			// Stop wp-env before composer so Docker releases file locks on stale dirs.
			if (isWpEnvRunning()) {
				console.log(chalk.cyan("> Stopping wp-env before reinstall..."));
				runWpEnv(["stop"]);
			}
			setup(["--delete-lock"]);
			await getRemoteDb({ action: dbCached ? "useIt" : "redownload" });
			// Start wp-env before the db import — it must be running to accept the import.
			runWpEnv(["start"]);
			await processDb();
			makeHtaccess();
			const inactivePlugins = getInactivePlugins();
			if (inactivePlugins.length > 0) {
				activateComposerPlugins(inactivePlugins);
			}

			// Clear the screen and print a clean summary
			const devPort   = getConfigValue("wp-env.env.development.port")    || 8889;
			const testPort  = getConfigValue("wp-env.env.tests.port")           || 8882;
			const devMysql  = getConfigValue("wp-env.env.development.mysqlPort");
			const testMysql = getConfigValue("wp-env.env.tests.mysqlPort");
			process.stdout.write("\x1Bc");
			console.log(chalk.green.bold("wp-env-bin finished reinitializing\n"));
			console.log("WordPress development site started at " + chalk.cyan("http://localhost:" + devPort));
			console.log("WordPress test site started at " + chalk.cyan("http://localhost:" + testPort));
			if (devMysql)  console.log("MySQL is listening on port " + chalk.cyan(devMysql));
			if (testMysql) console.log("MySQL for automated testing is listening on port " + chalk.cyan(testMysql));
		} else {
			console.log("\nTo get a working environment, run these steps manually:");
			console.log(chalk.cyan("  0. wp-env-bin composer get    (optionally build a composer.json"));
			console.log(chalk.cyan("  1. wp-env-bin composer install --delete-lock"));
			if (dbCached) {
				console.log(chalk.gray("  2. wp-env-bin db get          (skipped — database restored from cache)"));
			} else {
				console.log(chalk.cyan("  2. wp-env-bin db get          (export db from remote host)"));
			}
			console.log(chalk.cyan("  3. wp-env-bin env start"));
			console.log(chalk.cyan("  4. wp-env-bin db process      (import database + search-replace)"));
			console.log(chalk.cyan("  5. wp-env-bin htaccess make   (regenerate from current config)"));
		}
	} else {
		console.log(chalk.cyan(">  run `wp-env-bin composer install --delete-lock` to reinstall dependencies."));
		console.log(chalk.cyan(">  run `wp-env-bin env start` to restart the development environment."));
		console.log(chalk.cyan(">  run `wp-env-bin env sync` to sync the database and .htaccess file for this config."));
	}
}

// ─── Command handlers ─────────────────────────────────────────────────────────

async function configInstallPrompt() {
	const ctx = getInstallContext();
	let action;
	if (ctx.configExists) {
		action = await select({
			message: "wp-env-bin.config.json already exists. What would you like to do?",
			choices: [
				{ name: "Use the existing config", value: "useIt" },
				{ name: "Reconfigure using existing values as defaults", value: "editIt" },
				{ name: "Start over with a fresh config", value: "destroyIt" },
			],
		});
		if (action === "editIt") action = "configure";
		if (action === "destroyIt") { ctx.existingConfig = null; action = "configure"; }
	} else {
		const shouldConfigure = await confirm({
			message: "Configure wp-env-bin.config.json now?",
			default: true,
		});
		action = shouldConfigure ? "configure" : "skip";
	}

	let config = null;
	if (action === "configure") {
		config = await promptForConfig(ctx.existingConfig || {}, ctx.projectName);
	}

	configInstall({ action, config }, { shouldSave: false });
	if (action === "configure" && config) {
		await promptAndSaveProfile(config, ctx.dest);
	}
}

async function configUpdatePrompt() {
	const dest = path.join(process.cwd(), "wp-env-bin");
	const configPath = path.join(dest, "wp-env-bin.config.json");
	if (!existsSync(configPath)) {
		console.log(chalk.red("No wp-env-bin.config.json found. Run `wp-env-bin config install` first."));
		process.exit(1);
	}
	let existingConfig = {};
	try {
		existingConfig = JSON.parse(readFileSync(configPath, "utf8"));
	} catch {
		console.log(chalk.red("wp-env-bin.config.json is malformed. Run `wp-env-bin config install` to start fresh."));
		process.exit(1);
	}
	const config = await promptForConfig(existingConfig);
	configUpdate(config, { shouldSave: false });
	await promptAndSaveProfile(config, dest);
}

async function configSwitchPrompt() {
	const profiles = getProfileList();
	if (!profiles) {
		console.log(chalk.red("No site-configs/ directory found."));
		console.log("Run `wp-env-bin config install` and save a named profile to get started.");
		return;
	}
	if (profiles.length === 0) {
		console.log(chalk.red("No named profiles found in wp-env-bin/site-configs/."));
		console.log("Run `wp-env-bin config install` or `wp-env-bin config update` and save a profile to get started.");
		return;
	}

	const dest = path.join(process.cwd(), "wp-env-bin");
	const siteConfigsDir = path.join(dest, "site-configs");

	// Detect currently loaded profile using getActiveProfile()
	const currentProfile = getActiveProfile();

	const chosen = await select({
		message: "Switch to which site config?",
		choices: profiles.map(p => ({
			name: p === currentProfile ? `${p} (currently loaded)` : p,
			value: p,
		})),
	});

	// Offer to save current database to cache before switching away
	if (currentProfile && currentProfile !== chosen) {
		const cachedDbPath = path.join(siteConfigsDir, currentProfile + ".database.sql");
		if (checkDatabase() && !existsSync(cachedDbPath)) {
			const saveDb = await confirm({
				message: "Save current database to cache as site-configs/" + currentProfile + ".database.sql before switching?",
				default: true,
			});
			if (saveDb) {
				copyFileSync(path.join(dest, "assets/database.sql"), cachedDbPath);
				console.log(chalk.green("> cached to site-configs/" + currentProfile + ".database.sql"));
				const modSrc = path.join(dest, "assets/database.modified.sql");
				const cachedModPath = path.join(siteConfigsDir, currentProfile + ".database.modified.sql");
				if (checkModifiedDatabase() && !existsSync(cachedModPath)) {
					copyFileSync(modSrc, cachedModPath);
					console.log(chalk.green("> cached to site-configs/" + currentProfile + ".database.modified.sql"));
				}
			}
		}
	}

	const { config: newConfig, dbCached } = configSwitch(chosen);
	const siteType = (newConfig && newConfig.siteType) || "singlesite";

	if (dbCached) {
		console.log(chalk.green("> Database restored from cache — skipping db get"));
	} else {
		console.log(chalk.yellow("> No cached database found for " + chosen + ". Run `wp-env-bin db get` to download."));
	}

	await promptReinitEnvironment(siteType, dbCached);
}

async function configCreatePrompt() {
	let projectName = "";
	try {
		const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
		projectName = pkg.name || "";
	} catch { /* no package.json */ }

	const siteType = await select({
		message: "Site type?",
		choices: [
			{ name: "Single-site", value: "singlesite" },
			{ name: "Multisite", value: "multisite" },
		],
		default: "singlesite",
	});

	const host = await select({
		message: "Remote host type?",
		choices: [
			{ name: "Pantheon (Terminus)", value: "pantheon" },
			{ name: "Generic SSH (WP-CLI SSH)", value: "ssh" },
			{ name: "WordPress VIP (VIP-CLI)", value: "wpvip" },
		],
		default: "pantheon",
	});

	const envMessages = {
		pantheon: "Pantheon site.environment — e.g. mysite.live (leave blank to skip)",
		ssh:      "SSH connection string — e.g. user@hostname/var/www/html (leave blank to skip)",
		wpvip:    "WPVIP app.environment — e.g. myapp.production (leave blank to skip)",
	};

	const env = await input({
		message: envMessages[host],
		default: "",
	});

	const url = await input({
		message: "Live site URL — e.g. example.com",
		default: "",
	});

	const pluginName = await input({
		message: "Plugin or theme name (for reference)",
		default: projectName,
	});

	const createConfig = { pluginName, siteType, host, env, url };

	if (siteType === "multisite") {
		createConfig.oldPrefix = await input({
			message: "Live DB table prefix — e.g. wp_123_",
			default: "",
		});
		createConfig.siteId = await input({
			message: "Multisite site ID",
			default: "",
		});
	}

	const composerPathInput = await input({
		message: "Path to composer.json on the server (e.g. /code/composer.json) — leave blank to skip",
		default: "",
	});
	if (composerPathInput.trim()) createConfig.composerPath = composerPathInput.trim();

	const profileName = await input({
		message: "Profile name (used as filename prefix in site-configs/)",
		default: url || projectName,
		validate: (v) => {
			if (/\//u.test(v)) return "Profile name must not contain /";
			if (!v.trim()) return "Profile name is required";
			return true;
		},
	});

	configCreate(createConfig, profileName);

	const makeActive = await confirm({
		message: "Make this the active config now?",
		default: true,
	});
	if (makeActive) {
		const { config: newConfig, dbCached } = configSwitch(profileName);
		const siteType = (newConfig && newConfig.siteType) || "singlesite";
		await promptReinitEnvironment(siteType, dbCached);
	}
}

async function configDeletePrompt() {
	const profiles = getProfileList();
	if (!profiles || profiles.length === 0) {
		console.log(chalk.red("No profiles found in wp-env-bin/site-configs/."));
		console.log("Run `wp-env-bin config create` to create one.");
		return;
	}

	const chosen = await select({
		message: "Delete which profile?",
		choices: profiles.map(p => ({ name: p, value: p })),
	});

	// Show all companion files that will be removed
	const dest = path.join(process.cwd(), "wp-env-bin");
	const siteConfigsDir = path.join(dest, "site-configs");
	const toDelete = [chosen + ".wp-env-bin.config.json"];
	for (const ext of [".composer.json", ".database.sql", ".database.modified.sql"]) {
		if (existsSync(path.join(siteConfigsDir, chosen + ext))) {
			toDelete.push(chosen + ext);
		}
	}
	console.log("\nThe following files will be deleted:");
	toDelete.forEach(f => console.log(chalk.red("  site-configs/" + f)));

	const confirmed = await confirm({
		message: "Confirm deletion?",
		default: false,
	});

	if (confirmed) {
		configDelete(chosen);
		console.log(chalk.gray("\nNote: the active wp-env-bin.config.json was not removed."));
	} else {
		console.log(chalk.gray("Cancelled."));
	}
}

export {
	promptForConfig,
	promptAndSaveProfile,
	promptReinitEnvironment,
	configInstallPrompt,
	configUpdatePrompt,
	configSwitchPrompt,
	configCreatePrompt,
	configDeletePrompt,
};
