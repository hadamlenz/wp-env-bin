const { readFileSync, existsSync } = require("fs");
const path = require("path");
const { wpcli } = require("./run");
const { logger } = require("./log");

function readComposerPlugins() {
	const composerPath = path.join(process.cwd(), "wp-env-bin/composer.json");
	if (!existsSync(composerPath)) return [];
	const composer = JSON.parse(readFileSync(composerPath, "utf8"));
	const packages = { ...composer.require, ...composer["require-dev"] };
	return Object.keys(packages)
		.filter((name) => name.includes("/"))
		.map((name) => name.split("/")[1]);
}

function getInactiveComposerPlugins(composerSlugs) {
	const output = wpcli("wp plugin list --format=json", { stdio: "pipe" });
	const plugins = JSON.parse(output.toString());
	return plugins
		.filter((p) => p.status === "inactive" && composerSlugs.includes(p.name))
		.map((p) => p.name);
}

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
