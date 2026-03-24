const { existsSync, readdirSync, copyFileSync, writeFileSync, readFileSync } = require("fs");
const path = require("path");
const { logger } = require("../lib/utils/log");
const { applyProjectType, saveNamedProfile } = require("../lib/config");
const { install } = require("./install");

/**
 * Scaffold and configure wp-env-bin for the first time, then offer to save as a named profile.
 * This is the primary entry point for `wp-env-bin config install`.
 *
 * @returns {Promise<void>}
 */
async function configInstall() {
	await install();
	const dest = path.join(process.cwd(), "wp-env-bin");
	const configPath = path.join(dest, "wp-env-bin.config.json");
	if (!existsSync(configPath)) return;
	try {
		const config = JSON.parse(readFileSync(configPath, "utf8"));
		await saveNamedProfile(dest, config);
	} catch {
		// malformed config — skip profile save
	}
}

/**
 * Re-run configuration prompts using existing wp-env-bin.config.json values as defaults.
 * Does not re-scaffold template files. Offers to save as a named profile when done.
 *
 * @returns {Promise<void>}
 */
async function configUpdate() {
	const dest = path.join(process.cwd(), "wp-env-bin");
	const configPath = path.join(dest, "wp-env-bin.config.json");

	if (!existsSync(configPath)) {
		logger("No wp-env-bin.config.json found. Run `wp-env-bin config install` first.");
		process.exit(1);
	}

	let existingConfig = {};
	try {
		existingConfig = JSON.parse(readFileSync(configPath, "utf8"));
	} catch {
		logger("wp-env-bin.config.json is malformed. Run `wp-env-bin config install` to start fresh.");
		process.exit(1);
	}

	const { select, input } = await import("@inquirer/prompts");

	const projectType = await select({
		message: "Is this a plugin or a theme?",
		choices: [
			{ name: "Plugin", value: "plugin" },
			{ name: "Theme", value: "theme" },
		],
		default: existingConfig.projectType || "plugin",
	});

	const siteType = await select({
		message: "Site type?",
		choices: [
			{ name: "Single-site", value: "singlesite" },
			{ name: "Multisite (Pantheon subsite)", value: "multisite" },
		],
		default: existingConfig.siteType || "singlesite",
	});

	const env = await input({
		message: "Pantheon site.environment (e.g. my-site.live)",
		default: existingConfig.env || "",
	});

	const url = await input({
		message: "Live site URL (e.g. mysite.unc.edu)",
		default: existingConfig.url || "",
	});

	const pluginName = await input({
		message: "Plugin or theme name (for reference)",
		default: existingConfig.pluginName || "",
	});

	const config = {
		pluginName,
		projectType,
		siteType,
		env,
		url,
	};

	if (siteType === "multisite") {
		config.oldPrefix = await input({
			message: "Live DB table prefix (e.g. wp_123_)",
			default: existingConfig.oldPrefix || "",
		});
		config.siteId = await input({
			message: "Multisite site ID",
			default: existingConfig.siteId || "",
		});
	}

	writeFileSync(configPath, JSON.stringify(config, null, "\t"), "utf8");
	logger("> updated wp-env-bin/wp-env-bin.config.json");

	const wpEnvPath = path.join(dest, ".wp-env.json");
	try {
		const wpEnv = JSON.parse(readFileSync(wpEnvPath, "utf8"));
		const updatedWpEnv = applyProjectType(wpEnv, projectType);
		writeFileSync(wpEnvPath, JSON.stringify(updatedWpEnv, null, 4), "utf8");
		logger("> updated wp-env-bin/.wp-env.json (" + projectType + ")");
	} catch {
		// .wp-env.json missing or malformed — leave it as-is
	}

	await saveNamedProfile(dest, config);
}

/**
 * List named profiles in wp-env-bin/site-configs/ and let the user pick one to activate.
 * Copies the selected profile's config (and optionally composer.json / composer.lock)
 * to the active wp-env-bin/ files.
 *
 * @returns {Promise<void>}
 */
async function configSwitch() {
	const dest = path.join(process.cwd(), "wp-env-bin");
	const siteConfigsDir = path.join(dest, "site-configs");

	if (!existsSync(siteConfigsDir)) {
		logger("No site-configs/ directory found.");
		logger("Run `wp-env-bin config install` and save a named profile to get started.");
		return;
	}

	const files = readdirSync(siteConfigsDir);
	const profiles = files
		.filter(f => f.endsWith(".wp-env-bin.config.json"))
		.map(f => f.replace(".wp-env-bin.config.json", ""));

	if (profiles.length === 0) {
		logger("No named profiles found in wp-env-bin/site-configs/.");
		logger("Run `wp-env-bin config install` or `wp-env-bin config update` and save a profile to get started.");
		return;
	}

	const { select } = await import("@inquirer/prompts");

	const chosen = await select({
		message: "Switch to which site config?",
		choices: profiles.map(p => ({ name: p, value: p })),
	});

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

	logger("\nSwitched to " + chosen + ". Run `wp-env-bin setup` to install dependencies.");
}

module.exports = { configInstall, configUpdate, configSwitch };
