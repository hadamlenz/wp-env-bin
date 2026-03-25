const { wpcli } = require("../lib/utils/run");
const { logger } = require("../lib/utils/log");
const { readComposerPlugins, getInactiveComposerPlugins } = require("../lib/plugins");

/**
 * Return the list of composer-managed plugins that are currently inactive in
 * the local WordPress environment. Returns an empty array when all plugins are
 * active or there are no composer-managed plugins. Used by the bin to build
 * the activation prompt.
 *
 * @returns {string[]}
 */
function getInactivePlugins() {
	const composerSlugs = readComposerPlugins();
	if (composerSlugs.length === 0) return [];
	return getInactiveComposerPlugins(composerSlugs);
}

/**
 * Activate the given list of plugins in the local WordPress environment via
 * WP-CLI. No interactive prompts — the caller decides which plugins to activate.
 *
 * @param {string[]} pluginsToActivate - List of plugin slugs to activate
 * @returns {void}
 */
function activateComposerPlugins(pluginsToActivate) {
	if (!pluginsToActivate || pluginsToActivate.length === 0) return;
	wpcli("wp plugin activate " + pluginsToActivate.join(" "));
	logger("> activated: " + pluginsToActivate.join(", "));
}

module.exports = { getInactivePlugins, activateComposerPlugins };
