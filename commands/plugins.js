const { wpcli } = require("../lib/run");
const { logger } = require("../lib/log");
const { readComposerPlugins, getInactiveComposerPlugins } = require("../lib/plugins");

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
