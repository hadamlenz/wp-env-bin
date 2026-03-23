const { readFileSync, existsSync } = require("fs");
const path = require("path");
const { wpcli } = require("./utils/run");

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

module.exports = { readComposerPlugins, getInactiveComposerPlugins };
