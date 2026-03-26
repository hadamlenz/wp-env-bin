"use strict";

const path = require("path");
const fs = require("fs");
const { run } = require("../lib/utils/run");
const { logger } = require("../lib/utils/log");
const { matchActivePlugins, buildComposerJson } = require("../lib/remote-composer");

const BLANK_COMPOSER = {
	name: "hadamlenz/wp-env-bin",
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

const PLUGIN_FILES = ["wp-env-bin-plugin.php", "classes/class-service-worker.php"];

function ensureWpEnvBinPlugin(composerDir) {
	const pluginSrc = path.join(__dirname, "../scaffold/plugins/wp-env-bin-plugin");
	const pluginDest = path.join(composerDir, "plugins/wp-env-bin-plugin");
	fs.mkdirSync(path.join(pluginDest, "classes"), { recursive: true });
	for (const file of PLUGIN_FILES) {
		fs.copyFileSync(path.join(pluginSrc, file), path.join(pluginDest, file));
	}
	logger("> ensured wp-env-bin-plugin is present.");
}

/**
 * Cross-reference active WordPress plugins against a server composer.json,
 * build the local composer.json, and save it as the profile's companion file
 * in site-configs/.
 *
 * @param {string}      profileName    - Profile name (e.g. "example.com")
 * @param {string[]}    activePaths    - Active plugin file paths from WordPress
 * @param {string|null} themeSlug      - Active theme slug
 * @param {object}      serverComposer - Parsed server composer.json
 * @returns {{ composerJson: object, matched: object, unmatched: string[], themePkg: string|null }}
 */
function composerGet(profileName, activePaths, themeSlug, serverComposer) {
	const { matched, unmatched } = matchActivePlugins(activePaths, serverComposer);

	const allServerPkgs = {
		...((serverComposer && serverComposer.require) || {}),
		...((serverComposer && serverComposer["require-dev"]) || {}),
	};
	const themePkg = themeSlug
		? Object.keys(allServerPkgs).find(p => p.split("/")[1] === themeSlug) || null
		: null;

	const composerJson = buildComposerJson(
		matched,
		serverComposer.repositories || [],
		themePkg ? { [themePkg]: "*" } : null
	);

	const dest = path.join(process.cwd(), "wp-env-bin");
	fs.mkdirSync(path.join(dest, "site-configs"), { recursive: true });
	const outPath = path.join(dest, "site-configs", profileName + ".composer.json");
	fs.writeFileSync(outPath, JSON.stringify(composerJson, null, 4), "utf8");
	logger("> saved site-configs/" + profileName + ".composer.json");

	return { composerJson, matched, unmatched, themePkg };
}

/**
 * Create a blank companion composer.json for the given profile in site-configs/.
 *
 * @param {string} profileName - Profile name (e.g. "example.com")
 * @returns {void}
 */
function composerMake(profileName) {
	const dest = path.join(process.cwd(), "wp-env-bin");
	fs.mkdirSync(path.join(dest, "site-configs"), { recursive: true });
	const outPath = path.join(dest, "site-configs", profileName + ".composer.json");
	fs.writeFileSync(outPath, JSON.stringify(BLANK_COMPOSER, null, 4), "utf8");
	logger("> created blank site-configs/" + profileName + ".composer.json");
}

/**
 * Run `composer update` in wp-env-bin/, then restore wp-env-bin-plugin.
 *
 * @returns {void}
 */
function composerUpdate() {
	const composerDir = path.join(process.cwd(), "wp-env-bin");
	logger("> running composer update in " + composerDir + "...");
	run("composer update", { cwd: composerDir, stdio: "inherit" });
	logger("> composer update complete.");
	ensureWpEnvBinPlugin(composerDir);
}

/**
 * Run `composer install` in wp-env-bin/e2e/.
 *
 * @returns {void}
 */
function composerE2eInstall() {
	const e2eDir = path.join(process.cwd(), "wp-env-bin", "e2e");
	if (!fs.existsSync(path.join(e2eDir, "composer.json"))) {
		logger("No composer.json found in wp-env-bin/e2e/. Run `wp-env-bin e2e init` first, then copy composer.json.example to composer.json.");
		process.exit(1);
	}
	logger("> running composer install in " + e2eDir + "...");
	run("composer install", { cwd: e2eDir, stdio: "inherit" });
	logger("> composer install complete.");
}

/**
 * Run `composer update` in wp-env-bin/e2e/.
 *
 * @returns {void}
 */
function composerE2eUpdate() {
	const e2eDir = path.join(process.cwd(), "wp-env-bin", "e2e");
	if (!fs.existsSync(path.join(e2eDir, "composer.json"))) {
		logger("No composer.json found in wp-env-bin/e2e/. Run `wp-env-bin e2e init` first, then copy composer.json.example to composer.json.");
		process.exit(1);
	}
	logger("> running composer update in " + e2eDir + "...");
	run("composer update", { cwd: e2eDir, stdio: "inherit" });
	logger("> composer update complete.");
}

module.exports = { composerGet, composerMake, composerUpdate, composerE2eInstall, composerE2eUpdate };
