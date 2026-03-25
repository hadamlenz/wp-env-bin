"use strict";

const { terminus_wp } = require("./utils/run");

/**
 * Cross-reference active WordPress plugin paths against a server composer.json.
 * Maps folder name (from plugin file path) to the Composer package whose
 * name second-segment matches — e.g., "gravityforms/gravityforms.php" →
 * folder "gravityforms" → matches package "gravity/gravityforms".
 *
 * @param {string[]} activePaths    - e.g. ["gravityforms/gravityforms.php", "akismet/akismet.php"]
 * @param {object}   serverComposer - parsed server composer.json object
 * @returns {{ matched: object, unmatched: string[] }}
 *   matched  — { "gravity/gravityforms": "^2.9", ... }  package→version for matched active plugins
 *   unmatched — folder names with no match in server composer.json (e.g. manually uploaded plugins)
 */
function matchActivePlugins(activePaths, serverComposer) {
	const allPackages = {
		...((serverComposer && serverComposer.require) || {}),
		...((serverComposer && serverComposer["require-dev"]) || {}),
	};

	const matched = {};
	const unmatched = [];
	const seenFolders = new Set();

	for (const filePath of activePaths) {
		const folder = filePath.split("/")[0];
		if (seenFolders.has(folder)) continue;
		seenFolders.add(folder);

		const pkg = Object.keys(allPackages).find(p => p.split("/")[1] === folder);
		if (pkg) {
			matched[pkg] = allPackages[pkg];
		} else {
			unmatched.push(folder);
		}
	}

	return { matched, unmatched };
}

/**
 * Build a local composer.json object from matched packages and server repositories.
 * Repositories are carried over from the server as-is — they already contain the
 * correct private repo URLs, wpackagist, VCS entries, etc.
 *
 * @param {object}      matched      - { "vendor/package": "version", ... } from matchActivePlugins
 * @param {object[]|null} repositories - repositories array from the server's composer.json
 * @param {object|null} themeMatched - { "vendor/theme": "*" } or null when no theme matched
 * @returns {object} A composer.json-compatible object
 */
function buildComposerJson(matched, repositories, themeMatched) {
	const requireDev = { ...matched, ...(themeMatched || {}) };

	return {
		name: "hadamlenz/wp-env-bin",
		"require-dev": requireDev,
		repositories: repositories || [],
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
}

/**
 * Fetch active plugin paths, active theme slug, and the server's composer.json
 * from a remote Pantheon site via two Terminus WP-CLI eval calls.
 *
 * @param {string} env          - Pantheon site.environment (e.g. "mysite.live")
 * @param {string} url          - Site URL passed as --url to WP-CLI
 * @param {string} composerPath - Absolute path to composer.json on the server (e.g. "/code/composer.json")
 * @returns {{ activePaths: string[], themeSlug: string, serverComposer: object }}
 */
function fetchRemoteData(env, url, composerPath) {
	// Call 1: active plugin file paths + active theme slug
	const phpActivePlugins = [
		'$s=get_option("active_plugins",[]);',
		'$n=is_multisite()?array_keys(get_site_option("active_sitewide_plugins",[])):[];',
		'echo json_encode(["plugins"=>array_unique(array_merge($s,$n)),"theme"=>get_stylesheet()]);',
	].join("");

	const wpDataRaw = terminus_wp(
		env,
		"eval '" + phpActivePlugins + "' --url=" + url,
		{ encoding: "utf8", stdio: "pipe" }
	);
	const wpData = JSON.parse(wpDataRaw);

	// Call 2: server's composer.json contents
	const serverComposerRaw = terminus_wp(
		env,
		"eval-file " + composerPath,
		{ encoding: "utf8", stdio: "pipe" }
	);
	const serverComposer = JSON.parse(serverComposerRaw);

	return {
		activePaths: wpData.plugins || [],
		themeSlug: wpData.theme || null,
		serverComposer,
	};
}

module.exports = { matchActivePlugins, buildComposerJson, fetchRemoteData };
