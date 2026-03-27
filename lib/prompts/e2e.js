"use strict";

const { initE2e, getE2eDefaults } = require("../../commands/e2e");

async function handleE2eScaffold() {
	const { select, input } = await import("@inquirer/prompts");
	const { projectType: defaultType, pluginName: defaultSlug, e2eConfig } = getE2eDefaults();

	const projectType = await select({
		message: "Is this project a plugin or a theme?",
		choices: [
			{ name: "Plugin", value: "plugin" },
			{ name: "Theme", value: "theme" },
		],
		default: defaultType,
	});

	const slug = await input({
		message: projectType === "plugin" ? "Plugin slug (used in wp plugin activate)" : "Theme slug (used in wp theme activate)",
		default: defaultSlug,
	});

	let testTheme = e2eConfig.testTheme;
	if (projectType === "plugin") {
		testTheme = await input({
			message: "Theme to activate during tests",
			default: e2eConfig.testTheme,
		});
	}

	const wpVersion = await input({
		message: "WordPress version",
		default: e2eConfig.wpVersion,
	});

	const phpVersion = await input({
		message: "PHP version",
		default: e2eConfig.phpVersion,
	});

	const port = await input({
		message: "wp-env development port for e2e environment (must differ from your dev env, default 8889)",
		default: e2eConfig.port,
	});

	initE2e({ projectType, slug, testTheme, wpVersion, phpVersion, port });
}

module.exports = { handleE2eScaffold };
