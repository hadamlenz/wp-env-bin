const { readFileSync, existsSync } = require("fs");
const path = require("path");
const { wpcli } = require("./run");
const { logger } = require("./log");

/**
 * Read the list of plugin slugs declared in wp-env-bin/composer.json
 * (from both `require` and `require-dev`).
 * Returns an empty array if composer.json is missing.
 *
 * @returns {string[]} Array of plugin slug strings (e.g. `['my-plugin', 'another-plugin']`)
 */
function readComposerPlugins() {
	const composerPath = path.join(process.cwd(), "wp-env-bin/composer.json");
	if (!existsSync(composerPath)) return [];
	const composer = JSON.parse(readFileSync(composerPath, "utf8"));
	const packages = { ...composer.require, ...composer["require-dev"] };
	return Object.keys(packages)
		.filter((name) => name.includes("/"))
		.map((name) => name.split("/")[1]);
}

/**
 * Query the local WordPress environment for plugins that are listed in composer.json
 * but currently inactive.
 *
 * @param {string[]} composerSlugs - Plugin slugs from composer.json
 * @returns {string[]} Slugs of plugins that are installed but inactive
 */
function getInactiveComposerPlugins(composerSlugs) {
	const output = wpcli("wp plugin list --format=json", { stdio: "pipe" });
	const plugins = JSON.parse(output.toString());
	return plugins
		.filter((p) => p.status === "inactive" && composerSlugs.includes(p.name))
		.map((p) => p.name);
}

/**
 * Check for inactive composer plugins in the local WordPress environment and
 * prompt the user to activate them.
 *
 * @returns {Promise<void>}
 */
async function activateComposerPlugins() {
	const composerSlugs = readComposerPlugins();
	if (composerSlugs.length === 0) return;

	const inactivePlugins = getInactiveComposerPlugins(composerSlugs);

	if (inactivePlugins.length === 0) {
		logger("> all composer plugins are already active.");
		return;
	}

	const { select } = await import("@inquirer/prompts");
	const action = await select({
		message: `These composer plugins are inactive: ${inactivePlugins.join(", ")}. Activate them now?`,
		choices: [
			{ name: "Yes, activate all", value: "yes" },
			{ name: "No, skip", value: "no" },
		],
	});

	if (action === "yes") {
		wpcli("wp plugin activate " + inactivePlugins.join(" "));
		logger("> activated: " + inactivePlugins.join(", "));
	}
}

module.exports = { activateComposerPlugins };
